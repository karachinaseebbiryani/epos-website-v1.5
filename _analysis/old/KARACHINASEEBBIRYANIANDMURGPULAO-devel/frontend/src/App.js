import React, { Suspense, lazy } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/sonner";
import LoginPage from "./pages/LoginPage";
import POSPage from "./pages/POSPage"; // POS is the most-used page → keep eager
import Sidebar from "./components/Sidebar";

// Lazy-load all admin pages so the POS loads instantly on low-spec laptops.
// Each page becomes its own JS chunk fetched on first navigation.
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const MenuManagement = lazy(() => import("./pages/MenuManagement"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const VendorsPage = lazy(() => import("./pages/VendorsPage"));
const RefundsPage = lazy(() => import("./pages/RefundsPage"));
const OldOrdersPage = lazy(() => import("./pages/OldOrdersPage"));

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: "#F9F8F6" }}>
    <p style={{ color: "#5C5F5C" }}>Loading…</p>
  </div>
);

function ProtectedRoute({ children, perm }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user === false) return <Navigate to="/login" replace />;
  if (perm && user.role !== "admin" && !(user.permissions || []).includes(perm)) return <Navigate to="/pos" replace />;
  return children;
}

function AppLayout({ children }) {
  return (<div className="flex h-screen overflow-hidden" style={{ background: "#F9F8F6" }}><Sidebar />{children}</div>);
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  const defaultPath = user?.role === "admin" ? "/" : "/pos";
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={user && user !== false ? <Navigate to={defaultPath} replace /> : <LoginPage />} />
        <Route path="/" element={<ProtectedRoute perm="dashboard"><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute perm="pos"><AppLayout><POSPage /></AppLayout></ProtectedRoute>} />
        <Route path="/menu" element={<ProtectedRoute perm="menu"><AppLayout><MenuManagement /></AppLayout></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute perm="inventory"><AppLayout><InventoryPage /></AppLayout></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute perm="expenses"><AppLayout><ExpensesPage /></AppLayout></ProtectedRoute>} />
        <Route path="/vendors" element={<ProtectedRoute perm="vendors"><AppLayout><VendorsPage /></AppLayout></ProtectedRoute>} />
        <Route path="/refunds" element={<ProtectedRoute perm="refunds"><AppLayout><RefundsPage /></AppLayout></ProtectedRoute>} />
        <Route path="/old-orders" element={<ProtectedRoute perm="orders_history"><AppLayout><OldOrdersPage /></AppLayout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute perm="reports_x"><AppLayout><ReportsPage /></AppLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute perm="settings"><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
