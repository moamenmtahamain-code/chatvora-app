const jwt = require('jsonwebtoken');
const User = require('../modelsMongoose/User');
const ChatRoom = require('../modelsMongoose/ChatRoom');
const Message = require('../modelsMongoose/Message');

// ─── GLOBAL CONNECTION TRACKER ────────────────────────────────────────────
// userId -> Set<socketId>  (multi-tab: one user can have many sockets)
const userSockets = new Map();

function getOnlineUsers() {
  const online = [];
  for (const [userId, socketSet] of userSockets) {
    if (socketSet.size > 0) online.push(userId);
  }
  return online;
}

function isUserOnline(userId) {
  const set = userSockets.get(userId.toString());
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
      const user = await User.findById(decoded.userId).lean();
      if (!user) return next(new Error('User not found'));

      socket.userId = user._id.toString();
      socket.userData = user;
      next();
    } catch (err) {
      console.error('[WS] Auth error:', err.message);
      next(new Error('Invalid token'));
    }
  });

  // ─── CONNECTION ───────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const uid = socket.userId;
    console.log(`[WS] CONNECTED user=${socket.userData.username} socket=${socket.id}`);

    // Track this socket
    if (!userSockets.has(uid)) userSockets.set(uid, new Set());
    userSockets.get(uid).add(socket.id);
    console.log(`[WS] ${socket.userData.username} has ${userSockets.get(uid).size} active socket(s)`);

    // Update DB status to online & broadcast
    try {
      await User.findByIdAndUpdate(uid, { status: 'online', lastSeen: new Date() });
    } catch (err) {
      console.error('[WS] Failed to update user online status:', err.message);
    }
    socket.broadcast.emit('user_status_changed', { userId: uid, status: 'online' });

    // Join personal room (for targeted broadcasts like status updates)
    socket.join(`user:${uid}`);

    // ─── JOIN CHAT ROOM ────────────────────────────────────────────────
    socket.on('join_room', async ({ roomId } = {}) => {
      try {
        if (!roomId) return socket.emit('error', { message: 'roomId required' });

        const room = await ChatRoom.findById(roomId).lean();
        if (!room) return socket.emit('error', { message: 'Room not found' });

        const isParticipant = room.participants.some(p => p.toString() === uid);
        if (!isParticipant) return socket.emit('error', { message: 'Not a participant' });

        socket.join(roomId);
        console.log(`[WS] ${socket.userData.username} JOINED room=${roomId}`);

        // Send room info back
        const messages = await Message.find({ roomId })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();

        socket.emit('room_joined', {
          roomId,
          messages: messages.reverse(),
          onlineUsers: room.participants
            .map(p => p.toString())
            .filter(pid => isUserOnline(pid))
        });
      } catch (err) {
        console.error('[WS] join_room error:', err.message);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ─── LEAVE ROOM ────────────────────────────────────────────────────
    socket.on('leave_room', ({ roomId } = {}) => {
      if (roomId) {
        socket.leave(roomId);
        console.log(`[WS] ${socket.userData.username} LEFT room=${roomId}`);
      }
    });

    // ─── SEND MESSAGE ──────────────────────────────────────────────────
    socket.on('send_message', async (data = {}) => {
      try {
        const { roomId, text, type, media, clientMessageId } = data;

        if (!roomId) return socket.emit('error', { message: 'roomId required' });
        if (!text && !media?.url) return socket.emit('error', { message: 'Text or media required' });

        // Validate room & membership
        const room = await ChatRoom.findById(roomId).lean();
        if (!room || !room.participants.some(p => p.toString() === uid)) {
          return socket.emit('error', { message: 'Invalid room' });
        }

        // Deduplicate by clientMessageId
        if (clientMessageId) {
          const existing = await Message.findOne({ roomId, senderId: uid, clientMessageId }).lean();
          if (existing) {
            return socket.emit('message_sent', {
              message: existing,
              duplicate: true
            });
          }
        }

        // Create message in DB
        let message = await Message.create({
          roomId,
          senderId: uid,
          text: text || '',
          type: type || 'text',
          media: media || null,
          status: 'sent',
          clientMessageId: clientMessageId || null
        });

        // Reload with populated sender
        message = await Message.findById(message._id)
          .populate('senderId', 'username displayName avatar')
          .lean();

        // Ensure IDs are strings
        message._id = message._id.toString();
        message.roomId = message.roomId.toString();
        message.senderId = message.senderId._id
          ? { ...message.senderId, _id: message.senderId._id.toString() }
          : message.senderId;

        // Update ChatRoom's lastMessage
        await ChatRoom.findByIdAndUpdate(roomId, {
          lastMessage: message._id,
          lastMessageAt: message.createdAt || new Date()
        });

        // ─── BROADCAST TO ROOM ONLY ──────────────────────────────────
        // socket.to(roomId) excludes the sender's socket
        // io.to(roomId) includes ALL sockets in the room (including sender for multi-tab)
        console.log(`[WS] Broadcasting message ${message._id} to room=${roomId}`);
        io.to(roomId).emit('new_message', message);

        // Send confirmation back to sender
        socket.emit('message_sent', { message });

        // Update sidebar for all participants
        room.participants.forEach(pid => {
          const pidStr = pid.toString();
          io.to(`user:${pidStr}`).emit('room_updated', {
            roomId,
            lastMessage: message,
            lastMessageAt: message.createdAt
          });
        });
      } catch (err) {
        console.error('[WS] send_message error:', err.message);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ─── TYPING ─────────────────────────────────────────────────────────
    socket.on('typing_status', ({ roomId, isTyping } = {}) => {
      if (!roomId) return;
      // Send to EVERYONE in the room except the sender
      socket.to(roomId).emit('typing_status', {
        roomId,
        userId: uid,
        isTyping: Boolean(isTyping)
      });
    });

    // ─── MARK AS READ ───────────────────────────────────────────────────
    socket.on('mark_read', async ({ roomId, messageId } = {}) => {
      try {
        if (!roomId || !messageId) return;

        await Message.findByIdAndUpdate(messageId, { status: 'read' });

        socket.to(roomId).emit('message_read', {
          roomId,
          messageId,
          userId: uid
        });
      } catch (err) {
        console.error('[WS] mark_read error:', err.message);
      }
    });

    // ─── LOAD OLDER MESSAGES ───────────────────────────────────────────
    socket.on('load_messages', async ({ roomId, before, limit = 50 } = {}) => {
      try {
        if (!roomId) return;

        const query = { roomId };
        if (before) {
          query._id = { $lt: before };
        }

        const messages = await Message.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('senderId', 'username displayName avatar')
          .lean();

        socket.emit('load_messages_result', {
          roomId,
          messages: messages.reverse().map(m => ({
            ...m,
            _id: m._id.toString(),
            roomId: m.roomId.toString(),
            senderId: m.senderId?._id
              ? { ...m.senderId, _id: m.senderId._id.toString() }
              : m.senderId
          }))
        });
      } catch (err) {
        console.error('[WS] load_messages error:', err.message);
      }
    });

    // ─── DISCONNECT ─────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[WS] DISCONNECTED user=${socket.userData.username} socket=${socket.id}`);

      // Remove this socket from tracking
      const socketSet = userSockets.get(uid);
      if (socketSet) {
        socketSet.delete(socket.id);
        console.log(`[WS] ${socket.userData.username} has ${socketSet.size} remaining socket(s)`);

        // Only mark offline when ALL tabs are closed
        if (socketSet.size === 0) {
          userSockets.delete(uid);
          try {
            await User.findByIdAndUpdate(uid, { status: 'offline', lastSeen: new Date() });
          } catch (err) {
            console.error('[WS] Failed to update user offline status:', err.message);
          }
          io.emit('user_status_changed', { userId: uid, status: 'offline' });
          console.log(`[WS] ${socket.userData.username} is now FULLY OFFLINE`);
        }
      }
    });

    // ─── SOCKET ERROR ───────────────────────────────────────────────────
    socket.on('error', (err) => {
      console.error(`[WS] Socket error for ${socket.userData.username}:`, err.message || err);
    });
  });
}

module.exports = { setupWebSocket, getOnlineUsers, isUserOnline };
