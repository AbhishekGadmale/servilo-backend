const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', required: true
  },
  shopName: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['barber', 'food', 'hardware', 'electrician', 'plumber', 'mechanic'],
    required: true
  },
  description: { type: String, default: '' },
  address: { type: String, required: true },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  phone: { type: String, required: true },
  photos: { type: [String], default: [] },

  // For barber/hardware/electrician etc
  services: [{
    name: { type: String },
    price: { type: Number },
    duration: { type: Number, default: 30 }
  }],

  // For food category only
  menuItems: [{
    name: { type: String },
    price: { type: Number },
    image: { type: String, default: '' },
    inStock: { type: Boolean, default: true }
  }],

  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  isOpen: { type: Boolean, default: true },
  isApproved: { type: Boolean, default: false },
  openTime: { type: String, default: '09:00' },
  closeTime: { type: String, default: '21:00' },
  currentQueue: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

shopSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Shop', shopSchema);