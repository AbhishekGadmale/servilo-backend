const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const {
  signup, login, sendOTP, verifyOTP, googleLogin, getProfile,
  getAdminStats, updateProfile,
  getAllUsers, deleteUser,
  toggleUserSuspension, getReferralStats
} = require('../controllers/authController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// Import per-route rate limiters from the dedicated middleware module.
// IMPORTANT: These are applied only to login & signup — NOT to admin/data routes.
const { loginLimiter, signupLimiter, otpLimiter } = require('../middleware/rateLimiters');

// ── Reusable validation error handler ──────────────────
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array({ onlyFirstError: true })[0];
    return res.status(400).json({
      success: false,
      message: firstError.msg
    });
  }
  next();
};

// ── POST /api/auth/signup ───────────────────────────────
// signupLimiter: max 5 accounts per IP per hour
router.post('/signup',
  signupLimiter,
  [
    body('name')
      .trim()
      .not().isEmpty().withMessage('Name is required')
      .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),

    body('email')
      .trim()
      .not().isEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please enter a valid email address'),

    body('phone')
      .trim()
      .not().isEmpty().withMessage('Phone number is required')
      .isLength({ min: 10 }).withMessage('Phone must be at least 10 digits'),

    body('password')
      .not().isEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  handleValidation,
  signup
);

// ── POST /api/auth/login ────────────────────────────────
// loginLimiter: max 10 failed attempts per IP per 15 min
router.post('/login',
  loginLimiter,
  [
    body('email')
      .trim()
      .not().isEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please enter a valid email address'),

    body('password')
      .not().isEmpty().withMessage('Password is required'),
  ],
  handleValidation,
  login
);

router.post('/google', googleLogin);

// ── POST /api/auth/send-otp ─────────────────────────────
router.post('/send-otp',
  otpLimiter,
  [
    body('email')
      .trim()
      .not().isEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please enter a valid email address'),
  ],
  handleValidation,
  sendOTP
);

// ── POST /api/auth/verify-otp ──────────────────────────
router.post('/verify-otp',
  [
    body('email')
      .trim()
      .not().isEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please enter a valid email address'),
    body('otp')
      .not().isEmpty().withMessage('OTP is required')
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  ],
  handleValidation,
  verifyOTP
);

// ── GET /api/auth/profile ───────────────────────────────
// No rate limiter — authenticated route, safe to call freely
router.get('/profile', protect, getProfile);

// ── GET /api/auth/referrals ────────────────────────────
router.get('/referrals', protect, getReferralStats);

// ── PUT /api/auth/profile ───────────────────────────────
router.put('/profile',
  protect,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),

    body('phone')
      .optional()
      .trim()
      .isLength({ min: 10 }).withMessage('Phone must be at least 10 digits'),
  ],
  handleValidation,
  updateProfile
);

// ── Admin Routes ─────────────────────────────────────────
// These are admin-only, authenticated routes.
// They carry NO auth-attempt rate limiter — only the global 300 req/15min limit.
router.get('/admin/stats',
  protect,
  authorizeRoles('admin'),
  getAdminStats
);

router.get('/admin/users',
  protect,
  authorizeRoles('admin'),
  getAllUsers
);

router.delete('/admin/users/:id',
  protect,
  authorizeRoles('admin'),
  deleteUser
);

router.put('/admin/users/:id/suspend',
  protect,
  authorizeRoles('admin'),
  toggleUserSuspension
);

module.exports = router;