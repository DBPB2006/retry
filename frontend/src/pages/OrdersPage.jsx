import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatDate, formatCurrency } from '../utils/formatters';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.getOrderHistory()
      .then((data) => {
        if (active) {
          const list = data.orders || (Array.isArray(data) ? data : []);
          setOrders(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to retrieve order history.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 8px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '4px' }}>
            My Orders
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem' }}>
            Track your ticket bookings, Razorpay transaction references, and payment confirmations.
          </p>
        </div>
        <Link to="/" className="btn btn-outline btn-sm">
          Browse Tickets
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="state-box">
          <p className="state-title">Loading order history...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="state-box">
          <div style={{ fontSize: '38px', marginBottom: '12px' }}>🧾</div>
          <p className="state-title">No orders placed yet</p>
          <p className="state-desc">When you book tickets from providers or peer sellers, your order receipts will appear here.</p>
          <div style={{ marginTop: '16px' }}>
            <Link to="/" className="btn btn-primary btn-sm">
              Explore Tickets
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {orders.map((o) => (
            <div key={o.id} className="card" style={{ padding: '20px 24px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', textTransform: 'capitalize' }}>
                      {o.category || 'Ticket'}
                    </span>
                    <span className="badge" style={{ background: o.order_type === 'DIRECT' ? '#dbeafe' : '#dcfce7', color: o.order_type === 'DIRECT' ? '#1e40af' : '#15803d' }}>
                      {o.order_type === 'DIRECT' ? 'Direct Booking' : 'Peer Resale'}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{o.title}</h3>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {formatCurrency(o.total_amount)}
                  </div>
                  <span className="badge" style={{
                    background: o.status === 'COMPLETED' ? '#dcfce7' : o.status === 'PAID' ? '#e0f2fe' : '#fef3c7',
                    color: o.status === 'COMPLETED' ? '#15803d' : o.status === 'PAID' ? '#0369a1' : '#b45309',
                    marginTop: '4px',
                  }}>
                    {o.status === 'COMPLETED' ? '✓ Confirmed & Issued' : o.status}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                <div><strong>Route / Venue:</strong> {o.venue_or_route || 'Venue on ticket'}</div>
                <div><strong>Seat / Allocation:</strong> {o.seat_or_coach || 'Standard allocation'}</div>
                <div><strong>Attendee Name:</strong> {o.attendee_name || 'Holder'}</div>
                <div><strong>Date Ordered:</strong> {formatDate(o.created_at)}</div>
              </div>

              <div style={{
                background: 'var(--color-surface, #f8fafc)',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                border: '1px solid var(--color-border, #e2e8f0)'
              }}>
                <div>
                  <span>Order Ref: <strong>{o.order_number}</strong></span>
                  {o.ticket_ref && o.ticket_ref !== 'N/A' && (
                    <span style={{ marginLeft: '14px' }}>
                      Ticket Ref: <code>{o.ticket_ref}</code>
                    </span>
                  )}
                  {o.razorpay_order_id && (
                    <span style={{ marginLeft: '14px', color: 'var(--color-text-dim)' }}>
                      RZP ID: {o.razorpay_order_id}
                    </span>
                  )}
                </div>

                {o.ticket_id ? (
                  <Link to={`/vault/${o.ticket_id}`} className="btn btn-primary btn-sm">
                    View in Ticket Vault →
                  </Link>
                ) : (
                  <Link to="/vault" className="btn btn-outline btn-sm">
                    Ticket Vault
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
