'use client';

import { FiInbox } from 'react-icons/fi';

export default function EmptyState({
  icon = FiInbox,
  title = 'No data',
  description = '',
  action = null,
  compact = false,
}) {
  const Icon = icon;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: compact ? 8 : 16,
      padding: compact ? 32 : 64,
      textAlign: 'center',
    }}>
      <div style={{
        width: compact ? 40 : 56, height: compact ? 40 : 56, borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: compact ? 18 : 24,
        opacity: 0.6,
      }}>
        <Icon />
      </div>
      <h3 style={{
        fontSize: compact ? 14 : 16, fontWeight: 600,
        color: 'var(--text-dark)', margin: 0,
      }}>
        {title}
      </h3>
      {description && (
        <p style={{
          fontSize: compact ? 12 : 14, color: 'var(--text-muted)',
          margin: 0, maxWidth: 280, lineHeight: 1.5,
        }}>
          {description}
        </p>
      )}
      {action && (
        <div style={{ marginTop: compact ? 4 : 8 }}>{action}</div>
      )}
    </div>
  );
}
