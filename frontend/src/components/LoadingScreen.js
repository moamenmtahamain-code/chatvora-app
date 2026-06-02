'use client';

import { useEffect, useState } from 'react';

export default function LoadingScreen({ minimumDuration = 800 }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), minimumDuration);
    return () => clearTimeout(timer);
  }, [minimumDuration]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0F172A',
      color: 'white',
      gap: 24,
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 18,
        background: 'linear-gradient(135deg, #6D5DF6, #8b5cf6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
        fontWeight: 800,
        color: 'white',
        boxShadow: '0 8px 32px rgba(109,93,246,0.3)',
      }}>
        C
      </div>

      <div style={{
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: '-0.02em',
      }}>
        Chatvora
      </div>

      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.08)',
        borderTopColor: '#6D5DF6',
        animation: 'chatvora-spin 0.8s linear infinite',
      }} />

      <style>{`
        @keyframes chatvora-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
