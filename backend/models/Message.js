const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: false // Optional for pre-booking inquiries
  },
  isInquiry: {
    type: Boolean,
    default: false
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true // Always know which shop the chat is for
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: function() {
      return !this.image && !this.audio;
    }
  },
  image: {
    type: String,
    default: ''
  },
  audio: {
    type: String,
    default: ''
  },
  isDelivered: {
    type: Boolean,
    default: false
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for chat list and history performance
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, isRead: 1 });
messageSchema.index({ bookingId: 1, createdAt: -1 });
messageSchema.index({ shopId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
