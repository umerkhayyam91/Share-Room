const mongoose = require('mongoose');
const locationSchema = new mongoose.Schema({
    longitude: {
        type: String,
        required: true
    },
    latitude: {
        type: String,
        required: true
    }
});

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: async function (email) {
                const user = await this.constructor.findOne({ email });
                return !user;
            },
            message: 'already exists',
        },
    },
    image: String,
    password: {
        type: String,
        required: true,
        minlength: 8
    },
    date_of_birth: String,
    role: {
        type: String,
        enum: ['customer', 'user', 'admin'],
        default: 'customer',
        required: true
    },
    location: locationSchema,
    gender: {
        type: String,
        enum: ['male', 'female', 'non-binary']
    },
    hobbies: String,
    status: {
        type: String,
        enum: ['student', 'work', 'both']
    },
    language: String,
    about: String,
    personal_interests: String,
    isApproved: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    }
},
    {
        timestamps: true,
    })
const User = mongoose.model('User', userSchema);
module.exports = User;