'use client';

import { useEffect, useCallback } from 'react';
import useSettingsStore from '../stores/settingsStore';

const SHORTCUTS = {};

export default function useKeyboardShortcuts(handlers = {}) {
  const { enterToSend } = useSettingsStore();

  const handleKeyDown = useCallback((e) => {
    const target = e.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // Ctrl+Enter / Cmd+Enter: Send message (works globally)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handlers.onSend?.(e);
      return;
    }

    // Escape: Close modals, blur inputs
    if (e.key === 'Escape') {
      handlers.onEscape?.(e);
      return;
    }

    // / (slash): Focus search/input when not already in an input
    if (e.key === '/' && !isInput) {
      e.preventDefault();
      handlers.onFocusInput?.(e);
      return;
    }

    // Enter to send when in textarea/text input
    if (e.key === 'Enter' && isInput && enterToSend && !e.shiftKey) {
      e.preventDefault();
      handlers.onSend?.(e);
      return;
    }

    // Arrow Up: Edit last message (when input is empty)
    if (e.key === 'ArrowUp' && isInput && target.value === '') {
      handlers.onEditLastMessage?.(e);
      return;
    }
  }, [enterToSend, handlers.onSend, handlers.onEscape, handlers.onFocusInput, handlers.onEditLastMessage]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
