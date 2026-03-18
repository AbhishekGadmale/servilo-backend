const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const { uploadImage } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');

router.post('/image', protect, upload.single('image'), uploadImage);

module.exports = router;