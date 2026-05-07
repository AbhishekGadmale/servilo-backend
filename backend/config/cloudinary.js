const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'servilo',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }]
  }
});

const audioStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'servilo/audio',
    resource_type: 'video', // Cloudinary uses 'video' for audio files
    allowed_formats: ['m4a', 'mp3', 'wav', 'aac', 'ogg', '3gp']
  }
});

const upload = multer({ storage });
const audioUpload = multer({ storage: audioStorage });

module.exports = { cloudinary, upload, audioUpload };