const { cloudinary } = require('../config/cloudinary');

// Upload single image
const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    res.status(200).json({
      success: true,
      imageUrl: req.file.path
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadImage };