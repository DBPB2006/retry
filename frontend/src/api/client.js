/**
 * API client communicating with Django REST Framework backend.
 * Handles Django session authentication cookies, CSRF tokens, and JSON serialization.
 */

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

let cachedCsrfToken = null;

export async function fetchCsrfToken(force = false) {
  const fromCookie = getCookie('csrftoken');
  if (fromCookie && !force) {
    cachedCsrfToken = fromCookie;
    return fromCookie;
  }
  if (cachedCsrfToken && !force) return cachedCsrfToken;

  try {
    const res = await fetch('/api/auth/csrf/', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      cachedCsrfToken = data.csrfToken;
      return cachedCsrfToken;
    }
  } catch {
    // Ignore fallback
  }

  return cachedCsrfToken || getCookie('csrftoken') || '';
}

export function clearCsrfCache() {
  cachedCsrfToken = null;
}

async function request(endpoint, options = {}) {
  const method = options.method || 'GET';
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    const token = await fetchCsrfToken();
    if (token) {
      headers['X-CSRFToken'] = token;
    }
  }

  const response = await fetch(endpoint, {
    method,
    headers,
    credentials: 'include',
    body: options.body && typeof options.body === 'object' ? JSON.stringify(options.body) : options.body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || data.detail || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.code = data.code;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // System Health
  getHealth: () => request('/api/health/'),

  // Authentication
  getMe: () => request('/api/auth/me/'),
  login: async (credentials) => {
    clearCsrfCache();
    const res = await request('/api/auth/login/', { method: 'POST', body: credentials });
    clearCsrfCache();
    return res;
  },
  register: async (payload) => {
    clearCsrfCache();
    const res = await request('/api/auth/register/', { method: 'POST', body: payload });
    clearCsrfCache();
    return res;
  },
  logout: async () => {
    const res = await request('/api/auth/logout/', { method: 'POST' });
    clearCsrfCache();
    return res;
  },

  // Setu DigiLocker Identity Verification
  initiateSetuKyc: (payload) => {
    const body = typeof payload === 'string' ? { redirect_url: payload } : (payload || {});
    return request('/api/auth/setu/initiate/', { method: 'POST', body });
  },
  getSetuKycStatus: () => request('/api/auth/setu/status/'),

  // Catalog & Marketplace
  getCategories: () => request('/api/catalog/categories/'),
  getProviders: (category) => {
    const qs = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
    return request(`/api/catalog/providers/${qs}`);
  },
  getListings: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category && filters.category !== 'all') params.set('category', filters.category);
    if (filters.type && filters.type !== 'all') params.set('type', filters.type);
    if (filters.provider) params.set('provider', filters.provider);
    if (filters.q) params.set('q', filters.q);
    if (filters.min_price) params.set('min_price', filters.min_price);
    if (filters.max_price) params.set('max_price', filters.max_price);
    if (filters.sort) params.set('sort', filters.sort);
    const qs = params.toString();
    return request(`/api/catalog/listings/${qs ? `?${qs}` : ''}`);
  },
  getListingDetail: async (id) => {
    const data = await request(`/api/catalog/listings/${id}/`);
    return data?.listing || data;
  },
  createResaleListing: (payload) => request('/api/catalog/resale/create/', { method: 'POST', body: payload }),
  getSellerListings: () => request('/api/catalog/resale/my-listings/'),
  withdrawListing: (id) => request(`/api/catalog/listings/${id}/withdraw/`, { method: 'POST' }),

  // Orders & Razorpay Checkout
  createCheckoutOrder: (payload) => request('/api/orders/checkout/', { method: 'POST', body: payload }),
  verifyPayment: (orderId, payload) => request(`/api/orders/${orderId}/verify-payment/`, { method: 'POST', body: payload }),
  getOrderHistory: () => request('/api/orders/history/'),

  // Digital Tickets Vault & Gate Scanner
  getMyTickets: async () => {
    const data = await request('/api/ticketing/mine/');
    return data?.tickets || (Array.isArray(data) ? data : []);
  },
  getTicketDetail: async (id) => {
    const data = await request(`/api/ticketing/${id}/`);
    return data?.ticket || data;
  },
  getEligibleResaleTickets: async () => {
    const data = await request('/api/ticketing/eligible-to-sell/');
    return data?.tickets || [];
  },
  verifyQrCredential: (token, action = null) => {
    const url = `/api/ticketing/verify/${encodeURIComponent(token)}/${action ? `?action=${action}` : ''}`;
    return request(url);
  },
};
