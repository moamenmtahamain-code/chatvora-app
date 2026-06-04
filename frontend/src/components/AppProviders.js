'use client';

import { useEffect } from 'react';
import { ToastProvider } from '../components/ui/Toast';
import useSettingsStore from '../stores/settingsStore';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import PWAInstallPrompt from './PWAInstallPrompt';

export default function AppProviders({ children }) {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Register service worker for PWA
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        {children}
        <PWAInstallPrompt />
      </ToastProvider>
    </ErrorBoundary>
  );
}
