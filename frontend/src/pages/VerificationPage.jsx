import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

export default function VerificationPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const actionParam = searchParams.get('reason') || searchParams.get('action');

  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [justVerified, setJustVerified] = useState(false);

  const isVerified = user?.is_identity_verified;

  const getActionLabel = () => {
    if (actionParam === 'sell') return 'ticket resale listing';
    if (actionParam === 'direct_booking') return 'direct booking checkout';
    if (actionParam === 'resale_purchase') return 'resale checkout';
    return 'transaction';
  };

  useEffect(() => {
    if (returnTo) {
      sessionStorage.setItem('kyc_return_to', returnTo);
    }
  }, [returnTo]);

  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.data?.type === 'SETU_KYC_COMPLETED') {
        setPolling(false);
        setJustVerified(true);
        await refreshUser();
        const saved = returnTo || sessionStorage.getItem('kyc_return_to');
        if (saved) {
          sessionStorage.removeItem('kyc_return_to');
          setTimeout(() => navigate(saved), 1200);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, refreshUser, returnTo]);

  const handleInitiate = async () => {
    setLoading(true);
    setError(null);
    try {
      const redirectUrl = window.location.origin + '/kyc/callback';
      const res = await api.initiateSetuKyc({ redirect_url: redirectUrl });
      setSessionData(res);
      if (res.digilocker_url) {
        window.open(res.digilocker_url, '_blank', 'width=520,height=720');
      }
      setPolling(true);
    } catch (err) {
      setError(err.message || 'Failed to initiate DigiLocker verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSetuKycStatus();
      if (res.status === 'VERIFIED') {
        setPolling(false);
        setJustVerified(true);
        await refreshUser();
        if (returnTo) {
          setTimeout(() => navigate(returnTo), 1500);
        }
      } else if (res.status === 'FAILED' || res.status === 'EXPIRED') {
        setPolling(false);
        setError(res.error || res.detail || `Verification status: ${res.status}`);
      }
    } catch (err) {
      setError(err.message || 'Status check failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer = null;
    if (polling) {
      timer = setInterval(async () => {
        try {
          const res = await api.getSetuKycStatus();
          if (res.status === 'VERIFIED') {
            setPolling(false);
            setJustVerified(true);
            await refreshUser();
            if (returnTo) {
              setTimeout(() => navigate(returnTo), 1500);
            }
          } else if (res.status === 'FAILED' || res.status === 'EXPIRED') {
            setPolling(false);
            setError(res.error || `Verification finished with status: ${res.status}`);
          }
        } catch {
          // ignore transient poll error
        }
      }, 4000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [polling, refreshUser, returnTo, navigate]);

  return (
    <div style={{ maxWidth: '640px', margin: '20px auto', padding: '0 8px' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>
        Identity Verification (Setu DigiLocker)
      </h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.5 }}>
        Aadhaar eKYC via Setu DigiLocker. Mandatory for all ticket purchases, direct bookings, and resale listings to ensure security and prevent fraud.
      </p>

      {/* Return to Action Banner */}
      {returnTo && !isVerified && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{ fontSize: '26px' }}>🛡️</div>
          <div style={{ fontSize: '0.9rem', color: '#1e40af', lineHeight: 1.5 }}>
            <strong>Identity verification required:</strong> Setu DigiLocker KYC is required before you can proceed with your {getActionLabel()}. Complete the verification below to continue immediately.
          </div>
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      <div className="card" style={{ padding: '28px', borderRadius: '16px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '14px' }}>
          Current Verification Status
        </h2>

        {isVerified ? (
          <div style={{
            background: 'var(--color-success-bg, #f0fdf4)',
            border: '1px solid var(--color-success-border, #bbf7d0)',
            padding: '24px',
            borderRadius: '12px'
          }}>
            <div style={{ color: 'var(--color-success, #16a34a)', fontWeight: 800, fontSize: '1.15rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✓</span> Identity Verified
            </div>
            <div style={{ fontSize: '0.95rem', marginBottom: '10px' }}>
              <strong>Verified Legal Name:</strong> {user.verified_legal_name}
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: returnTo ? '20px' : '0' }}>
              Your account has been successfully verified via Setu DigiLocker. You are authorized to purchase tickets, book provider inventory, and list tickets for resale.
            </p>

            {justVerified && returnTo && (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-primary, #2563eb)', fontWeight: 600, marginBottom: '14px' }}>
                Redirecting you back to your intended transaction...
              </div>
            )}

            {returnTo ? (
              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid var(--color-success-border, #bbf7d0)',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => navigate(returnTo)}
                  className="btn btn-primary"
                  style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 700 }}
                >
                  {actionParam === 'sell' ? 'Continue to List Ticket →' : 'Continue to Checkout →'}
                </button>
                <Link to="/" className="btn btn-outline">
                  Return to Marketplace
                </Link>
              </div>
            ) : (
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Link to="/" className="btn btn-primary btn-sm">
                  Explore Available Tickets
                </Link>
                <Link to="/sell" className="btn btn-outline btn-sm">
                  Sell a Ticket
                </Link>
                <Link to="/vault" className="btn btn-ghost btn-sm">
                  Ticket Vault
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{
              background: 'var(--color-warning-bg, #fffbeb)',
              border: '1px solid var(--color-warning-border, #fef3c7)',
              padding: '18px 20px',
              borderRadius: '12px',
              marginBottom: '24px'
            }}>
              <div style={{ color: '#b45309', fontWeight: 700, fontSize: '0.98rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚠</span> Verification Required for All Transactions
              </div>
              <p style={{ fontSize: '0.88rem', color: '#92400e', lineHeight: 1.55 }}>
                Before purchasing or selling tickets, your legal identity must be verified via Setu DigiLocker. This guarantees that all buyers and sellers are verified individuals, protects against scalper bots, and secures gate admission credentials.
              </p>
            </div>

            {sessionData && sessionData.status === 'INITIATED' ? (
              <div style={{ textAlign: 'center', padding: '24px', background: '#f8fafc', borderRadius: '12px', marginBottom: '16px', border: '1px solid var(--color-border)' }}>
                <p style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1rem', marginBottom: '8px' }}>
                  {polling ? 'Waiting for DigiLocker consent authentication...' : 'Consent session initiated.'}
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '16px', maxWidth: '440px', margin: '0 auto 16px auto' }}>
                  Please complete the DigiLocker Aadhaar consent in the popup window. If the window did not open, click the button below.
                </p>
                {sessionData.digilocker_url && (
                  <div style={{ marginBottom: '16px' }}>
                    <a
                      href={sessionData.digilocker_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline"
                      style={{ padding: '10px 20px' }}
                    >
                      Open DigiLocker Window ↗
                    </a>
                  </div>
                )}
                <button
                  onClick={handleCheckStatus}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ padding: '10px 24px' }}
                >
                  {loading ? 'Checking status...' : 'Check Status Now'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleInitiate}
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '1.02rem', fontWeight: 700 }}
              >
                {loading ? 'Connecting to Setu DigiLocker...' : 'Start Setu DigiLocker Verification'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
