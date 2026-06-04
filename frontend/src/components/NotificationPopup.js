'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiBell, FiX, FiMessageCircle, FiUserPlus } from 'react-icons/fi';
import { premiumAPI } from '../lib/api';
import useChatStore from '../stores/chatStore';
import useAuthStore from '../stores/authStore';

const NOTIFICATION_SOUNDS = {
  message: '/notification.mp3',
  friend: '/friend-request.mp3',
};

export default function NotificationPopup() {
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const user = useAuthStore(s => s.user);

  const playSound = useCallback((type = 'message') => {
    try {
      const audio = new Audio(NOTIFICATION_SOUNDS[type] || NOTIFICATION_SOUNDS.message);
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const res = await premiumAPI.getFriendRequests();
        const reqs = res.data?.received || res.data || [];
        setUnreadCount(prev => {
          if (reqs.length > prev) playSound('friend');
          return reqs.length;
        });
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [user, playSound]);

  const push = useCallback((notif) => {
    setNotifications(prev => [{ ...notif, id: Date.now(), time: new Date() }, ...prev].slice(0, 20));
    playSound(notif.type || 'message');
  }, [playSound]);

  useEffect(() => {
    window.__notify = push;
  }, [push]);

  return (
    <>
      <button className="notification-bell" onClick={() => setShowPanel(!showPanel)}>
        <FiBell size={18} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {showPanel && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <h4>Notifications</h4>
            <button onClick={() => setShowPanel(false)}><FiX /></button>
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">No new notifications</div>
            ) : notifications.map(n => (
              <div key={n.id} className="notification-item">
                <div className="notification-icon">
                  {n.type === 'friend' ? <FiUserPlus /> : <FiMessageCircle />}
                </div>
                <div className="notification-content">
                  <span className="notification-text">{n.text || 'New notification'}</span>
                  <span className="notification-time">
                    {new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button className="notification-dismiss" onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}>
                  <FiX size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}