const express = require('express');
const router = express.Router();
const Story = require('../models/Story');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { toObjectId } = require('../database/database');

router.post('/', auth, async (req, res) => {
  try {
    const { content, type, media, background, duration } = req.body;
    const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));

    const story = await Story.insertOne({
      user: req.user._id,
      type: type || 'text',
      content,
      media,
      background,
      expiresAt,
      duration: duration || 24
    });

    const user = await User.findById(req.user._id, { username: 1, displayName: 1, avatar: 1 });
    res.status(201).json({ ...story, user });
  } catch (error) {
    logger.error('Create story error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/feed', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const contactIds = (user.contacts || []).map(id => toObjectId(id)).filter(Boolean);
    contactIds.push(toObjectId(req.user._id));

    const stories = await Story.collection().find({
      user: { $in: contactIds },
      isExpired: false,
      expiresAt: { $gt: new Date() }
    })
      .sort({ createdAt: -1 })
      .toArray();

    const userIds = [...new Set(stories.map(s => s.user.toString()))];
    const users = await User.collection().find(
      { _id: { $in: userIds.map(id => toObjectId(id)).filter(Boolean) } },
      { projection: { username: 1, displayName: 1, avatar: 1 } }
    ).toArray();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const grouped = {};
    stories.forEach(story => {
      const uid = story.user.toString();
      if (!grouped[uid]) {
        grouped[uid] = { user: userMap[uid] || story.user, stories: [] };
      }
      grouped[uid].stories.push(story);
    });

    res.json(Object.values(grouped));
  } catch (error) {
    logger.error('Get stories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story || story.isExpired) {
      return res.status(404).json({ message: 'Story not found or expired' });
    }

    const user = await User.findById(story.user, { username: 1, displayName: 1, avatar: 1 });
    res.json({ ...story, user });
  } catch (error) {
    logger.error('Get story error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/view', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    const hasViewed = (story.views || []).some(v => v.toString() === req.user._id.toString());
    if (!hasViewed) {
      await Story.collection().updateOne(
        { _id: toObjectId(req.params.id) },
        { $addToSet: { views: toObjectId(req.user._id) } }
      );
    }

    res.json({ message: 'View recorded' });
  } catch (error) {
    logger.error('View story error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/react', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    const index = (story.reactions || []).findIndex(r => r.toString() === req.user._id.toString());
    if (index > -1) {
      await Story.collection().updateOne(
        { _id: toObjectId(req.params.id) },
        { $pull: { reactions: toObjectId(req.user._id) } }
      );
    } else {
      await Story.collection().updateOne(
        { _id: toObjectId(req.params.id) },
        { $addToSet: { reactions: toObjectId(req.user._id) } }
      );
    }

    const updated = await Story.findById(req.params.id);
    res.json({ reactions: (updated.reactions || []).length });
  } catch (error) {
    logger.error('React to story error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    if (story.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Story.collection().deleteOne({ _id: toObjectId(req.params.id) });
    res.json({ message: 'Story deleted' });
  } catch (error) {
    logger.error('Delete story error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/my/all', auth, async (req, res) => {
  try {
    const stories = await Story.collection().find(
      { user: toObjectId(req.user._id) }
    )
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    res.json(stories);
  } catch (error) {
    logger.error('Get my stories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
