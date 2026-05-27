const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const QRCode = require('qrcode');
const { toObjectId } = require('../database/database');

router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'Search query too short' });
    }

    const users = await User.collection().find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } }
      ],
      _id: { $ne: toObjectId(req.user._id) }
    }, {
      projection: { username: 1, displayName: 1, avatar: 1, bio: 1, isOnline: 1, lastSeen: 1 },
      limit: 20
    }).toArray();

    res.json(users);
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(User.sanitize(user));
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/block', auth, async (req, res) => {
  try {
    const userId = req.params.id;
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    const user = await User.findById(req.user._id);
    const userIdObj = toObjectId(userId);
    const isBlocked = user.blockedUsers.some(id => id.toString() === userId);

    if (isBlocked) {
      await User.collection().updateOne(
        { _id: toObjectId(req.user._id) },
        { $pull: { blockedUsers: userIdObj } }
      );
    } else {
      await User.collection().updateOne(
        { _id: toObjectId(req.user._id) },
        { $addToSet: { blockedUsers: userIdObj } }
      );
    }

    res.json({ message: isBlocked ? 'User unblocked' : 'User blocked' });
  } catch (error) {
    logger.error('Block user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/contact/:id', auth, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(req.user._id);
    const userIdObj = toObjectId(userId);
    const hasContact = user.contacts.some(id => id.toString() === userId);

    if (hasContact) {
      await User.collection().updateOne(
        { _id: toObjectId(req.user._id) },
        { $pull: { contacts: userIdObj } }
      );
    } else {
      await User.collection().updateOne(
        { _id: toObjectId(req.user._id) },
        { $addToSet: { contacts: userIdObj } }
      );
    }

    res.json({ message: 'Contact updated' });
  } catch (error) {
    logger.error('Contact update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/qr/generate', auth, async (req, res) => {
  try {
    const qrData = JSON.stringify({ userId: req.user._id.toString(), timestamp: Date.now() });
    const qrCode = await QRCode.toDataURL(qrData);
    res.json({ qrCode });
  } catch (error) {
    logger.error('QR generation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/qr/scan/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: User.sanitize(user) });
  } catch (error) {
    logger.error('QR scan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/online-status/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id, { isOnline: 1, lastSeen: 1 });
    res.json({ isOnline: user?.isOnline || false, lastSeen: user?.lastSeen });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
