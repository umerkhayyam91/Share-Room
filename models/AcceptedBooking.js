const mongoose = require('mongoose');
const Post = require('./Post')
const User = require('./User')

const AcceptedBookingSchema = new mongoose.Schema({
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true,
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    startDate: String,
    endDate: String,
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        required: true,
    },
},
    {
        timestamps: true, // Automatically manage createdAt and updatedAt fields
    });

const AcceptedBooking = mongoose.model('AcceptedBooking', AcceptedBookingSchema);
module.exports = AcceptedBooking;
