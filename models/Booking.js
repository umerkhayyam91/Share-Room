const mongoose = require('mongoose');
const Post = require('./Post')
const User = require('./User')

const bookingSchema = new mongoose.Schema({
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
    enum: ['pending', 'accepted', 'rejected' , 'rented out'],
    default: 'pending',
    required: true,
  },
  showUser: { 
    type: Boolean,
    default: true,
    required: true
  },
  showCustomer: {
    type: Boolean,
    default: true,
    required: true
  },
},
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  });

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
