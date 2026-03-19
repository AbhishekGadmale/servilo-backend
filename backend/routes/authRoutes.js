const express    = require('express');
const router     = express.Router();
const { body, validationResult } = require('express-validator');
const {
  signup, login, getProfile,
  getAdminStats, updateProfile
} = require('../controllers/authController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const User = require('../models/User');

// ── Validation middleware helper ────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg, // return first error only
      errors: errors.array()
    });
  }
  next();
};

// ── Signup Validators ───────────────────────────────────
const signupValidators = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
    .isLength({ max: 50 }).withMessage('Name must be under 50 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .isLength({ min: 10, max: 15 }).withMessage('Phone must be 10-15 digits')
    .matches(/^[0-9+\-\s]+$/).withMessage('Phone number is invalid'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .isLength({ max: 100 }).withMessage('Password is too long'),

  body('role')
    .optional()
    .isIn(['customer', 'provider', 'admin'])
    .withMessage('Role must be customer, provider, or admin')
];

// ── Login Validators ────────────────────────────────────
const loginValidators = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
];

// ── Profile Update Validators ───────────────────────────
const profileUpdateValidators = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
    .isLength({ max: 50 }).withMessage('Name is too long'),

  body('phone')
    .optional()
    .trim()
    .isLength({ min: 10, max: 15 }).withMessage('Phone must be 10-15 digits')
    .matches(/^[0-9+\-\s]+$/).withMessage('Phone number is invalid')
];

// ── Public Routes ───────────────────────────────────────
router.post('/signup', signupValidators, validate, signup);
router.post('/login',  loginValidators,  validate, login);

// ── Private Routes ──────────────────────────────────────
router.get('/profile',  protect, getProfile);
router.put('/profile',  protect, profileUpdateValidators, validate, updateProfile);

// ── Admin Routes ────────────────────────────────────────
router.get('/admin/stats',
  protect, authorizeRoles('admin'), getAdminStats);

router.get('/admin/users',
  protect, authorizeRoles('admin'),
  async (req, res) => {
    try {
      const users = await User.find()
        .select('-password')
        .sort({ createdAt: -1 });
      res.status(200).json({ success: true, count: users.length, users });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.delete('/admin/users/:id',
  protect, authorizeRoles('admin'),
  async (req, res) => {
    try {
      await User.findByIdAndDelete(req.params.id);
      res.status(200).json({ success: true, message: 'User deleted' });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;