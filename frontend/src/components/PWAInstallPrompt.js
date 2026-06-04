'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDownload, FiX, FiSmartphone } from 'react-icons/fi';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // Check if dismissed recently (24h cooldown)
    const dismissedAt = localStorage.getItem('chatvora-install-dismissed');
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < 86400000) return;

    // Detect iOS (no beforeinstallprompt event on iOS)
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Android/Chrome: listen for beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show after a short delay so it doesn't feel intrusive
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Fallback: show iOS instructions or generic prompt after 10 seconds
    if (iOS) {
      setTimeout(() => setShowPrompt(true), 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('chatvora-install-dismissed', Date.now().toString());
  };

  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            maxWidth: '420px',
            width: 'calc(100% - 32px)',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.95), rgba(139,92,246,0.95))',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '20px 24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
            color: '#fff'
          }}
        >
          <button
            onClick={handleDismiss}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            <FiX size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <FiSmartphone size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>
                Install Chatvora
              </div>
              <div style={{ fontSize: '13px', opacity: 0.9, lineHeight: '1.4' }}>
                {isIOS
                  ? 'Tap the Share button (⬆️) then "Add to Home Screen"'
                  : 'Add Chatvora to your home screen for a faster, app-like experience'
                }
              </div>
            </div>
          </div>

          {!isIOS && deferredPrompt && (
            <button
              onClick={handleInstall}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '12px',
                background: '#fff',
                color: '#6366f1',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <FiDownload size={18} />
              Install App
            </button>
          )}

          {isIOS && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '10px',
              fontSize: '12px',
              lineHeight: '1.5'
            }}>
              <strong>Steps:</strong><br />
              1. Tap <span style={{ fontSize: '18px' }}>⬆️</span> Share button at bottom<br />
              2. Scroll down & tap "Add to Home Screen"<br />
              3. Tap "Add" to confirm
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}