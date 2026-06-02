'use client';

import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMoreVertical, FiPhone, FiVideo, FiSearch, FiPaperclip,
  FiSmile, FiSend, FiMic, FiImage, FiFile, FiCheck, FiCheckCircle,
  FiClock, FiMessageCircle, FiStar, FiMapPin, FiTrash2, FiEdit3, FiCornerUpLeft, FiShield, FiUserMinus, FiX, FiArrowLeft,
  FiDroplet, FiUpload, FiZap, FiChevronDown
} from 'react-icons/fi';
import EmojiPicker from 'emoji-picker-react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import useAuthStore from '../stores/authStore';
import useChatStore from '../stores/chatStore';
import useCallStore from '../stores/callStore';
import { messageAPI, uploadAPI, userAPI, conversationAPI, aiAPI } from '../lib/api';
import socketEvents, { setActiveConversationId, getActiveConversationId, getSocket } from '../lib/socket';
import VoiceRecorder from './VoiceRecorder';

const BUILTIN_WALLPAPERS = [
  { id: 'default', name: 'Default', gradient: null },
  { id: 'midnight', name: 'Midnight', gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
  { id: 'forest', name: 'Forest', gradient: 'linear-gradient(135deg, #0b3d0b 0%, #1a5c1a 50%, #2d7d2d 100%)' },
  { id: 'royal', name: 'Royal', gradient: 'linear-gradient(135deg, #1a0033 0%, #4a0080 50%, #6600cc 100%)' },
  { id: 'sunset', name: 'Sunset', gradient: 'linear-gradient(135deg, #ff6b35 0%, #f7c59f 50%, #efefd0 100%)' },
  { id: 'ocean', name: 'Ocean', gradient: 'linear-gradient(135deg, #0077b6 0%, #00b4d8 50%, #90e0ef 100%)' },
  { id: 'rose', name: 'Rose', gradient: 'linear-gradient(135deg, #590d22 0%, #800f2f 50%, #a4133c 100%)' },
  { id: 'charcoal', name: 'Charcoal', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' },
  { id: 'lavender', name: 'Lavender', gradient: 'linear-gradient(135deg, #2d1b69 0%, #4a2c8a 50%, #7b5ea7 100%)' },
  { id: 'teal', name: 'Teal', gradient: 'linear-gradient(135deg, #004d40 0%, #00695c 50%, #00897b 100%)' },
];
const ChatArea = memo(function ChatArea({ conversation, user, onBack, isMobile, isAIChat }) {
  const otherUser = conversation?.user || conversation?.User || {};
  const chatuser = conversation?.user || conversation?.User || {};
  const chatUser = conversation?.user || conversation?.User || {};
  const [messageText, setMessageText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [groupEdit, setGroupEdit] = useState({ name: '', description: '' });
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const isLoadingMoreRef = useRef(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardResults, setForwardResults] = useState([]);
  const [selectedForwardConv, setSelectedForwardConv] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const searchInputRef = useRef(null);
  const { messages, isLoadingMessages, sendMessage, loadMoreMessages, updateConversationWallpaper, updateConversationLastMessage, upsertConversation, setActiveConversation, createConversation } = useChatStore();
  const { initiateCall, joinRoom } = useCallStore();
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [wallpaperBlur, setWallpaperBlur] = useState(conversation?.wallpaper?.blur ?? 0);
  const [wallpaperBrightness, setWallpaperBrightness] = useState(conversation?.wallpaper?.brightness ?? 0.6);
  const [isAIMode, setIsAIMode] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const mentionIndexRef = useRef(-1);

  const getGroupMemberRole = (memberId) => {
    if (!conversation || conversation.type !== 'group' || !conversation.groupMembers) {
      return null;
    }
    const member = conversation.groupMembers.find(m => m.user === memberId || m.user?._id === memberId);
    return member?.role || 'member';
  };

  const canManageGroupMessages = (messageSenderId) => {
    if (!conversation || conversation.type !== 'group') return false;
    const currentUserRole = getGroupMemberRole(user?._id);
    if (currentUserRole === 'admin' || currentUserRole === 'owner') return true;
    return user?._id === messageSenderId;
  };

  // Auto-enable AI mode for Nexus AI chat
  useEffect(() => {
    if (isAIChat) {
      setIsAIMode(true);
    } else {
      setIsAIMode(false);
    }
  }, [isAIChat]);

  // Join room for real-time updates
  useEffect(() => {
    if (!conversation || !conversation._id) return;
    const roomId = conversation._id;

    // Track active room for auto-rejoin on socket reconnect
    setActiveConversationId(roomId);

    console.log('[ChatArea] joining room:', roomId);
    try {
      socketEvents.joinConversation(roomId);
    } catch (e) {
      console.warn('joinConversation failed', e);
    }

    return () => {
      console.log('[ChatArea] leaving room:', roomId);
      try {
        socketEvents.leaveConversation(roomId);
        if (getActiveConversationId() === roomId) {
          setActiveConversationId(null);
        }
      } catch (e) {}
    };
  }, [conversation?._id]);

  // Listen for real-time incoming messages
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleIncomingMessage = (newMessage) => {
      if (newMessage.conversation === conversation?._id || newMessage.conversation?._id === conversation?._id) {
        useChatStore.getState().addMessage(newMessage);
      }
    };

    socket.on('message-received', handleIncomingMessage);
    socket.on('new-message', handleIncomingMessage);

    return () => {
      socket.off('message-received', handleIncomingMessage);
      socket.off('new-message', handleIncomingMessage);
    };
  }, [conversation?._id]);

  // Listen for typing indicators from other users
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUserTyping = (room) => {
      if (room === conversation?._id) {
        setIsTyping(true);
      }
    };
    const handleUserStopTyping = (room) => {
      if (room === conversation?._id) {
        setIsTyping(false);
      }
    };

    socket.on('user-typing', handleUserTyping);
    socket.on('user-stop-typing', handleUserStopTyping);

    return () => {
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stop-typing', handleUserStopTyping);
      setIsTyping(false);
    };
  }, [conversation?._id]);

  // ─── SWIPE-TO-GO-BACK (mobile) ──────────────────────────────────────
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const touchHandlersRef = useRef(null);

  useEffect(() => {
    if (!isMobile || !onBack) return;
    const el = document.querySelector('.chat-area');
    if (!el) return;

    const onTouchStart = (e) => {
      swipeStartX.current = e.touches[0].clientX;
      swipeStartY.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e) => {
      const dx = e.changedTouches[0].clientX - swipeStartX.current;
      const dy = e.changedTouches[0].clientY - swipeStartY.current;
      // Swipe right > 80px and mostly horizontal
      if (dx > 80 && Math.abs(dy) < Math.abs(dx) * 0.6) {
        onBack();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    touchHandlersRef.current = { el, onTouchStart, onTouchEnd };

    return () => {
      const h = touchHandlersRef.current;
      if (h) {
        h.el.removeEventListener('touchstart', h.onTouchStart);
        h.el.removeEventListener('touchend', h.onTouchEnd);
      }
    };
  }, [isMobile, onBack]);

  const isNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    const threshold = 150;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'nearest'
      });
    }
  }, []);

  const checkScrollPosition = useCallback(() => {
    const near = isNearBottom();
    isNearBottomRef.current = near;
    setShowScrollToBottom(!near);
  }, [isNearBottom]);

  const handleScroll = useCallback(async (e) => {
    const el = e.target;
    checkScrollPosition();
    if (el.scrollTop < 80 && !isLoadingMoreRef.current) {
      isLoadingMoreRef.current = true;
      try {
        await loadMoreMessages();
      } finally {
        isLoadingMoreRef.current = false;
      }
    }
  }, [loadMoreMessages, checkScrollPosition]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom(false);
    }
    }, [messages, scrollToBottom]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const handleResize = () => {
      if (isNearBottomRef.current) {
        scrollToBottom(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [scrollToBottom]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setGroupEdit({
      name: conversation?.name || '',
      description: conversation?.description || conversation?.group?.description || ''
    });
    setMemberQuery('');
    setMemberResults([]);
    setWallpaperBlur(conversation?.wallpaper?.blur ?? 0);
    setWallpaperBrightness(conversation?.wallpaper?.brightness ?? 0.6);
  }, [conversation?._id, conversation?.name, conversation?.description, conversation?.wallpaper?.blur, conversation?.wallpaper?.brightness]);

  useEffect(() => {
    if (!showGroupSettings || memberQuery.trim().length < 2) {
      setMemberResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await userAPI.search(memberQuery.trim());
        const currentIds = new Set((conversation?.members || []).map(member => member.user?._id));
        setMemberResults((response.data || []).filter(person => !currentIds.has(person._id)));
      } catch (error) {
        console.error('Member search error:', error);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [memberQuery, showGroupSettings, conversation.members]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();

    if (!messageText.trim()) return;

    if (isAIMode) {
      return handleGenerateImage();
    }

    await sendMessage(messageText, 'text', null, replyingTo?._id);

    // Optimistically update the conversation's lastMessage so the sidebar
    // immediately shows the sent message without waiting for a socket event.
    if (conversation) {
      updateConversationLastMessage(conversation._id, {
        _id: `temp_lm_${Date.now()}`,
        content: messageText,
        type: 'text',
        sender: user?._id,
        createdAt: new Date().toISOString()
      }, { senderId: user?._id });
    }

    setMessageText('');
    setReplyingTo(null);
  };

  const handleGenerateImage = async () => {
    const prompt = messageText.trim();
    if (!prompt) return;

    setIsGeneratingAI(true);
    const promptText = messageText;
    setMessageText('');
    setReplyingTo(null);

    // Show user's prompt as a message
    const userMsgId = `ai_user_${Date.now()}`;
    const userMessage = {
      _id: userMsgId,
      conversationId: conversation?._id,
      sender: { _id: user?._id || 'current-user', username: user?.username || 'You', displayName: user?.displayName || 'You' },
      content: promptText,
      type: 'text',
      status: 'sent',
      createdAt: new Date().toISOString()
    };
    useChatStore.getState().addMessage(userMessage);

    // Show AI generating indicator
    const genId = `ai_gen_${Date.now()}`;
    const generatingMessage = {
      _id: genId,
      conversationId: conversation._id,
      sender: { _id: 'ai-bot', username: 'Nexus AI', displayName: 'Nexus AI' },
      content: `🎨 Generating...`,
      type: 'text',
      status: 'sent',
      createdAt: new Date().toISOString(),
      isGenerating: true
    };
    useChatStore.getState().addMessage(generatingMessage);

    try {
      const response = await aiAPI.generateImage({ prompt: promptText, style: 'realistic' });
      const { url, demo } = response.data;

      if (demo) {
        useChatStore.getState().updateMessageInList(genId, { isGenerating: false, content: `✨ "${promptText}"` });
        setTimeout(() => useChatStore.getState().removeMessage(genId), 1200);
      } else {
        useChatStore.getState().removeMessage(genId);
      }

      const imageMsg = {
        _id: `ai_img_${Date.now()}`,
        conversationId: conversation._id,
        sender: { _id: 'ai-bot', username: 'Nexus AI', displayName: 'Nexus AI' },
        content: promptText,
        type: 'image',
        media: { url, filename: 'ai-generated.png', size: 0, mimeType: 'image/png', type: 'image' },
        status: 'sent',
        createdAt: new Date().toISOString()
      };
      useChatStore.getState().addMessage(imageMsg);

      if (!demo) {
        try { await aiAPI.saveGeneration({ prompt: promptText, url, style: 'realistic' }); } catch (e) {}
      }
    } catch (error) {
      console.error('AI generation error:', error);
      useChatStore.getState().updateMessageInList(genId, { isGenerating: false, content: `❌ ${error.response?.data?.error || error.response?.data?.message || error.message || 'Generation failed'}` });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploading(true);
    setUploadProgress(0);

    const tempId = `upload_${Date.now()}`;
    const fileType = file.type.split('/')[0];
    const msgType = fileType === 'image' ? 'image' : fileType === 'video' ? 'video' : fileType === 'audio' ? 'audio' : 'document';

    useChatStore.getState().addMessage({
      _id: tempId,
      conversationId: conversation?._id,
      sender: user || { _id: user?._id || 'current-user' },
      content: '',
      type: msgType,
      status: 'sending',
      isUploading: true,
      uploadProgress: 0,
      fileName: file.name,
      fileSize: file.size,
      createdAt: new Date().toISOString()
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', conversation?._id);
      if (replyingTo?._id) formData.append('replyTo', replyingTo._id);

      const response = await messageAPI.uploadAndSend(formData);
      const savedMessage = response.data;

      useChatStore.getState().removeMessage(tempId);
      useChatStore.getState().addMessage(savedMessage);
      setShowAttachmentMenu(false);
      setReplyingTo(null);
    } catch (error) {
      console.error('Upload error:', error);
      useChatStore.getState().updateMessageInList(tempId, {
        status: 'failed',
        isUploading: false,
        content: 'Upload failed',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = async (type) => {
    setShowAttachmentMenu(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : type === 'audio' ? 'audio/*' : '*';
    input.multiple = false;

    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setUploadProgress(0);

      // Optimistic message (loading skeleton)
      const tempId = `upload_${Date.now()}`;
      const optimisticMsg = {
        _id: tempId,
        conversationId: conversation?._id,
        sender: user || { _id: user?._id || 'current-user' },
        content: '',
        type: type === 'image' ? 'image' : type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'document',
        status: 'sending',
        media: null,
        createdAt: new Date().toISOString(),
        isUploading: true,
        uploadProgress: 0,
        fileName: file.name,
        fileSize: file.size,
      };
      useChatStore.getState().addMessage(optimisticMsg);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversationId', conversation?._id);
        if (replyingTo?._id) formData.append('replyTo', replyingTo._id);

        // Progress tracking
        const response = await messageAPI.uploadAndSend(formData);
        const savedMessage = response.data;

        // Replace optimistic message with the real one from server
        useChatStore.getState().removeMessage(tempId);
        useChatStore.getState().addMessage(savedMessage);

        setReplyingTo(null);
      } catch (error) {
        console.error('Upload error:', error);
        // Mark the optimistic message as failed
        useChatStore.getState().updateMessageInList(tempId, {
          status: 'failed',
          isUploading: false,
          content: 'Upload failed',
        });
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    };

    input.click();
  };

  const handleReaction = (messageId, emoji) => {
    socketEvents.reactToMessage(
      { conversationId: conversation?._id, messageId, emoji },
      (response) => {
        if (response?.ok && response?.reactions) {
          useChatStore.getState().updateReactions(messageId, response.reactions);
        }
      }
    );
    setShowMessageMenu(null);
  };

  const handleDeleteMessage = (message) => {
    if (conversation?.type === 'group' && (canManageGroupMessages || message.sender?._id === user?._id)) {
      socketEvents.deleteGroupMessage(message._id);
      setShowMessageMenu(null);
      return;
    }
    messageAPI.delete(message._id, true);
    setShowMessageMenu(null);
  };

  const handleCopyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content || '');
    } catch (e) {
      console.error('Copy failed:', e);
    }
    setShowMessageMenu(null);
  };

  const handleEditMessage = (message) => {
    setEditingMessage(message._id);
    setEditText(message.content || '');
    setShowMessageMenu(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || !editingMessage) return;
    socketEvents.editMessage(
      { conversationId: conversation?._id, messageId: editingMessage, content: editText },
      (response) => {
        if (response?.error) {
          console.error('Edit failed:', response.error);
          return;
        }
        if (response?.message) {
          useChatStore.getState().updateMessageInList(editingMessage, {
            content: response.message.content,
            isEdited: true,
            editedAt: response.message.editedAt
          });
        }
      }
    );
    setEditingMessage(null);
    setEditText('');
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDeleteForMe = (message) => {
    socketEvents.deleteForMe(
      { conversationId: conversation?._id, messageId: message._id },
      (response) => {
        if (response?.ok) {
          useChatStore.getState().softDeleteMessage(message._id);
        }
      }
    );
    setShowMessageMenu(null);
  };

  const handleDeleteForEveryone = (message) => {
    socketEvents.deleteForEveryone(
      { conversationId: conversation?._id, messageId: message._id },
      (response) => {
        if (response?.error) {
          console.error('Delete failed:', response.error);
          return;
        }
      }
    );
    setShowMessageMenu(null);
  };

  const handleTogglePin = (message) => {
    socketEvents.togglePin(
      { conversationId: conversation?._id, messageId: message._id },
      (response) => {
        if (response?.ok) {
          useChatStore.getState().togglePinInList(message._id, response.isPinned);
        }
      }
    );
    setShowMessageMenu(null);
  };

  const handleUpdateGroupInfo = () => {
    socketEvents.updateGroupInfo(conversation?.groupId, groupEdit, (response) => {
      if (response?.conversation) {
        useChatStore.getState().updateActiveConversation(response.conversation);
      }
    });
  };

  const handleOpenForward = (message) => {
    setForwardMessage(message);
    setForwardSearch('');
    setForwardResults([]);
    setSelectedForwardConv(null);
    setShowForwardModal(true);
    setShowMessageMenu(null);
  };

  const handleForwardSearch = async (query) => {
    if (query.length < 2) { setForwardResults([]); return; }
    try {
      const response = await userAPI.search(query);
      setForwardResults(response.data || []);
    } catch (e) {
      console.error('Forward search error:', e);
    }
  };

  const handleSelectForwardTarget = async (personId) => {
    try {
      const response = await conversationAPI.create({ participantId: personId, type: 'direct' });
      setSelectedForwardConv(response.data._id);
    } catch (e) {
      console.error('Create conversation error:', e);
    }
  };

  const handleSendForward = async () => {
    if (!forwardMessage || !selectedForwardConv) return;
    try {
      await messageAPI.forward(forwardMessage._id, [selectedForwardConv]);
    } catch (e) {
      console.error('Forward error:', e);
    }
    setShowForwardModal(false);
    setForwardMessage(null);
    setSelectedForwardConv(null);
  };

  const handleReactWithEmoji = (message, emoji) => {
    socketEvents.reactToMessage(
      { conversationId: conversation?._id, messageId: message._id, emoji },
      (response) => {
        if (response?.ok && response?.reactions) {
          useChatStore.getState().updateReactions(message._id, response.reactions);
        }
      }
    );
    setShowReactionPicker(null);
  };

  const handleScrollToMessage = (messageId) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleOpenMenu = useCallback((messageId) => {
    setShowMessageMenu(prev => prev === messageId ? null : messageId);
  }, []);

  // ─── MOBILE LONG-PRESS CONTEXT MENU ──────────────────────────────────
  const longPressTimers = useRef({});

  const handleTouchStart = useCallback((messageId) => {
    longPressTimers.current[messageId] = setTimeout(() => {
      handleOpenMenu(messageId);
      longPressTimers.current[messageId] = null;
    }, 400);
  }, [handleOpenMenu]);

  const handleTouchEnd = useCallback((messageId) => {
    const timer = longPressTimers.current[messageId];
    if (timer) {
      clearTimeout(timer);
      longPressTimers.current[messageId] = null;
    }
  }, []);

  const handleTouchMove = useCallback((messageId) => {
    const timer = longPressTimers.current[messageId];
    if (timer) {
      clearTimeout(timer);
      longPressTimers.current[messageId] = null;
    }
  }, []);

  const formatMessageTime = (date) => {
    const d = new Date(date);
    if (isToday(d)) {
      return format(d, 'HH:mm');
    } else if (isYesterday(d)) {
      return 'Yesterday ' + format(d, 'HH:mm');
    }
    return format(d, 'MMM d, HH:mm');
  };

  if (!conversation) return null;

  const typingUsers = useChatStore(state => state.typingUsers[conversation?._id]);

  return (
    <>
      <div className="chat-header" style={isAIChat ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))', borderBottom: '1px solid rgba(99,102,241,0.12)' } : {}}>
        <div className="chat-header-info">
          {isMobile && (
            <button className="mobile-back-btn" onClick={onBack}>
              <FiArrowLeft />
            </button>
          )}
          {isAIChat ? (
            <>
              <div className="avatar" style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}>
                <FiZap />
              </div>
              <div>
                <div className="chat-header-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Nexus AI
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.2)', color: '#a78bfa', fontWeight: 700 }}>AI</span>
                </div>
                <div className="chat-header-status">
                  <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="online-dot" style={{ background: '#10b981' }}></span>
                    AI Image Generation
                  </span>
                </div>
              </div>
            </>
          ) : (
          <>
          <div className={`avatar ${otherUser?.isOnline ? 'online' : ''}`}>
            {conversation?.type === 'group' && conversation?.avatar ? (
              <img src={conversation.avatar} alt={conversation.name} />
            ) : otherUser?.avatar ? (
              <img src={otherUser.avatar} alt={otherUser.username} />
            ) : (
              (otherUser?.displayName || otherUser?.username || conversation.name || 'G')[0].toUpperCase()
            )}
          </div>
          <div>
            <div className="chat-header-title">
              {conversation?.type === 'direct'
                ? otherUser?.displayName || otherUser?.username
                : conversation?.name
              }
            </div>
            <div className="chat-header-status">
              {isTyping ? (
                <span className="typing-indicator">typing<span className="typing-dots"><span>.</span><span>.</span><span>.</span></span></span>
              ) : otherUser?.isOnline ? (
                <span><span className="online-dot"></span> Online</span>
              ) : otherUser?.lastSeen ? (
                <span>Last seen {formatDistanceToNow(new Date(otherUser.lastSeen))} ago</span>
              ) : conversation?.type === 'group' ? (
                <span>{conversation?.memberCount || conversation?.participants?.length || 0} members</span>
              ) : null}
            </div>
          </div>
          </>
          )}
        </div>

        <div className="chat-header-actions">
          {isAIChat ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="header-action-btn" onClick={() => window.open('/ai', '_blank')} title="Open AI Studio">
                <FiZap />
              </button>
            </div>
          ) : conversation?.type === 'group' ? (
            <>
              <button className="header-action-btn" disabled={!canManageGroupMessages} onClick={async () => {
                const callId = `gcall-${Date.now().toString(36)}`;
                try {
                  socketEvents.createRoom(async (res) => {
                    const roomId = res?.roomId;
                    if (!roomId) return console.error('Failed to create call room');
                    socketEvents.startConversationCall(conversation?._id, roomId, callId, 'audio');
                    await joinRoom(roomId, 'audio');
                  });
                } catch (e) { console.error('Start group call failed', e); }
              }}>
                <FiPhone />
              </button>
              <button className="header-action-btn" disabled={!canManageGroupMessages} onClick={async () => {
                const callId = `gcall-${Date.now().toString(36)}`;
                try {
                  socketEvents.createRoom(async (res) => {
                    const roomId = res?.roomId;
                    if (!roomId) return console.error('Failed to create call room');
                    socketEvents.startConversationCall(conversation?._id, roomId, callId, 'video');
                    await joinRoom(roomId, 'video');
                  });
                } catch (e) { console.error('Start group call failed', e); }
              }}>
                <FiVideo />
              </button>
            </>
          ) : (
            <>
              <button className="header-action-btn" onClick={() => initiateCall(otherUser?._id, 'audio', conversation?._id)}>
                <FiPhone />
              </button>
              <button className="header-action-btn" onClick={() => initiateCall(otherUser?._id, 'video', conversation?._id)}>
                <FiVideo />
              </button>
            </>
          )}
          <button className="header-action-btn" onClick={() => setShowWallpaperPicker(true)} title="Change Wallpaper">
            <FiDroplet />
          </button>
          <button className="header-action-btn" onClick={() => { setShowMessageSearch(true); setTimeout(() => searchInputRef.current?.focus(), 100); }} title="Search messages">
            <FiSearch />
          </button>
          <button className="header-action-btn" onClick={() => conversation?.type === 'group' && setShowGroupSettings(true)}>
            <FiMoreVertical />
          </button>
        </div>
      </div>

      {showMessageSearch && (
        <div className="message-search-bar">
          <FiSearch className="message-search-icon" />
          <input
            ref={searchInputRef}
            className="message-search-input"
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => {
              const q = e.target.value;
              setSearchQuery(q);
              if (q.trim()) {
                const results = messages.reduce((acc, m, i) => {
                  if ((m.content || '').toLowerCase().includes(q.toLowerCase())) {
                    acc.push(i);
                  }
                  return acc;
                }, []);
                setSearchResults(results);
                setSearchActiveIndex(0);
              } else {
                setSearchResults([]);
                setSearchActiveIndex(0);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (searchResults.length === 0) return;
                const idx = searchResults[searchActiveIndex];
                const el = document.getElementById(`msg-${messages[idx]?._id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              if (e.key === 'Escape') {
                setShowMessageSearch(false);
                setSearchQuery('');
                setSearchResults([]);
              }
            }}
          />
          {searchResults.length > 0 && (
            <span className="message-search-count">
              {searchActiveIndex + 1}/{searchResults.length}
            </span>
          )}
          <button className="message-search-close" onClick={() => { setShowMessageSearch(false); setSearchQuery(''); setSearchResults([]); }}>
            <FiX />
          </button>
        </div>
      )}

      <AnimatePresence>
        {showGroupSettings && conversation?.type === 'group' && (
          <motion.div className="group-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setShowGroupSettings(false)}>
            <motion.div className="group-settings-modal" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.97 }} onMouseDown={(event) => event.stopPropagation()}>
              <div className="group-modal-header">
                <div>
                  <h2>{conversation?.name}</h2>
                  <p>{conversation?.memberCount || conversation?.members?.length || 0} members</p>
                </div>
                <button className="group-icon-btn" onClick={() => setShowGroupSettings(false)}>x</button>
              </div>

              <div className="group-settings-body">
                <div className="group-settings-avatar">
                  {conversation?.avatar ? <img src={conversation.avatar} alt={conversation?.name} /> : (conversation?.name || 'G')[0].toUpperCase()}
                </div>

                {canAdminGroup && (
                  <div className="group-admin-tools">
                    <label className="group-field">
                      <span>Group name</span>
                      <input value={groupEdit.name} onChange={(event) => setGroupEdit({ ...groupEdit, name: event.target.value })} />
                    </label>
                    <label className="group-field">
                      <span>Description</span>
                      <textarea rows={3} value={groupEdit.description} onChange={(event) => setGroupEdit({ ...groupEdit, description: event.target.value })} />
                    </label>
                    <button className="group-primary-btn" onClick={handleUpdateGroupInfo}>Save group info</button>

                    <div className="group-search">
                      <FiSearch />
                      <input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Add members..." />
                    </div>
                    <div className="group-user-list compact">
                      {memberResults.map(person => (
                        <button className="group-user-row" key={person._id} onClick={() => handleAddMember(person)}>
                          <div className="mini-avatar">{person.avatar ? <img src={person.avatar} alt={person.username} /> : (person.displayName || person.username)[0].toUpperCase()}</div>
                          <div className="member-main">
                            <strong>{person.displayName || person.username}</strong>
                            <span>@{person.username}</span>
                          </div>
                          <FiUsers />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="group-section-title">Members</div>
                <div className="group-member-management-list">
                  {(conversation.members || []).map(member => (
                    <div className="selected-member-row" key={member.user?._id}>
                      <div className="mini-avatar">{member.user?.avatar ? <img src={member.user.avatar} alt={member.user.username} /> : (member.user?.displayName || member.user?.username || '?')[0].toUpperCase()}</div>
                      <div className="member-main">
                        <strong>{member.user?.displayName || member.user?.username}</strong>
                        <span>@{member.user?.username}</span>
                      </div>
                      {['owner', 'admin'].includes(member.role) && <span className="admin-badge"><FiShield /> Admin</span>}
                      {member.role === 'moderator' && <span className="moderator-badge">Mod</span>}
                      {canAdminGroup && member.role !== 'owner' && member.user?._id !== user?._id && (
                        <button className="group-icon-btn danger" onClick={() => handleRemoveMember(member)}>
                          <FiUserMinus />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={messagesContainerRef}
        className={`messages-container ${conversation?.wallpaper?.type && conversation?.wallpaper?.type !== 'none' ? 'with-wallpaper' : ''}`}
        style={conversation?.wallpaper?.url ? {
          backgroundImage: `url(${conversation.wallpaper.url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          '--wallpaper-blur': `${wallpaperBlur}px`,
          '--wallpaper-brightness': wallpaperBrightness
        } : conversation?.wallpaper?.gradient ? {
          backgroundImage: conversation.wallpaper.gradient,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          '--wallpaper-blur': `${wallpaperBlur}px`,
          '--wallpaper-brightness': wallpaperBrightness
        } : {}}
        onScroll={handleScroll}
      >
        {isAIChat && messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40, textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, boxShadow: '0 0 24px rgba(99,102,241,0.3)' }}>
              <FiZap style={{ color: 'white' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Nexus AI</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 360, lineHeight: 1.5 }}>
                I can generate stunning images from your descriptions. Try typing something like:
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 360 }}>
              {[
                'A cyberpunk city at sunset with neon lights',
                'A fantasy castle floating in the clouds',
                'A photorealistic portrait of a wolf in snow',
                'Anime girl with flowing pink hair in a cherry blossom field',
              ].map((example, i) => (
                <button
                  key={i}
                  onClick={() => { setMessageText(example); inputRef.current?.focus(); }}
                  style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--dark-surface-2)', border: '1px solid var(--dark-border)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.2s' }}
                >
                  ✨ {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {(messages || []).map((message, index) => {
          const isOutgoing = message.sender?._id === user?._id || message.sender === 'current-user';
          const senderRole = getGroupMemberRole(message.sender?._id || message.sender);
          const showDate = index === 0 ||
            new Date(message.createdAt).toDateString() !== new Date(messages[index - 1].createdAt).toDateString();
          const isEditing = editingMessage === message._id;
          const isHighlighted = searchQuery && (message.content || '').toLowerCase().includes(searchQuery.toLowerCase());

          return (
            <div key={message._id} id={`msg-${message._id}`}>
              {showDate && (
                <div className="messages-date-separator">
                  {formatMessageTime(message.createdAt)}
                </div>
              )}

              <div
                className={`message ${isOutgoing ? 'outgoing' : ''} ${message.isPinned ? 'pinned' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                onContextMenu={(e) => { e.preventDefault(); handleOpenMenu(message._id); }}
                onTouchStart={() => handleTouchStart(message._id)}
                onTouchEnd={() => handleTouchEnd(message._id)}
                onTouchMove={() => handleTouchMove(message._id)}
              >
                <div className={`avatar`} style={{ width: '36px', height: '36px', fontSize: '14px' }}>
                  {message.sender?.avatar ? (
                    <img src={message.sender.avatar} alt={message.sender.username} />
                  ) : (
                    (message.sender?.displayName || message.sender?.username || '?')[0].toUpperCase()
                  )}
                </div>

                <div className="message-bubble">
                  {message.isPinned && (
                    <div className="message-pinned-badge"><FiMapPin /> Pinned</div>
                  )}

                  {!isOutgoing && conversation.type === 'group' && (
                    <div className="message-sender">
                      {message.sender?.displayName || message.sender?.username}
                      {['owner', 'admin'].includes(senderRole) && <span className="admin-badge"><FiShield /> Admin</span>}
                      {senderRole === 'moderator' && <span className="moderator-badge">Mod</span>}
                    </div>
                  )}

                  {message.replyTo && (
                    <div className="reply-preview clickable" onClick={() => handleScrollToMessage(message.replyTo._id)}>
                      <FiCornerUpLeft />
                      <div className="reply-preview-content">
                        <div className="reply-preview-sender">
                          {message.replyTo.sender?.displayName || message.replyTo.sender?.username || 'Original'}
                        </div>
                        <div className="reply-preview-text">
                          {message.replyTo.content?.substring(0, 50) || 'Media message'}
                        </div>
                      </div>
                    </div>
                  )}

                  {message.isGenerating ? (
                    <div className="ai-generating">
                      <div className="ai-generating-spinner">
                        <FiZap />
                      </div>
                      <div className="ai-generating-text">
                        <span>Generating image...</span>
                        <span className="ai-generating-prompt">"{message.content?.replace(/^[^"]*"|"...$/g, '') || 'Working on it'}"</span>
                      </div>
                    </div>
                  ) : isEditing ? (
                    <div className="message-edit-container">
                      <textarea
                        className="message-edit-input"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                        rows={2}
                      />
                      <div className="message-edit-actions">
                        <button className="group-secondary-btn" onClick={handleCancelEdit}>Cancel</button>
                        <button className="group-primary-btn" onClick={handleSaveEdit} disabled={!editText.trim()}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {message.isUploading && (
                        <div className="message-upload-skeleton">
                          <div className="upload-skeleton-preview" />
                          <div className="upload-skeleton-info">
                            <div className="upload-skeleton-filename">{message.fileName || 'Uploading...'}</div>
                            <div className="upload-skeleton-progress">
                              <div className="upload-skeleton-bar" />
                            </div>
                          </div>
                        </div>
                      )}

                      {!message.isUploading && message.type === 'image' && message.media?.url && (
                        <div className="message-media-wrapper">
                          <img
                            src={message.media.url}
                            alt={message.media?.filename || 'Shared image'}
                            className="message-image"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {!message.isUploading && message.type === 'video' && message.media?.url && (
                        <div className="message-media-wrapper">
                          <video src={message.media.url} className="message-image" controls />
                        </div>
                      )}

                      {!message.isUploading && message.type === 'audio' && message.media?.url && (
                        <audio src={message.media.url} controls style={{ width: '200px', marginTop: '8px' }} />
                      )}

                      {!message.isUploading && message.type === 'document' && message.media?.url && (
                        <div className="message-document">
                          <FiFile style={{ fontSize: '24px', flexShrink: 0 }} />
                          <div className="message-document-info">
                            <span className="message-document-name">{message.media.filename}</span>
                            <span className="message-document-size">
                              {message.media.size ? (message.media.size / 1024).toFixed(1) + ' KB' : ''}
                            </span>
                          </div>
                          <a
                            href={message.media.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="message-download-btn"
                            title="Download"
                          >
                            Download
                          </a>
                        </div>
                      )}

                      {message.type === 'text' && (
                        <div className="message-content">{message.content}</div>
                      )}

                      {message.isEdited && (
                        <span className="edited-badge">(edited)</span>
                      )}

                      <div className="message-meta">
                        <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
                        {isOutgoing && (
                          <span className="message-status">
                            {message.status === 'sending' && <FiClock style={{ opacity: 0.5 }} />}
                            {message.status === 'sent' && <FiCheck />}
                            {message.status === 'delivered' && <FiCheck style={{ opacity: 0.7 }} />}
                            {message.status === 'seen' && <FiCheckCircle style={{ color: 'var(--primary)' }} />}
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {!isEditing && message.reactions?.length > 0 && (
                    <div className="message-reactions">
                      {message.reactions.map((r, i) => {
                        const isOwn = r.user?._id === user?._id || r.user === user?._id;
                        return (
                          <span
                            key={i}
                            className={`reaction-btn ${isOwn ? 'active' : ''}`}
                            onClick={() => handleQuickReaction(message._id, r.emoji)}
                          >
                            {r.emoji}
                          </span>
                        );
                      })}
                    </div>
                  )}

                </div>

                {!isEditing && (
                  <div className="message-actions-wrapper">
                    <button
                      className="message-action-btn"
                      onClick={() => handleOpenMenu(message._id)}
                      aria-label="Message actions"
                    >
                      <FiMoreVertical />
                    </button>

                    <AnimatePresence>
                      {showMessageMenu === message._id && (
                        <motion.div
                          className="message-menu"
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.12 }}
                        >
                          <div className="message-menu-header">Message Actions</div>

                          <button className="menu-item" onClick={() => { setReplyingTo(message); setShowMessageMenu(null); }}>
                            <FiCornerUpLeft /> Reply
                          </button>

                          {isOutgoing && (
                            <button className="menu-item" onClick={() => handleEditMessage(message)}>
                              <FiEdit3 /> Edit
                            </button>
                          )}

                          <button className="menu-item" onClick={() => handleCopyMessage(message)}>
                            <FiMessageCircle /> Copy
                          </button>

                          <button className="menu-item" onClick={async () => {
                            setShowMessageMenu(null);
                            try {
                              const res = await aiAPI.translate(message.content || '', 'en');
                              const translated = res.data.translatedText;
                              if (translated) {
                                // Show translation as a temporary message or alert
                                useChatStore.getState().addMessage({
                                  _id: `translated_${Date.now()}`,
                                  conversationId: conversation?._id,
                                  sender: { _id: 'translation-bot', username: 'Translation', displayName: 'Translation' },
                                  content: `🌐 Translated: ${translated}`,
                                  type: 'text',
                                  status: 'sent',
                                  createdAt: new Date().toISOString(),
                                  isTransient: true
                                });
                                // Auto-remove after 8 seconds
                                setTimeout(() => {
                                  useChatStore.getState().removeMessage(`translated_${Date.now()}`);
                                }, 8000);
                              }
                            } catch (err) {
                              console.error('Translation failed:', err);
                            }
                          }}>
                            <FiMessageCircle /> Translate
                          </button>

                          <button className="menu-item" onClick={() => handleOpenForward(message)}>
                            <FiSend /> Forward
                          </button>

                          <button className="menu-item" onClick={() => handleTogglePin(message)}>
                            <FiMapPin /> {message.isPinned ? 'Unpin' : 'Pin'}
                          </button>

                          <div className="menu-divider" />

                          <div className="menu-reactions-row">
                            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                              <button
                                key={emoji}
                                className="menu-reaction-btn"
                                onClick={() => handleReactWithEmoji(message, emoji)}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>

                          <div className="menu-divider" />

                          {(isOutgoing || (conversation.type === 'group' && canManageGroupMessages)) && (
                            <>
                              <button className="menu-item danger" onClick={() => handleDeleteForEveryone(message)}>
                                <FiTrash2 /> Delete for everyone
                              </button>
                            </>
                          )}

                          <button className="menu-item danger" onClick={() => handleDeleteForMe(message)}>
                            <FiUserMinus /> Delete for me
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {typingUsers && Object.values(typingUsers).some(v => v) && (
          <div className="typing-indicator">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {showScrollToBottom && (
          <motion.button
            className="scroll-to-bottom-btn"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => { scrollToBottom(true); setShowScrollToBottom(false); }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Scroll to bottom"
          >
            <FiChevronDown size={20} />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="input-area">
        {showAttachmentMenu && (
          <motion.div
            className="attachment-menu"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="attachment-option" onClick={() => handleFileSelect('image')}>
              <div className="attachment-icon image">📷</div>
              <span className="attachment-label">Image</span>
            </div>
            <div className="attachment-option" onClick={() => handleFileSelect('video')}>
              <div className="attachment-icon video">🎥</div>
              <span className="attachment-label">Video</span>
            </div>
            <div className="attachment-option" onClick={() => handleFileSelect('audio')}>
              <div className="attachment-icon audio">🎤</div>
              <span className="attachment-label">Audio</span>
            </div>
            <div className="attachment-option" onClick={() => handleFileSelect('document')}>
              <div className="attachment-icon document">📄</div>
              <span className="attachment-label">File</span>
            </div>
          </motion.div>
        )}

        {replyingTo && (
          <div style={{
            padding: '8px 16px',
            background: 'var(--dark-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: '8px 8px 0 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiCornerUpLeft style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '13px' }}>
                Replying to {replyingTo.sender?.username}
              </span>
            </div>
            <button onClick={() => setReplyingTo(null)} style={{ color: 'var(--text-muted)' }}>✕</button>
          </div>
        )}

        {isAIMode && (
          <div className="ai-mode-bar">
            <FiZap size={16} />
            <span>AI Image Generation — type a description and send</span>
            <button className="ai-mode-cancel" onClick={() => { setIsAIMode(false); setMessageText(''); }}>
              <FiX size={16} />
            </button>
          </div>
        )}

        <AnimatePresence>
          {showVoiceRecorder && (
            <VoiceRecorder
              onSend={(media, duration) => {
                sendMessage('', 'audio', media, replyingTo?._id);
                setReplyingTo(null);
                setShowVoiceRecorder(false);
              }}
              onClose={() => setShowVoiceRecorder(false)}
            />
          )}
        </AnimatePresence>

        <div className="input-actions">
          <button
            className="input-action-btn"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
          >
            <FiPaperclip />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <div className={`message-input-container ${isAIMode ? 'ai-mode' : ''}`}>
          <div style={{ position: 'relative', flex: 1 }}>
            {mentionSuggestions.length > 0 && (
              <div className="mention-dropdown">
                {mentionSuggestions.map((member, i) => (
                  <div
                    key={member.user?._id || i}
                    className={`mention-option ${i === mentionIndexRef.current ? 'active' : ''}`}
                    onMouseDown={() => {
                      const name = member.user?.username || member.user?.displayName || 'User';
                      const atIdx = messageText.lastIndexOf('@', mentionQuery._index);
                      const before = messageText.slice(0, atIdx);
                      const after = messageText.slice(atIdx + mentionQuery.length + 1);
                      setMessageText(`${before}@${name} ${after}`);
                      setMentionSuggestions([]);
                      setMentionQuery('');
                      inputRef.current?.focus();
                    }}
                  >
                    <span className="mention-avatar">
                      {member.user?.avatar ? <img src={member.user.avatar} alt="" /> : (member.user?.displayName || member.user?.username || '?')[0]}
                    </span>
                    <span className="mention-name">{member.user?.displayName || member.user?.username}</span>
                    <span className="mention-role">{member.role}</span>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              className="message-input"
              placeholder={isAIMode ? 'Describe an image to generate...' : 'Type a message...'}
              value={messageText}
              onChange={(e) => {
                const val = e.target.value;
                setMessageText(val);

                // Mention autocomplete detection
                if (conversation?.type === 'group') {
                  const lastAtIndex = val.lastIndexOf('@');
                  if (lastAtIndex !== -1) {
                    const afterAtIndex = val.slice(lastAtIndex + 1);
                    // Only trigger if there's no space after @
                    if (afterAtIndex.length > 0 && !afterAtIndex.includes(' ')) {
                      const members = conversation?.groupMembers || conversation?.participants?.map(p => ({ user: p })) || [];
                      const filtered = members.filter(m => {
                        const name = (m.user?.username || m.user?.displayName || '').toLowerCase();
                        return name.startsWith(afterAtIndex.toLowerCase());
                      });
                      setMentionSuggestions(filtered.slice(0, 8));
                      setMentionQuery({ text: afterAtIndex, _index: lastAtIndex, length: afterAtIndex.length });
                      mentionIndexRef.current = 0;
                    } else {
                      setMentionSuggestions([]);
                      setMentionQuery('');
                    }
                  } else {
                    setMentionSuggestions([]);
                    setMentionQuery('');
                  }
                }

                const socket = getSocket();
                if (socket && conversation?._id) {
                  socket.emit('typing', conversation._id);
                  clearTimeout(typingTimeoutRef.current);
                  typingTimeoutRef.current = setTimeout(() => {
                    socket.emit('stop-typing', conversation._id);
                  }, 2000);
                }
              }}
              onKeyDown={(e) => {
                if (mentionSuggestions.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    mentionIndexRef.current = (mentionIndexRef.current + 1) % mentionSuggestions.length;
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    mentionIndexRef.current = (mentionIndexRef.current - 1 + mentionSuggestions.length) % mentionSuggestions.length;
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    const member = mentionSuggestions[mentionIndexRef.current];
                    if (member) {
                      const name = member.user?.username || member.user?.displayName || 'User';
                      const atIdx = messageText.lastIndexOf('@', mentionQuery._index);
                      const before = messageText.slice(0, atIdx);
                      const after = messageText.slice(atIdx + mentionQuery.length + 1);
                      setMessageText(`${before}@${name} ${after}`);
                      setMentionSuggestions([]);
                      setMentionQuery('');
                    }
                    return;
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <button
              className={`emoji-trigger-btn ${showEmojiPicker ? 'active' : ''}`}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <FiSmile />
            </button>
            {showEmojiPicker && (
              <>
                <div className="emoji-backdrop" onClick={() => setShowEmojiPicker(false)} />
                <div className="emoji-picker-wrapper">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    theme="dark"
                    searchPlaceholder="Search emojis..."
                    width={352}
                    height={420}
                    autoFocusSearch={true}
                  />
                </div>
              </>
            )}
          </div>
          <button
            className={`ai-toggle-btn ${isAIMode ? 'active' : ''}`}
            onClick={() => { setIsAIMode(!isAIMode); if (!isAIMode) inputRef.current?.focus(); }}
            title="AI Image Generation"
            disabled={isGeneratingAI}
          >
            <FiZap />
          </button>
        </div>

        {messageText.trim() ? (
          <button
            className={`send-btn ${isAIMode ? 'ai-send' : ''}`}
            onClick={handleSendMessage}
            disabled={isGeneratingAI}
          >
            {isGeneratingAI ? <span className="ai-spinner" /> : isAIMode ? <FiZap /> : <FiSend />}
          </button>
        ) : !isAIMode ? (
          <button
            className={`send-btn voice-btn ${showVoiceRecorder ? 'recording' : ''}`}
            onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
            title="Voice message"
          >
            <FiMic />
          </button>
        ) : (
          <button
            className="send-btn ai-send"
            onClick={handleSendMessage}
            disabled={!messageText.trim() || isGeneratingAI}
          >
            {isGeneratingAI ? <span className="ai-spinner" /> : <FiZap />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForwardModal && (
          <motion.div
            className="group-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setShowForwardModal(false)}
          >
            <motion.div
              className="forward-modal"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="forward-modal-header">
                <h3>Forward Message</h3>
                <button className="group-icon-btn" onClick={() => setShowForwardModal(false)}><FiX /></button>
              </div>

              <div className="forward-modal-search">
                <FiSearch />
                <input
                  value={forwardSearch}
                  onChange={(e) => { setForwardSearch(e.target.value); handleForwardSearch(e.target.value); }}
                  placeholder="Search people and groups..."
                />
              </div>

              <div className="forward-modal-list">
                  {forwardResults.length > 0 ? (
                  forwardResults.map(person => (
                    <button
                      key={person._id}
                      className="forward-user-row"
                      onClick={() => handleSelectForwardTarget(person._id)}
                    >
                      <div className="mini-avatar">
                        {person.avatar ? <img src={person.avatar} alt={person.username} /> : (person.displayName || person.username)[0].toUpperCase()}
                      </div>
                      <div className="member-main">
                        <strong>{person.displayName || person.username}</strong>
                        <span>@{person.username}</span>
                      </div>
                      <FiSend />
                    </button>
                  ))
                ) : (
                  <div className="forward-empty-state">
                    <FiSend style={{ fontSize: '32px', opacity: 0.4 }} />
                    <p>Search for a person to forward this message</p>
                  </div>
                )}
              </div>

              <div className="forward-modal-footer">
                <button className="group-secondary-btn" onClick={() => setShowForwardModal(false)}>Cancel</button>
                <button className="group-primary-btn" onClick={handleSendForward} disabled={!selectedForwardConv}>
                  Forward
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showReactionPicker && (
          <motion.div
            className="group-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setShowReactionPicker(null)}
          >
            <motion.div
              className="reaction-picker-modal"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h4>Choose Reaction</h4>
              <div className="reaction-picker-grid">
                {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '💯', '✨', '🥰', '😍', '🤩', '👏', '💪', '🤝'].map(emoji => (
                  <button
                    key={emoji}
                    className="reaction-picker-btn"
                    onClick={() => {
                      const msg = messages.find(m => m._id === showReactionPicker);
                      if (msg) handleReactWithEmoji(msg, emoji);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {showWallpaperPicker && (
          <motion.div
            className="group-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setShowWallpaperPicker(false)}
          >
            <motion.div
              className="wallpaper-picker-modal"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="wallpaper-picker-header">
                <h3>Change Wallpaper</h3>
                <button className="group-icon-btn" onClick={() => setShowWallpaperPicker(false)}>
                  <FiX />
                </button>
              </div>

              <div className="wallpaper-picker-body">
                <div className="wallpaper-section-title">Built-in Wallpapers</div>
                <div className="wallpaper-grid">
                  {BUILTIN_WALLPAPERS.map((wp) => (
                    <button
                      key={wp.id}
                      className={`wallpaper-thumb ${conversation?.wallpaper?.gradient === wp.gradient || (!conversation?.wallpaper?.url && !conversation?.wallpaper?.gradient && wp.id === 'default') ? 'active' : ''}`}
                      style={wp.gradient ? { background: wp.gradient } : { background: 'var(--dark-bg)' }}
                      onClick={async () => {
                        if (wp.id === 'default') {
                          await updateConversationWallpaper(conversation._id, { url: null, gradient: null, type: 'none' });
                        } else {
                          await updateConversationWallpaper(conversation._id, { gradient: wp.gradient, type: 'builtin' });
                        }
                        setShowWallpaperPicker(false);
                      }}
                      title={wp.name}
                    >
                      <span className="wallpaper-thumb-label">{wp.name}</span>
                    </button>
                  ))}
                </div>

                <div className="wallpaper-section-title">Custom Wallpaper</div>
                <label className="wallpaper-upload-btn">
                  <FiUpload />
                  <span>Upload Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await updateConversationWallpaper(conversation._id, { file, url: null, type: 'custom' });
                      setShowWallpaperPicker(false);
                    }}
                  />
                </label>

                {conversation?.wallpaper?.type && conversation?.wallpaper?.type !== 'none' && (
                  <>
                    <div className="wallpaper-slider-group">
                      <label className="wallpaper-slider-label">
                        <FiImage size={14} /> Blur
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={wallpaperBlur}
                        onChange={(e) => setWallpaperBlur(Number(e.target.value))}
                        onMouseUp={async () => {
                          await updateConversationWallpaper(conversation._id, { blur: wallpaperBlur });
                        }}
                        onTouchEnd={async () => {
                          await updateConversationWallpaper(conversation._id, { blur: wallpaperBlur });
                        }}
                        className="wallpaper-slider"
                      />
                      <span className="wallpaper-slider-value">{wallpaperBlur}px</span>
                    </div>

                    <div className="wallpaper-slider-group">
                      <label className="wallpaper-slider-label">
                        <FiImage size={14} /> Brightness
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={wallpaperBrightness}
                        onChange={(e) => setWallpaperBrightness(Number(e.target.value))}
                        onMouseUp={async () => {
                          await updateConversationWallpaper(conversation._id, { brightness: wallpaperBrightness });
                        }}
                        onTouchEnd={async () => {
                          await updateConversationWallpaper(conversation._id, { brightness: wallpaperBrightness });
                        }}
                        className="wallpaper-slider"
                      />
                      <span className="wallpaper-slider-value">{Math.round(wallpaperBrightness * 100)}%</span>
                    </div>

                    <button
                      className="wallpaper-remove-btn"
                      onClick={async () => {
                        await updateConversationWallpaper(conversation._id, { url: null, gradient: null, type: 'none', blur: 0, brightness: 0.6 });
                        setShowWallpaperPicker(false);
                      }}
                    >
                      <FiTrash2 /> Remove Wallpaper
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

export default ChatArea;
