const express = require('express');
const router = express.Router();
const { signup, login, getProfile, getAdminStats,updateProfile } = require('../controllers/authController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const User = require('../models/User');

router.put('/profile', protect, updateProfile);
router.post('/signup', signup);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.get('/admin/stats', protect, authorizeRoles('admin'), getAdminStats);

// Admin - get all users
router.get('/admin/users', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin - delete user
router.delete('/admin/users/:id', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;