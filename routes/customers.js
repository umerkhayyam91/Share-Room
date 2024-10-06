const express = require('express')
const app = express()
const mongoose = require('mongoose')
const User = require('../models/User')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const AcceptedBooking = require('../models/AcceptedBooking')
const admin = require('firebase-admin');
const authenticateToken = require('../authToken');
const Booking = require('../models/Booking');
require("dotenv").config()
const multer = require('multer');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const fs = require('fs');

const serviceAccount = require("../serviceAccountKey.json");

const bucket = admin.storage().bucket();
const upload = multer({ dest: 'temp/' });

app.get('/allRequests', authenticateToken, async (req, res) => {
    try {
        const customerId = req.user.id; // Get the authenticated user's ID from the middleware

        const customerRequests = await Booking.find({ customerId, showCustomer: true })
            .populate({
                path: 'postId',
                populate: {
                    path: 'userId', // Assuming this is the field in the Post model
                    model: 'User',  // Make sure this matches your User model name
                },
            })
            .sort({ createdAt: -1 });
        // Sort by the booking request's creation date in descending order

        res.status(200).json({
            status: 'Success',
            data: customerRequests,
        });
    } catch (error) {
        console.error('Error fetching customer requests:', error);
        res.status(500).json({
            status: 'Failure',
            message: 'Failed to fetch customer requests',
            error: error.message,
        });
    }
});

app.get('/post/getAllPosts', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter

        const postsPerPage = 10;
        const totalPosts = await Post.countDocuments({ status: "active", isBooked: false }); // Get the total number of posts for the user
        const totalPages = Math.ceil(totalPosts / postsPerPage); // Calculate the total number of pages

        const skip = (page - 1) * postsPerPage; // Calculate the number of posts to skip based on the current page

        // Fetch the posts for the specified page
        const posts = await Post.find({ status: "active", isBooked: false }).skip(skip).limit(postsPerPage).populate('userId');

        let previousPage = page > 1 ? page - 1 : null;
        let nextPage = page < totalPages ? page + 1 : null;

        res.json({
            status: true,
            message: "Below are all the posts",
            posts: posts,
            previousPage: previousPage,
            nextPage: nextPage,
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Failed to fetch posts",
            error: error.message
        });
    }
});

app.delete('/delete', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id
        const approvedBookings = await Booking.find({
            customerId: userId,
            status: { $in: ['accepted'] }
        });
        if (approvedBookings) {
            const postIds = approvedBookings.map(booking => booking.postId);
            for (const postId of postIds) {
                const post = await Post.findById(postId);
                post.status = "paused";
                post.isBooked = false;
                post.requestedIds = [];
                await post.save();
                await Booking.deleteMany({
                    postId
                })
            }
        }

        await Booking.deleteMany({
            customerId: userId
        });
        await AcceptedBooking.deleteMany({ customerId: userId });
        await User.findByIdAndDelete(userId)
        return res.status(200).json({ status: 'success', message: 'User deleted successfully' })
    } catch (error) {
        // Handle errors
        return res.status(500).json({ status: 'failure', message: 'Failed to delete user', error: error.message });
    }
});

app.get('/post/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;

        // Check if the post with the given postId exists and belongs to the authenticated user
        const post = await Post.findOne({ _id: postId, status: { $in: ['active', 'paused'] }, isBooked: false }).populate('userId');

        if (!post) {
            return res.status(404).json({ status: 'failure', message: 'Post not found' });
        }

        // Delete the post from the database
        return res.status(200).json({
            status: 'success',
            message: 'Here is your post',
            post: post
        });
    } catch (error) {
        // Handle errors
        return res.status(500).json({ status: 'failure', message: 'Failed to fetch post', error: error.message });
    }
});

app.post('/booking/:postId', authenticateToken, async (req, res) => {
    try {
        const postId = req.params.postId;
        const customerId = req.user.id;
        const { startDate, endDate } = req.body

        const adExists = await Post.findById(postId);
        if (!adExists) {
            return res.status(404).json({
                status: 'Failure',
                message: 'Ad not found'
            });
        }

        // Check if the ad is already booked
        const isAdBooked = await Booking.exists({ postId: postId, status: 'accepted' });
        if (isAdBooked) {
            return res.status(409).json({
                status: 'Failure',
                message: 'Ad is already booked',
            });
        }

        const isAdSent = await Booking.exists({ postId: postId, customerId: customerId });
        if (isAdSent) {
            return res.status(409).json({
                status: 'Failure',
                message: 'Request already sent',
            });
        }


        // Create a new Booking instance using the Booking model
        const newBooking = new Booking({
            postId,
            customerId,
            startDate,
            endDate
        });
        const post = await Post.findById(postId)
        post.requestedIds.push(customerId);
        await post.save()

        // Save the new booking to the database
        const savedBooking = await newBooking.save();

        const user = await User.findById(customerId)

        const userNotification = new Notification({
            title: "Boooking request received",
            userId: adExists.userId,
            message: `${user.fullName} sent you a booking request against your ad titled '${adExists.title}`
        })
        await userNotification.save()

        const customerNotification = new Notification({
            title: "Boooking request sent",
            userId: customerId,
            message: `Booking request sent against ad titled '${adExists.title}`
        })
        await customerNotification.save()

        res.status(201).json({
            status: 'Success',
            message: 'Ad booked successfully',
        });
    } catch (error) {
        console.error('Error booking ad:', error);
        res.status(500).json({
            status: 'Failure',
            message: 'Failed to book ad',
            error: error.message,
        });
    }
});

app.delete('/booking/:bookingId', authenticateToken, async (req, res) => {
    try {
        const bookingId = req.params.bookingId; // Get the booking ID from the request parameters
        const customerId = req.user.id; // Get the authenticated user's ID from the middleware

        // Check if the booking exists in the database
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                status: 'Failure',
                message: 'Booking not found',
            });
        }
        const postId = booking.postId;


        // Check if the authenticated user is the customer who made the booking
        if (booking.customerId.toString() !== customerId) {
            return res.status(403).json({
                status: 'Failure',
                message: 'You are not authorized to cancel this booking',
            });
        }

        if (booking.status === 'rejected') {
            return res.status(400).json({
                status: 'Failure',
                message: 'Cannot cancel a rejected booking',
            });
        }

        if (booking.status === 'accepted') {
            return res.status(400).json({
                status: 'Failure',
                message: 'Cannot cancel an accepted booking',
            });
        }

        const deleteBooking = await Booking.findByIdAndDelete(bookingId)
        res.status(200).json({
            status: 'Success',
            message: 'Booking request canceled successfully',
        });
        const removeUid = await Post.updateOne(
            { _id: postId }, // Find the post by its ID
            { $pull: { requestedIds: customerId } }
        );

    } catch (error) {
        console.error('Error canceling booking request:', error);
        res.status(500).json({
            status: 'Failure',
            message: 'Failed to cancel booking request',
            error: error.message,
        });
    }
});

app.put('/booking/:bookingId', authenticateToken, async (req, res) => {
    try {
        const bookingId = req.params.bookingId;
        const booking = await Booking.findOne({ _id: bookingId, showCustomer: true });
        if (!booking) {
            return res.status(404).json({
                status: 'Failure',
                message: 'Booking not found',
            });
        }
        if (booking.status == "pending") {
            const deleteBooking = await Booking.findByIdAndDelete(bookingId)
            return res.status(200).json({
                status: 'Success',
                message: 'Deleted from history',
            });
        }
        booking.showCustomer = false;
        await booking.save();
        res.status(200).json({
            status: 'Success',
            message: 'Deleted from history',
        });

    } catch (error) {
        res.status(500).json({
            status: 'Failure',
            message: 'Failed to cancel booking request',
            error: error.message,
        });
    }
})

module.exports = app;