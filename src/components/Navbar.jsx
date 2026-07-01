import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
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
    <nav
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        left: 'var(--sidebar-width)',
        height: 'var(--navbar-height)',
        background: 'rgba(10, 10, 26, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-xl)',
        zIndex: 100,
      }}
    >
      {/* Page context - will be overridden or left blank */}
      <div />

      {/* Right side — User info */}
      <div className="flex items-center gap-md">
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>
            {userProfile?.displayName || 'User'}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
            {isAdmin ? 'Administrator' : 'Staff'}
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
          ⎋ Logout
        </button>
      </div>
    </nav>
  );
}
