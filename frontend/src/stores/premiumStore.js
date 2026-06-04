'use client';
import { create } from 'zustand';
import api from '../lib/api';

const usePremiumStore = create((set, get) => ({
  // ─── THEMES ─────────────────────────────────────────────────
  themes: [],
  currentTheme: typeof window !== 'undefined' ? localStorage.getItem('chatvora-theme') || 'dark' : 'dark',
  loadThemes: async () => {
    try {
      const { data } = await api.get('/premium/themes');
      set({ themes: data.themes });
    } catch (e) { console.error('Failed to load themes'); }
  },
  setTheme: (themeId) => {
    localStorage.setItem('chatvora-theme', themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    set({ currentTheme: themeId });
  },

  // ─── QUICK REPLIES ─────────────────────────────────────────
  quickReplies: [],
  loadQuickReplies: async () => {
    try {
      const { data } = await api.get('/premium/quick-replies');
      set({ quickReplies: data.replies });
    } catch (e) {}
  },
  addQuickReply: async (text, shortcut) => {
    try {
      const { data } = await api.post('/premium/quick-replies', { text, shortcut });
      set({ quickReplies: data.replies });
    } catch (e) {}
  },
  removeQuickReply: async (id) => {
    try {
      const { data } = await api.delete(`/premium/quick-replies/${id}`);
      set({ quickReplies: data.replies });
    } catch (e) {}
  },

  // ─── AUTO REPLY ────────────────────────────────────────────
  autoReply: { enabled: false, message: '' },
  loadAutoReply: async () => {
    try {
      const { data } = await api.get('/premium/auto-reply');
      set({ autoReply: data });
    } catch (e) {}
  },
  setAutoReply: async (enabled, message) => {
    try {
      const { data } = await api.post('/premium/auto-reply', { enabled, message });
      set({ autoReply: data });
    } catch (e) {}
  },

  // ─── SCHEDULED MESSAGES ────────────────────────────────────
  scheduledMessages: [],
  loadScheduled: async () => {
    try {
      const { data } = await api.get('/premium/schedule');
      set({ scheduledMessages: data.scheduled });
    } catch (e) {}
  },
  scheduleMessage: async (conversationId, content, scheduledAt) => {
    try {
      const { data } = await api.post('/premium/schedule', { conversationId, content, scheduledAt });
      set((s) => ({ scheduledMessages: [...s.scheduledMessages, data.scheduled] }));
    } catch (e) {}
  },
  cancelScheduled: async (id) => {
    try {
      await api.delete(`/premium/schedule/${id}`);
      set((s) => ({ scheduledMessages: s.scheduledMessages.filter(m => m._id !== id) }));
    } catch (e) {}
  },

  // ─── DND / FOCUS MODE ──────────────────────────────────────
  dnd: { enabled: false, until: null },
  setDnd: async (enabled, until) => {
    try {
      const { data } = await api.post('/premium/dnd', { enabled, until });
      set({ dnd: data });
    } catch (e) {}
  },

  // ─── ANALYTICS ─────────────────────────────────────────────
  analytics: null,
  loadAnalytics: async () => {
    try {
      const { data } = await api.get('/premium/analytics');
      set({ analytics: data });
    } catch (e) {}
  },

  // ─── DISAPPEARING ──────────────────────────────────────────
  setDisappearing: async (conversationId, timer) => {
    try {
      await api.post('/premium/disappearing', { conversationId, timer });
    } catch (e) {}
  },

  // ─── EXPORT ────────────────────────────────────────────────
  exportConversation: async (conversationId) => {
    try {
      const { data } = await api.get(`/premium/export/${conversationId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'chat-export.txt'; a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      // fallback: open in new tab
      window.open(`${api.defaults?.baseURL || '/api'}/premium/export/${conversationId}`, '_blank');
    }
  },

  // ─── REPORT ────────────────────────────────────────────────
  reportContent: async (messageId, reason, details) => {
    try {
      await api.post('/premium/report', { messageId, reason, details });
      return true;
    } catch (e) { return false; }
  },

  // ─── TRANSLATE ─────────────────────────────────────────────
  translateMessage: async (text, targetLang) => {
    try {
      const { data } = await api.post('/premium/translate', { text, targetLang });
      return data.translated;
    } catch (e) { return text; }
  },

  // ─── SUMMARIZE ─────────────────────────────────────────────
  summarizeConversation: async (conversationId) => {
    try {
      const { data } = await api.post('/premium/summarize', { conversationId });
      return data.summary;
    } catch (e) { return 'Failed to summarize'; }
  },

  // ─── SMART REPLIES ─────────────────────────────────────────
  getSmartReplies: async (message) => {
    try {
      const { data } = await api.post('/premium/smart-replies', { message });
      return data.replies;
    } catch (e) { return ['👍', 'Thanks!', 'Got it!']; }
  },

  // ─── SUPPORT ───────────────────────────────────────────────
  sendSupportMessage: async (message) => {
    try {
      const { data } = await api.post('/premium/support', { message });
      return data.reply;
    } catch (e) { return 'Support unavailable right now.'; }
  },

  // ─── LANGUAGE ──────────────────────────────────────────────
  language: typeof window !== 'undefined' ? localStorage.getItem('chatvora-lang') || 'en' : 'en',
  setLanguage: async (lang) => {
    localStorage.setItem('chatvora-lang', lang);
    set({ language: lang });
    try { await api.post('/premium/language', { language: lang }); } catch (e) {}
  },

  // ─── TEXT FORMATTING ───────────────────────────────────────
  formatText: (text) => {
    let formatted = text;
    // Bold: *text*
    formatted = formatted.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    // Italic: _text_
    formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Strikethrough: ~text~
    formatted = formatted.replace(/~([^~]+)~/g, '<del>$1</del>');
    // Code: `text`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    return formatted;
  },

  // ─── LOCKED CHATS ──────────────────────────────────────────
  lockedChats: {},
  lockChat: async (conversationId, pin) => {
    try {
      await api.post('/premium/chat-lock', { conversationId, pin });
      set((s) => ({ lockedChats: { ...s.lockedChats, [conversationId]: true } }));
    } catch (e) {}
  },
  verifyChatLock: async (conversationId, pin) => {
    try {
      const { data } = await api.post('/premium/chat-lock/verify', { conversationId, pin });
      return data.verified;
    } catch (e) { return false; }
  },
  unlockChat: async (conversationId) => {
    try {
      await api.delete(`/premium/chat-lock/${conversationId}`);
      set((s) => {
        const next = { ...s.lockedChats };
        delete next[conversationId];
        return { lockedChats: next };
      });
    } catch (e) {}
  },
}));

export default usePremiumStore;