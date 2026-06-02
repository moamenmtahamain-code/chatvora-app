const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const logger = require('../utils/logger');

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

let cloudinaryStorage = null;
let isConfigured = false;

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  try {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    });

    cloudinaryStorage = new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'chatvora',
        resource_type: 'auto',
        public_id: () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      },
    });

    isConfigured = true;
    logger.info('[Cloudinary] Configured successfully');
  } catch (err) {
    logger.warn('[Cloudinary] Configuration failed, falling back to local storage:', err.message);
  }
} else {
  logger.info('[Cloudinary] No credentials found, using local file storage');
}

module.exports = {
  cloudinary: isConfigured ? cloudinary : null,
  storage: cloudinaryStorage,
  isConfigured,
};
