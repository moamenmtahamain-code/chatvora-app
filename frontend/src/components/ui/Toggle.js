'use client';

export default function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }}>
      <div
        onClick={(e) => { e.preventDefault(); if (!disabled) onChange?.(!checked); }}
        style={{
          position: 'relative', width: 44, height: 24, borderRadius: 12,
          background: checked ? 'linear-gradient(135deg, #6366f1, #7c3aed)' : 'rgba(255,255,255,0.08)',
          transition: 'background 0.2s ease, box-shadow 0.2s ease',
          boxShadow: checked ? '0 0 12px rgba(99,102,241,0.2)' : 'none',
          flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%',
          background: 'white',
          transition: 'left 0.25s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      {label && <span style={{ fontSize: 14, color: 'var(--text-dark)' }}>{label}</span>}
    </label>
  );
}
