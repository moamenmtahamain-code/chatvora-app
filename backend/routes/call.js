const express = require('express');
const router = express.Router();
const Call = require('../models/Call');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { toObjectId } = require('../database/database');

router.post('/initiate', auth, async (req, res) => {
  try {
    const { receiverId, conversationId, type, isGroup } = req.body;

    const call = await Call.insertOne({
      type: type || 'audio',
      conversationId,
      caller: req.user._id,
      receivers: receiverId ? [receiverId] : [],
      participants: isGroup ? [] : [req.user._id, receiverId],
      isGroup: isGroup || false,
      status: 'initiated'
    });

    const caller = await User.findById(call.caller, { username: 1, displayName: 1, avatar: 1 });
    res.status(201).json({ ...call, caller });
  } catch (error) {
    logger.error('Initiate call error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const call = await Call.findById(req.params.id);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const caller = await User.findById(call.caller, { username: 1, displayName: 1, avatar: 1 });
    let participants = [];
    if (call.participants && call.participants.length > 0) {
      participants = await User.collection().find(
        { _id: { $in: call.participants.map(p => toObjectId(p)).filter(Boolean) } },
        { projection: { username: 1, displayName: 1, avatar: 1 } }
      ).toArray();
    }

    res.json({ ...call, caller, participants });
  } catch (error) {
    logger.error('Get call error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, duration } = req.body;
    const call = await Call.findById(req.params.id);

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const update = { status };
    if (status === 'ended') {
      update.endedAt = new Date();
      update.duration = duration || 0;
    }

    const updated = await Call.findOneAndUpdate(
      { _id: toObjectId(req.params.id) },
      { $set: update }
    );

    res.json(updated);
  } catch (error) {
    logger.error('Update call status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/join', auth, async (req, res) => {
  try {
    const call = await Call.findById(req.params.id);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const isParticipant = call.participants.some(p => p.toString() === req.user._id.toString());
    if (!isParticipant) {
      await Call.collection().updateOne(
        { _id: toObjectId(req.params.id) },
        {
          $addToSet: { participants: toObjectId(req.user._id) },
          $set: { status: 'accepted' }
        }
      );
    }

    const updated = await Call.findById(req.params.id);
    res.json(updated);
  } catch (error) {
    logger.error('Join call error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const calls = await Call.collection().find({
      $or: [
        { caller: toObjectId(req.user._id) },
        { participants: toObjectId(req.user._id) }
      ]
    })
      .sort({ startedAt: -1 })
      .limit(50)
      .toArray();

    const enriched = await Promise.all(calls.map(async call => {
      const caller = await User.findById(call.caller, { username: 1, displayName: 1, avatar: 1 });
      return { ...call, caller };
    }));

    res.json(enriched);
  } catch (error) {
    logger.error('Get call history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
