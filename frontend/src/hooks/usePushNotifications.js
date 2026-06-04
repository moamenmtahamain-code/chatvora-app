'use client';

import { useEffect, useState, useCallback } from 'react';

export function usePushNotifications() {
  const [permission, setPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default'
  );
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator
    );
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Register for push notifications via service worker
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_KEY
        });

        // Send subscription to backend
        try {
          const { default: api } = await import('../lib/api');
          await api.post('/notifications/subscribe', subscription.toJSON());
        } catch (e) {
          console.log('Push subscription save failed (non-critical):', e.message);
        }

        return true;
      }
      return false;
    } catch (error) {
      console.error('Notification permission error:', error);
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback((title, options = {}) => {
    if (permission !== 'granted') return;

    // Use service worker notification if available (works when app is in background)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          vibrate: [200, 100, 200],
          tag: 'chatvora-message',
          renotify: true,
          ...options
        });
      });
    } else {
      // Fallback to regular notification
      new Notification(title, {
        icon: '/icons/icon-192x192.png',
        ...options
      });
    }
  }, [permission]);

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    isGranted: permission === 'granted'
  };
}