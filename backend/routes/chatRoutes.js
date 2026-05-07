const express = require('express');
const router = express.Router();
const { getChatHistory, uploadChatImage, markMessagesAsRead, getChatList } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

router.get('/list', protect, getChatList);
router.get('/:id', protect, getChatHistory);
router.put('/:bookingId/read', protect, markMessagesAsRead);
router.post('/image', protect, upload.single('image'), uploadChatImage);

module.exports = router;
