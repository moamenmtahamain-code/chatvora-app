const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const userRoutes = require('./user');
const conversationRoutes = require('./conversation');
const messageRoutes = require('./message');
const uploadRoutes = require('./upload');
const callRoutes = require('./call');
const storyRoutes = require('./story');
const notificationRoutes = require('./notification');
const adminRoutes = require('./admin');
const groupRoutes = require('./group');
const aiRoutes = require('./ai');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);
router.use('/upload', uploadRoutes);
router.use('/calls', callRoutes);
router.use('/stories', storyRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/groups', groupRoutes);
router.use('/ai', aiRoutes);

module.exports = router;