const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['customer', 'provider', 'admin'],
    default: 'customer'
  },
  profileImage: { type: String, default: '' },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  notificationsEnabled: { type: Boolean, default: true },
  expoPushToken: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

userSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('User', userSchema);