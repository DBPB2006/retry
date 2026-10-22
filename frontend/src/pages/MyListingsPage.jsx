import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatDate, formatCurrency } from '../utils/formatters';

export default function MyListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.getSellerListings()
      .then((data) => {
        if (active) {
          setListings(data.listings || (Array.isArray(data) ? data : []));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to retrieve your resale listings.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleWithdraw = async (id) => {
    if (!window.confirm('Are you sure you want to withdraw this ticket from the marketplace? It will be returned to your active vault.')) return;
    setActionLoading(id);
    try {
      await api.withdrawListing(id);
      const data = await api.getSellerListings();
      setListings(data.listings || (Array.isArray(data) ? data : []));
    } catch (err) {
      alert(err.message || 'Failed to withdraw listing.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '4px' }}>
            My Resale Listings
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem' }}>
            Manage the tickets you have listed for peer-to-peer resale.
          </p>
        </div>
        <Link to="/sell" className="btn btn-primary btn-sm">
          + List Another Ticket
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="state-box">
          <p className="state-title">Loading your listings...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="state-box">
          <div style={{ fontSize: '38px', marginBottom: '12px' }}>🏷️</div>
          <p className="state-title">No listings created yet</p>
          <p className="state-desc">When you list eligible tickets for resale, their status, buyers, and history will appear here.</p>
          <div style={{ marginTop: '16px' }}>
            <Link to="/sell" className="btn btn-primary btn-sm">
              List a Ticket for Resale
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {listings.map((item) => (
            <div key={item.id} className="card" style={{ padding: '20px 24px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', textTransform: 'capitalize' }}>
                      {item.category || 'Ticket'}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      {item.provider_name}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{item.title}</h3>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {item.status === 'ACTIVE' ? (
                    <span className="badge" style={{ background: '#dcfce7', color: '#15803d' }}>
                      Active on Marketplace
                    </span>
                  ) : item.status === 'RESERVED' ? (
                    <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                      Reserved in Checkout
                    </span>
                  ) : item.status === 'SOLD' ? (
                    <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                      Sold & Transferred
                    </span>
                  ) : (
                    <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                      {item.status}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '0.88rem', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
                <div><strong>Route / Venue:</strong> {item.venue_or_route}</div>
                <div><strong>Seat / Coach:</strong> {item.seat_or_coach}</div>
                <div><strong>Event Date:</strong> {formatDate(item.event_date)}</div>
                <div><strong>Ticket Ref:</strong> <code>{item.ticket_ref}</code></div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--color-border)',
                paddingTop: '14px',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
                    Original Face Value: {formatCurrency(item.face_value)} • Listed at:{' '}
                  </span>
                  <strong style={{ fontSize: '1.15rem', color: 'var(--color-primary)' }}>
                    {formatCurrency(item.asking_price)}
                  </strong>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {item.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleWithdraw(item.id)}
                      disabled={actionLoading === item.id}
                      className="btn btn-outline btn-sm"
                      style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                    >
                      {actionLoading === item.id ? 'Withdrawing...' : 'Withdraw Listing'}
                    </button>
                  )}
                  {item.status === 'SOLD' && (
                    <span style={{ fontSize: '0.82rem', color: '#15803d', fontWeight: 600 }}>
                      ✓ Payout Transferred
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
