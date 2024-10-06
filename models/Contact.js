const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    email: String,
    phoneNumber: String
},
{
  timestamps: true, // Automatically manage createdAt and updatedAt fields
})

const Contact = mongoose.model('Contact', contactSchema);
module.exports = Contact;