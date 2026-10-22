# SafeTicket: Direct Booking & P2P Ticket Resale Platform

An end-to-end ticketing and peer-to-peer (P2P) resale platform providing direct inventory booking, verified legal identity verification via Setu DigiLocker, Razorpay payment processing, authoritative ticket ownership transfer, and cryptographic QR gate passes with real-time server-side validation.

---

## 1. Technology Stack

- **Backend**: Python 3.11+, Django, Django REST Framework (DRF), SQLite (`db.sqlite3`)
- **Payment Gateway**: Razorpay Standard Checkout & Orders API with server-side HMAC SHA-256 cryptographic signature verification & API capture validation
- **Identity Verification**: Official Setu DigiLocker Sandbox API integration (`https://dg-sandbox.setu.co/api/digilocker/`)
- **Ticketing & Gate Passes**: Cryptographic QR tokens via Python `qrcode` and `Pillow` with server-side SHA-256 hash lookup and gate scanner admission
- **Frontend**: React 18, Vite, React Router, Vanilla CSS design system

---

## 2. Directory Structure

```text
ticket-reselling-platform/
├── backend/
│   ├── manage.py
│   ├── config/                  # Django project configuration (settings, URLs, views)
│   ├── accounts/                # Custom User, Session Auth, Setu DigiLocker KYC client & audit records
│   ├── catalog/                 # Categories, provider listings, and marketplace views
│   ├── orders/                  # Orders, reservations, Razorpay payment settlement & verification
│   ├── ticketing/               # Authoritative Provider, Event, Ticket, ResaleListing models & seed command
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Environment variable template
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── api/                 # API client for Django REST backend
│   │   ├── context/             # Authentication context
│   │   ├── layouts/             # Main layout & navigation
│   │   ├── pages/               # Explore, Listing Details, Checkout, Sell, Vault, Orders, Verification, Admin
│   │   └── utils/               # Formatters & helpers
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## 3. Core Architecture & Workflows

### 1. Providers & Pre-Created Inventory
- The platform supports 7 ticket categories: **Flights**, **Trains**, **Movies**, **Concerts**, **Festivals**, **Sports**, and **Other Events**.
- Available inventory is pre-created through database seed data, defining provider details, events, routes, venues, schedules, seats, base prices, and individual ticket records.
- Unowned tickets with `status='AVAILABLE'` are available for direct booking on the platform.

### 2. Direct Booking
1. Users browse and search available tickets across providers and categories on the Explore page.
2. Users select available inventory, view routes/venues, schedules, and base prices, and proceed to checkout.
3. The platform reserves the inventory row for 10 minutes (`select_for_update`) and creates a Razorpay order.
4. The buyer completes payment through Razorpay Standard Checkout.
5. Upon cryptographic server-side payment verification:
   - The ticket is assigned to the buyer (`ticket.owner = buyer`, `ticket.attendee_name = attendee_name`).
   - A unique booking reference (`DIR-...`) is assigned.
   - An authoritative cryptographic QR code gate pass is generated and stored in the user's **Ticket Vault**.

### 3. Identity Verification & KYC
- Uses genuine **Setu DigiLocker Sandbox** integration for Aadhaar eKYC.
- Users can register, log in, initiate consent verification, and retrieve their verified legal name.
- **Selling Gate**: Legal identity verification is required before listing tickets for resale.
- **Frictionless Purchasing**: Buying direct inventory does not require prior KYC.

### 4. Peer-to-Peer Resale
1. Verified users view eligible active tickets they own in their Ticket Vault.
2. The user sets a resale asking price within platform rules (anti-scalping rule: asking price is capped at 120% of original face value).
3. The platform creates a `ResaleListing` that directly references the authoritative `Ticket` (single authoritative ticket model). The ticket status becomes `LISTED`.
4. Another buyer can purchase the resale listing through Razorpay checkout.
5. Upon successful payment verification:
   - The seller's existing QR credential is completely invalidated.
   - A brand-new cryptographic QR pass and validation token are issued to the buyer.
   - Ownership transfers to the buyer (`ticket.owner = buyer`, `ticket.status = 'ACTIVE'`).
   - The resale listing status is updated to `SOLD`.

### 5. Gate Access Scanner
- Venue check-in turnstiles verify tickets against `/api/ticketing/verify/<token>/`.
- If a ticket was resold, the seller's old QR token returns `DENIED`.
- When a valid ticket is presented, the scanner returns `decision: GRANTED` and marks the ticket as `USED` with an audit timestamp, preventing replay or double-entry.

---

## 4. Setup and Installation

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend Setup
```bash
# Navigate to backend directory
cd ticket-reselling-platform/backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Seed providers, routes, venues, and direct-booking inventory
python manage.py seed_inventory

# Start Django development server (http://127.0.0.1:8000)
python manage.py runserver 127.0.0.1:8000
```

### Frontend Setup
```bash
# Navigate to frontend directory
cd ticket-reselling-platform/frontend

# Install dependencies
npm install

# Start Vite dev server (http://localhost:5173)
npm run dev
```

---

## 5. Environment Configuration

Configure `backend/.env` with your sandbox API credentials:

```env
SECRET_KEY=django-insecure-tsr-dev-secret-key-safe-local
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,testserver
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Setu DigiLocker Sandbox Configuration
SETU_BASE_URL=https://dg-sandbox.setu.co
SETU_CLIENT_ID=<your_setu_client_id>
SETU_CLIENT_SECRET=<your_setu_client_secret>
SETU_PRODUCT_INSTANCE_ID=<your_product_instance_id>
SETU_REDIRECT_URL=http://localhost:5173/kyc/callback

# Razorpay Payment Gateway Configuration
RAZORPAY_KEY_ID=<your_razorpay_key_id>
RAZORPAY_KEY_SECRET=<your_razorpay_key_secret>
```

---

## 6. Complete API Endpoint Summary

### System & Health
- `GET /api/health/`: Diagnostic health check returning database status, Setu DigiLocker readiness, and Razorpay readiness.

### Authentication & Setu KYC (`accounts/`)
- `GET /api/auth/csrf/`: Returns CSRF token for React SPA requests.
- `POST /api/auth/register/`: Registers a new user account.
- `POST /api/auth/login/`: Authenticates credentials and initiates session.
- `POST /api/auth/logout/`: Logs out user and flushes session.
- `GET /api/auth/me/`: Returns current user, KYC verification status, and verified legal name.
- `POST /api/auth/setu/initiate/`: Initiates genuine Setu DigiLocker consent request.
- `GET /api/auth/setu/status/`: Polls Setu request status and fetches Aadhaar verified legal name upon completion.

### Catalog & Marketplace (`catalog/`)
- `GET /api/catalog/categories/`: Lists all 7 supported ticket categories.
- `GET /api/catalog/providers/`: Returns providers, optionally filtered by category.
- `GET /api/catalog/listings/`: Public marketplace search, filtering, and sorting (supports direct booking inventory and peer resale listings).
- `GET /api/catalog/listings/<id>/`: Details of a specific inventory item or resale listing.
- `POST /api/catalog/resale/create/`: Lists an owned ticket for peer resale (enforces Setu DigiLocker KYC and 120% price cap).
- `GET /api/catalog/resale/my-listings/`: Returns all resale listings created by the authenticated seller.
- `POST /api/catalog/listings/<id>/withdraw/`: Withdraws an active resale listing and restores ticket to active vault status.

### Orders & Checkout (`orders/`)
- `POST /api/orders/checkout/`: Reserves ticket/listing for 10 minutes, creates pending Order, and initializes Razorpay order.
- `POST /api/orders/<id>/verify-payment/`: Cryptographically verifies Razorpay payment signature (HMAC SHA-256), validates amount via Razorpay API, marks order `COMPLETED`, assigns ticket or executes resale transfer, and generates dynamic QR pass.
- `GET /api/orders/history/`: Returns purchase history for authenticated buyer.

### Ticketing & QR Gate Pass (`ticketing/`)
- `GET /api/ticketing/mine/`: Returns digital tickets owned by the authenticated user in their Ticket Vault.
- `GET /api/ticketing/<id>/`: Returns details and QR gate pass for a specific owned ticket.
- `GET /api/ticketing/eligible-to-sell/`: Returns owned active tickets eligible for resale listing.
- `GET /api/ticketing/verify/<token>/`: Server-side gate access control scanner. Supports `?action=admit` (or `POST`) to check in attendee and mark ticket as `USED`.

---

## 7. Seed Inventory Command

To populate initial providers, schedules, and bookable tickets, run:
```bash
python manage.py seed_inventory
```

- **Idempotent**: Re-running the command updates provider and event details but never duplicates inventory.
- **Safety Guarantee**: The seed command will never overwrite user-owned tickets, active resale listings, or completed transactions.
- **Clean Slate**: Does not create dummy user accounts or fake purchases.
