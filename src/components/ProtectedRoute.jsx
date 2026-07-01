import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import PendingApproval from './PendingApproval';

export default function ProtectedRoute({ children, requiredRole }) {
  const { currentUser, userProfile, loading, isAdmin, isApproved, isPending } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  // Not logged in
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Profile not loaded yet
  if (!userProfile) {
    return <LoadingSpinner fullScreen />;
  }

  // Pending approval
  if (isPending && requiredRole !== 'any') {
    return <PendingApproval />;
  }

  // Role check
  if (requiredRole === 'admin' && !isAdmin) {
    return <Navigate to="/staff" replace />;
  }

  if (requiredRole === 'staff' && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
