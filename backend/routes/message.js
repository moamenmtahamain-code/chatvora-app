const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { toObjectId, getDb } = require('../database/database');

const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cloudinaryConfig = require('../config/cloudinary');

// ─── MULTER: Cloudinary if configured, otherwise local disk ────────────────
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  cb(null, allowedMimes.includes(file.mimetype));
};

let uploadMiddleware;
if (cloudinaryConfig.isConfigured) {
  uploadMiddleware = multer({
    storage: cloudinaryConfig.storage,
    fileFilter,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 },
  });
} else {
  const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const type = file.mimetype.split('/')[0];
      const folder = type === 'image' ? 'images' : type === 'video' ? 'videos' : type === 'audio' ? 'audio' : 'documents';
      const dir = path.join(process.env.UPLOAD_PATH || './uploads', folder);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
    },
  });
  uploadMiddleware = multer({
    storage: diskStorage,
    fileFilter,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 },
  });
}

const populateMessageData = async (message) => {
  if (!message) return null;
  const sender = await Message.populateUser(message.sender);
  let replyTo = null;
  if (message.replyTo) {
    replyTo = await Message.findById(message.replyTo);
    if (replyTo) {
      replyTo.sender = await Message.populateUser(replyTo.sender);
    }
  }

  if (message.reactions && message.reactions.length > 0) {
    const userIds = [...new Set(message.reactions.map(r => r.user?.toString()).filter(Boolean))];
    const users = await User.collection().find(
      { _id: { $in: userIds.map(id => toObjectId(id)).filter(Boolean) } },
      { projection: { username: 1, displayName: 1, avatar: 1 } }
    ).toArray();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });
    message.reactions = message.reactions.map(r => ({
      ...r,
      user: userMap[r.user?.toString()] || r.user
    }));
  }

  return { ...message, sender, replyTo };
};

router.get('/conversation/:conversationId', auth, async (req, res) => {
  try {
    const { before, limit = 50 } = req.query;
    const conversationId = req.params.conversationId;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(
      p => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const query = {
      conversationId: toObjectId(conversationId),
      deleteFor: { $ne: toObjectId(req.user._id) }
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.collection().find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();

    const enriched = await Promise.all(messages.reverse().map(m => populateMessageData(m)));

    res.json(enriched);
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { conversationId, content, type, media, replyTo } = req.body;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(
      p => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Set disappearing message timer if the conversation has one
    let disappearAt = null;
    if (conversation.disappearTimer && conversation.disappearTimer > 0) {
      disappearAt = new Date(Date.now() + conversation.disappearTimer);
    }

    const message = await Message.insertOne({
      conversationId,
      sender: req.user._id,
      type: type || 'text',
      content,
      media,
      replyTo,
      disappearAt
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastMessageAt: new Date()
    });

    const enriched = await populateMessageData(message);
    res.status(201).json(enriched);
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot edit others message' });
    }

    const updated = await Message.findByIdAndUpdate(req.params.id, {
      content,
      isEdited: true,
      editedAt: new Date()
    }, { new: true });

    const enriched = await populateMessageData(updated);
    res.json(enriched);
  } catch (error) {
    logger.error('Edit message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const { forEveryone } = req.query;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (forEveryone === 'true') {
      let canDelete = message.sender.toString() === req.user._id.toString();
      if (!canDelete) {
        const group = await Group.findOne({ conversation: message.conversationId });
        if (group) {
          const member = await GroupMember.findOne({ group: group._id, user: toObjectId(req.user._id) });
          canDelete = ['owner', 'admin', 'moderator'].includes(member?.role);
        }
      }

      if (!canDelete) {
        return res.status(403).json({ message: 'Cannot delete others message' });
      }

      await Message.findByIdAndUpdate(req.params.id, {
        isDeleted: true,
        content: 'This message was deleted',
        media: null
      });
    } else {
      await Message.collection().updateOne(
        { _id: toObjectId(req.params.id) },
        { $addToSet: { deleteFor: toObjectId(req.user._id) } }
      );
    }

    res.json({ message: 'Message deleted' });
  } catch (error) {
    logger.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const reactions = message.reactions || [];
    const existingIdx = reactions.findIndex(
      r => r.user.toString() === req.user._id.toString() && r.emoji === emoji
    );

    if (existingIdx > -1) {
      reactions.splice(existingIdx, 1);
      await Message.collection().updateOne(
        { _id: toObjectId(req.params.id) },
        { $set: { reactions } }
      );
    } else {
      await Message.collection().updateOne(
        { _id: toObjectId(req.params.id) },
        { $push: { reactions: { user: toObjectId(req.user._id), emoji, createdAt: new Date() } } }
      );
    }

    const updated = await Message.findById(req.params.id);

    // Broadcast reaction update via Socket.IO for real-time sync
    const io = req.app.get('io');
    if (io && updated) {
      const enrichedReactions = updated.reactions || [];
      if (enrichedReactions.length > 0) {
        const userIds = [...new Set(enrichedReactions.map(r => r.user?.toString()).filter(Boolean))];
        const users = await getDb().collection('users').find(
          { _id: { $in: userIds.map(id => toObjectId(id)).filter(Boolean) } },
          { projection: { username: 1, displayName: 1, avatar: 1 } }
        ).toArray();
        const userMap = {};
        users.forEach(u => { userMap[u._id.toString()] = u; });
        enrichedReactions.forEach(r => {
          if (r.user) r.user = userMap[r.user.toString()] || r.user;
        });
      }
      io.to(`conversation:${message.conversationId}`).emit('message:reacted', {
        conversationId: message.conversationId,
        messageId: updated._id,
        reactions: enrichedReactions
      });
      logger.info(`[REST] Reaction broadcast via Socket.IO for message ${updated._id}`);
    }

    res.json(updated.reactions || []);
  } catch (error) {
    logger.error('React error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/pin', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const newPinned = !message.isPinned;
    await Message.findByIdAndUpdate(req.params.id, { isPinned: newPinned });

    res.json({ isPinned: newPinned });
  } catch (error) {
    logger.error('Pin message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/star', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const starKey = req.user._id.toString();
    const isStarred = message.isStarred && message.isStarred[starKey];
    const current = isStarred || false;

    await Message.collection().updateOne(
      { _id: toObjectId(req.params.id) },
      { $set: { [`isStarred.${starKey}`]: !current } }
    );

    res.json({ isStarred: !current });
  } catch (error) {
    logger.error('Star message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/search/:conversationId', auth, async (req, res) => {
  try {
    const { q } = req.query;
    const conversationId = req.params.conversationId;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.some(p => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const messages = await Message.collection().find({
      conversationId: toObjectId(conversationId),
      content: { $regex: q, $options: 'i' },
      deleteFor: { $ne: toObjectId(req.user._id) }
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const enriched = await Promise.all(messages.map(m => populateMessageData(m))).then(msgs => msgs);
    res.json(messages);
  } catch (error) {
    logger.error('Search messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/forward', auth, async (req, res) => {
  try {
    const { conversationIds } = req.body;
    const originalMessage = await Message.findById(req.params.id);

    if (!originalMessage) {
      return res.status(404).json({ message: 'Message not found' });
    }

    let count = 0;
    for (const convId of (conversationIds || [])) {
      const conv = await Conversation.findById(convId);
      if (conv && conv.participants.some(p => p.toString() === req.user._id.toString())) {
        await Message.insertOne({
          conversationId: convId,
          sender: req.user._id,
          type: originalMessage.type,
          content: originalMessage.content,
          media: originalMessage.media
        });
        count++;
      }
    }

    res.json({ message: 'Message forwarded', count });
  } catch (error) {
    logger.error('Forward error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── UPLOAD FILE + CREATE MESSAGE (single call) ────────────────────────────
router.post('/upload', auth, uploadMiddleware.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { conversationId, replyTo } = req.body;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(
      p => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Build media object from the uploaded file
    let fileUrl, mimeType, fileSize, origFilename;
    if (cloudinaryConfig.isConfigured) {
      fileUrl = req.file.path;
      mimeType = req.file.mimetype;
      fileSize = req.file.size;
      origFilename = req.file.originalname;
    } else {
      const type = req.file.mimetype.split('/')[0];
      const folder = type === 'image' ? 'images' : type === 'video' ? 'videos' : type === 'audio' ? 'audio' : 'documents';
      fileUrl = `/uploads/${folder}/${req.file.filename}`;
      mimeType = req.file.mimetype;
      fileSize = req.file.size;
      origFilename = req.file.originalname;
    }

    const fileType = mimeType.split('/')[0];
    const msgType = fileType === 'image' ? 'image'
      : fileType === 'video' ? 'video'
        : fileType === 'audio' ? 'audio' : 'document';

    const media = {
      url: fileUrl,
      filename: origFilename,
      size: fileSize,
      mimeType,
      type: fileType,
    };

    // Create the message
    const message = await Message.insertOne({
      conversationId,
      sender: req.user._id,
      type: msgType,
      content: '',
      media,
      replyTo: replyTo || null,
    });

    // Update conversation's lastMessage
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastMessageAt: new Date(),
    });

    // Enrich with sender data
    const enriched = await populateMessageData(message);

    // Broadcast via Socket.IO for real-time delivery
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('message:new', {
        message: enriched,
      });
    }

    res.status(201).json(enriched);
  } catch (error) {
    logger.error('Message upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

module.exports = router;
