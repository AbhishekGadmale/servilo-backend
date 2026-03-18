const express = require('express');
const router = express.Router();
const { signup, login, getProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/signup', signup);
router.post('/login', login);

// Private route
router.get('/profile', protect, getProfile);

module.exports = router;