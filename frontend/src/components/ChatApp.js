'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { FiMenu, FiMessageCircle, FiUsers, FiClock, FiPhone, FiDroplet, FiZap, FiBell, FiShield, FiUploadCloud, FiX, FiSettings, FiSearch } from 'react-icons/fi';
import useAuthStore from '../stores/authStore';
import useChatStore from '../stores/chatStore';
import useCallStore from '../stores/callStore';
import useSettingsStore from '../stores/settingsStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import socketEvents, { listListeners } from '../lib/socket';
import { useWallpaperStore } from '../stores/wallpaperStore';
import { AI_CONVERSATION, AI_BOT } from '../lib/aiBot';
import { requestNotificationPermission, registerPushNotifications } from '../lib/notifications';
import { setupSocketNotifications, teardownSocketNotifications } from '../lib/socketNotifications';
import { isE2EESupported } from '../lib/encryption';
import { useToast } from './ui/Toast';
import useKeyboardShortcuts from '../lib/useKeyboardShortcuts';
import LoadingScreen from './LoadingScreen';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import OnboardingWizard from './OnboardingWizard';
import GlobalSearch from './GlobalSearch';

const CallOverlay = dynamic(() => import('./CallOverlay'), { ssr: false });
const WallpaperPicker = dynamic(() => import('./WallpaperPicker'), { ssr: false });
const ProfileManager = dynamic(() => import('./ProfileManager'), { ssr: false });
const StoryViewer = dynamic(() => import('./StoryViewer'), { ssr: false });
const FileUploader = dynamic(() => import('./FileUploader'), { ssr: false });

export default function ChatApp() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    conversations,
    activeConversation,
    fetchConversations,
    setActiveConversation,
    sendMessage
  } = useChatStore();
  const { currentCall, callStatus } = useCallStore();
  const settings = useSettingsStore();
  const onboarding = useOnboardingStore();
  const addToast = useToast();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState('chats');
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [stories, setStories] = useState([]);
  const [showFileUploader, setShowFileUploader] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [isE2EE, setIsE2EE] = useState(false);
  const [appLoading, setAppLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const { wallpaper, getWallpaperStyle } = useWallpaperStore();
  const wallpaperStyle = getWallpaperStyle();

  // ─── ONBOARDING ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (user && !onboarding.completed && !onboarding.skipped) {
      const timer = setTimeout(() => setShowOnboarding(true), 600);
      return () => clearTimeout(timer);
    }
  }, [user, onboarding.completed, onboarding.skipped]);

  // ─── SHORTCUTS ────────────────────────────────────────────────────────────
  const inputRef = useRef(null);
  useKeyboardShortcuts({
    onEscape: () => { if (activeConversation) setActiveConversation(null); },
    onFocusInput: () => inputRef.current?.focus(),
  });

  // ─── SOCKET CALLBACKS (stable refs) ──────────────────────────────────────
  const callbacksRef = useRef(null);

  if (!callbacksRef.current) {
    const onMessage = (payload) => {
      const message = payload?.message || payload;
      try { useChatStore.getState().addMessage(message); } catch (e) { console.error(e); }
    };

    const onTyping = (data) => {
      try { useChatStore.getState().setTyping(data.conversationId, data.userId, data.isTyping); } catch (e) {}
    };

    const onGroupCreated = ({ conversation }) => {
      try { useChatStore.getState().upsertConversation(conversation); } catch (e) { console.error(e); }
    };

    const onGroupUpdated = ({ conversation }) => {
      try { useChatStore.getState().updateActiveConversation(conversation); } catch (e) { console.error(e); }
    };

    const onGroupMessageDeleted = ({ messageId }) => {
      try { useChatStore.getState().removeMessage(messageId); } catch (e) { console.error(e); }
    };

    const onMessageEdited = ({ message }) => {
      if (!message?._id) return;
      try { useChatStore.getState().updateMessageInList(message._id, { content: message.content, isEdited: message.isEdited, editedAt: message.editedAt }); } catch (e) { console.error(e); }
    };

    const onMessageDeletedForMe = ({ messageId }) => {
      try { useChatStore.getState().softDeleteMessage(messageId); } catch (e) { console.error(e); }
    };

    const onMessageDeletedForEveryone = ({ messageId }) => {
      try { useChatStore.getState().removeMessage(messageId); } catch (e) { console.error(e); }
    };

    const onMessagePinToggled = ({ messageId, isPinned }) => {
      try { useChatStore.getState().togglePinInList(messageId, isPinned); } catch (e) { console.error(e); }
    };

    const onMessageReacted = ({ messageId, reactions }) => {
      try { useChatStore.getState().updateReactions(messageId, reactions); } catch (e) { console.error(e); }
    };

    const onUserOnline = () => useAuthStore.getState().updateOnlineStatus(true);
    const onUserOffline = () => useAuthStore.getState().updateOnlineStatus(false);

    const onConversationUpdated = ({ conversationId, lastMessage, senderId }) => {
      try { useChatStore.getState().updateConversationLastMessage(conversationId, lastMessage, { senderId }); } catch (e) { console.error(e); }
    };

    callbacksRef.current = {
      onMessage, onTyping, onGroupCreated, onGroupUpdated,
      onGroupMessageDeleted, onMessageEdited, onMessageDeletedForMe,
      onMessageDeletedForEveryone, onMessagePinToggled, onMessageReacted,
      onUserOnline, onUserOffline, onConversationUpdated
    };
  }

  // ─── RESPONSIVE ──────────────────────────────────────────────────────────
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) setSidebarOpen(true);
    if (isMobile && sidebarOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
  }, [isMobile, sidebarOpen]);

  // ─── LOADING ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setAppLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // ─── INIT ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchConversations();
    requestNotificationPermission();
    setupSocketNotifications();
    setIsE2EE(isE2EESupported());

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(e => {
        console.warn('[PWA] Service worker registration failed:', e);
      });
    }

    const cbs = callbacksRef.current;
    if (!cbs) return;

    socketEvents.onMessage(cbs.onMessage);
    socketEvents.onMessageSent(cbs.onMessage);
    socketEvents.onTyping(cbs.onTyping);
    socketEvents.onUserOnline(cbs.onUserOnline);
    socketEvents.onUserOffline(cbs.onUserOffline);
    socketEvents.onGroupCreated(cbs.onGroupCreated);
    socketEvents.onGroupUpdated(cbs.onGroupUpdated);
    socketEvents.onGroupMessageDeleted(cbs.onGroupMessageDeleted);
    socketEvents.onMessageEdited(cbs.onMessageEdited);
    socketEvents.onMessageDeletedForMe(cbs.onMessageDeletedForMe);
    socketEvents.onMessageDeletedForEveryone(cbs.onMessageDeletedForEveryone);
    socketEvents.onMessagePinToggled(cbs.onMessagePinToggled);
    socketEvents.onMessageReacted(cbs.onMessageReacted);
    socketEvents.onConversationUpdated(cbs.onConversationUpdated);

    return () => {
      teardownSocketNotifications();
      socketEvents.offMessage(cbs.onMessage);
      socketEvents.offMessageSent(cbs.onMessage);
      socketEvents.offTyping(cbs.onTyping);
      socketEvents.offUserOnline(cbs.onUserOnline);
      socketEvents.offUserOffline(cbs.onUserOffline);
      socketEvents.offGroupCreated(cbs.onGroupCreated);
      socketEvents.offGroupUpdated(cbs.onGroupUpdated);
      socketEvents.offGroupMessageDeleted(cbs.onGroupMessageDeleted);
      socketEvents.offMessageEdited(cbs.onMessageEdited);
      socketEvents.offMessageDeletedForMe(cbs.onMessageDeletedForMe);
      socketEvents.offMessageDeletedForEveryone(cbs.onMessageDeletedForEveryone);
      socketEvents.offMessagePinToggled(cbs.onMessagePinToggled);
      socketEvents.offMessageReacted(cbs.onMessageReacted);
      socketEvents.offConversationUpdated(cbs.onConversationUpdated);
    };
  }, []);

  // ─── CONNECTION STATUS ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = socketEvents.onConnectionChange(setConnectionStatus);
    return unsub;
  }, []);

  const showConnectionBar = connectionStatus !== 'connected';
  const connectionLabel = connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected';

  // ─── HANDLERS ─────────────────────────────────────────────────────────────
  const handleSelectConversation = useCallback((conv) => {
    setActiveConversation(conv);
    setMobileTab('chats');
    if (isMobile) setSidebarOpen(false);
  }, [setActiveConversation, isMobile]);

  const handleOpenProfile = useCallback(() => {
    setShowProfileManager(true);
  }, []);

  const handleViewStory = useCallback((storyList, index) => {
    setStories(storyList);
    setStoryIndex(index);
    setShowStoryViewer(true);
  }, []);

  const handleFileUpload = useCallback(() => {
    setShowFileUploader(true);
  }, []);

  const handleFileSend = useCallback((type, media) => {
    sendMessage('', type, media, null);
    setShowFileUploader(false);
    addToast('File sent', 'success');
  }, [sendMessage, addToast]);

  const handleSelectAIChat = useCallback(() => {
    setActiveConversation(AI_CONVERSATION);
    setMobileTab('chats');
    if (isMobile) setSidebarOpen(false);
  }, [setActiveConversation, isMobile]);

  const handleBackToConversations = useCallback(() => {
    setActiveConversation(null);
    if (isMobile) setSidebarOpen(true);
  }, [setActiveConversation, isMobile]);

  const handleOpenSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);

  const hasGlobalWP = wallpaper.type !== 'default';

  if (appLoading) {
    return <LoadingScreen minimumDuration={1200} />;
  }

  return (
    <div className={`app-container ${hasGlobalWP ? 'has-global-wallpaper' : ''}`}>
      <div className={`connection-bar ${connectionStatus}`}>
        <div className="connection-bar-dot" />
        <span>{connectionLabel}</span>
      </div>

      {hasGlobalWP && (
        <div
          className="global-wallpaper-layer"
          style={{
            ...wallpaperStyle,
            transition: 'background-image 0.4s ease, backdrop-filter 0.3s ease, -webkit-backdrop-filter 0.3s ease'
          }}
        />
      )}

      <div
        className={`sidebar-overlay ${sidebarOpen && isMobile ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className={`sidebar ${isMobile && sidebarOpen ? 'mobile-open' : ''}`}>
        <Sidebar
          user={user}
          conversations={conversations}
          onSelectConversation={handleSelectConversation}
          onSelectAIChat={handleSelectAIChat}
          onCloseSidebar={() => setSidebarOpen(false)}
          isMobile={isMobile}
          onOpenProfile={handleOpenProfile}
          onViewStory={handleViewStory}
          onOpenSettings={handleOpenSettings}
        />
      </div>

      <div className={`chat-area ${isMobile && !activeConversation ? 'hidden-mobile' : ''}`}>
        {activeConversation ? (
          <ChatArea
            key={activeConversation._id}
            conversation={activeConversation}
            user={user}
            onBack={handleBackToConversations}
            isMobile={isMobile}
            isAIChat={activeConversation._id === AI_CONVERSATION._id}
            inputRef={inputRef}
          />
        ) : (
          <div className="empty-chat">
            {isMobile && (
              <button className="mobile-hamburger" onClick={() => setSidebarOpen(true)}>
                <FiMenu />
              </button>
            )}
            <div className="empty-chat-icon">💬</div>
            <h2>Chatvora</h2>
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>

      <div className="mobile-bottom-nav">
        <button className={`mobile-nav-btn ${mobileTab === 'chats' ? 'active' : ''}`} onClick={() => { setMobileTab('chats'); if (!activeConversation) setSidebarOpen(true); }}>
          <FiMessageCircle />
          <span>Chats</span>
        </button>
        <button className={`mobile-nav-btn ${mobileTab === 'groups' ? 'active' : ''}`} onClick={() => setMobileTab('groups')}>
          <FiUsers />
          <span>Groups</span>
        </button>
        <button className={`mobile-nav-btn ${mobileTab === 'calls' ? 'active' : ''}`} onClick={() => setMobileTab('calls')}>
          <FiPhone />
          <span>Calls</span>
        </button>
        <button className={`mobile-nav-btn ${mobileTab === 'status' ? 'active' : ''}`} onClick={() => setMobileTab('status')}>
          <FiClock />
          <span>Status</span>
        </button>
      </div>

      <CallOverlay />

      <div className={`e2ee-badge ${isE2EE ? 'enabled' : ''}`} title={isE2EE ? 'End-to-end encrypted' : 'Encryption not available'}>
        <FiShield size={12} />
        <span>{isE2EE ? 'E2EE' : 'No E2EE'}</span>
      </div>

      <div className="app-actions-stack">
        <button
          className="app-action-btn"
          onClick={() => setShowGlobalSearch(true)}
          title="Search"
          style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary)' }}
        >
          <FiSearch />
        </button>
        <button
          className="app-action-btn"
          onClick={() => window.location.href = '/ai'}
          title="AI Image Studio"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', color: '#a78bfa' }}
        >
          <FiZap />
        </button>
        <button
          className="app-action-btn"
          onClick={() => setShowFileUploader(true)}
          title="Upload Files"
        >
          <FiUploadCloud />
        </button>
        <button
          className={`app-action-btn ${hasGlobalWP ? 'has-wallpaper' : ''}`}
          onClick={() => setShowWallpaperPicker(true)}
          title="Change App Wallpaper"
        >
          <FiDroplet />
        </button>
        <button className="app-action-btn" onClick={handleOpenSettings} title="Settings">
          <FiSettings />
        </button>
      </div>

      <ProfileManager
        isOpen={showProfileManager}
        onClose={() => setShowProfileManager(false)}
      />

      <WallpaperPicker
        isOpen={showWallpaperPicker}
        onClose={() => setShowWallpaperPicker(false)}
      />

      {showStoryViewer && stories.length > 0 && (
        <StoryViewer
          stories={stories}
          initialIndex={storyIndex}
          onClose={() => setShowStoryViewer(false)}
          currentUser={user}
        />
      )}

      {showFileUploader && (
        <FileUploader
          onSend={handleFileSend}
          onClose={() => setShowFileUploader(false)}
        />
      )}

      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}

      <GlobalSearch
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        onSelectConversation={handleSelectConversation}
      />
    </div>
  );
}
