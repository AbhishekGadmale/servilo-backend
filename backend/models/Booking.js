const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  service: {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { type: Number, default: 30 }
  },
  bookingType: {
    type: String,
    enum: ['slot', 'queue'],
    default: 'slot'
  },
  timeSlot: {
    type: String,
    default: ''
  },
  queueNumber: {
    type: Number,
    default: 0
  },
  estimatedWaitTime: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },
  bookingDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  }
});

module.exports = mongoose.model('Booking', bookingSchema);