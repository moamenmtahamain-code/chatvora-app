const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = file.mimetype.split('/')[0];
    const folder = type === 'image' ? 'images' : type === 'video' ? 'videos' : type === 'audio' ? 'audio' : 'documents';
    const dir = path.join(process.env.UPLOAD_PATH || './uploads', folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024
  }
});

router.post('/single', auth, uploadLimiter, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const type = req.file.mimetype.split('/')[0];
    const fileUrl = `/uploads/${type === 'image' ? 'images' : type === 'video' ? 'videos' : type === 'audio' ? 'audio' : 'documents'}/${req.file.filename}`;

    res.json({
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
      type
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

router.post('/multiple', auth, uploadLimiter, upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const files = req.files.map(file => {
      const type = file.mimetype.split('/')[0];
      return {
        url: `/uploads/${type === 'image' ? 'images' : type === 'video' ? 'videos' : type === 'audio' ? 'audio' : 'documents'}/${file.filename}`,
        filename: file.filename,
        size: file.size,
        mimeType: file.mimetype,
        type
      };
    });

    res.json(files);
  } catch (error) {
    logger.error('Multiple upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

router.post('/avatar', auth, uploadLimiter, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/images/${req.file.filename}`;
    res.json({ url: avatarUrl });
  } catch (error) {
    logger.error('Avatar upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

module.exports = router;
