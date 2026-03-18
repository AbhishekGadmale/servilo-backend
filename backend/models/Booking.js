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

  serviceType: {
    type: String,
    enum: ['barber', 'food', 'hardware', 'electrician', 'plumber', 'mechanic'],
    required: true
  },

  bookingType: {
    type: String,
    enum: ['queue', 'order', 'service_request'],
    required: true
  },

  // ── BARBER ──────────────────────────
  barberData: {
    serviceName: { type: String, default: '' },
    price: { type: Number, default: 0 },
    duration: { type: Number, default: 30 },
    queueNumber: { type: Number, default: 0 },
    estimatedWaitTime: { type: Number, default: 0 },
    customerArrived: { type: Boolean, default: false }
  },

  // ── FOOD / HARDWARE ─────────────────
  orderData: {
    items: [{
      name: String,
      price: Number,
      quantity: Number,
      image: { type: String, default: '' }
    }],
    totalAmount: { type: Number, default: 0 },
    specialInstructions: { type: String, default: '' }
  },

  // ── ELECTRICIAN ─────────────────────
  electricianData: {
    issueType: { type: String, default: '' },
    customDescription: { type: String, default: '' },
    isUrgent: { type: Boolean, default: false },
    scheduledDate: { type: String, default: '' },
    scheduledTime: { type: String, default: '' },
    visitCharge: { type: Number, default: 0 }
  },

  // ── PLUMBER ─────────────────────────
  plumberData: {
    issueType: { type: String, default: '' },
    description: { type: String, default: '' },
    problemImage: { type: String, default: '' },
    scheduledDate: { type: String, default: '' },
    scheduledTime: { type: String, default: '' },
    estimatedCost: { type: Number, default: 0 }
  },

  // ── MECHANIC ────────────────────────
  mechanicData: {
    vehicleType: { type: String, default: '' },
    problemType: { type: String, default: '' },
    isEmergency: { type: Boolean, default: false },
    userLocation: {
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
      address: { type: String, default: '' }
    }
  },

  // ── COMMON ──────────────────────────
  isForFriend: { type: Boolean, default: false },
  friendName: { type: String, default: '' },
  friendPhone: { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },

  providerNote: { type: String, default: '' },
  bookingDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);