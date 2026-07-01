export default function LoadingSpinner({ fullScreen = false, size = 40 }) {
  if (fullScreen) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <Spinner size={size} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
      <Spinner size={size} />
    </div>
  );
}

function Spinner({ size }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: '3px solid var(--surface-3)',
        borderTopColor: 'var(--accent-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
      role="status"
      aria-label="Loading"
    />
  );
}
