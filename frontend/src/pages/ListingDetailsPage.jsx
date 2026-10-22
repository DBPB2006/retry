import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCurrency } from '../utils/formatters';

export default function ListingDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.getListingDetail(id)
      .then((data) => {
        if (active) {
          const item = data?.listing || data;
          setListing(item);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to load ticket details.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="state-box" style={{ maxWidth: '800px', margin: '40px auto' }}>
        <p className="state-title">Loading ticket details...</p>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto' }}>
        <div className="alert alert-error">{error || 'Ticket not found.'}</div>
        <Link to="/" className="btn btn-outline">
          ← Back to Marketplace
        </Link>
      </div>
    );
  }

  const isOwner = user && listing.seller_username && user.username === listing.seller_username;
  const isAvailable = listing.is_available ?? (listing.status === 'ACTIVE');

  const handleProceedToCheckout = () => {
    if (!user) {
      navigate('/login', { state: { from: `/listings/${listing.id}` } });
      return;
    }

    if (!user.is_identity_verified) {
      navigate(`/verification?returnTo=/checkout/${listing.id}&action=${listing.is_direct ? 'direct_booking' : 'resale_purchase'}`);
      return;
    }

    navigate(`/checkout/${listing.id}`);
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '0 8px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/" style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', textDecoration: 'none' }}>
          ← Back to All Tickets
        </Link>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
        {/* Banner image */}
        {listing.image_url ? (
          <div style={{ position: 'relative', height: '240px', width: '100%', overflow: 'hidden' }}>
            <img
              src={listing.image_url}
              alt={listing.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '8px' }}>
              <span className="badge" style={{ background: 'rgba(15, 23, 42, 0.9)', color: '#fff', textTransform: 'capitalize' }}>
                {listing.category}
              </span>
              {listing.is_direct ? (
                <span className="badge" style={{ background: '#2563eb', color: '#fff', fontWeight: 600 }}>
                  Direct Booking
                </span>
              ) : (
                <span className="badge" style={{ background: '#059669', color: '#fff', fontWeight: 600 }}>
                  Verified Resale
                </span>
              )}
            </div>
          </div>
        ) : null}

        <div style={{ padding: '28px 32px' }}>
          {/* Header & Provider */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {listing.provider_logo ? (
                  <img
                    src={listing.provider_logo}
                    alt={listing.provider_name}
                    style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : null}
                <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  {listing.provider_name}
                </span>
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.25 }}>
                {listing.title}
              </h1>
            </div>

            <div>
              {listing.status === 'ACTIVE' ? (
                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', padding: '6px 12px', fontSize: '0.85rem' }}>
                  ✓ Available to Book
                </span>
              ) : listing.status === 'RESERVED' ? (
                <span className="badge" style={{ background: '#fef3c7', color: '#b45309', padding: '6px 12px' }}>
                  Reserved in Checkout
                </span>
              ) : (
                <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', padding: '6px 12px' }}>
                  {listing.status}
                </span>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            background: 'var(--color-surface, #f8fafc)',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '24px',
            border: '1px solid var(--color-border, #e2e8f0)'
          }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Venue / Route
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 600, marginTop: '4px' }}>
                {listing.venue_or_route}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Scheduled Date & Time
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 600, marginTop: '4px' }}>
                {formatDate(listing.event_date || listing.start_time)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Seat / Allocation
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 600, marginTop: '4px' }}>
                {listing.seat_or_coach}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Ticket Reference
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 600, marginTop: '4px', fontFamily: 'monospace' }}>
                {listing.ticket_ref}
              </div>
            </div>
          </div>

          {/* Itinerary / Additional Details */}
          {listing.itinerary_or_details ? (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>
                Event & Journey Information
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                {listing.itinerary_or_details}
              </p>
            </div>
          ) : null}

          {/* KYC Notice for unverified users */}
          {user && !user.is_identity_verified && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '10px',
              padding: '14px 18px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ fontSize: '0.88rem', color: '#92400e', lineHeight: 1.5 }}>
                <strong>DigiLocker KYC Required:</strong> To book or buy tickets, identity verification is mandatory. Verify once to unlock all transactions.
              </div>
              <Link
                to={`/verification?returnTo=/checkout/${listing.id}&action=${listing.is_direct ? 'direct_booking' : 'resale_purchase'}`}
                className="btn btn-outline btn-sm"
                style={{ borderColor: '#d97706', color: '#b45309', whiteSpace: 'nowrap', fontWeight: 600 }}
              >
                Verify Identity Now →
              </Link>
            </div>
          )}

          {/* Pricing & Checkout Breakdown */}
          <div style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  {listing.is_direct ? 'Base Ticket Price' : `Resale Price (${formatCurrency(listing.asking_price)}) + Service Fee (${formatCurrency(listing.service_fee)})`}
                </span>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary, #2563eb)' }}>
                  {formatCurrency(listing.total_price)}
                </span>
                {!listing.is_direct && listing.face_value ? (
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)' }}>
                    Original Face Value: {formatCurrency(listing.face_value)}
                  </span>
                ) : null}
              </div>
            </div>

            <div>
              {isOwner ? (
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>
                    You listed this ticket for resale
                  </span>
                  <Link to="/my-listings" className="btn btn-outline">
                    Manage in My Listings
                  </Link>
                </div>
              ) : isAvailable ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <button
                    onClick={handleProceedToCheckout}
                    className="btn btn-primary"
                    style={{ padding: '12px 28px', fontSize: '1rem' }}
                  >
                    {listing.is_direct ? 'Book Directly' : 'Buy Resale Ticket'}
                  </button>
                  {user && !user.is_identity_verified && (
                    <span style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 600 }}>
                      ⚠ DigiLocker KYC required to checkout
                    </span>
                  )}
                </div>
              ) : (
                <button disabled className="btn btn-outline" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                  Currently Unavailable
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
