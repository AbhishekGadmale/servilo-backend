const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: role || 'customer'
    });

    // Return token
    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token: generateToken(user._id, user.role),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Return token
    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token: generateToken(user._id, user.role),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// @route  GET /api/admin/stats
// @access Private (admin only)
const getAdminStats = async (req, res) => {
  try {
    const User = require('../models/User');
    const Shop = require('../models/Shop');
    const Booking = require('../models/Booking');

    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalProviders = await User.countDocuments({ role: 'provider' });
    const totalShops = await Shop.countDocuments();
    const pendingShops = await Shop.countDocuments({ isApproved: false });
    const totalBookings = await Booking.countDocuments();

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalProviders,
        totalShops,
        pendingShops,
        totalBookings
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// @route  PUT /api/auth/profile
// @access Private
const updateProfile = async (req, res) => {
  try {
    const { name, phone, profileImage, expoPushToken, notificationsEnabled } = req.body;

    // Log to see if token is arriving
    if (expoPushToken) {
      console.log(`📱 Push token saved for user ${req.user.id}: ${expoPushToken.substring(0, 30)}...`);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(profileImage !== undefined && { profileImage }),
        ...(expoPushToken !== undefined && { expoPushToken }),
        ...(notificationsEnabled !== undefined && { notificationsEnabled })
      },
      { new: true }
    ).select('-password');

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { signup, login, getProfile, getAdminStats ,updateProfile};