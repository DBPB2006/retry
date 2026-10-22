import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { formatDate, formatCurrency } from '../utils/formatters';

export default function CheckoutPage() {
  const { listingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [listing, setListing] = useState(null);
  const [attendeeName, setAttendeeName] = useState(user?.verified_legal_name || user?.username || '');
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orderComplete, setOrderComplete] = useState(null);

  useEffect(() => {
    let active = true;
    api.getListingDetail(listingId)
      .then((data) => {
        if (active) {
          const item = data?.listing || data;
          setListing(item);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to retrieve ticket for checkout.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [listingId]);

  const handleStartPayment = async (e) => {
    e.preventDefault();
    if (!user?.is_identity_verified) {
      setError('Identity verification is required before initiating transactions.');
      navigate(`/verification?returnTo=/checkout/${listingId}&action=${listing?.is_direct ? 'direct_booking' : 'resale_purchase'}`);
      return;
    }

    setCheckoutLoading(true);
    setError(null);

    const nameToUse = attendeeName.trim() || user?.verified_legal_name || user?.username;
    if (!nameToUse) {
      setError('Please provide an attendee / passenger name for the ticket.');
      setCheckoutLoading(false);
      return;
    }

    try {
      // 1. Create checkout order on backend
      const res = await api.createCheckoutOrder({
        listing_id: listingId,
        attendee_name: nameToUse,
      });

      const orderData = res.order;
      const rzpData = res.razorpay;

      // 2. Open Razorpay Checkout SDK
      if (!window.Razorpay) {
        throw new Error('Razorpay Checkout SDK is not available. Please verify your network connection.');
      }

      const options = {
        key: rzpData.key_id,
        amount: rzpData.amount,
        currency: rzpData.currency,
        name: 'SafeTicket Platform',
        description: `${orderData.title} — ${orderData.seat_or_coach || ''}`,
        order_id: rzpData.order_id,
        prefill: {
          name: nameToUse,
          email: user?.email,
        },
        theme: {
          color: '#2563eb',
        },
        modal: {
          ondismiss: () => {
            setCheckoutLoading(false);
          },
        },
        handler: async (response) => {
          // 3. Verify payment on backend
          setCheckoutLoading(true);
          try {
            const verifyRes = await api.verifyPayment(orderData.id, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setOrderComplete(verifyRes);
          } catch (err) {
            setError(err.message || 'Payment verification failed at server.');
          } finally {
            setCheckoutLoading(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (failRes) => {
        setError(`Payment failed: ${failRes.error?.description || 'Transaction declined.'}`);
        setCheckoutLoading(false);
      });
      rzp.open();

    } catch (err) {
      if (err.code === 'KYC_REQUIRED' || err.status === 403) {
        setError(err.message || 'Setu DigiLocker identity verification is required.');
        navigate(`/verification?returnTo=/checkout/${listingId}&action=${listing?.is_direct ? 'direct_booking' : 'resale_purchase'}`);
        return;
      }
      setError(err.message || 'Failed to initiate checkout.');
      setCheckoutLoading(false);
    }
  };

  // Gate unverified users
  if (user && !user.is_identity_verified) {
    const isDirect = listing?.is_direct ?? (listingId && listingId.startsWith('dir-'));
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
            Before initiating a ticket transaction or reserving inventory, your identity must be verified via Setu DigiLocker. This ensures genuine attendees, prevents scalper bots, and secures your ticket.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to={`/verification?returnTo=/checkout/${listingId}&action=${isDirect ? 'direct_booking' : 'resale_purchase'}`}
              className="btn btn-primary"
            >
              Verify with DigiLocker
            </Link>
            <Link to={listingId ? `/listings/${listingId}` : '/'} className="btn btn-outline">
              Return to Ticket Details
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="state-box" style={{ maxWidth: '640px', margin: '40px auto' }}>
        <p className="state-title">Loading checkout details...</p>
      </div>
    );
  }

  // Success Confirmation State
  if (orderComplete) {
    const o = orderComplete.order || {};
    const t = orderComplete.ticket || {};
    return (
      <div style={{ maxWidth: '600px', margin: '30px auto', padding: '0 8px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '36px 28px', borderRadius: '16px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#dcfce7',
            color: '#15803d',
            fontSize: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            ✓
          </div>

          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>
            Booking Confirmed & Issued!
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.94rem', marginBottom: '24px' }}>
            Your payment was successfully verified and the ticket credential has been placed in your Ticket Vault.
          </p>

          <div style={{
            background: 'var(--color-surface, #f8fafc)',
            padding: '20px',
            borderRadius: '12px',
            textAlign: 'left',
            marginBottom: '24px',
            fontSize: '0.9rem',
            border: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Order Number:</span>
              <strong>{o.order_number}</strong>
            </div>
            {t.booking_reference ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Booking Reference:</span>
                <strong style={{ fontFamily: 'monospace' }}>{t.booking_reference}</strong>
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Ticket Reference:</span>
              <strong style={{ fontFamily: 'monospace' }}>{t.ticket_ref}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Attendee / Passenger:</span>
              <strong>{t.attendee_name || attendeeName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Total Amount Paid:</span>
              <strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(o.total_amount)}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/vault" className="btn btn-primary">
              View in Ticket Vault
            </Link>
            <Link to="/orders" className="btn btn-outline">
              Order History
            </Link>
            <Link to="/" className="btn btn-ghost">
              Browse More Tickets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto' }}>
        <div className="alert alert-error">{error}</div>
        <Link to="/" className="btn btn-outline">
          ← Back to Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '640px', margin: '20px auto', padding: '0 8px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to={`/listings/${listingId}`} style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', textDecoration: 'none' }}>
          ← Back to Ticket Details
        </Link>
      </div>

      <div className="card" style={{ padding: '28px', borderRadius: '16px' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge" style={{ background: listing.is_direct ? '#2563eb' : '#059669', color: '#fff' }}>
              {listing.is_direct ? 'Direct Booking' : 'Peer-to-Peer Resale'}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {listing.provider_name}
            </span>
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800 }}>
            {listing.title}
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {listing.venue_or_route} • {formatDate(listing.event_date || listing.start_time)}
          </p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleStartPayment}>
          {/* Attendee Name Input */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '6px' }}>
              Attendee / Passenger Legal Name
            </label>
            <input
              type="text"
              required
              className="input-text"
              value={attendeeName}
              onChange={(e) => setAttendeeName(e.target.value)}
              placeholder="Full name as printed on ID / ticket"
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', display: 'block', marginTop: '4px' }}>
              This name will be encoded on the gate check-in credential and ticket issuance.
            </span>
          </div>

          {/* Seat & Order Summary */}
          <div style={{
            background: 'var(--color-surface, #f8fafc)',
            padding: '18px 20px',
            borderRadius: '12px',
            marginBottom: '24px',
            border: '1px solid var(--color-border, #e2e8f0)',
            fontSize: '0.88rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Seat / Coach:</span>
              <strong>{listing.seat_or_coach}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Ticket Price:</span>
              <span>{formatCurrency(listing.price || listing.asking_price || listing.face_value)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Platform Service Fee:</span>
              <span>{formatCurrency(listing.service_fee || 0)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--color-border)',
              paddingTop: '8px',
              marginTop: '4px',
              fontSize: '1.05rem',
              fontWeight: 800
            }}>
              <span>Total Payable:</span>
              <span style={{ color: 'var(--color-primary, #2563eb)' }}>
                {formatCurrency(listing.total_price)}
              </span>
            </div>
          </div>

          {/* Pay Button */}
          <button
            type="submit"
            disabled={checkoutLoading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700 }}
          >
            {checkoutLoading ? 'Processing Checkout...' : `Pay ${formatCurrency(listing.total_price)} with Razorpay`}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--color-text-dim)', marginTop: '12px' }}>
            🔒 Secured via Razorpay. Available inventory will be reserved for 10 minutes during checkout.
          </p>
        </form>
      </div>
    </div>
  );
}
