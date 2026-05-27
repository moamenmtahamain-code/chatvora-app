import { io } from 'socket.io-client';

let socket = null;
let currentConversationId = null;
let connectionStatus = 'disconnected';
const connectionListeners = new Set();

// ─── LISTENER TRACKER ─────────────────────────────────────────────────────
const registered = new Map();

function safeOn(event, cb) {
  if (!socket) return;
  let set = registered.get(event);
  if (!set) {
    set = new Set();
    registered.set(event, set);
  }
  if (set.has(cb)) return;
  set.add(cb);
  socket.on(event, cb);
}

function safeOff(event, cb) {
  if (!socket) return;
  const set = registered.get(event);
  try { socket.off(event, cb); } catch (_) {}
  if (set) {
    set.delete(cb);
    if (set.size === 0) registered.delete(event);
  }
}

function removeAllListeners(event) {
  if (!socket) return;
  const set = registered.get(event);
  if (!set) return;
  set.forEach(cb => { try { socket.off(event, cb); } catch (_) {} });
  registered.delete(event);
}

export function listListeners() {
  const result = {};
  for (const [event, set] of registered.entries()) {
    result[event] = set.size;
  }
  return result;
}

// ─── INIT ─────────────────────────────────────────────────────────────────
export function initSocket(token) {
  if (socket) {
    socket.auth.token = token;
    if (!socket.connected) {
      console.log('[socket] Reconnecting with updated token');
      socket.connect();
    }
    return socket;
  }

  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ||
    (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:5000`
      : 'http://127.0.0.1:5000');

  console.log('[socket] Connecting to', SOCKET_URL);

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  });

  function setStatus(status) {
    connectionStatus = status;
    connectionListeners.forEach(fn => fn(status));
  }

  socket.on('connect', () => {
    console.log('[socket] CONNECTED id=' + socket.id);
    setStatus('connected');
    if (currentConversationId) {
      console.log('[socket] Re-joining conversation:', currentConversationId);
      socket.emit('conversation:join', { conversationId: currentConversationId });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[socket] DISCONNECTED reason=' + reason);
    setStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting');
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] CONNECT_ERROR:', err.message);
    setStatus('reconnecting');
  });

  socket.on('reconnect_attempt', (n) => {
    console.log('[socket] Reconnect attempt #' + n);
    setStatus('reconnecting');
  });

  socket.on('reconnect', (n) => {
    console.log('[socket] Reconnected after ' + n + ' attempts');
    setStatus('connected');
    if (currentConversationId) {
      socket.emit('conversation:join', { conversationId: currentConversationId });
    }
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    registered.clear();
    currentConversationId = null;
  }
}

export function setActiveConversationId(id) {
  currentConversationId = id;
}

export function getActiveConversationId() {
  return currentConversationId;
}

// ─── RAW EMIT HELPERS ─────────────────────────────────────────────────────
function emit(event, data, cb) {
  if (!socket?.connected) {
    console.warn('[socket] Cannot emit ' + event + ' — not connected');
    if (typeof cb === 'function') cb({ error: 'Not connected' });
    return;
  }
  if (typeof cb === 'function') {
    socket.emit(event, data, cb);
  } else {
    socket.emit(event, data);
  }
}

// ─── EVENT WRAPPERS ───────────────────────────────────────────────────────
const socketEvents = {
  // ─── Messages ────────────────────────────────────────────────────────
  onMessage: (cb) => safeOn('message:new', cb),
  offMessage: (cb) => safeOff('message:new', cb),

  onMessageSent: (cb) => safeOn('message:sent', cb),
  offMessageSent: (cb) => safeOff('message:sent', cb),

  sendMessage: (data) => emit('message:send', data),

  // ─── Typing ─────────────────────────────────────────────────────────
  onTyping: (cb) => safeOn('message:typing', cb),
  offTyping: (cb) => safeOff('message:typing', cb),
  sendTyping: (convId, isTyping) => emit('message:typing', { conversationId: convId, isTyping }),

  // ─── Read ───────────────────────────────────────────────────────────
  onMessageRead: (cb) => safeOn('message:read', cb),
  offMessageRead: (cb) => safeOff('message:read', cb),
  markRead: (convId, msgId) => emit('message:read', { conversationId: convId, messageId: msgId }),

  // ─── Room management ────────────────────────────────────────────────
  joinConversation: (convId, cb) => {
    console.log('[socket] conversation:join', convId);
    emit('conversation:join', { conversationId: convId }, cb);
  },
  leaveConversation: (convId) => {
    console.log('[socket] conversation:leave', convId);
    emit('conversation:leave', { conversationId: convId });
  },

  // ─── User status ────────────────────────────────────────────────────
  onUserOnline: (cb) => safeOn('user:online', cb),
  offUserOnline: (cb) => safeOff('user:online', cb),
  onUserOffline: (cb) => safeOn('user:offline', cb),
  offUserOffline: (cb) => safeOff('user:offline', cb),

  // ─── Group events ───────────────────────────────────────────────────
  onGroupCreated: (cb) => safeOn('group_created', cb),
  offGroupCreated: (cb) => safeOff('group_created', cb),
  onGroupUpdated: (cb) => safeOn('group:updated', cb),
  offGroupUpdated: (cb) => safeOff('group:updated', cb),
  onGroupMemberJoined: (cb) => safeOn('group:member:joined', cb),
  offGroupMemberJoined: (cb) => safeOff('group:member:joined', cb),
  onGroupMemberLeft: (cb) => safeOn('group:member:left', cb),
  offGroupMemberLeft: (cb) => safeOff('group:member:left', cb),
  onGroupMessageDeleted: (cb) => safeOn('group:message:deleted', cb),
  offGroupMessageDeleted: (cb) => safeOff('group:message:deleted', cb),

  // ─── Sidebar updates ────────────────────────────────────────────────
  onConversationUpdated: (cb) => safeOn('conversation:updated', cb),
  offConversationUpdated: (cb) => safeOff('conversation:updated', cb),

  // ─── Message editing/deletion/reactions ──────────────────────────────
  onMessageEdited: (cb) => safeOn('message:edited', cb),
  offMessageEdited: (cb) => safeOff('message:edited', cb),
  onMessageDeletedForMe: (cb) => safeOn('message:deleted_for_me', cb),
  offMessageDeletedForMe: (cb) => safeOff('message:deleted_for_me', cb),
  onMessageDeletedForEveryone: (cb) => safeOn('message:deleted', cb),
  offMessageDeletedForEveryone: (cb) => safeOff('message:deleted', cb),
  onMessageDeleted: (cb) => safeOn('message:deleted', cb),
  offMessageDeleted: (cb) => safeOff('message:deleted', cb),
  onMessagePinToggled: (cb) => safeOn('message:pin_toggled', cb),
  offMessagePinToggled: (cb) => safeOff('message:pin_toggled', cb),
  onMessageReacted: (cb) => safeOn('message:reacted', cb),
  offMessageReacted: (cb) => safeOff('message:reacted', cb),

  // ─── Legacy aliases (used by ChatArea) ───────────────────────────────
  reactToMessage: (data, cb) => emit('message:react', data, cb),
  updateGroupInfo: (groupId, data, cb) => emit('group:update', { groupId, ...data }, cb),
  addGroupMembers: (groupId, members, cb) => emit('group:add_members', { groupId, members }, cb),
  removeGroupMember: (groupId, userId, cb) => emit('group:remove_member', { groupId, userId }, cb),
  deleteGroupMessage: (messageId) => emit('group:delete_message', { messageId }),
  editMessage: (data, cb) => emit('message:edit', data, cb),
  deleteForMe: (data, cb) => emit('message:delete_for_me', data, cb),
  deleteForEveryone: (data, cb) => emit('message:delete_for_everyone', data, cb),
  togglePin: (data, cb) => emit('message:pin_toggle', data, cb),

  // ─── CALL SIGNALING ──────────────────────────────────────────────────
  // 1:1 call flow
  initiateCall: (data) => emit('call:initiate', data),
  acceptCall: (receiverId, callId) => emit('call:accept', { receiverId, callId }),
  rejectCall: (receiverId, callId) => emit('call:reject', { receiverId, callId }),
  endCall: (receiverIds, callId) => emit('call:end', { receiverIds, callId }),
  sendCallSignal: (receiverId, signal, callId) => emit('call:signal', { receiverId, signal, callId }),

  // Incoming call listeners
  onCallIncoming: (cb) => safeOn('call:incoming', cb),
  offCallIncoming: (cb) => safeOff('call:incoming', cb),
  onConversationCallIncoming: (cb) => safeOn('conversation:call:incoming', cb),
  offConversationCallIncoming: (cb) => safeOff('conversation:call:incoming', cb),
  onGroupCallIncoming: (cb) => safeOn('group:call:incoming', cb),
  offGroupCallIncoming: (cb) => safeOff('group:call:incoming', cb),

  // Call state listeners
  onCallAccepted: (cb) => safeOn('call:accepted', cb),
  offCallAccepted: (cb) => safeOff('call:accepted', cb),
  onCallRejected: (cb) => safeOn('call:rejected', cb),
  offCallRejected: (cb) => safeOff('call:rejected', cb),
  onCallEnded: (cb) => safeOn('call:ended', cb),
  offCallEnded: (cb) => safeOff('call:ended', cb),
  onCallSignal: (cb) => safeOn('call:signal', cb),
  offCallSignal: (cb) => safeOff('call:signal', cb),

  // Room (group) call flow
  createRoom: (cb) => emit('call:create_room', null, cb),
  startConversationCall: (convId, roomId, callId, type) => emit('call:start', { conversationId: convId, roomId, callId, type }),
  joinRoom: (roomId, cb) => emit('room:join', { roomId }, cb),
  leaveRoom: (roomId) => emit('room:leave', { roomId }),
  sendRoomSignal: (roomId, to, signal, callId) => emit('room:signal', { roomId, to, signal, callId }),

  // Room listeners
  onRoomSignal: (cb) => safeOn('room:signal', cb),
  offRoomSignal: (cb) => safeOff('room:signal', cb),
  onRoomParticipantLeft: (cb) => safeOn('room:participant_left', cb),
  offRoomParticipantLeft: (cb) => safeOff('room:participant_left', cb),

  // ─── Connection Status ──────────────────────────────────────────────
  onConnectionChange: (fn) => {
    connectionListeners.add(fn);
    return () => connectionListeners.delete(fn);
  },
  getConnectionStatus: () => connectionStatus,

  // ─── Utilities ──────────────────────────────────────────────────────
  removeAllListeners,
  setActiveConversationId,
  getActiveConversationId
};

export default socketEvents;
