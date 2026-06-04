'use strict';

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const FriendRequest = require('../models/FriendRequest');

// ─── FRIENDS ─────────────────────────────────────────────────────
const { toObjectId } = require('../database/database');

// Get all friends
router.get('/friends', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('contacts', '-password -refreshToken');
    res.json({ friends: user?.contacts || [] });
  } catch (e) {
    res.json({ friends: [] });
  }
});

// Remove friend
router.delete('/friends/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.contacts) {
      user.contacts = user.contacts.filter(c => c.toString() !== req.params.userId);
      await user.save();
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// Send friend request
router.post('/friends/request/:userId', auth, async (req, res) => {
  try {
    if (req.params.userId === req.user.id.toString()) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }
    const existing = await FriendRequest.findBetween(req.user.id, req.params.userId);
    if (existing) {
      return res.status(400).json({ error: 'Request already exists' });
    }
    const request = await FriendRequest.create(req.user.id, req.params.userId);
    res.json({ request });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Get pending friend requests (received)
router.get('/friends/requests', auth, async (req, res) => {
  try {
    const requests = await FriendRequest.findPendingTo(req.user.id);
    // Populate 'from' user info
    const populated = await Promise.all((requests || []).map(async (req) => {
      const fromUser = await User.findById(req.from).select('-password -refreshToken');
      return { ...req, from: fromUser };
    }));
    res.json({ requests: populated });
  } catch (e) {
    res.json({ requests: [] });
  }
});

// Get sent friend requests
router.get('/friends/requests/sent', auth, async (req, res) => {
  try {
    const requests = await FriendRequest.findPendingFrom(req.user.id);
    res.json({ requests });
  } catch (e) {
    res.json({ requests: [] });
  }
});

// Accept friend request
router.put('/friends/requests/:id/accept', auth, async (req, res) => {
  try {
    const updated = await FriendRequest.updateStatus(req.params.id, 'accepted');
    if (updated) {
      // Add each user to the other's contacts
      const fromId = updated.from.toString();
      const toId = updated.to.toString();
      await User.findByIdAndUpdate(toId, { $addToSet: { contacts: fromId } });
      await User.findByIdAndUpdate(fromId, { $addToSet: { contacts: toId } });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// Reject friend request
router.put('/friends/requests/:id/reject', auth, async (req, res) => {
  try {
    await FriendRequest.updateStatus(req.params.id, 'rejected');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Get mutual friends
router.get('/friends/mutual/:userId', auth, async (req, res) => {
  try {
    const mutual = await FriendRequest.getMutualFriends(req.user.id, req.params.userId);
    res.json({ friends: mutual });
  } catch (e) {
    res.json({ friends: [] });
  }
});

// ─── MULTIPLE THEMES ────────────────────────────────────────────
router.get('/themes', (_req, res) => {
  res.json({
    themes: [
      { id: 'dark', name: 'Midnight Blue', primary: '#6366f1', bg: '#0f0f1a', surface: '#1a1a2e' },
      { id: 'light', name: 'Clean White', primary: '#6366f1', bg: '#f8fafc', surface: '#ffffff' },
      { id: 'ocean', name: 'Deep Ocean', primary: '#0ea5e9', bg: '#0c1222', surface: '#162032' },
      { id: 'forest', name: 'Emerald Forest', primary: '#10b981', bg: '#0a1a14', surface: '#122a1e' },
      { id: 'rose', name: 'Rose Garden', primary: '#f43f5e', bg: '#1a0a10', surface: '#2a1420' },
      { id: 'sunset', name: 'Sunset Glow', primary: '#f97316', bg: '#1a100a', surface: '#2a1a14' },
      { id: 'lavender', name: 'Lavender Dream', primary: '#a78bfa', bg: '#141020', surface: '#1e1830' },
      { id: 'amoled', name: 'AMOLED Black', primary: '#6366f1', bg: '#000000', surface: '#0a0a0a' },
      { id: 'nord', name: 'Nord Frost', primary: '#88c0d0', bg: '#2e3440', surface: '#3b4252' },
      { id: 'cyberpunk', name: 'Cyberpunk', primary: '#f0e130', bg: '#0a0a14', surface: '#14142a' },
    ]
  });
});

// ─── QUICK REPLIES ──────────────────────────────────────────────
router.get('/quick-replies', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ replies: user.quickReplies || [] });
});

router.post('/quick-replies', auth, async (req, res) => {
  const { text, shortcut } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  const user = await User.findById(req.user.id);
  if (!user.quickReplies) user.quickReplies = [];
  user.quickReplies.push({ text, shortcut: shortcut || '', _id: Date.now().toString() });
  await user.save();
  res.json({ replies: user.quickReplies });
});

router.delete('/quick-replies/:id', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  user.quickReplies = (user.quickReplies || []).filter(r => r._id !== req.params.id);
  await user.save();
  res.json({ replies: user.quickReplies });
});

// ─── AUTO-REPLY ─────────────────────────────────────────────────
router.get('/auto-reply', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ enabled: user.autoReplyEnabled || false, message: user.autoReplyMessage || '' });
});

router.post('/auto-reply', auth, async (req, res) => {
  const { enabled, message } = req.body;
  const user = await User.findById(req.user.id);
  user.autoReplyEnabled = !!enabled;
  user.autoReplyMessage = message || '';
  await user.save();
  res.json({ enabled: user.autoReplyEnabled, message: user.autoReplyMessage });
});

// ─── SCHEDULED MESSAGES ─────────────────────────────────────────
router.post('/schedule', auth, async (req, res) => {
  const { conversationId, content, scheduledAt } = req.body;
  if (!conversationId || !content || !scheduledAt) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const user = await User.findById(req.user.id);
  if (!user.scheduledMessages) user.scheduledMessages = [];
  const scheduled = {
    _id: Date.now().toString(),
    conversationId,
    content,
    scheduledAt: new Date(scheduledAt),
    status: 'pending',
    createdAt: new Date()
  };
  user.scheduledMessages.push(scheduled);
  await user.save();
  res.json({ scheduled });
});

router.get('/schedule', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ scheduled: user.scheduledMessages || [] });
});

router.delete('/schedule/:id', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  user.scheduledMessages = (user.scheduledMessages || []).filter(s => s._id !== req.params.id);
  await user.save();
  res.json({ success: true });
});

// ─── DISAPPEARING MESSAGES ──────────────────────────────────────
router.post('/disappearing', auth, async (req, res) => {
  const { conversationId, timer } = req.body; // timer in seconds: 0=off, 60=1m, 3600=1h, 86400=24h, 604800=7d
  const conv = await Conversation.findById(conversationId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  conv.disappearingTimer = timer || 0;
  await conv.save();
  res.json({ timer: conv.disappearingTimer });
});

// ─── ANALYTICS ──────────────────────────────────────────────────
router.get('/analytics', auth, async (req, res) => {
  const userId = req.user.id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalMessages, messagesLast30d, conversations] = await Promise.all([
    Message.countDocuments({ sender: userId }),
    Message.countDocuments({ sender: userId, createdAt: { $gte: thirtyDaysAgo } }),
    Conversation.countDocuments({ participants: userId })
  ]);

  const dailyMessages = await Message.aggregate([
    { $match: { sender: userId, createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  const mediaMessages = await Message.countDocuments({
    sender: userId,
    type: { $in: ['image', 'video', 'audio', 'document', 'voice'] }
  });

  res.json({
    totalMessages,
    messagesLast30d,
    conversations,
    mediaMessages,
    dailyMessages,
    avgPerDay: Math.round(messagesLast30d / 30)
  });
});

// ─── EXPORT CONVERSATION ────────────────────────────────────────
router.get('/export/:conversationId', auth, async (req, res) => {
  const messages = await Message.find({ conversation: req.params.conversationId })
    .sort({ createdAt: 1 })
    .populate('sender', 'username displayName')
    .limit(5000);

  let text = '=== Chatvora Conversation Export ===\n';
  text += `Date: ${new Date().toLocaleString()}\n\n`;

  messages.forEach(m => {
    const sender = m.sender?.displayName || m.sender?.username || 'Unknown';
    const time = new Date(m.createdAt).toLocaleString();
    const type = m.type !== 'text' ? `[${m.type.toUpperCase()}] ` : '';
    text += `[${time}] ${sender}: ${type}${m.content || ''}\n`;
  });

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=chat-export.txt');
  res.send(text);
});

// ─── LANGUAGE ───────────────────────────────────────────────────
router.post('/language', auth, async (req, res) => {
  const { language } = req.body;
  const user = await User.findById(req.user.id);
  user.language = language || 'en';
  await user.save();
  res.json({ language: user.language });
});

// ─── 2FA ────────────────────────────────────────────────────────
router.post('/2fa/enable', auth, async (req, res) => {
  const { secret } = req.body;
  const user = await User.findById(req.user.id);
  user.twoFactorSecret = secret;
  user.twoFactorEnabled = true;
  await user.save();
  res.json({ enabled: true });
});

router.post('/2fa/disable', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  user.twoFactorSecret = null;
  user.twoFactorEnabled = false;
  await user.save();
  res.json({ enabled: false });
});

// ─── DND / FOCUS MODE ───────────────────────────────────────────
router.post('/dnd', auth, async (req, res) => {
  const { enabled, until } = req.body;
  const user = await User.findById(req.user.id);
  user.dndEnabled = !!enabled;
  user.dndUntil = until ? new Date(until) : null;
  await user.save();
  res.json({ enabled: user.dndEnabled, until: user.dndUntil });
});

// ─── REPORT CONTENT ─────────────────────────────────────────────
router.post('/report', auth, async (req, res) => {
  const { messageId, reason, details } = req.body;
  if (!messageId || !reason) return res.status(400).json({ error: 'Missing fields' });
  // In production, save to a Report collection or send to admin
  console.log(`[REPORT] User ${req.user.id} reported message ${messageId}: ${reason} - ${details || ''}`);
  res.json({ success: true, message: 'Report submitted successfully' });
});

// ─── CHAT LOCK (SAFE MODE) ─────────────────────────────────────
router.post('/chat-lock', auth, async (req, res) => {
  const { conversationId, pin } = req.body;
  if (!conversationId || !pin) return res.status(400).json({ error: 'Missing fields' });
  const user = await User.findById(req.user.id);
  if (!user.lockedChats) user.lockedChats = new Map();
  user.lockedChats.set(conversationId, pin);
  await user.save();
  res.json({ locked: true });
});

router.post('/chat-lock/verify', auth, async (req, res) => {
  const { conversationId, pin } = req.body;
  const user = await User.findById(req.user.id);
  const storedPin = user.lockedChats?.get(conversationId);
  if (storedPin === pin) {
    res.json({ verified: true });
  } else {
    res.status(401).json({ verified: false, error: 'Incorrect PIN' });
  }
});

router.delete('/chat-lock/:conversationId', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  user.lockedChats?.delete(req.params.conversationId);
  await user.save();
  res.json({ unlocked: true });
});

// ─── LOCATION SHARING ───────────────────────────────────────────
router.post('/location', auth, async (req, res) => {
  const { conversationId, lat, lng, address } = req.body;
  if (!conversationId || !lat || !lng) return res.status(400).json({ error: 'Missing fields' });
  // Create a location message
  const message = new Message({
    conversation: conversationId,
    sender: req.user.id,
    type: 'location',
    content: address || `${lat}, ${lng}`,
    location: { lat, lng, address: address || '' },
    createdAt: new Date()
  });
  await message.save();
  res.json({ message });
});

// ─── TEXT FORMATTING HELPER ─────────────────────────────────────
router.post('/format-text', (_req, res) => {
  // Client-side formatting guide
  res.json({
    formats: {
      bold: { syntax: '*text*', example: '*hello*' },
      italic: { syntax: '_text_', example: '_hello_' },
      strikethrough: { syntax: '~text~', example: '~hello~' },
      code: { syntax: '```text```', example: '```code```' },
      monospace: { syntax: '`text`', example: '`code`' }
    }
  });
});

// ─── AI TRANSLATION ─────────────────────────────────────────────
router.post('/translate', auth, async (req, res) => {
  const { text, targetLang } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  // Simple built-in translation for common phrases
  // In production, integrate with Google Translate API or similar
  const translations = {
    en: { ar: 'Translation service - connect Google Translate API', fr: 'Translation service', es: 'Translation service' },
    ar: { en: 'خدمة الترجمة - قم بتوصيل Google Translate API' }
  };

  try {
    // Try using AI provider for translation
    const aiProvider = require('../services/ai-providers');
    if (aiProvider && aiProvider.generateText) {
      const result = await aiProvider.generateText(`Translate the following text to ${targetLang || 'en'}: "${text}". Only return the translation, nothing else.`);
      return res.json({ translated: result });
    }
  } catch (e) { /* fallback */ }

  res.json({ translated: text, note: 'Connect AI provider for real translation' });
});

// ─── AI SUMMARY ─────────────────────────────────────────────────
router.post('/summarize', auth, async (req, res) => {
  const { conversationId } = req.body;
  if (!conversationId) return res.status(400).json({ error: 'Conversation ID required' });

  const messages = await Message.find({ conversation: conversationId })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('sender', 'displayName username');

  const text = messages.reverse().map(m =>
    `${m.sender?.displayName || 'User'}: ${m.content || '[media]'}`
  ).join('\n');

  try {
    const aiProvider = require('../services/ai-providers');
    if (aiProvider && aiProvider.generateText) {
      const summary = await aiProvider.generateText(`Summarize this conversation in 3-5 bullet points:\n\n${text.slice(0, 3000)}`);
      return res.json({ summary });
    }
  } catch (e) { /* fallback */ }

  res.json({ summary: 'AI summary requires an AI provider to be configured.' });
});

// ─── SMART REPLIES ──────────────────────────────────────────────
router.post('/smart-replies', auth, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    const aiProvider = require('../services/ai-providers');
    if (aiProvider && aiProvider.generateText) {
      const replies = await aiProvider.generateText(
        `Given this message: "${message}", suggest 3 short reply options. Return only the replies separated by "||". Keep each reply under 10 words.`
      );
      return res.json({ replies: replies.split('||').map(r => r.trim()).filter(Boolean) });
    }
  } catch (e) { /* fallback */ }

  // Fallback smart replies
  const fallbackReplies = {
    'hello': ['Hi there! 👋', 'Hello! How are you?', 'Hey! Nice to hear from you'],
    'how are you': ['I\'m good, thanks!', 'Great, how about you?', 'Doing well! 😊'],
    'thanks': ['You\'re welcome!', 'No problem!', 'Anytime! 😊'],
    'bye': ['Goodbye! 👋', 'See you later!', 'Take care!'],
    'ok': ['👍', 'Got it!', 'Sure thing!'],
  };

  const lower = message.toLowerCase().trim();
  for (const [key, replies] of Object.entries(fallbackReplies)) {
    if (lower.includes(key)) return res.json({ replies });
  }

  res.json({ replies: ['👍', 'Thanks!', 'Got it!', 'I\'ll check', 'Sure!'] });
});

// ─── SUPPORT CHAT ───────────────────────────────────────────────
router.post('/support', auth, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    const aiProvider = require('../services/ai-providers');
    if (aiProvider && aiProvider.generateText) {
      const reply = await aiProvider.generateText(
        `You are a helpful support agent for Chatvora messaging app. Answer this question: "${message}". Be concise and friendly.`
      );
      return res.json({ reply });
    }
  } catch (e) { /* fallback */ }

  res.json({ reply: 'Thank you for reaching out! Our support team will get back to you shortly. In the meantime, you can check our FAQ at chatvora.app/help' });
});

module.exports = router;