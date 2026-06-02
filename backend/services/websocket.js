const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Call = require('../models/Call');
const logger = require('../utils/logger');
const { toObjectId } = require('../database/database');

// ─── GLOBAL STATE ─────────────────────────────────────────────────────────
// userId -> Set<socketId>   (multi-tab support)
const connectedUsers = new Map();
const userSockets = new Map();

function getOnlineUsers() {
  return Array.from(connectedUsers.keys());
}

function isUserOnline(userId) {
  const set = connectedUsers.get(userId?.toString());
  return set && set.size > 0;
}

// ─── SETUP ────────────────────────────────────────────────────────────────
function setupWebSocket(io) {
  // ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      socket.userId = user._id.toString();
      next();
    } catch (err) {
      logger.error('[WS] Auth error:', err.message);
      next(new Error('Invalid token'));
    }
  });

  // ─── CONNECTION ───────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const uid = socket.userId;
    const username = socket.user.username;
    logger.info(`[WS] CONNECTED user=${username} socket=${socket.id}`);

    // Track this socket (multi-tab)
    if (!connectedUsers.has(uid)) connectedUsers.set(uid, new Set());
    connectedUsers.get(uid).add(socket.id);
    userSockets.set(socket.id, uid);
    logger.info(`[WS] ${username} has ${connectedUsers.get(uid).size} active socket(s)`);

    // Update DB status & broadcast online
    try {
      await User.findByIdAndUpdate(uid, { isOnline: true, lastSeen: new Date() });
    } catch (err) {
      logger.error('[WS] DB online update failed:', err.message);
    }
    socket.broadcast.emit('user:online', { userId: uid });

    // Join personal room for targeted messages
    socket.join(`user:${uid}`);

    // ─── JOIN CONVERSATION ROOM ───────────────────────────────────────
    socket.on('conversation:join', async (data = {}, cb) => {
      try {
        const { conversationId, before, limit } = data || {};
        if (!conversationId) {
          if (typeof cb === 'function') cb({ error: 'conversationId required' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          if (typeof cb === 'function') cb({ error: 'Conversation not found' });
          return;
        }

        const isParticipant = conversation.participants.some(
          p => p.toString() === uid
        );
        if (!isParticipant) {
          if (typeof cb === 'function') cb({ error: 'Not a participant' });
          return;
        }

        // Join the room — ALL future `io.to(roomName)` will reach this socket
        const roomName = `conversation:${conversationId}`;
        socket.join(roomName);
        logger.info(`[WS] ${username} JOINED room ${roomName}`);

        if (conversation.type === 'group') {
          const Group = require('../models/Group');
          const group = await Group.findOne({ conversation: toObjectId(conversation._id) });
          if (group) {
            socket.join(`group:${group._id}`);
            logger.info(`[WS] ${username} JOINED group room group:${group._id}`);
          }
        }

        // Load messages
        const query = { conversationId: toObjectId(conversationId), isDeleted: { $ne: true } };
        if (before) query.createdAt = { $lt: new Date(before) };
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

        const messages = await Message.collection().find(query)
          .sort({ createdAt: -1 })
          .limit(safeLimit)
          .toArray();

        const enriched = await Promise.all(messages.reverse().map(async (msg) => {
          const sender = await User.findById(msg.sender, { username: 1, displayName: 1, avatar: 1 });
          let replyTo = null;
          if (msg.replyTo) {
            const replyMsg = await Message.findById(msg.replyTo);
            if (replyMsg) {
              replyTo = {
                ...replyMsg,
                sender: await User.findById(replyMsg.sender, { username: 1, displayName: 1, avatar: 1 })
              };
            }
          }
          return { ...msg, sender, replyTo };
        }));

        socket.emit('conversation:history', { conversationId, messages: enriched });

        if (typeof cb === 'function') cb({ ok: true, conversation, messages: enriched });
      } catch (err) {
        logger.error('[WS] conversation:join error:', err.message);
        if (typeof cb === 'function') cb({ error: 'Failed to join conversation' });
      }
    });

    // ─── LEAVE CONVERSATION ────────────────────────────────────────────
    socket.on('conversation:leave', async ({ conversationId } = {}) => {
      if (!conversationId) return;
      socket.leave(`conversation:${conversationId}`);

      const conversation = await Conversation.findById(conversationId);
      if (conversation?.type === 'group') {
        const Group = require('../models/Group');
        const group = await Group.findOne({ conversation: toObjectId(conversation._id) });
        if (group) {
          socket.leave(`group:${group._id}`);
          socket.to(`group:${group._id}`).emit('group:member:left', { userId: uid, groupId: group._id });
        }
      }
      logger.info(`[WS] ${username} LEFT conversation:${conversationId}`);
    });

    // ─── SEND MESSAGE ──────────────────────────────────────────────────
    socket.on('message:send', async (data = {}) => {
      try {
        const { conversationId, content, text, type, messageType, media, replyTo, clientMessageId } = data;
        const messageContent = typeof content === 'string' ? content : text;
        const resolvedType = type || messageType || 'text';

        logger.info(`[WS] message:send from=${username} conv=${conversationId} content="${(messageContent || '').substring(0, 40)}"`);

        if (!toObjectId(conversationId)) {
          return socket.emit('error', { message: 'Invalid conversation id' });
        }
        if (!messageContent?.trim() && !media?.url) {
          return socket.emit('error', { message: 'Content or media required' });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.some(p => p.toString() === uid)) {
          return socket.emit('error', { message: 'Invalid conversation' });
        }

        // Deduplicate
        if (clientMessageId) {
          const existing = await Message.findOne({
            conversationId: toObjectId(conversationId),
            sender: toObjectId(uid),
            clientMessageId
          });
          if (existing) {
            const sender = await User.findById(uid, { username: 1, displayName: 1, avatar: 1 });
            socket.emit('message:sent', { message: { ...existing, sender }, duplicate: true });
            return;
          }
        }

        // Set disappearing message timer if the conversation has one
        let disappearAt = null;
        if (conversation.disappearTimer && conversation.disappearTimer > 0) {
          disappearAt = new Date(Date.now() + conversation.disappearTimer);
        }

        // Save to DB
        const message = await Message.insertOne({
          conversationId,
          sender: uid,
          type: resolvedType,
          content: messageContent,
          clientMessageId,
          media,
          replyTo,
          status: 'sent',
          disappearAt
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          lastMessageAt: new Date()
        });

        try {
          const Group = require('../models/Group');
          await Group.findOneAndUpdate(
            { conversation: toObjectId(conversationId) },
            { $addToSet: { messages: toObjectId(message._id) } }
          );
        } catch (_) {}

        // Build populated message for broadcast
        const sender = await User.findById(uid, { username: 1, displayName: 1, avatar: 1 });
        const populatedMsg = { ...message, sender };
        const roomName = `conversation:${conversationId}`;

        // ─── BROADCAST to the conversation ROOM ONLY ─────────────────
        // io.to(roomName) reaches ALL sockets in the room, including sender's
        // other tabs. socket.to(roomName) would exclude the sender.
        logger.info(`[WS] Broadcasting message ${message._id} to ${roomName}`);
        io.to(roomName).emit('message:new', populatedMsg);

        // ─── SEND CONFIRMATION to sender's socket ────────────────────
        socket.emit('message:sent', { message: populatedMsg });

        // ─── UPDATE SIDEBAR for all participants ─────────────────────
        conversation.participants.forEach(pid => {
          const pidStr = pid.toString();
          io.to(`user:${pidStr}`).emit('conversation:updated', {
            conversationId: conversation._id,
            lastMessage: populatedMsg,
            lastMessageAt: populatedMsg.createdAt,
            senderId: uid
          });
        });

        logger.info(`[WS] Message ${message._id} sent to ${conversation.participants.length} participants`);
      } catch (err) {
        logger.error('[WS] message:send error:', err.message);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ─── TYPING ─────────────────────────────────────────────────────────
    socket.on('message:typing', ({ conversationId, isTyping } = {}) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('message:typing', {
        conversationId,
        userId: uid,
        isTyping: Boolean(isTyping)
      });
    });

    // ─── TYPING INDICATOR (separate events with debounce) ───────────────
    socket.on('typing', (room) => {
      if (!room) return;
      socket.to(`conversation:${room}`).emit('user-typing', room);
    });

    socket.on('stop-typing', (room) => {
      if (!room) return;
      socket.to(`conversation:${room}`).emit('user-stop-typing', room);
    });

    // ─── MARK READ ──────────────────────────────────────────────────────
    socket.on('message:read', async ({ conversationId, messageId } = {}) => {
      try {
        if (!conversationId || !messageId) return;
        await Message.findByIdAndUpdate(messageId, { status: 'seen', seen: true });
        socket.to(`conversation:${conversationId}`).emit('message:read', {
          conversationId,
          userId: uid,
          messageId
        });
      } catch (err) {
        logger.error('[WS] message:read error:', err.message);
      }
    });

    // ─── CALL SIGNALING ─────────────────────────────────────────────────
    // Store call rooms in-memory (peerId -> Set<socketId>)
    const callRooms = new Map(); // roomId -> Set<userId>

    socket.on('call:initiate', async (data = {}) => {
      try {
        const { receiverId, type, conversationId, isGroup, callId, signal } = data;
        logger.info(`[WS] call:initiate from=${uid} to=${receiverId} type=${type} callId=${callId}`);

        const caller = await User.findById(uid, { username: 1, displayName: 1, avatar: 1 });
        if (!caller) return;

        // Persist call in DB
        await Call.insertOne({
          callId,
          type: type || 'audio',
          conversationId,
          caller: uid,
          receivers: receiverId ? [receiverId] : [],
          participants: isGroup ? [] : [uid, receiverId],
          isGroup: isGroup || false,
          status: 'initiated'
        }).catch(err => logger.error('[WS] Call DB insert error:', err.message));

        // Forward incoming call to receiver's personal room
        const incomingPayload = {
          callId,
          caller,
          type: type || 'audio',
          conversationId,
          isGroup: isGroup || false,
          signal
        };

        if (receiverId) {
          // 1:1 call — send to user's personal room
          io.to(`user:${receiverId}`).emit('call:incoming', incomingPayload);
          logger.info(`[WS] Forwarded call:incoming to user:${receiverId}`);
        }

        if (conversationId && isGroup) {
          // Group call — send to conversation room
          io.to(`conversation:${conversationId}`).emit('group:call:incoming', incomingPayload);
          io.to(`conversation:${conversationId}`).emit('conversation:call:incoming', incomingPayload);
        }

        socket.emit('call:initiated', { ok: true, callId });
      } catch (err) {
        logger.error('[WS] call:initiate error:', err.message);
      }
    });

    socket.on('call:accept', async ({ receiverId, callId } = {}) => {
      logger.info(`[WS] call:accept from=${uid} to=${receiverId} callId=${callId}`);

      // Update DB
      await Call.findOneAndUpdate(
        { callId },
        { $set: { status: 'accepted', startedAt: new Date() } }
      ).catch(err => logger.error('[WS] Call accept DB error:', err.message));

      // Notify the caller that their call was accepted
      if (receiverId) {
        io.to(`user:${receiverId}`).emit('call:accepted', {
          callId,
          receiverId: uid,
          receiver: socket.user
        });
        logger.info(`[WS] Forwarded call:accepted to user:${receiverId}`);
      }
    });

    socket.on('call:reject', async ({ receiverId, callId } = {}) => {
      logger.info(`[WS] call:reject from=${uid} to=${receiverId} callId=${callId}`);

      // Update DB
      await Call.findOneAndUpdate(
        { callId },
        { $set: { status: 'rejected', endedAt: new Date() } }
      ).catch(err => logger.error('[WS] Call reject DB error:', err.message));

      if (receiverId) {
        io.to(`user:${receiverId}`).emit('call:rejected', {
          callId,
          reason: 'declined'
        });
      }
    });

    socket.on('call:end', async ({ receiverIds, callId } = {}) => {
      logger.info(`[WS] call:end from=${uid} callId=${callId}`);

      // Calculate duration
      const existing = await Call.findOne({ callId }).catch(() => null);
      const startTime = existing?.startedAt || new Date();
      const duration = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);

      await Call.findOneAndUpdate(
        { callId },
        { $set: { status: 'ended', endedAt: new Date(), duration, isActive: false } }
      ).catch(err => logger.error('[WS] Call end DB error:', err.message));

      // Notify all participants
      const allTargets = (receiverIds || []).concat(uid);
      const uniqueTargets = [...new Set(allTargets.map(id => id.toString()))];
      uniqueTargets.forEach(targetId => {
        io.to(`user:${targetId}`).emit('call:ended', { callId, endedBy: uid });
        logger.info(`[WS] Forwarded call:ended to user:${targetId}`);
      });
    });

    socket.on('call:signal', async ({ receiverId, signal, callId } = {}) => {
      try {
        if (!receiverId || !signal) return;

        const payload = { signal, from: uid, callId };

        if (signal.type === 'offer') {
          logger.info(`[WS] Forwarding WebRTC offer from=${uid} to=${receiverId}`);
        } else if (signal.type === 'answer') {
          logger.info(`[WS] Forwarding WebRTC answer from=${uid} to=${receiverId}`);
        } else if (signal.type === 'candidate') {
          logger.debug(`[WS] Forwarding ICE candidate from=${uid} to=${receiverId}`);
        }

        io.to(`user:${receiverId}`).emit('call:signal', payload);
      } catch (err) {
        logger.error('[WS] call:signal error:', err.message);
      }
    });

    // ─── ICE RESTART ──────────────────────────────────────────────────────
    // The client triggers this when the peer connection ICE fails.
    // The server forwards the new SDP offer to the target peer so it can
    // renegotiate without tearing down the call.
    socket.on('call:ice_restart', async ({ receiverId, offer, callId } = {}) => {
      try {
        if (!receiverId || !offer || !callId) {
          logger.warn('[WS] call:ice_restart missing params');
          return;
        }
        logger.info(`[WS] ICE restart from=${uid} to=${receiverId} callId=${callId}`);

        // Update call in DB
        await Call.findOneAndUpdate(
          { callId },
          { $set: { iceRestartedAt: new Date() } }
        ).catch(() => {});

        io.to(`user:${receiverId}`).emit('call:ice_restart', {
          offer,
          from: uid,
          callId,
        });
      } catch (err) {
        logger.error('[WS] call:ice_restart error:', err.message);
      }
    });

    // ─── CALL CONNECTION QUALITY ───────────────────────────────────────────
    // Periodic reports from clients about connection health.
    socket.on('call:quality_report', async ({ callId, quality, rtt, receiverId } = {}) => {
      try {
        if (!callId) return;
        logger.debug(`[WS] Quality report call=${callId} from=${uid} quality=${quality} rtt=${rtt}`);

        // Forward to the other participant for display
        if (receiverId) {
          io.to(`user:${receiverId}`).emit('call:quality_update', {
            callId,
            peerQuality: quality,
            from: uid,
          });
        }
      } catch (err) {
        logger.error('[WS] call:quality_report error:', err.message);
      }
    });

    // ─── ROOM (GROUP) CALLS ─────────────────────────────────────────────
    socket.on('call:create_room', (data, cb) => {
      const roomId = `call_room_${crypto.randomBytes(8).toString('hex')}`;
      callRooms.set(roomId, new Set());
      socket.join(`call_room:${roomId}`);
      callRooms.get(roomId).add(uid);
      logger.info(`[WS] Created call room ${roomId} by ${username}`);

      if (typeof cb === 'function') cb({ roomId });
    });

    socket.on('room:join', ({ roomId } = {}, cb) => {
      try {
        if (!roomId) {
          if (typeof cb === 'function') cb({ error: 'roomId required' });
          return;
        }

        socket.join(`call_room:${roomId}`);

        if (!callRooms.has(roomId)) {
          callRooms.set(roomId, new Set());
        }
        callRooms.get(roomId).add(uid);
        logger.info(`[WS] ${username} JOINED call room ${roomId}`);

        // Return current participants (excluding self)
        const participants = Array.from(callRooms.get(roomId))
          .filter(id => id !== uid)
          .map(id => ({ _id: id }));

        if (typeof cb === 'function') cb({ participants, roomId });
      } catch (err) {
        logger.error('[WS] room:join error:', err.message);
        if (typeof cb === 'function') cb({ error: 'Failed to join room' });
      }
    });

    socket.on('room:leave', ({ roomId } = {}) => {
      if (!roomId) return;
      socket.leave(`call_room:${roomId}`);

      if (callRooms.has(roomId)) {
        callRooms.get(roomId).delete(uid);
        logger.info(`[WS] ${username} LEFT call room ${roomId}`);

        // Notify remaining participants
        callRooms.get(roomId).forEach(participantId => {
          io.to(`user:${participantId}`).emit('room:participant_left', {
            roomId,
            userId: uid
          });
        });

        if (callRooms.get(roomId).size === 0) {
          callRooms.delete(roomId);
          logger.info(`[WS] Call room ${roomId} destroyed (empty)`);
        }
      }
    });

    socket.on('room:signal', ({ roomId, to, signal, callId } = {}) => {
      try {
        if (!roomId || !to || !signal) return;

        const payload = { signal, from: uid, callId, roomId };
        io.to(`user:${to}`).emit('room:signal', payload);
      } catch (err) {
        logger.error('[WS] room:signal error:', err.message);
      }
    });

    socket.on('call:start', ({ conversationId, roomId, callId, type } = {}) => {
      if (!conversationId) return;
      logger.info(`[WS] call:start conv=${conversationId} roomId=${roomId} type=${type}`);
      io.to(`conversation:${conversationId}`).emit('conversation:call:incoming', {
        roomId,
        callId,
        type: type || 'audio',
        caller: { _id: uid, username, displayName: socket.user.displayName || username }
      });
    });

    // ─── DISCONNECT (enhanced to clean up call rooms) ───────────────────
    socket.on('disconnect', async () => {
      logger.info(`[WS] DISCONNECTED user=${username} socket=${socket.id}`);

      // Clean up call rooms
      if (typeof callRooms !== 'undefined') {
        for (const [roomId, members] of callRooms.entries()) {
          if (members.has(uid)) {
            members.delete(uid);
            members.forEach(participantId => {
              io.to(`user:${participantId}`).emit('room:participant_left', { roomId, userId: uid });
            });
            if (members.size === 0) callRooms.delete(roomId);
          }
        }
      }

      userSockets.delete(socket.id);
      const socketSet = connectedUsers.get(uid);
      if (socketSet) {
        socketSet.delete(socket.id);
        logger.info(`[WS] ${username} has ${socketSet.size} remaining socket(s)`);

        if (socketSet.size === 0) {
          connectedUsers.delete(uid);
          try {
            await User.findByIdAndUpdate(uid, { isOnline: false, lastSeen: new Date() });
          } catch (err) {
            logger.error('[WS] DB offline update failed:', err.message);
          }
          socket.broadcast.emit('user:offline', { userId: uid, lastSeen: new Date() });
          logger.info(`[WS] ${username} is now FULLY OFFLINE`);
        }
      }
    });

    // ─── ERROR ──────────────────────────────────────────────────────────
    socket.on('error', (err) => {
      logger.error(`[WS] Socket error for ${username}:`, err.message || err);
    });
  });
}

module.exports = {
  setupWebSocket,
  sendNotification: async (userId, notification) => {
    io?.to(`user:${userId}`).emit('notification:new', notification);
  },
  getOnlineUsers,
  getUserSocket: (userId) => connectedUsers.get(userId?.toString())
};
