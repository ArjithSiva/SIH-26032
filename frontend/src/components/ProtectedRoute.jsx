import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { session } = useAuth();
  let loginPath = '/staff/login';
  if (roles?.includes('farmer')) loginPath = '/farmer/login';
  else if (roles?.includes('officer')) loginPath = '/officer/login';

  if (!session) return <Navigate to={loginPath} replace />;
  if (roles && !roles.includes(session.role)) return <Navigate to="/" replace />;

  return children;
}
