'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

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
        fontSize: '64px',
        marginBottom: '24px'
      }}>
        ⚠️
      </div>
      <h1 style={{
        fontSize: '24px',
        fontWeight: '700',
        marginBottom: '12px',
        color: '#f43f5e'
      }}>
        Something went wrong
      </h1>
      <p style={{
        fontSize: '15px',
        color: 'var(--text-muted, #94a3b8)',
        marginBottom: '8px',
        maxWidth: '400px'
      }}>
        An unexpected error occurred. Don't worry, your data is safe.
      </p>
      {error?.message && (
        <p style={{
          fontSize: '13px',
          color: 'var(--text-muted, #64748b)',
          background: 'rgba(244, 63, 94, 0.1)',
          padding: '8px 16px',
          borderRadius: '8px',
          marginBottom: '24px',
          maxWidth: '500px',
          wordBreak: 'break-word'
        }}>
          {error.message}
        </p>
      )}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={reset}
          style={{
            background: 'var(--primary, #6366f1)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'opacity 0.2s'
          }}
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            background: 'transparent',
            color: 'var(--text-muted, #94a3b8)',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            borderRadius: '12px',
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'opacity 0.2s'
          }}
        >
          Go Home
        </button>
      </div>
    </div>
  );
}