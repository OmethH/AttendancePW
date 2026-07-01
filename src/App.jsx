import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LoadingSpinner from './components/LoadingSpinner';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/Dashboard';
import StaffManagement from './pages/admin/StaffManagement';
import AttendanceReports from './pages/admin/AttendanceReports';
import QRKiosk from './pages/admin/QRKiosk';
import StaffDashboard from './pages/staff/StaffDashboard';
import ScanQR from './pages/staff/ScanQR';

function AppRoutes() {
  const { currentUser, userProfile, loading, isAdmin } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        currentUser && userProfile ? (
          <Navigate to={isAdmin ? '/admin' : '/staff'} replace />
        ) : (
          <Login />
        )
      } />
      <Route path="/register" element={
        currentUser && userProfile ? (
          <Navigate to={isAdmin ? '/admin' : '/staff'} replace />
        ) : (
          <Register />
        )
      } />

      {/* QR Kiosk - Full screen, no sidebar/navbar */}
      <Route path="/admin/kiosk" element={
        <ProtectedRoute requiredRole="admin">
          <QRKiosk />
        </ProtectedRoute>
      } />

      {/* QR Scan - Can be accessed via URL with token */}
      <Route path="/scan" element={
        <ProtectedRoute requiredRole="any">
          <ScanQR />
        </ProtectedRoute>
      } />

      {/* Admin Routes with Layout */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <AppLayout>
            <AdminDashboard />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/staff" element={
        <ProtectedRoute requiredRole="admin">
          <AppLayout>
            <StaffManagement />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/reports" element={
        <ProtectedRoute requiredRole="admin">
          <AppLayout>
            <AttendanceReports />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* Staff Routes with Layout */}
      <Route path="/staff" element={
        <ProtectedRoute requiredRole="staff">
          <AppLayout>
            <StaffDashboard />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/staff/scan" element={
        <ProtectedRoute requiredRole="staff">
          <ScanQR />
        </ProtectedRoute>
      } />

      {/* Default Redirect */}
      <Route path="/" element={
        currentUser && userProfile ? (
          <Navigate to={isAdmin ? '/admin' : '/staff'} replace />
        ) : (
          <Navigate to="/login" replace />
        )
      } />

      {/* 404 */}
      <Route path="*" element={
        <div className="auth-container">
          <div className="auth-card glass-strong" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>404</div>
            <h2 style={{ marginBottom: '8px' }}>Page Not Found</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              The page you're looking for doesn't exist.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => window.location.href = '/'}
            >
              ← Go Home
            </button>
          </div>
        </div>
      } />
    </Routes>
  );
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div style={{ flex: 1 }}>
        <Navbar />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
