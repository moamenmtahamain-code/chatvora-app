'use client';

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (typeof console !== 'undefined') {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error)
          : this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 48, textAlign: 'center',
          color: 'var(--text-dark)', minHeight: 200,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(239,68,68,0.1)', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, marginBottom: 16,
          }}>
            !
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>Something went wrong</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, maxWidth: 320, lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected error occurred. Please try refreshing the page.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20, padding: '10px 24px', borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
              color: 'white', fontWeight: 600, fontSize: 14,
              border: 'none', cursor: 'pointer',
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
