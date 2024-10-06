const mongoose = require('mongoose');
const User = require('./User');
const locationSchema = new mongoose.Schema({
    longitude: {
        type: String,
        // required: true
    },
    latitude: {
        type: String,
        // required: true
    }
});

const postSchema = new mongoose.Schema({
    title: {
        type: String,
        // required: true
    },
    description: {
        type: String,
        // required: true
    },
    images: [{
        type: String,
        // required: true
    }],
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // required: true,
    },
    startDate: String,
    endDate: String,
    houseRules: String,
    location: {
        type: locationSchema,
        // required: true
    },
    monthlyRent: {
        type: Number,
        // required: true
    },
    totalBedrooms: Number,
    totalBathrooms: Number,
    initialDeposit: Number,
    amenities: String,
    property_type: {
        type: String,
        enum: ['shared room', 'separate room', 'entire property'],
        // required: true
    },
    // flat_type: String,
    preferredGender: {
        type: String,
        enum: ['male', 'female', 'non-binary', "any"]
    },
    preferredAge: String,
    propertySize: String,
    flatMates: {
        males: Number,
        females: Number,
      },
    prefferedStatus: {
        type: String,
        enum: ['student', 'working', "any"],
    },
    bedType: {
        type: String,
        enum: ['single bed', 'double bed', "sofa bed", "no bed"],
    },
    status: {
        type: String,
        enum: ['active', 'paused', "deleted"],
        default: "active",
        // required: true
    },
    requestedIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    billInclude: Boolean,
    isVerified: {
        type: Boolean,
        default: false
    },
    isBooked: {
        type: Boolean,
        default: false
    },
},
    {
        timestamps: true,
    });

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
