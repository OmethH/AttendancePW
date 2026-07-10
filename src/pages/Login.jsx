import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Forgot Password state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState('');

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/new-user') {
        navigate('/register?error=google-register-first');
      } else {
        setError('Google Sign-In failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // Navigation will happen via ProtectedRoute based on role
      navigate('/');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError('Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match.');
    }
    if (newPassword.length < 6) {
      return setError('Password must be at least 6 characters.');
    }

    setLoading(true);

    try {
      // Query the user's document directly
      const q = query(collection(db, 'users'), where('email', '==', email));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError('Email address not found.');
        setLoading(false);
        return;
      }

      const userDoc = snap.docs[0];
      // Update the user's password in Firestore
      await updateDoc(doc(db, 'users', userDoc.id), {
        password: newPassword,
      });

      setSuccess('Your password has been reset successfully! You can now sign in with your new password.');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setError('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      {/* Background decorative elements */}
      <div
        style={{
          position: 'fixed',
          top: '-20%',
          right: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(216,0,0,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '-15%',
          left: '-10%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,63,52,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {isForgotPassword ? (
        <div className="auth-card glass-strong animate-scale-in">
          <div className="auth-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img
              src="/logo.png"
              alt="Power World Logo"
              style={{
                maxWidth: '260px',
                width: '100%',
                height: 'auto',
                marginBottom: '20px',
                objectFit: 'contain',
              }}
            />
            <p>Reset your account password</p>
          </div>

          {error && <div className="auth-error">{error}</div>}
          {success && (
            <div
              className="auth-success"
              style={{
                background: 'rgba(46, 213, 115, 0.1)',
                border: '1px solid rgba(46, 213, 115, 0.3)',
                color: '#2ed573',
                padding: '12px var(--space-md)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                marginBottom: 'var(--space-md)',
                textAlign: 'center',
              }}
            >
              {success}
            </div>
          )}

          {!success && (
            <form className="auth-form" onSubmit={handleResetPassword}>
              <div className="input-group">
                <label htmlFor="reset-email">Email Address</label>
                <input
                  id="reset-email"
                  type="email"
                  className="input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="input-group">
                <label htmlFor="reset-new-password">New Password</label>
                <input
                  id="reset-new-password"
                  type="password"
                  className="input"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="input-group">
                <label htmlFor="reset-confirm-password">Confirm Password</label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  className="input"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={loading}
                id="reset-submit-btn"
                style={{ marginTop: '8px' }}
              >
                {loading ? (
                  <span className="flex items-center gap-sm">
                    <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
                    Resetting...
                  </span>
                ) : (
                  'Reset Password →'
                )}
              </button>
            </form>
          )}

          <div className="auth-footer" style={{ marginTop: '20px' }}>
            Remembered your password?{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setIsForgotPassword(false);
                setError('');
                setSuccess('');
              }}
            >
              Sign In here
            </a>
          </div>
        </div>
      ) : (
        <div className="auth-card glass-strong animate-scale-in">
          <div className="auth-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img
              src="/logo.png"
              alt="Power World Logo"
              style={{
                maxWidth: '260px',
                width: '100%',
                height: 'auto',
                marginBottom: '20px',
                objectFit: 'contain',
              }}
            />
            <p>Sign in to manage attendance</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                className="input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="login-password">Password</label>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsForgotPassword(true);
                    setError('');
                    setSuccess('');
                  }}
                  style={{
                    fontSize: 'var(--font-xs)',
                    color: 'var(--text-tertiary)',
                    textDecoration: 'none',
                  }}
                  onMouseOver={(e) => (e.target.style.color = 'var(--accent-primary)')}
                  onMouseOut={(e) => (e.target.style.color = 'var(--text-tertiary)')}
                >
                  Forgot Password?
                </a>
              </div>
              <input
                id="login-password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={loading}
              id="login-submit-btn"
              style={{ marginTop: '8px' }}
            >
              {loading ? (
                <span className="flex items-center gap-sm">
                  <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
                  Signing in...
                </span>
              ) : (
                'Sign In →'
              )}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-subtle)' }} />
            <span style={{ padding: '0 10px' }}>OR</span>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-subtle)' }} />
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-lg w-full flex items-center justify-center"
            onClick={handleGoogleSignIn}
            disabled={loading}
            id="google-login-btn"
            style={{ gap: '10px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1c-4.3 0-8.01 2.47-9.82 6.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign In with Google
          </button>

          <div className="auth-footer">
            Don't have an account?{' '}
            <Link to="/register">Register here</Link>
          </div>
        </div>
      )}
    </div>
  );
}
