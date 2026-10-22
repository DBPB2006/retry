import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatDate } from '../utils/formatters';

export default function TicketDetailsPage() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.getTicketDetail(id)
      .then((res) => {
        if (active) {
          const item = res?.ticket || res;
          setTicket(item);
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
      <div className="state-box" style={{ maxWidth: '720px', margin: '40px auto' }}>
        <p className="state-title">Loading ticket credential...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div style={{ maxWidth: '720px', margin: '40px auto' }}>
        <div className="alert alert-error">{error || 'Ticket not found.'}</div>
        <Link to="/vault" className="btn btn-outline">
          ← Back to Vault
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 8px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/vault" style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', textDecoration: 'none' }}>
          ← Back to Ticket Vault
        </Link>
      </div>

      <div className="card" style={{ padding: '32px', borderRadius: '16px' }}>
        {/* Ticket Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', textTransform: 'capitalize' }}>
                {ticket.category}
              </span>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                {ticket.provider_name}
              </span>
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{ticket.title}</h1>
          </div>

          <div>
            {ticket.status === 'ACTIVE' ? (
              <span className="badge" style={{ background: '#dcfce7', color: '#15803d', padding: '6px 12px' }}>
                ✓ Valid Pass
              </span>
            ) : ticket.status === 'LISTED' ? (
              <span className="badge" style={{ background: '#fef3c7', color: '#b45309', padding: '6px 12px' }}>
                Listed for Resale
              </span>
            ) : ticket.status === 'USED' ? (
              <span className="badge" style={{ background: '#f1f5f9', color: '#64748b', padding: '6px 12px' }}>
                Used / Admitted
              </span>
            ) : (
              <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', padding: '6px 12px' }}>
                {ticket.status}
              </span>
            )}
          </div>
        </div>

        {/* Content Split: Details on Left, QR on Right */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '28px',
          alignItems: 'center',
          padding: '24px 0',
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.92rem' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Ticket Holder / Attendee
              </span>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text)' }}>
                {ticket.attendee_name || 'Ticket Holder'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Venue / Route
              </span>
              <div style={{ fontWeight: 600 }}>{ticket.venue_or_route}</div>
            </div>

            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Seat / Allocation
              </span>
              <div style={{ fontWeight: 600 }}>{ticket.seat_or_coach}</div>
            </div>

            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Event Date & Time
              </span>
              <div style={{ fontWeight: 600 }}>{formatDate(ticket.event_date)}</div>
            </div>

            {ticket.booking_reference ? (
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Booking Reference
                </span>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {ticket.booking_reference}
                </div>
              </div>
            ) : null}
          </div>

          {/* QR Code Pass */}
          <div style={{
            textAlign: 'center',
            background: 'var(--color-surface, #f8fafc)',
            padding: '24px 20px',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            {ticket.qr_image_url ? (
              <img
                src={ticket.qr_image_url}
                alt="Gate Pass QR Code"
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  padding: '8px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                }}
              />
            ) : (
              <div style={{
                width: '180px',
                height: '180px',
                background: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                color: 'var(--color-text-muted)',
                borderRadius: '8px'
              }}>
                Generating Pass...
              </div>
            )}
            <div style={{ marginTop: '12px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Gate Access Token
              </span>
              <code style={{ fontSize: '0.78rem', color: 'var(--color-primary, #2563eb)', wordBreak: 'break-all' }}>
                {ticket.qr_token || 'N/A'}
              </code>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
              Scan at venue entrance gate or boarding turnstile
            </span>
          </div>
        </div>

        {/* References and Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            Authoritative Ticket Reference: <code style={{ fontWeight: 600 }}>{ticket.ticket_ref}</code>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {ticket.is_eligible_for_resale && ticket.status === 'ACTIVE' ? (
              <Link to={`/sell?ticketId=${ticket.id}`} className="btn btn-primary btn-sm">
                List for Resale
              </Link>
            ) : null}
            <Link to="/vault" className="btn btn-outline btn-sm">
              Vault Overview
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
