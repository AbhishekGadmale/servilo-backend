const express = require('express');
const router = express.Router();
const { getChatHistory, uploadChatImage, markMessagesAsRead } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

router.get('/:bookingId', protect, getChatHistory);
router.put('/:bookingId/read', protect, markMessagesAsRead);
router.post('/image', protect, upload.single('image'), uploadChatImage);

module.exports = router;
