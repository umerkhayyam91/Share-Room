const express = require('express');
const app = express();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const authenticateToken = require('../authToken');
const multer = require('multer');
const Notification = require('../models/Notification')
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const Mailgun = require('mailgun-js');
const apiKey = 'key-de8b1afd256f9e8923165b1d6406942a';
const DOMAIN = 'sandboxa62be9b929c541d4b76dc747dbe77602.mailgun.org';
const mailgun = new Mailgun({ apiKey, domain: DOMAIN });
const twilio = require('twilio');
app.use(express.json());

const resetTokenSchema = new mongoose.Schema({
    token: String,
    email: String,
});

// Create a model for the reset tokens collection
const ResetToken = mongoose.model('ResetToken', resetTokenSchema);

const serviceAccount = require("../serviceAccountKey.json"); // Replace with your actual key file

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "share-room-c2625.appspot.com", // Replace with your actual storage bucket URL
});

const bucket = admin.storage().bucket();
const upload = multer({ dest: 'temp/' })


app.post('/signup', async (req, res) => {
    try {
        const { fullName, email, password, role } = req.body;
        if (!fullName || !email || !password || !role) {
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
            role,
        });

        await user.save();
        res.json({
            'status': 'Success',
            'message': "Account Created Successfully",
        });

    } catch (error) {
        return res.json({
            'status': 'failure',
            'message': error.message,
        });
    }
});


app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(401).json({
            status: "failure",
            message: 'Please enter the required credentials'
        });
    }
    try {
        const users = await User.findOne({ email: { $regex: new RegExp("^" + email.toLowerCase(), "i") } });
        if (!users) {
            return res.status(401).json({
                status: "failure",
                message: 'Invalid email'
            });
        }

        if (await bcrypt.compare(password, users.password)) {
            const id = users.id
            const role = users.role
            const user = { id: id, role: role }
            const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET)
            res.json({ accessToken: accessToken })
        } else {
            res.json({
                'status': 'failure',
                'message': "wrong password",
            });
        }
    } catch (error) {
        res.json({
            'status': 'failure',
            'message': error.message,
        });
    }
});

app.put('/updatePassword/:userId?', async (req, res) => {
    try {
        const { userId } = req.params;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.json({
                'status': 'Failure',
                'message': `Please enter the required credentials`,
            });
            return;
        }
        if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
            res.json({
                'status': 'Failure',
                'message': `Invalid id format`,
            });
            return;
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: 'Failure', message: 'User not found' });
        }
        if (newPassword.length < 8) {
            return res.json({
                'status': 'Failure',
                'message': "Password must be at least 8 characters long",
            });
        }
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ status: 'Failure', message: 'Invalid current password' });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({ status: 'Failure', message: 'New password must be different from the current password' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        await User.updateOne({ _id: userId }, { password: hashedNewPassword }, { runValidators: true });
        const userNotification = new Notification({
            userId,
            message: "Profile updated Successfully"
        })
        await userNotification.save()

        return res.json({ status: 'success', message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ status: 'Failure', message: error.message });
    }
});

app.post('/', async (req, res) => {
    try {
        const userId = req.body.userId;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: 'Failure',
                message: 'User not found',
            });
        }

        res.status(200).json({
            status: 'Failure',
            message: 'Here is your profile',
            profile: user,
        });

    } catch (error) {
        return res.status(500).json({
            status: 'Failure',
            message: 'Failed to fetch profile',
            error: error.message,
        });
    }
});

app.patch('/', upload.single('image'), async (req, res) => {
    const id = req.body.userId;
    const { fullName, date_of_birth, gender, status, language, about, hobbies, longitude, latitude, personal_interests } = req.body;

    if (!fullName && !date_of_birth && !status && !language && !gender && !about && !hobbies && !(longitude && latitude) && !personal_interests && !req.file) {
        return res.status(404).json({
            status: 'Failure',
            message: 'Nothing to update',
        });
    }


    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        res.json({
            'status': 'Failure',
            'message': `Invalid id format`,
        });
        return;
    }

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                status: 'Failure',
                message: 'User not found',
            });
        }

        const updateObject = {};

        if (fullName) {
            updateObject.fullName = fullName;
        }
        if (date_of_birth) {
            updateObject.date_of_birth = date_of_birth;
        }
        if (latitude && longitude) {
            updateObject.location = {
                longitude,
                latitude
            };
        }
        if (gender) {
            updateObject.gender = gender;
        }
        if (about) {
            updateObject.about = about;
        }
        if (hobbies) {
            updateObject.hobbies = hobbies;
        }
        if (status) {
            updateObject.status = status;
        }
        if (language) {
            updateObject.language = language;
        }
        if (personal_interests) {
            updateObject.personal_interests = personal_interests;
        }

        if (req.file) {
            const allowedExtensions = ["jpg", "png", "jpeg"];
            const fileExten = req.file.originalname.split(".").pop().toLowerCase();
            if (!allowedExtensions.includes(fileExten)) {
                return res.json({
                    status: "failure",
                    message: "invalid extension, only jpg, jpeg and png allowed"
                });
            }
            const file = fs.readFileSync(req.file.path);
            const imageRef = bucket.file(`profile_pictures/${id}/${req.file.originalname}`);

            bucket.upload(req.file.path, {
                destination: imageRef,
                metadata: {
                    contentType: req.file.mimetype,
                },
            })
                .then(() => {
                    // Delete the local file after uploading
                    fs.unlinkSync(req.file.path);

                    // Get the public URL of the uploaded image
                    imageRef.getSignedUrl({
                        action: 'read',
                        expires: '01-01-3000', // Set an expiration date if needed
                    })
                        .then((signedUrls) => {
                            const imageUrl = signedUrls[0];
                            updateObject.image = imageUrl
                            User.updateOne({ _id: id }, { $set: updateObject }).exec()
                                .then(() => {
                                    const userNotification = new Notification({
                                        title: "Profile Update",
                                        userId: id,
                                        message: "Profile updated Successfully"
                                    })
                                    userNotification.save()
                                    return res.status(200).json({
                                        message: 'Profile updated successfully',
                                        imageUrl: imageUrl
                                    });
                                })
                                .catch((error) => {
                                    console.error('Error updating user:', error);
                                    return res.status(500).send('Error updating user.');
                                });
                        })
                        .catch((error) => {
                            console.error('Error getting signed URL:', error);
                            return res.status(500).send('Error getting signed URL.');
                        });
                })
                .catch((error) => {
                    console.error('Error uploading image:', error);
                    return res.status(500).send('Error uploading image.');
                });
        } else {
            // If no image update, save the other fields
            User.updateOne({ _id: id }, { $set: updateObject }).exec()
                .then(() => {
                    const userNotification = new Notification({
                        title: "Profile Update",
                        userId: id,
                        message: "Profile updated Successfully"
                    })
                    userNotification.save()
                    return res.status(200).json({ message: 'Profile updated successfully' });
                })
                .catch((error) => {
                    console.error('Error updating user:', error);
                    return res.status(500).send('Error updating user.');
                });
        }


    } catch (error) {
        res.status(500).json({
            status: 'Failure',
            message: 'Failed to update profile',
            error: error.message,
        });
    }
});

app.get('/notifications', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
        const userId = req.body.userId
        if (!userId) {
            return res.json({
                status: "Failure",
                message: "No User Found"
            })
        }
        const postsPerPage = 10;
        const totalPosts = await Notification.countDocuments({ userId }); // Get the total number of posts for the user
        const totalPages = Math.ceil(totalPosts / postsPerPage); // Calculate the total number of pages

        const skip = (page - 1) * postsPerPage; // Calculate the number of posts to skip based on the current page

        // Fetch the posts for the specified page
        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(postsPerPage);

        let previousPage = page > 1 ? page - 1 : null;
        let nextPage = page < totalPages ? page + 1 : null;

        res.status(200).json({
            status: 'Success',
            data: notifications,
            previousPage,
            nextPage
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            status: 'Failure',
            message: 'Failed to fetch notifications',
            error: error.message,
        });
    }
});

app.put('/notification', async (req, res) => {
    try {
        const notificationId = req.body.notificationId;

        await Notification.updateOne({ _id: notificationId }, { $set: { status: 'read' } });

        res.status(200).json({
            status: 'Success',
            message: 'Notification marked as read',
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            status: 'Failure',
            message: 'Failed to mark notification as read',
            error: error.message,
        });
    }
});

app.post('/changeRole', async (req, res) => {
    try {
        // Get the authenticated user's ID from the token
        const userId = req.body.userId;

        // Find the user in the database
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: 'Failure',
                message: 'User not found'
            });
        }

        // Update the user's role to "customer"

        if (user.role == "customer") {
            await User.updateOne({ _id: userId }, { $set: { role: "user" } });
            res.status(200).json({
                status: 'Success',
                message: "User role changed to \'User\'"
            });
        } else if (user.role == "user") {
            await User.updateOne({ _id: userId }, { $set: { role: "customer" } });
            res.status(200).json({
                status: 'Success',
                message: "User role changed to \'Customer\'"
            });
        } else {
            res.status(200).json({
                status: 'Failure',
                message: 'Invalid Role!!'
            });
        }

    } catch (error) {
        res.status(500).json({
            status: 'Failure',
            message: 'Failed to change user role',
            error: error.message,
        });
    }
});

const tokens = {};

app.post('/forgotPassword', async (req, res) => {
    try {
        const { email } = req.body;
        console.log(email);
        if (!email) {
            return res.status(404).json({ status: 'failure', message: 'Please enter email' });
        }
        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            return res.status(404).json({ status: 'failure', message: 'Email not found' });
        }

        // Generate a random password reset token
        const resetToken = uuidv4();
        // Save the resetToken and associated email in your database
        await ResetToken.create({ token: resetToken, email });

        tokens[resetToken] = email;
        console.log(tokens);
        // Create a reset link with the token
        const resetLink = `http://localhost:3000/api/v1/user/resetPassword?token=${resetToken}`;

        // Send an email with the reset link using Mailgun
        const data = {
            from: 'ShareRoom@gmail.com',
            to: "umerkhayyam91@gmail.com",
            subject: 'Payment',
            html: `<p>Click the link below to reset your password:</p>${resetLink}`,
        }

        mailgun.messages().send(data, (error, body) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ status: 'failure', message: 'Failed to send email' });
            }

            return res.json({ status: 'success', message: 'Password reset link sent to your email' });
        });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ status: 'failure', message: 'Internal server error' });
    }
});


app.get('/resetPassword', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!newPassword) {
            res.json({
                'status': 'Failure',
                'message': `Please enter new password`,
            });
            return;
        }
        // Check if the provided token exists in the tokens object
        const email = tokens[token];
        if (!email) {
            return res.status(404).json({ status: 'failure', message: 'Invalid token' });
        }
        console.log(email);

        const user = await User.find({ email })
        if (!user) {
            return res.status(404).json({ status: 'Failure', message: 'User not found' });
        }
        console.log(user);
        if (newPassword.length < 8) {
            return res.json({
                'status': 'Failure',
                'message': "Password must be at least 8 characters long",
            });
        }
        // In a real application, you should update the user's password in your database
        // For this demo, we'll just log the new password
        console.log(`Password for ${email} reset to: ${newPassword}`);

        // Delete the token from the tokens object after it's used
        delete tokens[token];
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        await User.updateOne({ email: email }, { password: hashedNewPassword }, { runValidators: true });

        return res.json({ status: 'success', message: 'Password reset successful' });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ status: 'failure', message: 'Internal server error' });
    }
});


// Generate a 6-digit random OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const otps = new Map();

// Route to send OTP to the user's email address
app.post('/sendOTP', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            return res.status(404).json({ status: 'failure', message: 'Email not found' });
        }

        const otp = generateOTP();
        otps.set(email, otp);


        // Send the OTP via email
        const data = {
            from: "ShareRoom@gmail.com",
            to: 'umer.khayyam900@gmail.com',
            subject: 'OTP Verification',
            text: `Your OTP is: ${otp}`,
        };

        mailgun.messages().send(data, (error) => {
            if (error) {
                console.error('Error sending OTP:', error);
                return res.status(500).json({ message: 'Failed to send OTP' });
            }

            res.json({ message: 'OTP sent successfully' });
        });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ status: 'failure', message: 'Internal server error' });
    }
});

app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    // Get the stored OTP for the provided email
    const storedOTP = otps.get(email);

    if (!storedOTP) {
        return res.status(404).json({ error: 'OTP not found. Please request a new OTP.' });
    }

    if (otp === storedOTP) {
        // Correct OTP, verification successful
        otps.delete(email); // Remove the OTP from storage after successful verification
        const user = await User.find({ email })
        user.isVerified = true;
        return res.json({
            status: 'Success',
            message: 'Email Verified!!'
        });
    } else {
        // Incorrect OTP, verification failed
        return res.status(401).json({ error: 'Incorrect OTP. Please try again.' });
    }
});

module.exports = app;