const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { toObjectId } = require('../database/database');

router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.collection().find(
      { user: toObjectId(req.user._id) }
    )
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    res.json(notifications);
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: toObjectId(req.params.id), user: toObjectId(req.user._id) },
      { isRead: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    logger.error('Mark read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: toObjectId(req.user._id), isRead: false },
      { isRead: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Mark all read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: toObjectId(req.user._id), isRead: false });
    res.json({ count });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: toObjectId(req.params.id), user: toObjectId(req.user._id) });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/register-push-token', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ message: 'Invalid subscription' });
    }

    const UserModel = require('../models/User');
    const user = await UserModel.findById(req.user._id);

    let pushSubscriptions = user.pushSubscriptions || [];
    const existingIdx = pushSubscriptions.findIndex(s => s.endpoint === subscription.endpoint);

    if (existingIdx >= 0) {
      pushSubscriptions[existingIdx] = subscription;
    } else {
      pushSubscriptions.push(subscription);
    }

    await UserModel.findByIdAndUpdate(req.user._id, { pushSubscriptions });
    res.json({ message: 'Push token registered' });
  } catch (error) {
    logger.error('Push register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/vapid-public-key', auth, (req, res) => {
  const { getVapidPublicKey } = require('../services/pushNotifications');
  const key = getVapidPublicKey();
  res.json({ publicKey: key || 'BC8iPZ3kL5xR7vN9qW2yE4uA6cG8jS0mD1fH3tK5nP7rT9vX2zB4wM6' });
});

module.exports = router;
