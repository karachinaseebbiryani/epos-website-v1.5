import "./App.css";
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { StaffAuthProvider, useStaffAuth } from "./contexts/StaffAuthContext";

// --- Customer-facing site (NEW) ---
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import MenuPage from "./pages/MenuPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OffersPage from "./pages/OffersPage";
import EventsPage from "./pages/EventsPage";
import ProfilePage from "./pages/ProfilePage";
import OrdersPage from "./pages/OrdersPage";
import RewardsPage from "./pages/RewardsPage";
import FeedbackPage from "./pages/FeedbackPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import BankPaymentPage from "./pages/BankPaymentPage";
import PaymentResultPage from "./pages/PaymentResultPage";
import TrackingPage from "./pages/TrackingPage";
import ReviewPage from "./pages/ReviewPage";
import RiderViewPage from "./pages/RiderViewPage";

// --- Online-store admin panel (NEW) ---
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import UnifiedLoginPage from "./pages/UnifiedLoginPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminMenu from "./pages/admin/AdminMenu";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminOffers from "./pages/admin/AdminOffers";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminSettings from "./pages/admin/AdminSettings";
import PaymentGateways from "./pages/admin/PaymentGateways";
import LoyaltySettings from "./pages/admin/LoyaltySettings";
import RewardsManagement from "./pages/admin/RewardsManagement";
import AdminNotifications from "./pages/admin/AdminNotifications";
import ReviewManagement from "./pages/admin/ReviewManagement";
import AdminFAQs from "./pages/admin/AdminFAQs";
import AdminDeliveryAreas from "./pages/admin/AdminDeliveryAreas";
import FAQPage from "./pages/FAQPage";
import DeliveryPage from "./pages/DeliveryPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import PolicyPage from "./pages/PolicyPage";
import AdminLayout from "./components/AdminLayout";

// --- Operational POS pages (preserved from OLD system, lazy-loaded) ---
const POSPage = lazy(() => import("./pages/legacy/POSPage"));
const TablesPage = lazy(() => import("./pages/legacy/TablesPage"));
const ClassicDashboardPage = lazy(() => import("./pages/legacy/DashboardPage"));
const MenuManagement = lazy(() => import("./pages/legacy/MenuManagement"));
const InventoryPage = lazy(() => import("./pages/legacy/InventoryPage"));
const ReportsPage = lazy(() => import("./pages/legacy/ReportsPage"));
const SettingsPageFull = lazy(() => import("./pages/legacy/SettingsPage"));
const ExpensesPage = lazy(() => import("./pages/legacy/ExpensesPage"));
const VendorsPage = lazy(() => import("./pages/legacy/VendorsPage"));
const RefundsPage = lazy(() => import("./pages/legacy/RefundsPage"));
const OldOrdersPage = lazy(() => import("./pages/legacy/OldOrdersPage"));

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-neutral-50">
    <p className="text-neutral-500">Loading…</p>
  </div>
);

// Gate operational pages behind staff JWT (separate from customer auth and online-admin token).
function StaffGate({ children, perm }) {
  const { user, loading } = useStaffAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user === false) return <Navigate to="/admin/sign-in" replace />;
  if (perm && user.role !== "admin" && !(user.permissions || []).includes(perm)) {
    return <Navigate to="/admin/pos" replace />;
  }
  return children;
}

// Wrap operational pages in AdminLayout so they share the unified admin shell + sidebar.
const Op = ({ perm, children }) => (
  <StaffGate perm={perm}>
    <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
  </StaffGate>
);

function App() {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
  const Inner = (
    <div className="App">
      <AuthProvider>            {/* customer auth — /api/customer/* */}
        <StaffAuthProvider>     {/* staff auth — /api/auth/* (POS users) */}
          <CartProvider>
            <BrowserRouter>
              <Toaster position="top-center" richColors />
              <Routes>
                {/* ------------ Public customer-facing site ------------ */}
                <Route element={<Layout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/menu" element={<MenuPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/offers" element={<OffersPage />} />
                  <Route path="/events" element={<EventsPage />} />
                  <Route path="/faq" element={<FAQPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/privacy" element={<PolicyPage />} />
                  <Route path="/terms" element={<PolicyPage />} />
                  <Route path="/refunds" element={<PolicyPage />} />
                  <Route path="/ownership" element={<PolicyPage />} />
                  <Route path="/delivery" element={<DeliveryPage />} />
                  <Route path="/rewards-program" element={<PolicyPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/rewards" element={<RewardsPage />} />
                  <Route path="/feedback" element={<FeedbackPage />} />
                  <Route path="/order/:id/success" element={<OrderSuccessPage />} />
                  <Route path="/order/:id/bank-payment" element={<BankPaymentPage />} />
                  <Route path="/track/:id" element={<TrackingPage />} />
                  <Route path="/review/:orderId" element={<ReviewPage />} />
                  <Route path="/payment/success" element={<PaymentResultPage outcome="success" />} />
                  <Route path="/payment/cancel" element={<PaymentResultPage outcome="cancel" />} />
                </Route>

                {/* Rider one-tap delivery view — bypasses the customer Layout (no header
                    chrome) because riders use this on their phones in 1 hand. */}
                <Route path="/rider/:orderId" element={<RiderViewPage />} />

                {/* ------------ Admin login pages ------------
                     Unified sign-in is the canonical entry point. The two legacy
                     paths redirect into it so nothing breaks for existing
                     bookmarks. AdminLoginPage is kept for backward-compat tests
                     but no longer surfaced anywhere in the UI. */}
                <Route path="/admin/sign-in" element={<UnifiedLoginPage />} />
                <Route path="/admin/login" element={<Navigate to="/admin/sign-in" replace />} />
                <Route path="/admin/staff-login" element={<Navigate to="/admin/sign-in" replace />} />
                <Route path="/admin/legacy-login" element={<AdminLoginPage />} />

                {/* ------------ Unified admin shell ------------
                     Online-store admin (existing) + operational POS pages
                     (preserved from OLD) — all share AdminLayout's sidebar.   */}
                <Route element={<AdminLayout />}>
                  {/* Online store admin */}
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/orders" element={<AdminOrders />} />
                  <Route path="/admin/menu" element={<AdminMenu />} />
                  <Route path="/admin/categories" element={<AdminCategories />} />
                  <Route path="/admin/offers" element={<AdminOffers />} />
                  <Route path="/admin/events" element={<AdminEvents />} />
                  <Route path="/admin/reviews" element={<ReviewManagement />} />
                  <Route path="/admin/faqs" element={<AdminFAQs />} />
                  <Route path="/admin/delivery-areas" element={<AdminDeliveryAreas />} />
                  <Route path="/admin/loyalty-settings" element={<LoyaltySettings />} />
                  <Route path="/admin/rewards" element={<RewardsManagement />} />
                  <Route path="/admin/notifications" element={<AdminNotifications />} />
                  <Route path="/admin/settings" element={<AdminSettings />} />
                  <Route path="/admin/payment-gateways" element={<PaymentGateways />} />

                  {/* ----- POS Operations (preserved from OLD) ----- */}
                  <Route path="/admin/pos"               element={<Op perm="pos"><POSPage /></Op>} />
                  <Route path="/admin/tables"            element={<Op perm="pos"><TablesPage /></Op>} />
                  <Route path="/admin/dashboard-classic" element={<Op perm="dashboard"><ClassicDashboardPage /></Op>} />
                  <Route path="/admin/menu-mgmt"         element={<Op perm="menu"><MenuManagement /></Op>} />
                  <Route path="/admin/inventory"         element={<Op perm="inventory"><InventoryPage /></Op>} />
                  <Route path="/admin/expenses"          element={<Op perm="expenses"><ExpensesPage /></Op>} />
                  <Route path="/admin/vendors"           element={<Op perm="vendors"><VendorsPage /></Op>} />
                  <Route path="/admin/refunds"           element={<Op perm="refunds"><RefundsPage /></Op>} />
                  <Route path="/admin/old-orders"        element={<Op perm="orders_history"><OldOrdersPage /></Op>} />
                  <Route path="/admin/reports"           element={<Op perm="reports_x"><ReportsPage /></Op>} />
                  <Route path="/admin/settings-full"     element={<Op perm="settings"><SettingsPageFull /></Op>} />
                </Route>
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </StaffAuthProvider>
      </AuthProvider>
    </div>
  );
  // Wrap in GoogleOAuthProvider only when a client id is configured. The provider must be a
  // single root so the Google client loads once and is shared across login/register pages.
  return (
    <>
      {googleClientId
        ? <GoogleOAuthProvider clientId={googleClientId}>{Inner}</GoogleOAuthProvider>
        : Inner}
      <Analytics />
    </>
  );
}

export default App;
