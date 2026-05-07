const express = require('express');
const router = express.Router();
const { getChatHistory, uploadChatImage, uploadChatAudio, markMessagesAsRead, getChatList } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const { upload, audioUpload } = require('../config/cloudinary');

router.get('/list', protect, getChatList);
router.get('/:id', protect, getChatHistory);
router.put('/:bookingId/read', protect, markMessagesAsRead);
router.post('/image', protect, upload.single('image'), uploadChatImage);
router.post('/audio', protect, audioUpload.single('audio'), uploadChatAudio);

module.exports = router;
