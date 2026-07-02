import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

export default function Navbar({ onMenuClick }) {
  const { userProfile, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const initials = userProfile?.displayName
    ? userProfile.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  return (
    <nav className="navbar">
      {/* Mobile Menu Toggle Button */}
      <button
        onClick={onMenuClick}
        className="menu-toggle-btn"
        aria-label="Open menu"
        style={{ marginRight: '16px' }}
      >
        ☰
      </button>

      {/* Page context - will be overridden or left blank */}
      <div />

      {/* Right side — User info */}
      <div className="flex items-center gap-md">
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>
            {userProfile?.displayName || 'User'}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
            {isAdmin ? 'Administrator' : (userProfile?.department || 'Staff')}
          </div>
        </div>

        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-full)',
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--font-xs)',
            fontWeight: 700,
            color: '#fff',
            cursor: 'pointer',
          }}
          title={userProfile?.displayName}
        >
          {initials}
        </div>

        <button
          className="btn btn-ghost btn-sm"
          onClick={handleLogout}
          id="navbar-logout-btn"
          title="Sign out"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </nav>
  );
}
