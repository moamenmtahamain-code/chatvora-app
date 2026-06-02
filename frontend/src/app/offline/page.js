'use client';

import { useEffect, useState } from 'react';
import { FiWifiOff, FiRefreshCw } from 'react-icons/fi';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--gradient-dark, #0F172A)',
      color: '#e2e8f0',
      padding: 24,
      textAlign: 'center',
      gap: 24,
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(109,93,246,0.15), rgba(139,92,246,0.15))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 36,
        color: '#6D5DF6',
      }}>
        <FiWifiOff />
      </div>

      <div>
        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 8,
          letterSpacing: '-0.02em',
        }}>
          {isOnline ? 'You\'re back online!' : 'No internet connection'}
        </h1>
        <p style={{
          color: '#94a3b8',
          fontSize: 15,
          lineHeight: 1.6,
          maxWidth: 360,
          margin: '0 auto',
        }}>
          {isOnline
            ? 'Your connection has been restored. Tap below to continue.'
            : 'Please check your connection and try again. Some features may be limited.'}
        </p>
      </div>

      {isOnline ? (
        <button
          onClick={handleRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 32px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #6D5DF6, #8b5cf6)',
            color: 'white',
            fontWeight: 600,
            fontSize: 15,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(109,93,246,0.25)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.03)';
            e.target.style.boxShadow = '0 6px 28px rgba(109,93,246,0.35)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 4px 20px rgba(109,93,246,0.25)';
          }}
        >
          <FiRefreshCw size={18} />
          Continue
        </button>
      ) : (
        <button
          onClick={handleRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 32px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.06)',
            color: '#e2e8f0',
            fontWeight: 600,
            fontSize: 15,
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.06)'; }}
        >
          <FiRefreshCw size={18} />
          Try Again
        </button>
      )}

      <div style={{
        marginTop: 16,
        fontSize: 13,
        color: '#64748b',
      }}>
        Chatvora
      </div>
    </div>
  );
}
