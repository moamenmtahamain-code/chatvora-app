'use client';

export default function Skeleton({ width = '100%', height = 20, borderRadius = 8, variant = 'text', count = 1, style }) {
  const dims = variant === 'circle'
    ? { width: height, height, borderRadius: '50%' }
    : variant === 'rect'
    ? { width, height, borderRadius }
    : { width, height: height || 16, borderRadius };

  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {items.map(i => (
        <div
          key={i}
          className="skeleton"
          style={{
            ...dims,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
            backgroundSize: '200% 100%',
            animation: 'skeleton 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          flexDirection: i % 2 === 0 ? 'row' : 'row-reverse',
          marginLeft: i % 2 === 0 ? 0 : 'auto',
          maxWidth: '70%',
        }}>
          <Skeleton variant="circle" height={32} width={32} />
          <div style={{ flex: 1 }}>
            <Skeleton height={40} borderRadius={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton height={44} borderRadius={10} />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Skeleton variant="circle" height={40} width={40} />
          <div style={{ flex: 1 }}>
            <Skeleton height={14} width="60%" />
            <Skeleton height={12} width="40%" style={{ marginTop: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 32 }}>
      <Skeleton variant="circle" height={80} width={80} />
      <Skeleton height={24} width="50%" />
      <Skeleton height={14} width="70%" />
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={48} borderRadius={10} />
        ))}
      </div>
    </div>
  );
}
