const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { toObjectId } = require('../database/database');

const attachGroupMetadata = async (conversation) => {
  if (conversation.type !== 'group') return conversation;

  const group = await Group.findOne({ conversation: toObjectId(conversation._id) });

  if (group) {
    const members = await GroupMember.collection().find(
      { group: group._id, isBanned: false }
    ).toArray();

    const userIds = members.map(m => m.user);
    const users = await User.collection().find(
      { _id: { $in: userIds } },
      { projection: { username: 1, displayName: 1, avatar: 1, isOnline: 1 } }
    ).toArray();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    conversation.groupId = group._id;
    conversation.group = group;
    conversation.memberCount = group.memberCount || members.length;
    conversation.members = members.map(member => ({
      _id: member._id,
      role: member.role,
      permissions: member.permissions || {},
      user: userMap[member.user.toString()] || member.user
    }));
    conversation.adminIds = members
      .filter(member => ['owner', 'admin'].includes(member.role))
      .map(member => member.user?.toString());
    conversation.moderatorIds = members
      .filter(member => member.role === 'moderator')
      .map(member => member.user?.toString());
  }

  return conversation;
};

const populateParticipants = async (participantIds) => {
  if (!participantIds || participantIds.length === 0) return [];
  const ids = participantIds.map(id => toObjectId(id)).filter(Boolean);
  return User.collection().find(
    { _id: { $in: ids } },
    { projection: { username: 1, displayName: 1, avatar: 1, isOnline: 1, lastSeen: 1 } }
  ).toArray();
};

const populateLastMessage = async (messageId) => {
  if (!messageId) return null;
  const Message = require('../models/Message');
  return Message.findById(messageId);
};

router.get('/', auth, async (req, res) => {
  try {
    const conversations = await Conversation.collection().find(
      { participants: toObjectId(req.user._id) }
    ).sort({ lastMessageAt: -1 }).toArray();

    const result = await Promise.all(conversations.map(async conv => {
      const participants = await populateParticipants(conv.participants);
      const lastMessage = await populateLastMessage(conv.lastMessage);

      const convObj = { ...conv, participants, lastMessage };
      const enriched = await attachGroupMetadata(convObj);
      enriched.unreadCount = (conv.unreadCount && conv.unreadCount[req.user._id.toString()]) || 0;
      enriched.isArchived = (conv.isArchived && conv.isArchived[req.user._id.toString()]) || false;
      enriched.isPinned = (conv.isPinned && conv.isPinned[req.user._id.toString()]) || false;
      enriched.isMuted = (conv.isMuted && conv.isMuted[req.user._id.toString()]) || false;
      enriched.wallpaper = (conv.wallpaperSettings && conv.wallpaperSettings[req.user._id.toString()]) || null;
      return enriched;
    }));

    res.json(result);
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { participantId, type, name } = req.body;

    if (type === 'direct') {
      const existingConv = await Conversation.findOne({
        type: 'direct',
        participants: { $all: [toObjectId(req.user._id), toObjectId(participantId)], $size: 2 }
      });

      if (existingConv) {
        const participants = await populateParticipants(existingConv.participants);
        return res.json({ ...existingConv, participants });
      }
    }

    const conversation = await Conversation.insertOne({
      type: type || 'direct',
      name: name || null,
      participants: type === 'direct'
        ? [toObjectId(req.user._id), toObjectId(participantId)]
        : [toObjectId(req.user._id)],
      admin: [toObjectId(req.user._id)],
      createdBy: toObjectId(req.user._id)
    });

    const participants = await populateParticipants(conversation.participants);
    res.status(201).json({ ...conversation, participants });
  } catch (error) {
    logger.error('Create conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(
      p => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const participants = await populateParticipants(conversation.participants);
    const lastMessage = await populateLastMessage(conversation.lastMessage);

    const convObj = { ...conversation, participants, lastMessage };
    const enriched = await attachGroupMetadata(convObj);
    enriched.unreadCount = (conversation.unreadCount && conversation.unreadCount[req.user._id.toString()]) || 0;
    enriched.wallpaper = (conversation.wallpaperSettings && conversation.wallpaperSettings[req.user._id.toString()]) || null;

    res.json(enriched);
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/archive', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const key = req.user._id.toString();
    const current = (conversation.isArchived && conversation.isArchived[key]) || false;

    await Conversation.collection().updateOne(
      { _id: toObjectId(req.params.id) },
      { $set: { [`isArchived.${key}`]: !current } }
    );

    res.json({ isArchived: !current });
  } catch (error) {
    logger.error('Archive error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/pin', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const key = req.user._id.toString();
    const current = (conversation.isPinned && conversation.isPinned[key]) || false;

    await Conversation.collection().updateOne(
      { _id: toObjectId(req.params.id) },
      { $set: { [`isPinned.${key}`]: !current } }
    );

    res.json({ isPinned: !current });
  } catch (error) {
    logger.error('Pin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/mute', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const key = req.user._id.toString();
    const current = (conversation.isMuted && conversation.isMuted[key]) || false;

    await Conversation.collection().updateOne(
      { _id: toObjectId(req.params.id) },
      { $set: { [`isMuted.${key}`]: !current } }
    );

    res.json({ isMuted: !current });
  } catch (error) {
    logger.error('Mute error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/leave', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (conversation.type === 'direct') {
      return res.status(400).json({ message: 'Cannot leave direct conversation' });
    }

    const userIdObj = toObjectId(req.user._id);
    await Conversation.collection().updateOne(
      { _id: toObjectId(req.params.id) },
      { $pull: { participants: userIdObj, admin: userIdObj } }
    );

    res.json({ message: 'Left conversation successfully' });
  } catch (error) {
    logger.error('Leave error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/wallpaper', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const key = req.user._id.toString();
    const { url, blur, brightness, type } = req.body;

    const wallpaper = { type: type || 'none' };
    if (url) wallpaper.url = url;
    if (typeof blur === 'number') wallpaper.blur = Math.min(Math.max(blur, 0), 20);
    if (typeof brightness === 'number') wallpaper.brightness = Math.min(Math.max(brightness, 0.1), 1);

    await Conversation.collection().updateOne(
      { _id: toObjectId(req.params.id) },
      { $set: { [`wallpaperSettings.${key}`]: wallpaper } }
    );

    res.json({ wallpaper });
  } catch (error) {
    logger.error('Wallpaper error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/add', auth, async (req, res) => {
  try {
    const { userIds } = req.body;
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isAdmin = conversation.admin.some(a => a.toString() === req.user._id.toString());
    if (!isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const existingIds = new Set(conversation.participants.map(p => p.toString()));
    const newParticipants = (userIds || []).filter(id => !existingIds.has(id));

    if (newParticipants.length > 0) {
      const newObjIds = newParticipants.map(id => toObjectId(id)).filter(Boolean);
      await Conversation.collection().updateOne(
        { _id: toObjectId(req.params.id) },
        { $addToSet: { participants: { $each: newObjIds } } }
      );
    }

    const updated = await Conversation.findById(req.params.id);
    const participants = await populateParticipants(updated.participants);

    res.json({ ...updated, participants });
  } catch (error) {
    logger.error('Add participants error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
