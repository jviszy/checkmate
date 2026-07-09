import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/** Requires any signed-in user. */
export function ProtectedRoute({ children }) {
  const { isAuthed, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!isAuthed) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

/** Requires a signed-in user in the Admins group. */
export function AdminRoute({ children }) {
  const { isAuthed, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!isAuthed) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Requires a signed-in coach. */
export function CoachRoute({ children }) {
  const { isAuthed, isCoach, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!isAuthed) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!isCoach) return <Navigate to="/dashboard" replace />;
  return children;
}
