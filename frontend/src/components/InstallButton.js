'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiDownload, FiX, FiMonitor, FiSmartphone } from 'react-icons/fi';

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      setIsInstallable(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        setIsInstallable(false);
      }
    };

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setShowPopup(false);
    });

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      mediaQuery.removeEventListener('change', checkInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (isIOS) {
      setShowPopup(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }

    setDeferredPrompt(null);
  }, [deferredPrompt, isIOS]);

  if (isInstalled || !isInstallable) return null;

  return (
    <>
      <button
        onClick={handleInstall}
        className="install-button"
        title="Install Chatvora"
      >
        <FiDownload size={18} />
        <span>Install Chatvora</span>
      </button>

      {isIOS && (
        <div className={`install-popup-overlay ${showPopup ? 'visible' : ''}`} onClick={() => setShowPopup(false)}>
          <div className="install-popup" onClick={(e) => e.stopPropagation()}>
            <button className="install-popup-close" onClick={() => setShowPopup(false)}>
              <FiX size={20} />
            </button>
            <div className="install-popup-icon">
              <FiSmartphone size={32} />
            </div>
            <h3>Install Chatvora</h3>
            <ol>
              <li>Tap the <strong>Share</strong> button <FiMonitor size={14} /> in Safari</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
              <li>Tap <strong>Add</strong> in the top right</li>
            </ol>
            <button className="install-popup-btn" onClick={() => setShowPopup(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
