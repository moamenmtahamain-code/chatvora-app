'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSend, FiHeart, FiEye, FiChevronLeft, FiChevronRight, FiTrash2, FiPlus } from 'react-icons/fi';
import { storyAPI } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

const STORY_DURATION = 5000;

export default function StoryViewer({ stories, initialIndex, onClose, currentUser }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState([]);
  const [showViewers, setShowViewers] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const progressRef = useRef(null);
  const timerRef = useRef(null);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (!currentStory) return;
    markAsViewed(currentStory._id);
    fetchViewers(currentStory._id);
    setReactions(currentStory.reactions || []);
    setProgress(0);
    startProgress();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, currentStory?._id]);

  const startProgress = () => {
    setIsPaused(false);
    const interval = 50;
    const step = (interval / STORY_DURATION) * 100;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (!isPaused) {
        setProgress(prev => {
          const next = prev + step;
          if (next >= 100) {
            clearInterval(timerRef.current);
            goNext();
            return 0;
          }
          return next;
        });
      }
    }, interval);
  };

  const markAsViewed = async (storyId) => {
    try { await storyAPI.view(storyId); } catch (e) {}
  };

  const fetchViewers = async (storyId) => {
    try {
      const res = await storyAPI.getOne(storyId);
      setViewers(res.data?.viewers || []);
    } catch (e) { setViewers([]); }
  };

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    }
  }, [currentIndex]);

  const handleReact = async (emoji) => {
    if (!currentStory) return;
    try {
      await storyAPI.react(currentStory._id);
      setReactions(prev => [...prev, { user: currentUser, emoji, createdAt: new Date() }]);
    } catch (e) {}
  };

  const handleDelete = async () => {
    if (!currentStory) return;
    try {
      await storyAPI.delete(currentStory._id);
      if (stories.length <= 1) {
        onClose();
      } else {
        setCurrentIndex(i => Math.min(i, stories.length - 2));
      }
    } catch (e) {}
  };

  if (!currentStory) return null;

  const isOwn = currentStory.user?._id === currentUser?._id;
  const storyDate = new Date(currentStory.createdAt);

  return (
    <motion.div
      className="story-viewer-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="story-viewer-container">
        <div className="story-progress-bar">
          {stories.map((story, i) => (
            <div key={story._id} className="story-progress-segment">
              <div
                className="story-progress-fill"
                style={{
                  width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
                  background: i <= currentIndex ? 'var(--primary)' : 'rgba(255,255,255,0.2)'
                }}
              />
            </div>
          ))}
        </div>

        <div className="story-viewer-header">
          <div className="story-viewer-user">
            <div className="avatar">
              {currentStory.user?.avatar ? (
                <img src={currentStory.user.avatar} alt="" />
              ) : (
                (currentStory.user?.displayName || '?')[0]
              )}
            </div>
            <div className="story-viewer-info">
              <span className="story-viewer-name">
                {currentStory.user?.displayName || currentStory.user?.username}
              </span>
              <span className="story-viewer-time">
                {formatDistanceToNow(storyDate, { addSuffix: true })}
              </span>
            </div>
          </div>
          <div className="story-viewer-actions-header">
            {viewers.length > 0 && (
              <button className="story-header-btn" onClick={() => setShowViewers(!showViewers)}>
                <FiEye /> {viewers.length}
              </button>
            )}
            {isOwn && (
              <button className="story-header-btn danger" onClick={handleDelete}>
                <FiTrash2 />
              </button>
            )}
            <button className="story-header-btn" onClick={onClose}>
              <FiX />
            </button>
          </div>
        </div>

        <div className="story-viewer-content" onClick={() => setIsPaused(!isPaused)}>
          {currentStory.type === 'image' && currentStory.media?.url && (
            <img src={currentStory.media.url} alt="Story" className="story-media" />
          )}
          {currentStory.type === 'video' && currentStory.media?.url && (
            <video src={currentStory.media.url} className="story-media" autoPlay controls />
          )}
          {currentStory.type === 'text' && (
            <div className="story-text-content" style={{ color: currentStory.textColor || '#fff' }}>
              {currentStory.content}
            </div>
          )}
        </div>

        <AnimatePresence>
          {showViewers && (
            <motion.div
              className="story-viewers-panel"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
            >
              <div className="story-viewers-title">Views ({viewers.length})</div>
              <div className="story-viewers-list">
                {viewers.map((v, i) => (
                  <div key={i} className="story-viewer-item">
                    <div className="avatar">
                      {v.user?.avatar ? (
                        <img src={v.user.avatar} alt="" />
                      ) : (
                        (v.user?.displayName || '?')[0]
                      )}
                    </div>
                    <span>{v.user?.displayName || v.user?.username}</span>
                    <span className="story-viewer-seen">
                      {v.seenAt ? formatDistanceToNow(new Date(v.seenAt), { addSuffix: true }) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="story-navigation">
          {currentIndex > 0 && (
            <button className="story-nav-btn left" onClick={goPrev}>
              <FiChevronLeft />
            </button>
          )}
          {currentIndex < stories.length - 1 && (
            <button className="story-nav-btn right" onClick={goNext}>
              <FiChevronRight />
            </button>
          )}
        </div>

        <div className="story-viewer-footer">
          <div className="story-reactions">
            {reactions.slice(0, 5).map((r, i) => (
              <span key={i} className="story-reaction">{r.emoji}</span>
            ))}
            <button className="story-react-btn" onClick={() => handleReact('❤️')}>
              <FiHeart />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
