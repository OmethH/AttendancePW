import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, ClipboardList, QrCode } from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const { isAdmin } = useAuth();
  const location = useLocation();

  const adminLinks = [
    { to: '/admin', icon: <LayoutDashboard size={18} />, label: 'Dashboard', end: true },
    { to: '/admin/staff', icon: <Users size={18} />, label: 'Staff Management' },
    { to: '/admin/reports', icon: <ClipboardList size={18} />, label: 'Attendance Reports' },
    { to: '/admin/kiosk', icon: <QrCode size={18} />, label: 'QR Code' },
  ];

  const staffLinks = [
    { to: '/staff', icon: <LayoutDashboard size={18} />, label: 'My Dashboard', end: true },
    { to: '/staff/scan', icon: <QrCode size={18} />, label: 'Scan QR Code' },
  ];

  const links = isAdmin ? adminLinks : staffLinks;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(5, 5, 15, 0.6)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            zIndex: 190,
          }}
        />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Mobile Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '1.25rem',
            cursor: 'pointer',
          }}
          className="sidebar-close-btn-inline"
          aria-label="Close menu"
        >
          ✕
        </button>

        {/* Brand */}
        <div className="sidebar-brand-container" style={{ display: 'flex', justifyContent: 'center', padding: '20px var(--space-md)', borderBottom: '1px solid var(--border-subtle)' }}>
          <img
            src="/logo.png"
            alt="Power World Logo"
            style={{
              width: '100%',
              maxHeight: '55px',
              objectFit: 'contain',
            }}
          />
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
    </>
  );
}
