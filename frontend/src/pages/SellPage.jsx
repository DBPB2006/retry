import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { formatDate, formatCurrency } from '../utils/formatters';

export default function SellPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedTicketId = searchParams.get('ticketId');

  const [eligibleTickets, setEligibleTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [loading, setLoading] = useState(Boolean(user?.is_identity_verified));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.is_identity_verified) {
      return;
    }

    let active = true;
    api.getEligibleResaleTickets()
      .then((tickets) => {
        if (active) {
          setEligibleTickets(tickets);
          if (tickets.length > 0) {
            const initialId = preselectedTicketId && tickets.some(t => String(t.id) === preselectedTicketId)
              ? preselectedTicketId
              : String(tickets[0].id);
            setSelectedTicketId(initialId);
            const found = tickets.find(t => String(t.id) === initialId);
            if (found) {
              setAskingPrice(found.face_value);
            }
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to fetch eligible tickets.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user, preselectedTicketId]);

  const selectedTicket = eligibleTickets.find(t => String(t.id) === String(selectedTicketId));

  const handleTicketSelect = (idStr) => {
    setSelectedTicketId(idStr);
    const found = eligibleTickets.find(t => String(t.id) === idStr);
    if (found) {
      setAskingPrice(found.face_value);
      setError(null);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!selectedTicket) {
      setError('Please select an eligible ticket to resell.');
      return;
    }

    const priceNum = parseFloat(askingPrice);
    const maxNum = parseFloat(selectedTicket.max_allowed_resale_price);

    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter a valid positive asking price.');
      return;
    }

    if (maxNum && priceNum > maxNum) {
      setError(`Asking price (${formatCurrency(priceNum)}) exceeds the platform maximum allowed price of ${formatCurrency(maxNum)} (120% of face value).`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.createResaleListing({
        ticket_id: selectedTicket.id,
        asking_price: priceNum,
      });
      navigate('/my-listings');
    } catch (err) {
      setError(err.message || 'Failed to list ticket for resale.');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Identity verification gate
  if (!user?.is_identity_verified) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 8px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px', borderRadius: '16px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#e0f2fe',
            color: '#0284c7',
            fontSize: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            🛡️
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '8px' }}>
            DigiLocker Identity Verification Required
          </h2>
          <p style={{ fontSize: '0.92rem', color: 'var(--color-text-muted)', marginBottom: '24px', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 24px auto' }}>
            To list tickets for peer-to-peer resale, our platform requires verified legal identity via Setu DigiLocker. This protects buyers from fraud and ensures ticket authenticity.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/verification?returnTo=/sell&reason=sell" className="btn btn-primary">
              Verify with DigiLocker
            </Link>
            <Link to="/" className="btn btn-outline">
              Return to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Loading state
  if (loading) {
    return (
      <div className="state-box" style={{ maxWidth: '640px', margin: '40px auto' }}>
        <p className="state-title">Loading eligible tickets from your vault...</p>
      </div>
    );
  }

  // 3. No eligible tickets to resell
  if (eligibleTickets.length === 0) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 8px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '36px 24px', borderRadius: '16px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎟️</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>
            No Eligible Tickets Found in Your Vault
          </h2>
          <p style={{ fontSize: '0.92rem', color: 'var(--color-text-muted)', marginBottom: '24px', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 24px auto' }}>
            You do not currently own any active tickets eligible for resale. Once you book a ticket for travel or events, you can list it here if your plans change.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/" className="btn btn-primary">
              Explore Available Tickets
            </Link>
            <Link to="/vault" className="btn btn-outline">
              Open Ticket Vault
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '680px', margin: '20px auto', padding: '0 8px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '6px' }}>
          List a Ticket for Resale
        </h1>
        <p style={{ fontSize: '0.92rem', color: 'var(--color-text-muted)' }}>
          Verified Seller: <strong>{user.verified_legal_name || user.username}</strong> • Select an active ticket from your vault to list on the marketplace.
        </p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      <div className="card" style={{ padding: '28px', borderRadius: '16px' }}>
        <form onSubmit={handlePublish}>
          {/* Step 1: Select Ticket */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '8px' }}>
              Select Ticket to Resell
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {eligibleTickets.map((t) => {
                const isSelected = String(t.id) === String(selectedTicketId);
                return (
                  <div
                    key={t.id}
                    onClick={() => handleTicketSelect(String(t.id))}
                    style={{
                      border: isSelected ? '2px solid var(--color-primary, #2563eb)' : '1px solid var(--color-border, #e2e8f0)',
                      background: isSelected ? '#eff6ff' : 'var(--color-surface, #f8fafc)',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontSize: '0.72rem' }}>
                          {t.category}
                        </span>
                        <strong style={{ fontSize: '0.96rem' }}>{t.title}</strong>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                        {t.venue_or_route} • {t.seat_or_coach}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', marginTop: '2px' }}>
                        Ref: {t.ticket_ref} • {formatDate(t.event_date)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>Face Value</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{formatCurrency(t.face_value)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Set Resale Price */}
          {selectedTicket ? (
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                background: '#f8fafc',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Anti-Scalping Platform Policy: Maximum allowed resale price is capped at 120% of original face value.
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 600 }}>
                  <span>Original Face Value: {formatCurrency(selectedTicket.face_value)}</span>
                  <span style={{ color: '#059669' }}>Max Resale Cap: {formatCurrency(selectedTicket.max_allowed_resale_price)}</span>
                </div>
              </div>

              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '6px' }}>
                Your Asking Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                max={selectedTicket.max_allowed_resale_price}
                className="input-text"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="Enter asking price in INR"
                style={{ width: '100%', fontSize: '1.1rem', fontWeight: 700 }}
              />

              {askingPrice && !isNaN(parseFloat(askingPrice)) ? (
                <div style={{
                  marginTop: '12px',
                  fontSize: '0.86rem',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: '#f1f5f9',
                  padding: '10px 14px',
                  borderRadius: '8px'
                }}>
                  <span>Buyer Total (Asking Price + ₹50 Service Fee):</span>
                  <strong style={{ color: 'var(--color-text)' }}>
                    {formatCurrency(parseFloat(askingPrice) + 50)}
                  </strong>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !selectedTicket}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700 }}
          >
            {submitting ? 'Publishing Listing...' : 'Publish Ticket for Resale'}
          </button>
        </form>
      </div>
    </div>
  );
}
