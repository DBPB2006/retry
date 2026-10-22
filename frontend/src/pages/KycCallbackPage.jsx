import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

export default function KycCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [statusResult, setStatusResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [returnTo] = useState(() => sessionStorage.getItem('kyc_return_to') || '');

  const requestId = searchParams.get('id');

  useEffect(() => {
    let isMounted = true;

    async function syncVerification() {
      try {
        // Sync with backend Setu status endpoint
        const res = await api.getSetuKycStatus();
        const updatedUser = await refreshUser();

        if (!isMounted) return;

        setStatusResult(res);

        // Notify parent window if opened in a popup
        if (window.opener && window.opener !== window) {
          try {
            window.opener.postMessage({ type: 'SETU_KYC_COMPLETED', status: res.status }, '*');
          } catch {
            // Ignore cross-origin error
          }
        }

        if (res.status === 'VERIFIED' || updatedUser?.is_identity_verified) {
          if (returnTo) {
            sessionStorage.removeItem('kyc_return_to');
            setTimeout(() => {
              if (isMounted) navigate(returnTo);
            }, 2200);
          }
        } else if (res.status === 'FAILED' || res.status === 'EXPIRED') {
          setErrorMessage(res.error || res.detail || `Verification status: ${res.status}`);
        }
      } catch (err) {
        if (!isMounted) return;
        // Even if status check throws, check if auth already refreshed user as verified
        if (user?.is_identity_verified) {
          setStatusResult({ status: 'VERIFIED' });
        } else {
          setErrorMessage(err.message || 'Could not verify status with backend.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    syncVerification();

    return () => {
      isMounted = false;
    };
  }, [navigate, refreshUser, returnTo, user]);

  const isVerified = user?.is_identity_verified || statusResult?.status === 'VERIFIED';
  const verifiedLegalName = user?.verified_legal_name || statusResult?.verified_legal_name;

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: '36px 28px', textAlign: 'center', borderRadius: '16px' }}>
        {loading ? (
          <div>
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
              margin: '0 auto 16px auto',
              animation: 'pulse 1.5s infinite'
            }}>
              ⏳
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '8px' }}>
              Confirming DigiLocker Verification...
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem' }}>
              Retrieving cryptographic confirmation from Setu Data Gateway.
            </p>
          </div>
        ) : isVerified ? (
          <div>
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

            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, marginBottom: '8px', color: 'var(--color-text)' }}>
              Identity Verified Successfully!
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', marginBottom: '24px', lineHeight: 1.5 }}>
              Your Setu DigiLocker Aadhaar eKYC consent has been verified. You now have full access to purchase tickets and list tickets for resale.
            </p>

            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '12px',
              padding: '18px 20px',
              textAlign: 'left',
              marginBottom: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.9rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Verified Legal Name:</span>
                <strong style={{ color: 'var(--color-text)' }}>{verifiedLegalName || 'Verified'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Verification Method:</span>
                <span style={{ fontWeight: 600 }}>Setu DigiLocker Aadhaar eKYC</span>
              </div>
              {requestId && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Request ID:</span>
                  <code style={{ fontSize: '0.78rem' }}>{requestId}</code>
                </div>
              )}
            </div>

            {returnTo ? (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-primary, #2563eb)', fontWeight: 600, marginBottom: '14px' }}>
                  Redirecting back to your transaction...
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => navigate(returnTo)}
                    className="btn btn-primary"
                    style={{ padding: '12px 28px', fontSize: '1rem', fontWeight: 700 }}
                  >
                    Continue to Checkout →
                  </button>
                  <Link to="/" className="btn btn-outline">
                    Return to Marketplace
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/" className="btn btn-primary" style={{ padding: '12px 24px' }}>
                  Explore Available Tickets
                </Link>
                <Link to="/sell" className="btn btn-outline" style={{ padding: '12px 24px' }}>
                  Sell a Ticket
                </Link>
                <Link to="/vault" className="btn btn-ghost" style={{ padding: '12px 24px' }}>
                  Ticket Vault
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#b91c1c',
              fontSize: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              ⚠
            </div>

            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>
              Verification Not Completed
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', marginBottom: '24px' }}>
              {errorMessage || 'Setu DigiLocker consent could not be verified. Please try again.'}
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/verification" className="btn btn-primary">
                Try Verification Again
              </Link>
              <Link to="/" className="btn btn-outline">
                Return to Marketplace
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
