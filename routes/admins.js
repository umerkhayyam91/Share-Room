const express = require('express');
const app = express();
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Post = require('../models/Post');
const Booking = require('../models/Booking')
const AcceptedBooking = require('../models/AcceptedBooking')
const Notification = require('../models/Notification')
require('dotenv').config();
const multer = require('multer');
const authenticateToken = require('../authToken');
const admin = require('firebase-admin');
const Contact = require('../models/Contact')
const fs = require('fs');
app.use(express.json());

const serviceAccount = require("../serviceAccountKey.json"); // Replace with your actual key file

const bucket = admin.storage().bucket();
const upload = multer({ dest: 'temp/' });

app.post('/signup', authenticateToken, async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) {
            return res.status(401).json({
                status: "failure",
                message: 'Please enter the required credentials'
            });
        }


        if (password.length < 8) {
            return res.json({
                'status': 'failure',
                'message': 'Password must be at least 8 characters long',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            fullName,
            email,
            password: hashedPassword,
            role: "admin"
        });

        await user.save();
        return res.json({
            'status': 'Success',
            'message': "Account created successfully!",
        });

    } catch (error) {
        return res.json({
            'status': 'failure',
            'message': error.message,
        });
    }
});

app.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
        const usersPerPage = 10;
        const totalUsers = await User.countDocuments(); // Get the total number of posts for the user
        const totalPages = Math.ceil(totalUsers / usersPerPage); // Calculate the total number of pages

        const skip = (page - 1) * usersPerPage; // Calculate the number of posts to skip based on the current page

        // Fetch the posts for the specified page
        const users = await User.find().skip(skip).limit(usersPerPage);

        let previousPage = page > 1 ? page - 1 : null;
        let nextPage = page < totalPages ? page + 1 : null;

        res.json({
            status: true,
            message: "Below are all the users",
            users: users,
            previousPage: previousPage,
            nextPage: nextPage
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Failed to fetch users",
            error: error.message
        });
    }
});

app.post('/post', authenticateToken, upload.fields([
    { name: 'property_document', maxCount: Infinity },
    { name: 'images', maxCount: Infinity },
]), async (req, res) => {
    try {
        // console.log(req.file);
        // console.log(req.files);
        const { title, description, longitude, latitude, monthlyRent, property_type, totalBedrooms,
            totalBathrooms, houseRules, initialDeposit, males, females, preferredGender,
            preferredAge, status, amenities, propertySize, startDate,
            endDate, bedType, prefferedStatus, billInclude } = req.body;
        // if (!title || !description || !longitude || !latitude || !monthlyRent || !property_type) {
        //     return res.status(401).json({
        //         status: "failure",
        //         message: 'Please enter the required credentials'
        //     });
        // }
        const userId = req.user.id;

        // const isSingleFileUpload = req.files['property_document'] !== undefined && req.files['property_document'].length > 0;
        const isMultipleFileUpload = req.files['images'] !== undefined && req.files['images'].length > 0;

        if (property_type && !['shared room', 'separate room', 'entire property'].includes(property_type)) {
            return res.json({
                'status': 'failure',
                'message': 'Invalid property type!!',
            });
        }

        if (bedType && !['single bed', 'double bed', "sofa bed", "no bed"].includes(bedType)) {
            return res.json({
                'status': 'failure',
                'message': 'Invalid bedtype!!',
            });
        }
        if (preferredGender && !['male', 'female', 'non-binary', "any"].includes(preferredGender)) {
            return res.json({
                'status': 'failure',
                'message': 'Invalid gender!!',
            });
        }
        if (prefferedStatus && !['student', 'working', "any"].includes(prefferedStatus)) {
            return res.json({
                'status': 'failure',
                'message': 'Invalid status!!',
            });
        }
        // if (isSingleFileUpload) {
        //     if (req.files['property_document'].length > 1) {
        //         return res.json({
        //             'status': 'failure',
        //             'message': 'Please attach one file only',
        //         });
        //     }
        //     const propertyDocumentFile = req.files['property_document'][0];
        //     const allowedImgExt = ["pdf"];
        //     const fileExten = propertyDocumentFile.originalname.split(".").pop().toLowerCase();
        //     if (!allowedImgExt.includes(fileExten)) {
        //         return res.json({
        //             status: "failure",
        //             message: "invalid extension, only pdf allowed for 'property_document"
        //         });
        //     }
        // }

        if (isMultipleFileUpload) {
            const imagesFiles = req.files['images'];
            const allowedDocExt = ["jpg", "png", "jpeg", "mp4", "avi", "mkv", "mov"];
            for (const imageFile of imagesFiles) {
                const fileExten = imageFile.originalname.split('.').pop().toLowerCase();
                if (!allowedDocExt.includes(fileExten)) {
                    return res.json({
                        status: "failure",
                        message: "Invalid extension! Only jpg , png , jpeg, mp4, avi, mkv and mov allowed for 'images/videos'"
                    });
                }
            }
        }
        //  else {
        //     return res.json({
        //         status: "failure",
        //         message: "Please attach residence images/videos"
        //     });
        // }

        const flatMates = {};

        if (typeof males !== 'null' && males !== '') {
            flatMates.males = males;
        }

        if (typeof females !== 'undefined' && females !== '') {
            flatMates.females = females;
        }

        const newPoster = new Post({
            userId,
            title, description,
            location: {
                longitude,
                latitude
            },
            monthlyRent, property_type, totalBedrooms,
            totalBathrooms, houseRules, initialDeposit, flatMates, preferredGender,
            preferredAge, status, amenities, propertySize, startDate,
            endDate, bedType,billInclude, prefferedStatus, isVerified: true, status: "active"
        });
        await newPoster.save();
        // if (isSingleFileUpload) {
        //     const propertyDocumentFile = req.files['property_document'][0];
        //     const file = fs.readFileSync(propertyDocumentFile.path);
        //     const imageRef = bucket.file(`property_documents/${userId}/${propertyDocumentFile.originalname}`);

        //     await new Promise((resolve, reject) => {
        //         bucket.upload(propertyDocumentFile.path, {
        //             destination: imageRef,
        //             metadata: {
        //                 contentType: propertyDocumentFile.mimetype,
        //             },
        //         })
        //             .then(() => {
        //                 fs.unlinkSync(propertyDocumentFile.path);
        //                 resolve();
        //             })
        //             .catch((error) => {
        //                 console.error('Error uploading property_document:', error);
        //                 reject(error);
        //             });
        //     });

        //     // Get the public URL of the uploaded document
        //     const documentUrl = await imageRef.getSignedUrl({
        //         action: 'read',
        //         expires: '01-01-3000',
        //     });

        //     // Update the property_document URL in the newPoster object
        //     newPoster.property_document = documentUrl[0];
        // }

        const imagesFiles = req.files['images']
        // Wait for all image uploads to complete
        await Promise.all(
            imagesFiles.map((imageFile) =>
                new Promise((resolve, reject) => {
                    const imageRef = bucket.file(`residence_images/${userId}/${imageFile.originalname}`);
                    bucket.upload(imageFile.path, {
                        destination: imageRef,
                        metadata: {
                            contentType: imageFile.mimetype
                        },
                    })
                        .then(() => {
                            fs.unlinkSync(imageFile.path);
                            // Get the public URL of the uploaded image
                            return imageRef.getSignedUrl({
                                action: 'read',
                                expires: '01-01-3000',
                            });
                        })
                        .then((signedUrls) => {
                            // Add the image URL to the 'images' array in the newPoster object
                            newPoster.images.push(signedUrls[0]);
                            resolve();
                        })
                        .catch((error) => {
                            console.error('Error uploading an image:', error);
                            reject(error);
                        });
                })
            )
        );

        // Save the newPoster object to the database
        await newPoster.save();

        // Now the newPoster object is saved with the 'images' and 'property_document' URLs
        // Send the response with the newPoster object
        return res.status(200).json({ newPoster });

    } catch (error) {
        // Handle errors
        return res.json({
            'status': 'failure',
            'message': error.message,
        });
    }
});

app.put('/post/:postId', authenticateToken, upload.fields([
    { name: 'property_document', maxCount: Infinity },
    { name: 'images', maxCount: Infinity },
]), async (req, res) => {
    try {
        const postId = req.params.postId;
        const userId = req.user.id;

        // Check if the post with the given postId exists and belongs to the authenticated user
        const existingPost = await Post.findOne({ _id: postId, userId });

        if (!existingPost) {
            return res.status(404).json({ status: 'failure', message: 'Post not found' });
        }
        // if (req.files != undefined) {
        //     if (req.files['property_document'] && req.files['property_document'].length > 1) {
        //         return res.json({
        //             'status': 'failure',
        //             'message': 'Please attach one file only',
        //         });
        //     }
        // }

        const males = req.body.males
        const females = req.body.females
        const flatMates = {};

        if (typeof males !== 'null' && males !== '') {
            flatMates.males = males;
        }

        if (typeof females !== 'undefined' && females !== '') {
            flatMates.females = females;
        }

        // Update the post fields
        if (req.body.title) {
            existingPost.title = req.body.title;
        }
        if (req.body.billInclude) {
            existingPost.billInclude = req.body.billInclude;
        }
        if (req.body.isVerified) {
            existingPost.isVerified = req.body.isVerified;
        }
        if (flatMates.males | flatMates.females) {
            existingPost.flatMates = flatMates;
        }
        if (req.body.startDate) {
            existingPost.startDate = req.body.startDate;
        }
        if (req.body.endDate) {
            existingPost.endDate = req.body.endDate;
        }
        if (req.body.prefferedStatus) {
            existingPost.prefferedStatus = req.body.prefferedStatus;
        }
        if (req.body.description) {
            existingPost.description = req.body.description;
        }
        if (req.body.bedType && ['single bed', 'double bed', "sofa bed", "no bed"].includes(req.body.bedType)) {
            existingPost.bedType = req.body.bedType;
        }
        if (req.body.latitude && req.body.longitude) {
            existingPost.location = {
                longitude: req.body.longitude,
                latitude: req.body.latitude
            };
        }
        if (req.body.monthlyRent) {
            existingPost.monthlyRent = req.body.monthlyRent;
        }
        if (req.body.totalBathrooms) {
            existingPost.totalBathrooms = req.body.totalBathrooms;
        }
        if (req.body.totalBedrooms) {
            existingPost.totalBedrooms = req.body.totalBedrooms;
        }
        if (req.body.houseRules) {
            existingPost.houseRules = req.body.houseRules;
        }
        if (req.body.initialDeposit) {
            existingPost.initialDeposit = req.body.initialDeposit;
        }
        if (req.body.preferredGender && ['male', 'female', 'non-binary', "any"].includes(req.body.preferredGender)) {
            existingPost.preferredGender = req.body.preferredGender;
        }
        if (req.body.preferredGender) {
            existingPost.preferredGender = req.body.preferredGender;
        }
        if (req.body.status) {
            existingPost.status = req.body.status;
        }
        if (req.body.amenities) {
            existingPost.amenities = req.body.amenities;
        }
        if (req.body.propertySize) {
            existingPost.propertySize = req.body.propertySize;
        }
        if (req.body.property_type && ['shared room', 'separate room', 'entire property'].includes(req.body.property_type)) {
            existingPost.property_type = req.body.property_type;
        }

        // Handle property_document update
        // if (req.files != undefined) {
        //     if (req.files['property_document'] && req.files['property_document'].length > 0) {
        //         const propertyDocumentFile = req.files['property_document'][0];
        //         const allowedImgExt = ["pdf"];
        //         const fileExten = propertyDocumentFile.originalname.split(".").pop().toLowerCase();
        //         if (!allowedImgExt.includes(fileExten)) {
        //             throw new Error("Invalid extension, only pdf allowed for 'property_document'");
        //         }

        //         // Upload new property document to the cloud storage
        //         const file = fs.readFileSync(propertyDocumentFile.path);
        //         const imageRef = bucket.file(`property_documents/${userId}/${propertyDocumentFile.originalname}`);

        //         await bucket.upload(propertyDocumentFile.path, {
        //             destination: imageRef,
        //             metadata: {
        //                 contentType: propertyDocumentFile.mimetype,
        //             },
        //         });

        //         // Get the public URL of the uploaded document
        //         const documentUrl = await imageRef.getSignedUrl({
        //             action: 'read',
        //             expires: '01-01-3000', // Set an expiration date if needed
        //         });

        //         existingPost.property_document = documentUrl[0];
        //     }
        // }

        // Handle images update
        if (req.files != undefined) {
            if (req.files['images'] && req.files['images'].length > 0) {
                const imagesFiles = req.files['images'];
                const allowedDocExt = ["jpg", "png", "jpeg", "mp4", "avi", "mkv", "mov"];
                for (const imageFile of imagesFiles) {
                    const fileExten = imageFile.originalname.split('.').pop().toLowerCase();
                    if (!allowedDocExt.includes(fileExten)) {
                        throw new Error("Invalid extension! Only jpg , png , jpeg, mp4, avi, mkv and mov allowed for 'images/videos'");
                    }
                }


                // Clear the existing image URLs in the 'images' array
                existingPost.images = [];

                // Upload images and get public URLs
                const imageUploadPromises = imagesFiles.map(async (imageFile) => {
                    const file = fs.readFileSync(imageFile.path);
                    const imageRef = bucket.file(`residence_images/${userId}/${imageFile.originalname}`);

                    await bucket.upload(imageFile.path, {
                        destination: imageRef,
                        metadata: {
                            contentType: imageFile.mimetype,
                        },
                    });

                    // Get the public URL of the uploaded image
                    const imageUrl = await imageRef.getSignedUrl({
                        action: 'read',
                        expires: '01-01-3000', // Set an expiration date if needed
                    });

                    return imageUrl[0];
                });

                // Wait for all images to be uploaded and get public URLs
                existingPost.images = await Promise.all(imageUploadPromises);
            }
        }

        // Save the updated post to the database
        await existingPost.save();

        return res.status(200).json({ status: 'success', post: existingPost });

    } catch (error) {
        // Handle errors
        return res.status(500).json({ status: 'failure', message: 'Failed to update post', error: error.message });
    }
});

app.get('/post/getAllPosts', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter

        const postsPerPage = 10;
        const totalPosts = await Post.countDocuments(); // Get the total number of posts for the user
        const totalPages = Math.ceil(totalPosts / postsPerPage); // Calculate the total number of pages

        const skip = (page - 1) * postsPerPage; // Calculate the number of posts to skip based on the current page

        // Fetch the posts for the specified page
        const posts = await Post.find().skip(skip).limit(postsPerPage).populate('userId');

        let previousPage = page > 1 ? page - 1 : null;
        let nextPage = page < totalPages ? page + 1 : null;

        res.json({
            status: true,
            message: "Below are all of your posts",
            posts: posts,
            previousPage: previousPage,
            nextPage: nextPage
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Failed to fetch posts",
            error: error.message
        });
    }
});

app.get('/contactUs', authenticateToken, async (req, res) => {
    try {
        const latestContact = await Contact.findOne().sort({ createdAt: -1 }).limit(1);
        if (!latestContact) {
            return res.status(404).json({
                status: "Failure",
                message: 'No contact information found.'
            });
        }
        res.status(200).json(latestContact);
    } catch (error) {
        console.error('Error fetching contact information:', error);
        res.status(500).json({ error: 'An error occurred while fetching contact information.' });
    }
})

app.get('/post/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;

        const post = await Post.findOne({ _id: postId }).populate('userId');

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
        return res.status(500).json({ status: 'failure', message: 'Failed to delete post', error: error.message });
    }
});

app.get('/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ status: 'failure', message: 'User not found' });
        }

        return res.status(200).json({
            status: 'success',
            user: user
        });
    } catch (error) {
        return res.status(500).json({ status: 'failure', message: 'Failed to delete user', error: error.message });
    }
});

app.delete('/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        const admin = await User.findById(req.user.id)
        // Check if the post with the given userId exists and belongs to the authenticated user
        const existingUser = await User.findOne({ _id: userId });

        if (!existingUser) {
            return res.status(404).json({ status: 'failure', message: 'user not found' });
        }
        if (existingUser.role == "user") {
            console.log("working");
            const userPosts = await Post.find({ userId });
            const postIds = userPosts.map(post => post._id);
            const bookings = await Booking.find({ postId: { $in: postIds } });
            const customerIds = bookings.map(booking => booking.customerId);
            console.log("working");
            const uniqueNotifications = new Map();

            for (const booking of bookings) {
                const customerId = booking.customerId;
                const postId = booking.postId;

                const post = await Post.findById(postId);
                const postTitle = post.title;

                const key = `${customerId}-${postId}`;
                if (!uniqueNotifications.has(key)) {
                    const notificationMessage = `The post titled "${postTitle}" that you were interested in has been deleted.`;
                    uniqueNotifications.set(key, notificationMessage);

                    const notification = new Notification({
                        title: "Post Deleted",
                        userId: customerId,
                        message: notificationMessage
                    });
                    await notification.save();
                }
            }
            console.log("working");

            await Booking.deleteMany({ postId: { $in: postIds } });
            await AcceptedBooking.deleteMany({ postId: { $in: postIds } });
            await User.findByIdAndDelete(userId)
            await Post.deleteMany({ userId })
            return res.status(200).json({ status: 'success', message: 'User deleted successfully' });
        } else if (existingUser.role == "customer") {
            
            const approvedBookings = await Booking.find({
                customerId: userId,
                status: { $in: ['accepted'] }
            });
            if (approvedBookings) {
                const postIds = approvedBookings.map(booking => booking.postId)
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
            await AcceptedBooking.deleteOne({ customerId: userId });
            await User.findByIdAndDelete(userId)
            return res.status(200).json({ status: 'success', message: 'User deleted successfully' });
        } else if (existingUser.role == "admin" && admin.email == "devopsmarkaz@gmail.com") {
            await User.findByIdAndDelete({ userId })
            await Post.deleteMany({ userId })
            return res.status(200).json({ status: 'success', message: 'User deleted successfully' });
        }

        // Delete the post from the database
    } catch (error) {
        // Handle errors
        return res.status(500).json({ status: 'failure', message: 'Failed to delete user', error: error.message });
    }
});

app.post('/contactUs', authenticateToken, async (req, res) => {
    const { email, phoneNumber } = req.body;
    if (!email || !phoneNumber) {
        return res.status(404).json({ status: 'Failure', message: 'Please enter the required credentials!' });
    }
    const contact = new Contact({
        email,
        phoneNumber
    })
    await contact.save()
    res.json({ status: 'Success', message: 'Contact Us updated successfully!!' });

})

app.delete('/post/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        const post = await Post.findById(postId)
        if (!post || post.status == "deleted") {
            return res.status(404).json({
                status: 'Failure',
                message: 'Post not found',
            });
        }
        await Booking.deleteMany({ postId, status: "pending" })
        post.status = "deleted";
        await post.save()
        return res.status(200).json({ status: 'Success', message: 'Post deleted successfully' });
    } catch (error) {
        return res.status(500).json({
            status: 'Failure',
            message: 'Post deleted successfully',
            error: error.message
        });
    }
})

module.exports = app;