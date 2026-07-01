import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar() {
  const { isAdmin } = useAuth();
  const location = useLocation();

  const adminLinks = [
    { to: '/admin', icon: '📊', label: 'Dashboard', end: true },
    { to: '/admin/staff', icon: '👥', label: 'Staff Management' },
    { to: '/admin/reports', icon: '📋', label: 'Attendance Reports' },
    { to: '/admin/kiosk', icon: '📱', label: 'QR Kiosk' },
  ];

  const staffLinks = [
    { to: '/staff', icon: '🏠', label: 'My Dashboard', end: true },
    { to: '/staff/scan', icon: '📷', label: 'Scan QR Code' },
  ];

  const links = isAdmin ? adminLinks : staffLinks;

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 'var(--sidebar-width)',
        background: 'rgba(15, 15, 35, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
        overflowY: 'auto',
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: 'var(--space-lg) var(--space-lg)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          height: 'var(--navbar-height)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
          }}
        >
          ✓
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 'var(--font-lg)', letterSpacing: '-0.02em' }}>
            <span className="text-gradient">Attend</span>Ease
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: 'var(--space-md)', flex: 1 }}>
        <div
          style={{
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '8px 12px',
            marginBottom: '4px',
          }}
        >
          {isAdmin ? 'Administration' : 'Navigation'}
        </div>

        <div className="flex flex-col gap-xs">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--surface-2)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                transition: 'all var(--transition-fast)',
                textDecoration: 'none',
              })}
            >
              <span style={{ fontSize: '1.1rem', width: 24, textAlign: 'center' }}>{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: 'var(--space-md) var(--space-lg)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 'var(--font-xs)',
          color: 'var(--text-tertiary)',
          textAlign: 'center',
        }}
      >
        AttendEase v1.0
      </div>
    </aside>
  );
}
