import { create } from 'zustand';
import { conversationAPI } from '../lib/api';
import socketEvents from '../lib/socket';

// ─── CIRCULAR IMPORT WORKAROUND ──────────────────────────────────────────
let useAuthStore;
try { useAuthStore = require('./authStore').default || require('./authStore').useAuthStore; } catch (_) {}

export const useChatStore = create((set, get) => ({
  // ─── STATE ───────────────────────────────────────────────────────────
  conversations: [],
  activeConversation: null,
  messages: [],
  isLoadingMessages: false,
  typingUsers: {},

  // ─── CONVERSATIONS ───────────────────────────────────────────────────
  fetchConversations: async () => {
    try {
      const res = await conversationAPI.getAll();
      set({ conversations: res.data });
      return res.data;
    } catch (err) {
      console.error('[chatStore] fetchConversations error:', err);
      return [];
    }
  },

  setActiveConversation: (conv) => {
    set({ activeConversation: conv, messages: [] });
    if (conv) {
      get().fetchMessages(conv._id);
    }
  },

  upsertConversation: (conv) => {
    if (!conv?._id) return;
    set((s) => ({
      conversations: [conv, ...s.conversations.filter((c) => c._id !== conv._id)]
    }));
  },

  updateActiveConversation: (conv) => {
    if (!conv?._id) return;
    set((s) => ({
      activeConversation: s.activeConversation?._id === conv._id ? conv : s.activeConversation,
      conversations: s.conversations.map((c) => (c._id === conv._id ? conv : c))
    }));
  },

  updateConversationLastMessage: (convId, lastMessage, opts = {}) => {
    const cur = useAuthStore?.getState?.()?.user;
    const senderId = opts?.senderId;
    const isOwn = senderId && cur?._id === senderId;
    set((s) => ({
      conversations: s.conversations
        .map((c) =>
          c._id === convId
            ? {
                ...c,
                lastMessage,
                lastMessageAt: lastMessage?.createdAt || new Date().toISOString(),
                unreadCount: isOwn ? (c.unreadCount || 0) : (c.unreadCount || 0) + 1
              }
            : c
        )
        .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))
    }));
  },

  createConversation: async (participantIdOrData) => {
    try {
      const { conversationAPI } = await import('../lib/api');
      const data = typeof participantIdOrData === 'string'
        ? { participantId: participantIdOrData, type: 'direct' }
        : participantIdOrData;
      const res = await conversationAPI.create(data);
      const conv = res.data;
      if (conv) {
        set((s) => ({
          conversations: [conv, ...s.conversations.filter((c) => c._id !== conv._id)]
        }));
      }
      return conv;
    } catch (err) {
      console.error('[chatStore] createConversation error:', err);
      return null;
    }
  },

  // ─── MESSAGES ────────────────────────────────────────────────────────
  fetchMessages: async (convId, before = null) => {
    set({ isLoadingMessages: true });
    try {
      const { messageAPI } = await import('../lib/api');
      const res = await messageAPI.getConversationMessages(convId, before);
      const msgs = res.data;

      set((s) => {
        const merged = before ? [...s.messages, ...msgs] : msgs;
        const seen = new Set();
        const deduped = [];
        for (const m of merged) {
          if (!m || !m._id) continue;
          if (seen.has(m._id)) continue;
          seen.add(m._id);
          deduped.push(m);
        }
        return { messages: deduped, isLoadingMessages: false };
      });

      return msgs;
    } catch (err) {
      console.error('[chatStore] fetchMessages error:', err);
      set({ isLoadingMessages: false });
      return [];
    }
  },

  loadMoreMessages: async () => {
    const { activeConversation, messages, isLoadingMessages } = get();
    if (!activeConversation || isLoadingMessages || messages.length === 0) return;
    const oldest = messages[0];
    return get().fetchMessages(activeConversation._id, oldest._id);
  },

  // ─── ADD MESSAGE (called by socket listeners) ───────────────────────
  addMessage: (message) => {
    if (!message || !message._id) return;

    set((s) => {
      const activeId = s.activeConversation?._id?.toString();
      const msgConvId = message.conversationId?.toString();
      if (!activeId || !msgConvId || activeId !== msgConvId) return s;

      const msgId = message._id?.toString();
      if (s.messages.some((m) => m._id?.toString() === msgId)) return s;

      if (message.clientMessageId) {
        const optIdx = s.messages.findIndex(
          (m) => m.clientMessageId === message.clientMessageId && m.isOptimistic
        );
        if (optIdx !== -1) {
          const next = [...s.messages];
          next[optIdx] = { ...message, isOptimistic: false };
          return { messages: next };
        }
      }

      return { messages: [...s.messages, message] };
    });
  },

  // ─── SEND MESSAGE (optimistic + socket) ─────────────────────────────
  sendMessage: (text, type = 'text', media = null, replyTo = null) => {
    const { activeConversation } = get();
    if (!activeConversation) return;

    const clientMessageId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const tempId = `temp_${clientMessageId}`;
    const currentUser = useAuthStore?.getState?.()?.user || null;

    const optimistic = {
      _id: tempId,
      conversationId: activeConversation._id,
      sender: currentUser || { _id: 'current-user', username: 'You' },
      content: text,
      type,
      media,
      clientMessageId,
      status: 'sending',
      createdAt: new Date().toISOString(),
      isOptimistic: true
    };

    set((s) => {
      const activeId = s.activeConversation?._id?.toString();
      const msgConvId = activeConversation._id?.toString();
      if (!activeId || !msgConvId || activeId !== msgConvId) return s;
      return { messages: [...s.messages, optimistic] };
    });

    socketEvents.sendMessage({
      conversationId: activeConversation._id,
      content: text,
      text,
      type,
      media,
      replyTo,
      clientMessageId
    });
  },

  // ─── TYPING ──────────────────────────────────────────────────────────
  setTyping: (convId, userId, isTyping) => {
    set((s) => ({
      typingUsers: {
        ...s.typingUsers,
        [convId]: {
          ...s.typingUsers[convId],
          [userId]: isTyping
        }
      }
    }));
  },

  // ─── MESSAGE UPDATES ────────────────────────────────────────────────
  updateMessageInList: (messageId, updates) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m._id === messageId ? { ...m, ...updates } : m
      )
    }));
  },

  removeMessage: (messageId) => {
    set((s) => ({
      messages: s.messages.filter((m) => m._id !== messageId)
    }));
  },

  softDeleteMessage: (messageId) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m._id === messageId ? { ...m, isDeleted: true } : m
      )
    }));
  },

  togglePinInList: (messageId, isPinned) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m._id === messageId ? { ...m, isPinned: !!isPinned } : m
      )
    }));
  },

  updateReactions: (messageId, reactions) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m._id === messageId ? { ...m, reactions } : m
      )
    }));
  },

  updateConversationWallpaper: async (convId, wallpaper) => {
    try {
      const { conversationAPI } = await import('../lib/api');
      await conversationAPI.update(convId, { wallpaper });
      set((s) => ({
        activeConversation: s.activeConversation?._id === convId
          ? { ...s.activeConversation, wallpaper }
          : s.activeConversation,
        conversations: s.conversations.map((c) =>
          c._id === convId ? { ...c, wallpaper } : c
        )
      }));
    } catch (err) {
      console.error('[chatStore] updateConversationWallpaper error:', err);
    }
  },

  createGroup: async (data) => {
    try {
      const { conversationAPI } = await import('../lib/api');
      const res = await conversationAPI.createGroup(data);
      const conv = res.data?.conversation || res.data;
      if (conv) {
        set((s) => ({
          conversations: [conv, ...s.conversations.filter((c) => c._id !== conv._id)]
        }));
      }
      return conv;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Could not create the group. Please try again.';
      console.error('[chatStore] createGroup error:', message);
      return { error: message };
    }
  }
}));

export default useChatStore;
