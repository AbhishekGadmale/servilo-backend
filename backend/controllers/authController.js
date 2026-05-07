const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Helper: Generate unique 6-char referral code
const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res) => {
  try {
    const { name, email, phone, password, role, referralCode } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Referral Logic
    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) {
        referredBy = referrer._id;
        referrer.referralCount += 1;
        await referrer.save();
      }
    }

    // Determine role (prevent 'admin' from being passed in production)
    let assignedRole = (role === 'provider') ? 'provider' : 'customer';
    if (process.env.NODE_ENV === 'test' && role === 'admin') {
      assignedRole = 'admin';
    }

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: assignedRole,
      referredBy,
      referralCode: generateReferralCode()
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
      return res.status(404).json({ message: 'User is not registered' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
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

// @route  GET /api/auth/admin/users
// @access Private (admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
};

// @route  DELETE /api/auth/admin/users/:id
// @access Private (admin only)
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const Shop = require('../models/Shop');
    const Booking = require('../models/Booking');
    const Review = require('../models/Review');

    // 1. Delete all bookings made by this user
    await Booking.deleteMany({ userId });

    // 2. Find all shops owned by this user
    const shops = await Shop.find({ ownerId: userId });
    const shopIds = shops.map(s => s._id);

    if (shopIds.length > 0) {
      // 3. Delete all bookings associated with these shops
      await Booking.deleteMany({ shopId: { $in: shopIds } });
      // 4. Delete all reviews associated with these shops
      await Review.deleteMany({ shopId: { $in: shopIds } });
      // 5. Delete the shops
      await Shop.deleteMany({ ownerId: userId });
    }

    // 6. Delete all reviews made by this user
    await Review.deleteMany({ userId });

    // 7. Finally delete the user
    await User.findByIdAndDelete(userId);

    res.status(200).json({ success: true, message: 'User and all associated data deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
};

// @route  PUT /api/auth/admin/users/:id/suspend
// @access Private (admin only)
const toggleUserSuspension = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isSuspended = !user.isSuspended;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isSuspended ? 'suspended' : 'reinstated'} successfully`,
      isSuspended: user.isSuspended
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @route  GET /api/auth/referrals
// @access Private
const getReferralStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('referralCode referralCount');

    // Find people who were referred by this user
    const referredUsers = await User.find({ referredBy: req.user.id })
      .select('name createdAt role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      referralCode: user.referralCode,
      referralCount: user.referralCount,
      referredUsers
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { signup, login, getProfile, getAdminStats, updateProfile, getAllUsers, deleteUser, toggleUserSuspension, getReferralStats };