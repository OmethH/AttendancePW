import { useAuth } from '../contexts/AuthContext';

export default function PendingApproval() {
  const { logout, userProfile } = useAuth();

  return (
    <div className="auth-container">
      <div className="auth-card glass-strong animate-fade-in-up">
        <div className="auth-header">
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>⏳</div>
          <h2 style={{ fontSize: 'var(--font-2xl)', marginBottom: '8px' }}>
            Pending Approval
          </h2>
          <p>
            Your account is awaiting admin approval. You'll be able to access the
            system once your account has been reviewed.
          </p>
        </div>

        <div
          style={{
            padding: '16px',
            background: 'var(--surface-1)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
            Registered as
          </div>
          <div style={{ fontWeight: 600 }}>{userProfile?.displayName}</div>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
            {userProfile?.email}
          </div>
          {userProfile?.department && (
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
              Department: {userProfile.department}
            </div>
          )}
        </div>

        <button className="btn btn-secondary w-full" onClick={logout} id="logout-pending-btn">
          ← Sign Out
        </button>
      </div>
    </div>
  );
}
