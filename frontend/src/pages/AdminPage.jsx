import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function AdminPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.getHealth()
      .then((data) => {
        if (active) {
          setHealth(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to retrieve system diagnostic health.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
          Platform Administration & Operations
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Protected management operations and backend diagnostic inspection.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Django Admin Access */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '6px' }}>
          Django Admin Management Portal
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          Use the authoritative Django Admin site to inspect, filter, audit, or adjust database models including providers, events, direct tickets, resale listings, orders, payments, and KYC records.
        </p>
        <a
          href="/admin/"
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary"
        >
          Open Django Admin Site ↗
        </a>
      </div>

      {/* Backend Integration Diagnostics */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '14px' }}>
          Backend Subsystem Readiness
        </h2>

        {loading ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Loading system diagnostics...</p>
        ) : health ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '6px' }}>
              <span>Database Connection:</span>
              <strong style={{ color: health.database === 'connected' ? 'var(--color-success)' : 'var(--color-error)' }}>
                {health.database}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '6px' }}>
              <span>Setu DigiLocker Sandbox:</span>
              <strong style={{ color: health.setu_digilocker?.configured ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {health.setu_digilocker?.configured ? 'Configured & Ready' : health.setu_digilocker?.status_detail}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '6px' }}>
              <span>Razorpay Payment Gateway:</span>
              <strong style={{ color: health.razorpay?.configured ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {health.razorpay?.configured ? 'Test Mode Ready' : health.razorpay?.status_detail}
              </strong>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
