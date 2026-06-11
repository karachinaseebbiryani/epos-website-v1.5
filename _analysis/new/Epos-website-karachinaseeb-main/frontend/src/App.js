import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
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
import OrderSuccessPage from "./pages/OrderSuccessPage";
import BankPaymentPage from "./pages/BankPaymentPage";
import PaymentResultPage from "./pages/PaymentResultPage";
import TrackingPage from "./pages/TrackingPage";
import ReviewPage from "./pages/ReviewPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminMenu from "./pages/admin/AdminMenu";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminOffers from "./pages/admin/AdminOffers";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminLayout from "./components/AdminLayout";

function App() {
    return (
        <div className="App">
            <AuthProvider>
                <CartProvider>
                    <BrowserRouter>
                        <Toaster position="top-center" richColors />
                        <Routes>
                            <Route element={<Layout />}>
                                <Route path="/" element={<HomePage />} />
                                <Route path="/menu" element={<MenuPage />} />
                                <Route path="/cart" element={<CartPage />} />
                                <Route path="/checkout" element={<CheckoutPage />} />
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/register" element={<RegisterPage />} />
                                <Route path="/offers" element={<OffersPage />} />
                                <Route path="/events" element={<EventsPage />} />
                                <Route path="/profile" element={<ProfilePage />} />
                                <Route path="/order/:id/success" element={<OrderSuccessPage />} />
                                <Route path="/order/:id/bank-payment" element={<BankPaymentPage />} />
                                <Route path="/track/:id" element={<TrackingPage />} />
                                <Route path="/review/:orderId" element={<ReviewPage />} />
                                <Route path="/payment/success" element={<PaymentResultPage outcome="success" />} />
                                <Route path="/payment/cancel" element={<PaymentResultPage outcome="cancel" />} />
                            </Route>
                            <Route path="/admin/login" element={<AdminLoginPage />} />
                            <Route element={<AdminLayout />}>
                                <Route path="/admin" element={<AdminDashboard />} />
                                <Route path="/admin/orders" element={<AdminOrders />} />
                                <Route path="/admin/menu" element={<AdminMenu />} />
                                <Route path="/admin/categories" element={<AdminCategories />} />
                                <Route path="/admin/offers" element={<AdminOffers />} />
                                <Route path="/admin/events" element={<AdminEvents />} />
                                <Route path="/admin/settings" element={<AdminSettings />} />
                            </Route>
                        </Routes>
                    </BrowserRouter>
                </CartProvider>
            </AuthProvider>
        </div>
    );
}

export default App;
