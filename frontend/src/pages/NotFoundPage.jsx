import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{ maxWidth: '480px', margin: '60px auto', textAlign: 'center' }}>
      <div className="card" style={{ padding: '40px 24px' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: '8px' }}>
          404
        </h1>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>
          Page Not Found
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
          The requested page route does not exist or has been moved.
        </p>
        <Link to="/" className="btn btn-primary">
          ← Return to Marketplace
        </Link>
      </div>
    </div>
  );
}
