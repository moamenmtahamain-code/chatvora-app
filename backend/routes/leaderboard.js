const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');
const logger = require('../utils/logger');

// API endpoint: GET /api/leaderboard
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    // Aggregate message counts per user (field is 'sender', not 'senderId')
    const messageCounts = await Message.collection().aggregate([
      {
        $group: {
          _id: '$sender',
          messageCount: { $sum: 1 }
        }
      },
      { $sort: { messageCount: -1 } }
    ]).toArray();

    // Get all users with public profile info
    const users = await User.collection().find({}, {
      projection: {
        username: 1,
        displayName: 1,
        avatar: 1,
        bio: 1,
        isOnline: 1,
        lastSeen: 1,
        createdAt: 1,
        contacts: 1
      }
    }).toArray();

    // Build a map of message counts
    const countMap = {};
    messageCounts.forEach(mc => {
      countMap[mc._id?.toString()] = mc.messageCount;
    });

    // Build leaderboard entries
    const leaderboard = users.map(user => ({
      _id: user._id,
      username: user.username || 'unknown',
      displayName: user.displayName || user.username || 'Unknown',
      avatar: user.avatar || null,
      bio: user.bio || '',
      isOnline: user.isOnline || false,
      lastSeen: user.lastSeen,
      messageCount: countMap[user._id?.toString()] || 0,
      contactCount: (user.contacts || []).length,
      joinedAt: user.createdAt
    }));

    // Sort by message count descending, then by contact count
    leaderboard.sort((a, b) => b.messageCount - a.messageCount || b.contactCount - a.contactCount);

    // Assign ranks
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    res.json({
      totalUsers: users.length,
      leaderboard: leaderboard.slice(0, limit)
    });
  } catch (error) {
    logger.error('Leaderboard fetch error:', error);
    res.status(500).json({ message: 'Failed to load leaderboard' });
  }
});

module.exports = router;