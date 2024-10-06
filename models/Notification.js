const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['unread', 'read'],
    default: 'unread',
    required: true,
  },
},
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
