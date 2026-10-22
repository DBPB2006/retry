import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import MainLayout from './layouts/MainLayout';

// Page components
import ExplorePage from './pages/ExplorePage';
import ListingDetailsPage from './pages/ListingDetailsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerificationPage from './pages/VerificationPage';
import KycCallbackPage from './pages/KycCallbackPage';
import SellPage from './pages/SellPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import MyListingsPage from './pages/MyListingsPage';
import TicketVaultPage from './pages/TicketVaultPage';
import TicketDetailsPage from './pages/TicketDetailsPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            {/* Public Routes */}
            <Route index element={<ExplorePage />} />
            <Route path="listings/:id" element={<ListingDetailsPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="kyc/callback" element={<KycCallbackPage />} />

            {/* Authenticated Routes */}
            <Route
              path="verification"
              element={
                <ProtectedRoute>
                  <VerificationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sell"
              element={
                <ProtectedRoute>
                  <SellPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="checkout/:listingId"
              element={
                <ProtectedRoute>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders"
              element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="my-listings"
              element={
                <ProtectedRoute>
                  <MyListingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="vault"
              element={
                <ProtectedRoute>
                  <TicketVaultPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="vault/:id"
              element={
                <ProtectedRoute>
                  <TicketDetailsPage />
                </ProtectedRoute>
              }
            />

            {/* Protected Administrative Routes */}
            <Route
              path="admin/*"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />

            {/* 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
