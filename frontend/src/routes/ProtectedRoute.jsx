import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="state-box">
        <p className="state-title">Checking session authentication...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !user.is_staff) {
    return (
      <div className="card" style={{ maxWidth: '520px', margin: '48px auto', textAlign: 'center', padding: '36px 24px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: 'var(--color-error)' }}>
          Access Restricted
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
          You do not have administrative permissions to view this section.
        </p>
        <a href="/" className="btn btn-primary">
          Return to Marketplace
        </a>
      </div>
    );
  }

  return children;
}
