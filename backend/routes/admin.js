const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Call = require('../models/Call');
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../utils/logger');
const { toObjectId } = require('../database/database');

router.use(auth, adminOnly);

router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, onlineUsers, totalMessages, totalConversations, totalCalls] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isOnline: true }),
      Message.countDocuments(),
      Conversation.countDocuments(),
      Call.countDocuments()
    ]);

    res.json({
      totalUsers,
      onlineUsers,
      totalMessages,
      totalConversations,
      totalCalls,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.collection().find(query, {
      projection: { password: 0, refreshToken: 0 }
    })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .toArray();

    const total = await User.countDocuments(query);

    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const { password, refreshToken, ...safe } = user;
    res.json(safe);
  } catch (error) {
    logger.error('Update role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/messages', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const messages = await Message.collection().find({})
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .toArray();

    const enriched = await Promise.all(messages.map(async msg => {
      const sender = await User.findById(msg.sender, { username: 1, email: 1 });
      const conversation = await Conversation.findById(msg.conversationId);
      return { ...msg, sender, conversationId: conversation || msg.conversationId };
    }));

    res.json(enriched);
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const conversations = await Conversation.collection().find({})
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .toArray();

    const enriched = await Promise.all(conversations.map(async conv => {
      const participants = await User.collection().find(
        { _id: { $in: conv.participants.map(p => toObjectId(p)).filter(Boolean) } },
        { projection: { username: 1, email: 1 } }
      ).toArray();
      const lastMessage = conv.lastMessage ? await Message.findById(conv.lastMessage) : null;
      return { ...conv, participants, lastMessage };
    }));

    res.json(enriched);
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/reports', async (req, res) => {
  try {
    res.json({ message: 'Reports endpoint - implement reporting system' });
  } catch (error) {
    logger.error('Get reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/broadcast', async (req, res) => {
  try {
    const { message, type } = req.body;
    res.json({ message: 'Broadcast sent', recipients: 0 });
  } catch (error) {
    logger.error('Broadcast error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
