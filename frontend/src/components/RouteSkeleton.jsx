import React from 'react'

export default function RouteSkeleton() {
  return (
    <>
      <style>{`
        @keyframes shimmerPulse {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            var(--skeleton-base, rgba(148, 163, 184, 0.12)) 25%,
            var(--skeleton-highlight, rgba(148, 163, 184, 0.28)) 50%,
            var(--skeleton-base, rgba(148, 163, 184, 0.12)) 75%
          );
          background-size: 200% 100%;
          animation: shimmerPulse 1.8s infinite ease-in-out;
          border-radius: 8px;
        }
      `}</style>

      <div
        style={{
          padding: '28px 32px',
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          minHeight: '80vh',
        }}
      >
        {/* Page Header Skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="skeleton-shimmer" style={{ width: '220px', height: '28px', borderRadius: '8px' }} />
            <div className="skeleton-shimmer" style={{ width: '340px', height: '14px', borderRadius: '6px' }} />
          </div>
          <div className="skeleton-shimmer" style={{ width: '120px', height: '38px', borderRadius: '10px' }} />
        </div>

        {/* Metric Cards Skeleton */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border-color, rgba(226, 232, 240, 0.8))',
                borderRadius: '14px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton-shimmer" style={{ width: '70px', height: '12px' }} />
                <div className="skeleton-shimmer" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
              </div>
              <div className="skeleton-shimmer" style={{ width: '90px', height: '26px' }} />
              <div className="skeleton-shimmer" style={{ width: '130px', height: '10px' }} />
            </div>
          ))}
        </div>

        {/* Table / Grid Content Skeleton */}
        <div
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, rgba(226, 232, 240, 0.8))',
            borderRadius: '16px',
            padding: '24px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
          }}
        >
          {/* Controls Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skeleton-shimmer" style={{ width: '240px', height: '36px', borderRadius: '8px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="skeleton-shimmer" style={{ width: '80px', height: '36px', borderRadius: '8px' }} />
              <div className="skeleton-shimmer" style={{ width: '100px', height: '36px', borderRadius: '8px' }} />
            </div>
          </div>

          {/* Simulated Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <div className="skeleton-shimmer" style={{ width: '100%', height: '42px', borderRadius: '8px', opacity: 0.8 }} />
            {[1, 2, 3, 4, 5, 6].map((row) => (
              <div
                key={row}
                className="skeleton-shimmer"
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '8px',
                  opacity: 0.5 - row * 0.05,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
