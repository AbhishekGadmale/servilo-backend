const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../utils/email');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

const client = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

// Generate JWT Token (Access Token)
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '15m' // Short lived access token
  });
};

// Generate Refresh Token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: '30d' // Long lived refresh token
  });
};

// Helper: Generate unique 8-char referral code
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// @route   POST /api/auth/send-otp
// @access  Public
const sendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Generate 6-digit OTP securely
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Find user or create temporary one
    let user = await User.findOne({ email });
    if (!user) {
      // Create user if doesn't exist (Registration via OTP)
      user = new User({ 
        email, 
        role: 'customer',
        referralCode: generateReferralCode() 
      });
    }

    // Hash OTP for security
    const salt = await bcrypt.genSalt(10);
    user.otp = await bcrypt.hash(otp, salt);
    user.otpExpires = otpExpires;
    await user.save();

    // Send Email
    try {
      await sendOTPEmail(email, otp);
    } catch (emailError) {
      console.error('Send OTP email failed:', emailError.message);
      return next(emailError);
    }

    res.status(200).json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Send OTP Error:', error);
    next(error);
  }
};

// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const user = await User.findOne({ email });
    if (!user || !user.otp) return res.status(404).json({ message: 'No OTP requested for this email' });

    // Check expiry
    if (new Date() > user.otpExpires) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // Verify OTP
    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid OTP' });
    }

    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Clear OTP fields, verify email, and save refresh token
    user.otp = undefined;
    user.otpExpires = undefined;
    user.isEmailVerified = true;
    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isNewUser: !user.name // If no name, they need to complete profile
      }
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'ID Token is required' });

    // Verify token with Google
    const ticket = await client.verifyIdToken({
      idToken,
      audience: [
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        process.env.GOOGLE_IOS_CLIENT_ID,
        process.env.GOOGLE_WEB_CLIENT_ID
      ].filter(Boolean)
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture: profileImage } = payload;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      // Create new user if doesn't exist
      user = await User.create({
        googleId,
        email,
        name,
        profileImage,
        role: 'customer',
        isEmailVerified: true,
        referralCode: generateReferralCode()
      });
    } else if (!user.googleId) {
      // Link Google account to existing email account
      user.googleId = googleId;
      if (!user.profileImage) user.profileImage = profileImage;
      await user.save();
    }

    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    
    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('Google Login Error:', error);
    next(error);
  }
};

// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res, next) => {
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

    // Create user with retry logic for unique referralCode
    let user;
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {
        user = await User.create({
          name,
          email,
          phone,
          password: hashedPassword,
          role: assignedRole,
          referredBy,
          referralCode: generateReferralCode(),
          isEmailVerified: false
        });
        break; 
      } catch (err) {
        lastError = err;
        if (err.code === 11000) {
          retries--;
          continue;
        }
        throw err;
      }
    }

    if (!user) throw lastError || new Error('Failed to create user after multiple attempts');

    // Generate 6-digit OTP securely
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Hash OTP for security
    const otpSalt = await bcrypt.genSalt(10);
    user.otp = await bcrypt.hash(otp, otpSalt);
    user.otpExpires = otpExpires;
    await user.save();

    // Send Email
    try {
      await sendOTPEmail(email, otp);
    } catch (emailError) {
      console.error('Signup email sending failed:', emailError.message);
      // We don't want to fail the whole signup if just the email fails,
      // but we should inform the user they can resend it.
      return res.status(201).json({
        success: true,
        requireOtp: true,
        message: 'Account created, but verification email failed to send. Please use "Resend OTP".',
        email: user.email
      });
    }

    res.status(201).json({
      success: true,
      requireOtp: true,
      message: 'OTP sent to your email. Please verify.',
      email: user.email
    });

  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ 
      message: 'Registration failed', 
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
    });
  }
};

// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
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

    // Check if email is verified
    if (!user.isEmailVerified) {
      // Send a new OTP
      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      const salt = await bcrypt.genSalt(10);
      user.otp = await bcrypt.hash(otp, salt);
      user.otpExpires = otpExpires;
      await user.save();
      
      try {
        await sendOTPEmail(email, otp);
      } catch (emailError) {
        console.error('Login verification email failed:', emailError.message);
        return res.status(401).json({ 
          success: true,
          requireOtp: true, 
          message: 'Please verify your email. We tried to send a new code but the email service failed. Please try "Resend OTP" in a moment.',
          email: user.email 
        });
      }

      return res.status(401).json({ 
        success: true,
        requireOtp: true, 
        message: 'Please verify your email before logging in. OTP sent.',
        email: user.email 
      });
    }

    // Generate Tokens
    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    // Return token
    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (error) {
    next(error);
  }
};

// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};
// @route  GET /api/admin/stats
// @access Private (admin only)
const getAdminStats = async (req, res, next) => {
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
    next(error);
  }
};
// @route  PUT /api/auth/profile
// @access Private
const updateProfile = async (req, res, next) => {
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
    next(error);
  }
};

// @route  GET /api/auth/admin/users
// @access Private (admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await User.countDocuments();
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({ 
      success: true, 
      count: users.length, 
      total,
      page,
      totalPages: Math.ceil(total / limit),
      users 
    });
  } catch (error) {
    next(error);
  }
};

// @route  DELETE /api/auth/admin/users/:id
// @access Private (admin only)
const deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const Shop = require('../models/Shop');
    const Booking = require('../models/Booking');
    const Review = require('../models/Review');
    const Staff = require('../models/Staff');
    const Message = require('../models/Message');

    // 1. Delete all bookings made by this user
    await Booking.deleteMany({ userId });

    // 2. Delete all chat messages where user is sender or receiver
    await Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] });

    // 3. Find all shops owned by this user
    const shops = await Shop.find({ ownerId: userId });
    const shopIds = shops.map(s => s._id);

    if (shopIds.length > 0) {
      // 4. Delete all bookings associated with these shops
      await Booking.deleteMany({ shopId: { $in: shopIds } });
      // 5. Delete all reviews associated with these shops
      await Review.deleteMany({ shopId: { $in: shopIds } });
      // 6. Delete all staff members associated with these shops
      await Staff.deleteMany({ shopId: { $in: shopIds } });
      // 7. Delete all chat messages associated with these shops
      await Message.deleteMany({ shopId: { $in: shopIds } });
      // 8. Delete the shops
      await Shop.deleteMany({ ownerId: userId });
    }

    // 9. Delete all reviews made by this user
    await Review.deleteMany({ userId });

    // 10. Finally delete the user
    await User.findByIdAndDelete(userId);

    res.status(200).json({ success: true, message: 'User and all associated data deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @route  PUT /api/auth/admin/users/:id/suspend
// @access Private (admin only)
const toggleUserSuspension = async (req, res, next) => {
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
    next(error);
  }
};

// @route  GET /api/auth/referrals
// @access Private
const getReferralStats = async (req, res, next) => {
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
    next(error);
  }
};
// @route   POST /api/auth/refresh-token
// @access  Public
const refreshTokenHandler = async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: 'Refresh Token required' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const newAccessToken = generateToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
};

module.exports = { 
  signup, 
  login, 
  sendOTP, 
  verifyOTP,
  googleLogin,
  getProfile, 
  getAdminStats, 
  updateProfile, 
  getAllUsers, 
  deleteUser, 
  toggleUserSuspension, 
  getReferralStats,
  refreshToken: refreshTokenHandler
};