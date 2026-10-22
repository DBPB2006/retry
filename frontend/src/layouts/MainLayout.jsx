import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="app-container">
      {/* Primary Navigation */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-group">
            <Link to="/" className="brand-logo">
              <span className="brand-title">SafeTicket</span>
              <span className="brand-subtitle">P2P Resale Marketplace</span>
            </Link>
          </div>

          <nav className="nav-links">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              Explore
            </NavLink>
            <NavLink to="/sell" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              Sell Ticket
            </NavLink>

            {user ? (
              <>
                <NavLink to="/orders" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                  My Orders
                </NavLink>
                <NavLink to="/my-listings" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                  My Listings
                </NavLink>
                <NavLink to="/vault" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                  Ticket Vault
                </NavLink>
                {user.is_staff && (
                  <NavLink to="/admin" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                    Admin
                  </NavLink>
                )}
              </>
            ) : null}
          </nav>

          <div className="auth-actions">
            {user ? (
              <div className="user-profile-menu">
                <Link to="/verification" className={`kyc-badge ${user.is_identity_verified ? 'verified' : 'unverified'}`}>
                  {user.is_identity_verified ? `✓ Verified: ${user.verified_legal_name || 'KYC'}` : '⚠ Verify Identity'}
                </Link>
                <span className="username-display">{user.username}</span>
                <button onClick={handleLogout} className="btn btn-outline btn-sm">
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="guest-actions">
                <Link to="/login" className="btn btn-outline btn-sm">
                  Sign In
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Shared Footer */}
      <footer className="app-footer">
        <div className="footer-inner">
          <p className="footer-title">SafeTicket</p>
          <p className="footer-disclaimer">
            Secure peer-to-peer ticket marketplace with verified identity and direct ticket transfers.
          </p>
        </div>
      </footer>
    </div>
  );
}
