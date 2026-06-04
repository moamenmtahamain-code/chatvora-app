'use client';

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiPlus, FiPhone, FiSettings, FiUsers, FiStar, FiArchive, FiX, FiPhoneIncoming, FiPhoneMissed, FiVideo, FiZap, FiUserPlus, FiCheck, FiUserX } from 'react-icons/fi';
import { formatDistanceToNow, format } from 'date-fns';
import useAuthStore from '../stores/authStore';
import useChatStore from '../stores/chatStore';
import { userAPI, callAPI } from '../lib/api';
import { AI_BOT, AI_CONVERSATION } from '../lib/aiBot';
import useCallStore from '../stores/callStore';
import CreateGroupModal from './CreateGroupModal';
import DownloadForDesktop from './DownloadForDesktop';
import usePremiumStore from '../stores/premiumStore';
import ThemeSwitcher from './ThemeSwitcher';
import NotificationPopup from './NotificationPopup';

const Sidebar = memo(function Sidebar({ user, conversations, onSelectConversation, onCloseSidebar, isMobile, onSelectAIChat, onOpenProfile, onViewStory, onOpenSettings }) {
  const [activeTab, setActiveTab] = useState('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const { logout, updateProfile } = useAuthStore();
  const { activeConversation, setActiveConversation, createConversation } = useChatStore();
  const { initiateCall } = useCallStore();
  const { friends, friendRequests, fetchFriends, fetchFriendRequests, acceptRequest, rejectRequest } = usePremiumStore();

  useEffect(() => {
    if (searchQuery.length >= 2) {
      setIsSearching(true);
      const timer = setTimeout(async () => {
        try {
          const response = await userAPI.search(searchQuery);
          setSearchResults(response.data);
        } catch (error) {
          console.error('Search error:', error);
        }
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSelectConversation = useCallback(async (conv) => {
    setActiveConversation(conv);
    if (onSelectConversation) {
      onSelectConversation(conv);
    }
  }, [onSelectConversation, setActiveConversation]);

  const handleSelectUser = useCallback(async (userResult) => {
    const newConv = await createConversation(userResult._id);
    if (newConv) {
      setActiveConversation(newConv);
      if (onSelectConversation) {
        onSelectConversation(newConv);
      }
    }
    setSearchQuery('');
    setSearchResults([]);
  }, [createConversation, setActiveConversation, onSelectConversation]);

  const getConversationName = (conv) => {
    if (conv.type === 'group' || conv.type === 'channel') {
      return conv.name || 'Group';
    }
    const otherUser = conv.participants?.find(p => p._id !== user?._id);
    return otherUser?.displayName || otherUser?.username || 'Unknown';
  };

  const getConversationAvatar = (conv) => {
    if (conv.type === 'group' || conv.type === 'channel') {
      return conv.avatar ? (
        <img src={conv.avatar} alt={conv.name} />
      ) : (
        <FiUsers />
      );
    }
    const otherUser = conv.participants?.find(p => p._id !== user?._id);
    return otherUser?.avatar ? (
      <img src={otherUser.avatar} alt={otherUser.username} />
    ) : (
      (otherUser?.displayName || otherUser?.username || '?')[0].toUpperCase()
    );
  };

  const getMemberCount = (conv) => {
    return conv.memberCount || conv.group?.memberCount || conv.participants?.length || 0;
  };

  const isUserOnline = (conv) => {
    if (conv.type === 'group') return false;
    const otherUser = conv.participants?.find(p => p._id !== user?._id);
    return otherUser?.isOnline || false;
  };

  const filteredConversations = useMemo(() => conversations.filter(conv => {
    const name = getConversationName(conv).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  }), [conversations, searchQuery]);

  const groupConversations = useMemo(() => filteredConversations.filter(conv => conv.type === 'group'), [filteredConversations]);
  const pinnedConversations = useMemo(() => filteredConversations.filter(conv => conv.isPinned), [filteredConversations]);
  const archivedConversations = useMemo(() => filteredConversations.filter(conv => conv.isArchived), [filteredConversations]);

  useEffect(() => { fetchFriends(); fetchFriendRequests(); }, []);

  const getOnlineMemberCount = (conv) => {
    if (conv.type !== 'group') return 0;
    return conv.participants?.filter(p => p.isOnline).length || 0;
  };

  const tabs = [
    { id: 'chats', label: 'Chats' },
    { id: 'friends', label: `Friends${(friendRequests?.length ?? 0) > 0 ? ` (${friendRequests.length})` : ''}` },
    { id: 'groups', label: 'Groups' },
    { id: 'archive', label: 'Archive' },
    { id: 'calls', label: 'Calls' }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isMobile && (
              <button className="sidebar-close-btn" onClick={onCloseSidebar}>
                <FiX />
              </button>
            )}
            <div
              className="avatar"
              style={{ cursor: 'pointer' }}
              onClick={onOpenProfile}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={user.username} />
              ) : (
                (user?.displayName || user?.username || '?')[0].toUpperCase()
              )}
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '15px' }}>
                {user?.displayName || user?.username}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {user?.isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <NotificationPopup />
            <ThemeSwitcher />
            <button className="header-action-btn" onClick={() => {
              if (activeConversation?.type === 'direct') {
                const targetId = activeConversation.participants?.find(p => p._id !== user?._id)?._id;
                if (targetId) initiateCall(targetId, 'audio', activeConversation._id);
              } else {
                setActiveTab('calls');
              }
            }}>
              <FiPhone />
            </button>
            <button className="header-action-btn" onClick={onOpenSettings}>
              <FiSettings />
            </button>
          </div>
        </div>

        <div className="search-bar">
          <FiSearch style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="search-create-btn"
            onClick={() => setShowCreateGroup(true)}
            title="Create Group"
            aria-label="Create Group"
          >
            <FiPlus />
          </button>
        </div>

        <button className="create-group-btn" onClick={() => setShowCreateGroup(true)}>
          <FiUsers />
          <span>Create Group</span>
        </button>
      </div>

      <div className="sidebar-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="conversation-list">
        {isSearching && searchQuery.length >= 2 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Searching...
          </div>
        ) : searchResults.length > 0 ? (
          <div>
            <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
              CONTACTS
            </div>
            {searchResults.map(result => (
              <div
                key={result._id}
                className="conversation-item"
                onClick={() => handleSelectUser(result)}
              >
                <div className={`avatar ${result.isOnline ? 'online' : ''}`}>
                  {result.avatar ? (
                    <img src={result.avatar} alt={result.username} />
                  ) : (
                    (result.displayName || result.username)[0].toUpperCase()
                  )}
                </div>
                <div className="conversation-info">
                  <div className="conversation-name">{result.displayName || result.username}</div>
                  <div className="conversation-preview">{result.bio || 'Hey there!'}</div>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'chats' ? (
          <>
            <motion.div
              className={`conversation-item ${activeConversation?._id === AI_CONVERSATION._id ? 'active' : ''}`}
              onClick={() => { if (onSelectAIChat) onSelectAIChat(AI_CONVERSATION); }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              style={{ marginBottom: '4px', border: '1px solid rgba(99, 102, 241, 0.12)', borderRadius: '12px', background: activeConversation?._id === AI_CONVERSATION._id ? 'rgba(99, 102, 241, 0.08)' : 'transparent' }}
            >
              <div className="avatar" style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)', boxShadow: '0 0 12px rgba(99,102,241,0.3)' }}>
                <FiZap />
              </div>
              <div className="conversation-info">
                <div className="conversation-name">
                  Nexus AI
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.2)', color: '#a78bfa', fontWeight: 700, marginLeft: 8 }}>AI</span>
                </div>
                <div className="conversation-preview" style={{ color: '#a78bfa' }}>
                  ✨ Generate images from text prompts
                </div>
              </div>
              <div className="conversation-meta">
                <div style={{ fontSize: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  Online
                </div>
              </div>
            </motion.div>

            <div style={{ padding: '4px 16px 8px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Conversations
            </div>

            {filteredConversations.length > 0 ? (
            filteredConversations.map(conv => (
              <motion.div
                key={conv._id}
                className={`conversation-item ${activeConversation?._id === conv._id ? 'active' : ''}`}
                onClick={() => handleSelectConversation(conv)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className={`avatar ${isUserOnline(conv) ? 'online' : ''}`}>
                  {getConversationAvatar(conv)}
                </div>
                <div className="conversation-info">
                  <div className="conversation-name">
                    {getConversationName(conv)}
                    {conv.isPinned && <span className="pinned-icon">📌</span>}
                  </div>
                  <div className="conversation-preview">
                    {conv.type === 'group'
                      ? `${getMemberCount(conv)} members`
                      : conv.lastMessage?.content?.substring(0, 40) || 'No messages yet'}
                    {conv.type !== 'group' && conv.lastMessage?.content?.length > 40 && '...'}
                  </div>
                </div>
                <div className="conversation-meta">
                  {conv.lastMessageAt && (
                    <span className="conversation-time">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                    </span>
                  )}
                  {conv.unreadCount > 0 && (
                    <span className="unread-badge">{conv.unreadCount}</span>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <FiStar style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }} />
              <p>No conversations yet</p>
              <p style={{ fontSize: '13px' }}>Start a new chat!</p>
            </div>
          )}
          </>
        ) : activeTab === 'friends' ? (
          <div style={{ padding: '8px' }}>
            {(friendRequests?.length ?? 0) > 0 && (
              <>
                <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>
                  FRIEND REQUESTS ({friendRequests.length})
                </div>
                {friendRequests.map(req => (
                  <div key={req._id} className="conversation-item" style={{ background: 'rgba(99,102,241,0.06)', borderRadius: '12px', marginBottom: '4px' }}>
                    <div className="avatar">
                      {req.from?.avatar ? <img src={req.from.avatar} alt="" /> : (req.from?.displayName || '?')[0].toUpperCase()}
                    </div>
                    <div className="conversation-info">
                      <div className="conversation-name">{req.from?.displayName || req.from?.username}</div>
                      <div className="conversation-preview">wants to be your friend</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => acceptRequest(req._id)} style={{ background: 'var(--success)', color: '#fff', borderRadius: '8px', padding: '6px 10px', fontSize: '12px' }}><FiCheck /></button>
                      <button onClick={() => rejectRequest(req._id)} style={{ background: 'var(--danger)', color: '#fff', borderRadius: '8px', padding: '6px 10px', fontSize: '12px' }}><FiX /></button>
                    </div>
                  </div>
                ))}
              </>
            )}
            <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
              MY FRIENDS ({friends.length})
            </div>
            {friends.length > 0 ? friends.map(f => (
              <motion.div key={f._id} className="conversation-item" onClick={() => handleSelectUser(f)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <div className={`avatar ${f.isOnline ? 'online' : ''}`}>
                  {f.avatar ? <img src={f.avatar} alt="" /> : (f.displayName || f.username || '?')[0].toUpperCase()}
                </div>
                <div className="conversation-info">
                  <div className="conversation-name">
                    {f.displayName || f.username}
                    {f.badges?.isVerified && <span style={{ color: '#3b82f6', marginLeft: 4 }}>✓</span>}
                    {f.badges?.isPremium && <span style={{ color: '#f59e0b', marginLeft: 4 }}>⭐</span>}
                  </div>
                  <div className="conversation-preview">{f.customStatus || f.bio || 'Hey there!'}</div>
                </div>
              </motion.div>
            )) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FiUserPlus style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.5 }} />
                <p>No friends yet</p>
                <p style={{ fontSize: '13px', marginTop: '8px' }}>Search users and send friend requests!</p>
              </div>
            )}
          </div>
        ) : activeTab === 'archive' ? (
          <div style={{ padding: '8px' }}>
            <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
              ARCHIVED ({archivedConversations.length})
            </div>
            {archivedConversations.length > 0 ? archivedConversations.map(conv => (
              <motion.div key={conv._id} className={`conversation-item ${activeConversation?._id === conv._id ? 'active' : ''}`} onClick={() => handleSelectConversation(conv)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <div className="avatar">{getConversationAvatar(conv)}</div>
                <div className="conversation-info">
                  <div className="conversation-name">{getConversationName(conv)}</div>
                  <div className="conversation-preview">{conv.lastMessage?.content?.substring(0, 40) || 'No messages'}</div>
                </div>
              </motion.div>
            )) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FiArchive style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.5 }} />
                <p>No archived chats</p>
                <p style={{ fontSize: '13px', marginTop: '8px' }}>Archive conversations to hide them</p>
              </div>
            )}
          </div>
        ) : activeTab === 'groups' ? (
          <div className="groups-tab-content">
            <div className="groups-list">
              {groupConversations.length > 0 ? (
                groupConversations.map(conv => (
                  <motion.div
                    key={conv._id}
                    className={`group-card ${activeConversation?._id === conv._id ? 'active' : ''}`}
                    onClick={() => handleSelectConversation(conv)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="group-card-avatar">
                      {conv.avatar ? (
                        <img src={conv.avatar} alt={conv.name} />
                      ) : (
                        <FiUsers />
                      )}
                    </div>
                    <div className="group-card-info">
                      <div className="group-card-name">{conv.name || 'Group'}</div>
                      <div className="group-card-preview">
                        {conv.lastMessage?.content?.substring(0, 50) || 'No messages yet'}
                      </div>
                      <div className="group-card-meta">
                        <span className="group-card-online">
                          <span className="group-online-dot"></span>
                          {getOnlineMemberCount(conv)} online
                        </span>
                        <span className="group-member-count">
                          {getMemberCount(conv)} members
                        </span>
                        {conv.lastMessageAt && (
                          <span className="group-time">
                            {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="group-card-end">
                      {conv.unreadCount > 0 && (
                        <span className="unread-badge">{conv.unreadCount}</span>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="groups-empty-state">
                  <FiUsers style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }} />
                  <p>No groups yet</p>
                  <p style={{ fontSize: '13px', marginTop: '8px' }}>Create a group to start collaborating</p>
                </div>
              )}
            </div>
            <button className="groups-fab" onClick={() => setShowCreateGroup(true)} title="Create Group">
              <FiPlus />
            </button>
          </div>
        ) : (
          <div className="calls-tab">
            <CallHistory user={user} />
          </div>
        )}
      </div>

      <div className="sidebar-install-section">
        <DownloadForDesktop variant="sidebar" />
      </div>

      <CreateGroupModal
        currentUser={user}
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />
    </div>
  );
});

export default Sidebar;

function CallHistory({ user: propUser }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const storeUser = useAuthStore(state => state.user);
  const currentUser = propUser || storeUser;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    callAPI.getHistory()
      .then(res => { if (mounted) setCalls(res.data || []); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading calls…</div>;
  }

  if (calls.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <FiPhone style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }} />
        <p>No call history</p>
        <p style={{ fontSize: '13px', marginTop: '8px' }}>Your calls will appear here</p>
      </div>
    );
  }

  const getCallIcon = (call) => {
    if (call.status === 'missed' || call.status === 'rejected') return <FiPhoneMissed style={{ color: 'var(--danger)' }} />;
    if (call.type === 'video') return <FiVideo style={{ color: 'var(--primary)' }} />;
    return <FiPhoneIncoming style={{ color: call.caller?._id === currentUser?._id ? 'var(--primary)' : 'var(--success)' }} />;
  };

  return (
    <div className="call-history-list">
      {calls.map((call) => (
        <div key={call._id} className="call-history-item">
          <div className="call-history-avatar">
            {call.caller?.avatar ? (
              <img src={call.caller.avatar} alt="" />
            ) : (
              (call.caller?.displayName || call.caller?.username || '?')[0].toUpperCase()
            )}
          </div>
          <div className="call-history-info">
            <div className="call-history-name">
              {call.caller?.displayName || call.caller?.username || 'Unknown'}
            </div>
            <div className="call-history-meta">
              {getCallIcon(call)}
              <span className="call-history-type">
                {call.type === 'video' ? 'Video' : 'Voice'} call
              </span>
              {call.status === 'missed' && <span className="call-history-badge missed">Missed</span>}
              {call.status === 'rejected' && <span className="call-history-badge rejected">Declined</span>}
              {call.duration > 0 && (
                <span className="call-history-duration">
                  {Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
          <div className="call-history-time">
            {call.startedAt && format(new Date(call.startedAt), 'MMM d, HH:mm')}
          </div>
        </div>
      ))}
    </div>
  );
}
