'use client';

import { FiWifiOff } from 'react-icons/fi';

export default function OfflinePage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-primary, #0f0f1a)',
      color: 'var(--text-primary, #e2e8f0)',
      padding: '24px',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'rgba(99,102,241,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px'
      }}>
        <FiWifiOff size={40} color="#6366f1" />
      </div>
      <h1 style={{
        fontSize: '24px',
        fontWeight: '700',
        marginBottom: '12px'
      }}>
        You're Offline
      </h1>
      <p style={{
        fontSize: '15px',
        color: 'var(--text-muted, #94a3b8)',
        maxWidth: '360px',
        lineHeight: '1.6',
        marginBottom: '24px'
      }}>
        It looks like you've lost your internet connection. Don't worry — your messages are saved and will be sent once you're back online.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: 'var(--primary, #6366f1)',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 32px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        Try Again
      </button>
    </div>
  );
}