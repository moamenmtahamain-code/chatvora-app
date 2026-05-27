'use client';

import { useEffect } from 'react';
import { ToastProvider } from '../components/ui/Toast';
import useSettingsStore from '../stores/settingsStore';
import ErrorBoundary from '../components/ui/ErrorBoundary';

export default function AppProviders({ children }) {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ErrorBoundary>
  );
}
