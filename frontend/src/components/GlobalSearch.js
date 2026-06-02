'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiX, FiUsers, FiMessageCircle, FiArrowRight, FiClock } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import useChatStore from '../stores/chatStore';
import { userAPI, messageAPI } from '../lib/api';

export default function GlobalSearch({ isOpen, onClose, onSelectConversation }) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const { conversations, createConversation, setActiveConversation } = useChatStore();
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'users', label: 'People' },
    { id: 'messages', label: 'Messages' },
  ];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setUsers([]);
      setMessages([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.length < 2) {
      setUsers([]);
      setMessages([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (activeTab === 'all' || activeTab === 'users') {
          const res = await userAPI.search(query);
          setUsers(res.data || []);
        }
        if (activeTab === 'all' || activeTab === 'messages') {
          const res = await messageAPI.search(query);
          setMessages(res.data || []);
        }
      } catch (e) {
        console.error('Search error:', e);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeTab]);

  const handleSelectUser = async (userResult) => {
    const conv = await createConversation(userResult._id);
    if (conv) {
      setActiveConversation(conv);
      if (onSelectConversation) onSelectConversation(conv);
    }
    onClose();
  };

  const handleSelectConversation = (convId) => {
    const conv = conversations.find(c => c._id === convId);
    if (conv) {
      setActiveConversation(conv);
      if (onSelectConversation) onSelectConversation(conv);
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  const hasResults = users.length > 0 || messages.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="global-search-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="global-search-modal"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="global-search-input-wrap">
              <FiSearch className="global-search-input-icon" />
              <input
                ref={inputRef}
                className="global-search-input"
                type="text"
                placeholder="Search users, messages..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button className="global-search-close" onClick={onClose}>
                <FiX />
              </button>
            </div>

            <div className="global-search-tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`global-search-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="global-search-results">
              {loading ? (
                <div className="global-search-loading">Searching...</div>
              ) : query.length < 2 ? (
                <div className="global-search-hint">
                  <FiSearch size={24} />
                  <p>Type at least 2 characters to search</p>
                </div>
              ) : !hasResults ? (
                <div className="global-search-empty">
                  <FiSearch size={24} />
                  <p>No results found for "{query}"</p>
                </div>
              ) : (
                <>
                  {(activeTab === 'all' || activeTab === 'users') && users.length > 0 && (
                    <div className="global-search-section">
                      <div className="global-search-section-title">
                        <FiUsers /> People
                      </div>
                      {users.map(u => (
                        <div
                          key={u._id}
                          className="global-search-item"
                          onClick={() => handleSelectUser(u)}
                        >
                          <div className="global-search-avatar">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" />
                            ) : (
                              (u.displayName || u.username || '?')[0].toUpperCase()
                            )}
                          </div>
                          <div className="global-search-item-info">
                            <div className="global-search-item-name">{u.displayName || u.username}</div>
                            <div className="global-search-item-sub">@{u.username}</div>
                          </div>
                          <FiArrowRight className="global-search-item-action" />
                        </div>
                      ))}
                    </div>
                  )}

                  {(activeTab === 'all' || activeTab === 'messages') && messages.length > 0 && (
                    <div className="global-search-section">
                      <div className="global-search-section-title">
                        <FiMessageCircle /> Messages
                      </div>
                      {messages.map(msg => (
                        <div
                          key={msg._id}
                          className="global-search-item"
                          onClick={() => handleSelectConversation(msg.conversationId)}
                        >
                          <div className="global-search-avatar small">
                            <FiMessageCircle />
                          </div>
                          <div className="global-search-item-info">
                            <div className="global-search-item-name">
                              {msg.content?.substring(0, 60) || 'Media message'}
                            </div>
                            <div className="global-search-item-sub">
                              <FiClock size={10} />
                              {msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true }) : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
