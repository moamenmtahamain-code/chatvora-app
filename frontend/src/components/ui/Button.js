'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';

const variants = {
  primary: {
    background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
    color: 'white',
    border: 'none',
    boxShadow: '0 4px 16px rgba(99,102,241,0.2)',
  },
  secondary: {
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-dark)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
  },
  danger: {
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    color: 'white',
    border: 'none',
    boxShadow: '0 4px 16px rgba(239,68,68,0.2)',
  },
  success: {
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: 'white',
    border: 'none',
    boxShadow: '0 4px 16px rgba(16,185,129,0.2)',
  },
};

const sizes = {
  sm: { padding: '6px 14px', fontSize: 12, borderRadius: 6 },
  md: { padding: '10px 22px', fontSize: 14, borderRadius: 8 },
  lg: { padding: '14px 32px', fontSize: 16, borderRadius: 10 },
  xl: { padding: '18px 42px', fontSize: 17, borderRadius: 12 },
};

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    icon = null,
    children,
    style,
    ...props
  },
  ref
) {
  return (
    <motion.button
      ref={ref}
      whileHover={!disabled && !loading ? { scale: 1.02 } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
        fontFamily: 'inherit',
        ...variants[variant],
        ...sizes[size],
        ...(fullWidth ? { width: '100%' } : {}),
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span className="btn-spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      ) : icon ? (
        <span style={{ display: 'inline-flex', fontSize: '1.1em' }}>{icon}</span>
      ) : null}
      {children}
    </motion.button>
  );
});

export default Button;
