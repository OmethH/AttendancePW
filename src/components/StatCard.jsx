export default function StatCard({ icon, label, value, trend, trendLabel, color = 'primary', delay = 0, onClick }) {
  const colorMap = {
    primary: { bg: 'rgba(108, 92, 231, 0.1)', border: 'rgba(108, 92, 231, 0.2)', text: '#6c5ce7' },
    secondary: { bg: 'rgba(0, 206, 201, 0.1)', border: 'rgba(0, 206, 201, 0.2)', text: '#00cec9' },
    accent: { bg: 'rgba(253, 121, 168, 0.1)', border: 'rgba(253, 121, 168, 0.2)', text: '#fd79a8' },
    warning: { bg: 'rgba(253, 203, 110, 0.1)', border: 'rgba(253, 203, 110, 0.2)', text: '#fdcb6e' },
    success: { bg: 'rgba(0, 184, 148, 0.1)', border: 'rgba(0, 184, 148, 0.2)', text: '#00b894' },
    danger: { bg: 'rgba(255, 107, 107, 0.1)', border: 'rgba(255, 107, 107, 0.2)', text: '#ff6b6b' },
  };

  const c = colorMap[color] || colorMap.primary;

  return (
    <div
      className="glass glass-hover animate-fade-in-up"
      onClick={onClick}
      style={{
        padding: 'var(--space-lg)',
        animationDelay: `${delay}ms`,
        animationFillMode: 'both',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
        <div
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            background: c.bg,
            border: `1px solid ${c.border}`,
            fontSize: '1.25rem',
          }}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <span
            style={{
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              color: trend >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
            }}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 'var(--font-3xl)',
          fontWeight: 800,
          color: c.text,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          marginBottom: '4px',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
        {label}
      </div>
      {trendLabel && (
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>
          {trendLabel}
        </div>
      )}
    </div>
  );
}
