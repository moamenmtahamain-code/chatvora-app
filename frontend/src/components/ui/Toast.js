'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiAlertCircle, FiInfo, FiAlertTriangle, FiX } from 'react-icons/fi';

const ToastContext = createContext(null);

const icons = {
  success: FiCheck,
  error: FiAlertCircle,
  info: FiInfo,
  warning: FiAlertTriangle,
};

const colors = {
  success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', icon: '#10b981' },
  error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', icon: '#ef4444' },
  info: { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)', icon: '#6366f1' },
  warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', icon: '#f59e0b' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={{
        position: 'fixed', top: 16, right: 16, zIndex: 99999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none', maxWidth: 400,
      }}>
        <AnimatePresence>
          {toasts.map(toast => {
            const Icon = icons[toast.type];
            const c = colors[toast.type];
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 80, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{
                  pointerEvents: 'auto',
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 12,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}
              >
                <span style={{ color: c.icon, display: 'flex', fontSize: 18, flexShrink: 0 }}>
                  <Icon />
                </span>
                <span style={{ fontSize: 14, color: 'var(--text-dark)', lineHeight: 1.4, flex: 1 }}>
                  {toast.message}
                </span>
                <button
                  onClick={() => removeToast(toast.id)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', padding: 4, display: 'flex',
                    fontSize: 14, flexShrink: 0,
                  }}
                >
                  <FiX />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export default ToastProvider;
