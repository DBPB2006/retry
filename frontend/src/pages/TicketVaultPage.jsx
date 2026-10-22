import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatDate } from '../utils/formatters';

export default function TicketVaultPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.getMyTickets()
      .then((res) => {
        if (active) {
          const list = Array.isArray(res) ? res : (res?.tickets || []);
          setTickets(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to retrieve tickets from vault.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 8px' }}>
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>
            Ticket Vault
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.94rem' }}>
            Your authoritative verified tickets, digital gate passes, and booking confirmations.
          </p>
        </div>
        <Link to="/" className="btn btn-outline btn-sm">
          + Book More Tickets
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="state-box">
          <p className="state-title">Loading your tickets...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="state-box">
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>🎟️</div>
          <p className="state-title">No tickets in your vault yet</p>
          <p className="state-desc" style={{ maxWidth: '420px', margin: '0 auto' }}>
            When you complete a direct booking or buy a resale ticket, your verified pass with entry QR code appears here.
          </p>
          <div style={{ marginTop: '20px' }}>
            <Link to="/" className="btn btn-primary">
              Explore Available Tickets
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '22px' }}>
          {tickets.map((t) => (
            <div
              key={t.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '22px',
                borderRadius: '16px',
                border: t.status === 'LISTED' ? '1px dashed #f59e0b' : '1px solid var(--color-border)'
              }}
            >
              <div>
                {/* Header badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', textTransform: 'capitalize' }}>
                      {t.category}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      {t.provider_name}
                    </span>
                  </div>

                  <div>
                    {t.status === 'ACTIVE' ? (
                      <span className="badge" style={{ background: '#dcfce7', color: '#15803d' }}>
                        ✓ Active Pass
                      </span>
                    ) : t.status === 'LISTED' ? (
                      <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                        Listed for Resale
                      </span>
                    ) : t.status === 'USED' ? (
                      <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                        Used / Admitted
                      </span>
                    ) : (
                      <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                        {t.status}
                      </span>
                    )}
                  </div>
                </div>

                <h2 style={{ fontSize: '1.24rem', fontWeight: 700, marginBottom: '8px', lineHeight: 1.3 }}>
                  {t.title}
                </h2>

                <div style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div><strong>Attendee:</strong> {t.attendee_name || 'Ticket Holder'}</div>
                  <div><strong>Venue / Route:</strong> {t.venue_or_route}</div>
                  <div><strong>Seat / Coach:</strong> {t.seat_or_coach}</div>
                  <div><strong>Date & Time:</strong> {formatDate(t.event_date)}</div>
                  {t.booking_reference ? (
                    <div><strong>Booking Ref:</strong> <code style={{ color: 'var(--color-primary)' }}>{t.booking_reference}</code></div>
                  ) : null}
                </div>
              </div>

              {/* Actions */}
              <div style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)' }}>
                  Ref: <code style={{ fontWeight: 600 }}>{t.ticket_ref}</code>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {t.is_eligible_for_resale && t.status === 'ACTIVE' ? (
                    <Link to={`/sell?ticketId=${t.id}`} className="btn btn-outline btn-sm">
                      Sell Ticket
                    </Link>
                  ) : null}

                  {t.status === 'LISTED' ? (
                    <Link to="/my-listings" className="btn btn-outline btn-sm">
                      Manage Listing
                    </Link>
                  ) : (
                    <Link to={`/vault/${t.id}`} className="btn btn-primary btn-sm">
                      View QR Pass →
                    </Link>
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
