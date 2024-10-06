const express = require('express');
const multer = require('multer');
const Post = require('../models/Post');
const app = express();
const fs = require('fs');
const User = require('../models/User')
const admin = require('firebase-admin');
const Notification = require('../models/Notification');
const Booking = require('../models/Booking')
const AcceptedBooking = require('../models/AcceptedBooking')
const authenticateToken = require('../authToken');
app.use(express.json())

const serviceAccount = require("../serviceAccountKey.json"); // Replace with your actual key file

const bucket = admin.storage().bucket();
const upload = multer({ dest: 'temp/' });

app.get('/myPostRequests', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Check if the post belongs to the authenticated user
        const userPosts = await Post.find({ userId });

        // Fetch all booking requests for the user's posts
        const postIds = userPosts.map(post => post._id);
        const postRequests = await Booking.find({ postId: { $in: postIds }, showUser: true })
            .populate('customerId')
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'Success',
            data: postRequests,
        });
    } catch (error) {
        console.error('Error fetching post requests:', error);
        res.status(500).json({
            status: 'Failure',
            message: 'Failed to fetch post requests',
            error: error.message,
        });
    }
});

app.delete('/delete', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
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
    } catch (error) {
        // Handle errors
        return res.status(500).json({ status: 'failure', message: 'Failed to delete user', error: error.message });
    }
});

app.post('/post', authenticateToken, upload.fields([
    { name: 'property_document', maxCount: Infinity },
    { name: 'images', maxCount: Infinity },
]), async (req, res) => {
    try {
        const { title, description, longitude, latitude, monthlyRent, property_type, totalBedrooms,
            totalBathrooms, houseRules, initialDeposit, males, females, preferredGender,
            preferredAge, amenities, propertySize, startDate,
            endDate, bedType, prefferedStatus, billInclude } = req.body;
        // if (!title || !description || !monthlyRent || !property_type) {
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
            totalBathrooms, houseRules, initialDeposit,
            flatMates, preferredGender,
            preferredAge, amenities, propertySize, startDate,
            endDate, bedType, prefferedStatus, billInclude, status: "active"
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
        const notification = new Notification({
            title: "Post Created",
            userId,
            message: 'Your post has been created and is live!'
        })
        await notification.save()

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
// Assuming you have the necessary imports and setup for your routes
// Update Post route
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

        // Update the post fields
        const males = req.body.males
        const females = req.body.females
        const flatMates = {};

        if (typeof males !== 'null' && males !== '') {
            flatMates.males = males;
        }

        if (typeof females !== 'undefined' && females !== '') {
            flatMates.females = females;
        }

        if (req.body.title) {
            existingPost.title = req.body.title;
        }
        if (req.body.billInclude) {
            existingPost.billInclude = req.body.billInclude;
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
        if (req.body.preferredAge) {
            existingPost.preferredAge = req.body.preferredAge;
        }
        if (req.body.preferredGender && ['male', 'female', 'non-binary', "any"].includes(req.body.preferredGender)) {
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

app.get('/post/getAllPosts', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter

        const postsPerPage = 10;
        const totalPosts = await Post.countDocuments({ userId, status: { $in: ["active", "paused"] } }); // Get the total number of posts for the user
        const totalPages = Math.ceil(totalPosts / postsPerPage); // Calculate the total number of pages

        const skip = (page - 1) * postsPerPage; // Calculate the number of posts to skip based on the current page

        // Fetch the posts for the specified page
        const posts = await Post.find({ userId, status: { $in: ["active", "paused"] } }).skip(skip).limit(postsPerPage).populate('userId');

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

app.get('/post/:postId', authenticateToken, async (req, res) => {
    try {
        const postId = req.params.postId;
        const userId = req.user.id;

        // Check if the post with the given postId exists and belongs to the authenticated user
        const post = await Post.findOne({ _id: postId, userId }).populate('userId');

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

app.put('/acceptBooking/:bookingId', authenticateToken, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId)
        if (!booking) {
            return res.status(409).json({
                status: 'Failure',
                message: 'Booking not found',
            });
        }
        if (booking.status == 'accepted') {
            return res.status(409).json({
                status: 'Failure',
                message: 'Booking already accepted',
            });
        }
        const post = await Post.findById(booking.postId)
        console.log(post.userId);
        console.log(req.user.id);
        if (post.userId == req.user.id) {
            console.log("object");
            booking.status = 'accepted';
            await Booking.updateMany(
                { postId: booking.postId, _id: { $ne: booking._id } },
                { $set: { status: 'rented out' } }
            )
        } else {
            return res.json({
                status: "Failure",
                message: "Invalid user !!"
            })
        }
        const userPost = await Post.findById(booking.postId)
        userPost.isBooked = true;
        await booking.save()
        await userPost.save()
        const user = await User.findById(req.user.id)
        const notification = new Notification({
            title: "Booking request accepted",
            userId: booking.customerId,
            message: `${user.fullName} accepted your booking request against the ad '${userPost.title}`
        })
        await notification.save()

        const accepted = await new AcceptedBooking({
            postId: booking.postId,
            customerId: booking.customerId,
            startDate: booking.startDate,
            endDate: booking.endDate,
            status: booking.status
        })
        await accepted.save()
        res.json({
            status: "Success",
            message: "Booking Accepted Successfully!!"
        })
    } catch (error) {
        return res.status(500).json({ status: 'Failure', message: 'Failed to accept booking request', error: error.message });
    }
})

app.put('/rejectBooking/:bookingId', authenticateToken, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId)
        if (!booking) {
            return res.status(409).json({
                status: 'Failure',
                message: 'Booking not found',
            });
        }
        const post = await Post.findById(booking.postId)
        console.log(post.userId);
        console.log(req.user.id);
        if (post.userId == req.user.id) {
            if (booking.status == 'accepted') {
                return res.json({
                    status: "Failure",
                    message: "Accepted bookings can't be rejected!"
                })
            }
            booking.status = 'rejected';
            await booking.save()
            const user = await User.findById(req.user.id)
            const notification = new Notification({
                userId: booking.customerId,
                message: `${user.fullName} rejected your booking request against the ad titled '${post.title}`
            })
            await notification.save()
        } else {
            return res.json({
                statua: "Success",
                message: "Cannot reject other user's posts!!"
            })
        }
        res.json({
            statua: "Success",
            message: "Booking Rejected Successfully!!"
        })
    } catch (error) {
        return res.status(500).json({ status: 'Failure', message: 'Failed to reject booking request', error: error.message });
    }
})

app.put('/allRequests/:bookingId', authenticateToken, async (req, res) => {
    try {
        const bookingId = req.params.bookingId;
        const booking = await Booking.findOne({ _id: bookingId, showUser: true });
        if (!booking) {
            return res.status(404).json({
                status: 'Failure',
                message: 'Booking not found',
            });
        }
        booking.showUser = false;
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

app.delete('/pausePost/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({
                status: 'Failure',
                message: 'Post not found',
            });
        }

        // Toggle the status between 'active' and 'paused'
        post.status = post.status === 'active' ? 'paused' : 'active';

        await post.save();

        const statusMessage =
            post.status === 'active'
                ? 'Post is now active'
                : 'Post is now paused';

        return res.status(200).json({
            status: 'Success',
            message: statusMessage,
        });
    } catch (error) {
        return res.status(500).json({
            status: 'Failure',
            error: error.message,
        });
    }
});


module.exports = app;