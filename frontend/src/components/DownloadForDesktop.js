'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDownload, FiCheck, FiMonitor, FiSmartphone, FiX, FiExternalLink } from 'react-icons/fi';

export default function DownloadForDesktop({ variant = 'default', showSuccess = true }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showSuccessMsg, setShowSuccessMsg] = useState(false);
  const [showIOSPopup, setShowIOSPopup] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);
    if (ios) {
      setIsInstallable(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const onInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      if (showSuccess) {
        setShowSuccessMsg(true);
        setTimeout(() => setShowSuccessMsg(false), 4000);
      }
    };
    window.addEventListener('appinstalled', onInstalled);

    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsInstalled(standalone);
      if (standalone) setIsInstallable(false);
    };
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', checkStandalone);

    setTimeout(() => {
      if (!isInstallable && !isInstalled) {
        setManualMode(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
      mq.removeEventListener('change', checkStandalone);
    };
  }, [showSuccess, isInstallable, isInstalled]);

  const handleInstall = useCallback(async () => {
    if (isIOS) {
      setShowIOSPopup(true);
      return;
    }
    if (!deferredPrompt) {
      setShowIOSPopup(true);
      return;
    }

    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstalling(false);

    if (outcome === 'accepted' && showSuccess) {
      setShowSuccessMsg(true);
      setTimeout(() => setShowSuccessMsg(false), 4000);
    }
  }, [deferredPrompt, isIOS, showSuccess]);

  if (isInstalled) {
    return (
      <div className={`download-desktop-installed ${variant}`}>
        <FiCheck size={16} />
        <span>Already Installed</span>
      </div>
    );
  }

  if (!isInstallable && !manualMode) return null;

  if (variant === 'sidebar') {
    return (
      <div className="sidebar-install-btn-wrap">
        <motion.button
          className="sidebar-install-btn"
          onClick={handleInstall}
          disabled={installing}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          {installing ? (
            <span className="auth-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          ) : (
            <FiDownload size={16} />
          )}
          <span>{installing ? 'Installing...' : 'Install Desktop App'}</span>
        </motion.button>
        {showIOSPopup && <IOSPopup visible={showIOSPopup} onClose={() => setShowIOSPopup(false)} />}
      </div>
    );
  }

  if (variant === 'settings') {

    return (
      <div className="download-desktop-settings">
        <motion.button
          className="download-desktop-btn settings"
          onClick={handleInstall}
          disabled={installing}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {installing ? (
            <span className="download-desktop-installing">
              <span className="auth-spinner" />
              Installing...
            </span>
          ) : (
            <>
              <FiDownload size={18} />
              <span>Download for Desktop</span>
              <FiExternalLink size={14} />
            </>
          )}
        </motion.button>
        <p className="download-desktop-hint">
          Install Chatvora on your computer for faster access and offline support
        </p>

        <AnimatePresence>
          {showSuccessMsg && (
            <motion.div
              className="download-desktop-success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <FiCheck /> Chatvora installed successfully!
            </motion.div>
          )}
        </AnimatePresence>

        {isIOS && <IOSPopup visible={showIOSPopup} onClose={() => setShowIOSPopup(false)} />}
      </div>
    );
  }

  return (
    <>
      <motion.button
        className="download-desktop-btn"
        onClick={handleInstall}
        disabled={installing}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        title="Download for Desktop"
      >
        {installing ? (
          <span className="download-desktop-installing">
            <span className="auth-spinner" />
          </span>
        ) : (
          <FiDownload size={18} />
        )}
        <span>{installing ? 'Installing...' : 'Download for Desktop'}</span>
      </motion.button>

      <AnimatePresence>
        {showSuccessMsg && (
          <motion.div
            className="download-desktop-toast"
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
          >
            <FiCheck />
            <span>Chatvora installed! Open from your Start menu.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {isIOS && <IOSPopup visible={showIOSPopup} onClose={() => setShowIOSPopup(false)} />}
    </>
  );
}

function IOSPopup({ visible, onClose }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="install-popup-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="install-popup"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="install-popup-close" onClick={onClose}>
              <FiX size={20} />
            </button>
            <div className="install-popup-icon">
              <FiSmartphone size={32} />
            </div>
            <h3>Install Chatvora on iOS</h3>
            <ol>
              <li>Tap the <strong>Share</strong> button <FiMonitor size={14} /> in Safari</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
              <li>Tap <strong>Add</strong> in the top right</li>
            </ol>
            <button className="install-popup-btn" onClick={onClose}>
              Got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
