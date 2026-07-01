import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  async function handleGoogleRegister() {
    setError('');
    if (!formData.department) {
      return setError('Please select a department first.');
    }
    setLoading(true);
    try {
      await loginWithGoogle(formData.department);
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError('Google Sign-Up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match.');
    }
    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }

    setLoading(true);
    try {
      await register(formData.email, formData.password, formData.displayName, formData.department);
      setSuccess(true);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card glass-strong animate-scale-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ fontSize: 'var(--font-2xl)', marginBottom: '8px' }}>Registration Successful!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Your account has been created and is pending admin approval.
            You'll be able to sign in once your account is approved.
          </p>
          <Link to="/login" className="btn btn-primary">
            ← Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div
        style={{
          position: 'fixed',
          top: '-20%',
          left: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(216,0,0,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="auth-card glass-strong animate-scale-in">
        <div className="auth-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img
            src="/logo.jpg"
            alt="Power World Logo"
            style={{
              maxHeight: '60px',
              width: 'auto',
              marginBottom: '16px',
              objectFit: 'contain',
            }}
          />
          <p>Create your staff account</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              type="text"
              name="displayName"
              className="input"
              placeholder="John Doe"
              value={formData.displayName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
              type="email"
              name="email"
              className="input"
              placeholder="you@company.com"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label htmlFor="reg-department">Department</label>
            <select
              id="reg-department"
              name="department"
              className="input"
              value={formData.department}
              onChange={handleChange}
              required
            >
              <option value="">Select department</option>
              <option value="Finance">Finance</option>
              <option value="Maintenance">Maintenance</option>
              <option value="HR">Human Resources</option>
              <option value="Operations">Operations</option>
              <option value="IT">IT</option>
              <option value="Business">Business</option>
            </select>
          </div>

          <div className="input-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              name="password"
              className="input"
              placeholder="Min 6 characters"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="input-group">
            <label htmlFor="reg-confirm-password">Confirm Password</label>
            <input
              id="reg-confirm-password"
              type="password"
              name="confirmPassword"
              className="input"
              placeholder="Re-enter password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
            id="register-submit-btn"
            style={{ marginTop: '8px' }}
          >
            {loading ? (
              <span className="flex items-center gap-sm">
                <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
                Creating account...
              </span>
            ) : (
              'Create Account →'
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
          onClick={handleGoogleRegister}
          disabled={loading}
          id="google-register-btn"
          style={{ gap: '10px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1c-4.3 0-8.01 2.47-9.82 6.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Register with Google
        </button>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
