const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', required: true
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop', required: true
  },

  bookingType: {
    type: String,
    enum: ['slot', 'queue', 'food_order'],
    default: 'slot'
  },

  // For barber/service bookings
  service: {
    name: { type: String, default: '' },
    price: { type: Number, default: 0 },
    duration: { type: Number, default: 30 }
  },

  // For food orders
  foodItems: [{
    name: { type: String },
    price: { type: Number },
    quantity: { type: Number, default: 1 }
  }],
  totalAmount: { type: Number, default: 0 },

  // Slot/Queue info
  timeSlot: { type: String, default: '' },
  queueNumber: { type: Number, default: 0 },
  estimatedWaitTime: { type: Number, default: 0 },

  // Book for friend
  isForFriend: { type: Boolean, default: false },
  friendName: { type: String, default: '' },
  friendPhone: { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },
  bookingDate: { type: Date, default: Date.now },
  notes: { type: String, default: '' }
});

module.exports = mongoose.model('Booking', bookingSchema);