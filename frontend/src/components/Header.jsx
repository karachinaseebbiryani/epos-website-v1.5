import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { Menu, X, ShoppingBag, User, LogOut, UtensilsCrossed, Package, Diamond } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NAV = [
    { to: "/", label: "Home" },
    { to: "/menu", label: "Menu" },
    { to: "/offers", label: "Offers" },
    { to: "/events", label: "Events" },
    { to: "/feedback", label: "Feedback" },
];

export default function Header() {
    const { user, logout } = useAuth();
    const { totalQty } = useCart();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [diamondBalance, setDiamondBalance] = useState(0);

    const loadBalance = () => {
        if (user) {
            axios.get(`${API}/loyalty/balance`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('knb_token')}` }
            })
            .then(({ data }) => setDiamondBalance(data.diamond_balance || 0))
            .catch(() => {});
        } else {
            setDiamondBalance(0);
        }
    };

    useEffect(() => {
        loadBalance();
        // eslint-disable-next-line
    }, [user]);
    
    // Refresh balance when user navigates (catches post-checkout updates)
    useEffect(() => {
        const handleFocus = () => loadBalance();
        window.addEventListener('focus', handleFocus);
        
        // Listen for custom event from checkout
        const handleBalanceUpdate = () => loadBalance();
        window.addEventListener('diamondsUpdated', handleBalanceUpdate);
        
        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('diamondsUpdated', handleBalanceUpdate);
        };
        // eslint-disable-next-line
    }, [user]);

    return (
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5" data-testid="site-header">
            <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16 md:h-20">
                <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
                    <div className="w-9 h-9 rounded-full bg-brand-red text-white flex items-center justify-center font-display font-black text-lg">K</div>
                    <div className="hidden sm:flex flex-col leading-none">
                        <span className="font-display font-bold text-base text-brand-ink">Karachi Naseeb</span>
                        <span className="font-display text-xs text-brand-yellow font-semibold">Biryani &amp; Murg Pulao</span>
                    </div>
                </Link>

                <nav className="hidden md:flex items-center gap-1">
                    {NAV.map((n) => (
                        <NavLink
                            key={n.to}
                            to={n.to}
                            data-testid={`nav-${n.label.toLowerCase()}-link`}
                            className={({ isActive }) =>
                                `px-4 py-2 text-sm font-semibold rounded-full transition-colors ${isActive ? "bg-brand-red text-white" : "text-brand-ink hover:bg-neutral-100"}`
                            }
                        >
                            {n.label}
                        </NavLink>
                    ))}
                    {user && (
                        <NavLink
                            to="/orders"
                            data-testid="nav-orders-link"
                            className={({ isActive }) =>
                                `px-4 py-2 text-sm font-semibold rounded-full transition-colors ${isActive ? "bg-brand-red text-white" : "text-brand-ink hover:bg-neutral-100"}`
                            }
                        >
                            Orders
                        </NavLink>
                    )}
                    {user && (
                        <Link
                            to="/rewards"
                            data-testid="nav-diamonds-link"
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold rounded-full bg-brand-yellow text-brand-ink hover:bg-brand-yellow/90 transition-colors"
                        >
                            <Diamond className="w-4 h-4" fill="currentColor" />
                            {diamondBalance}
                        </Link>
                    )}
                </nav>

                <div className="flex items-center gap-2">
                    {/* Prominent Menu CTA for mobile — visible without opening hamburger */}
                    <Link
                        to="/menu"
                        data-testid="mobile-menu-quick-link"
                        className="md:hidden inline-flex items-center gap-1.5 bg-brand-red text-white rounded-full px-4 py-2 text-sm font-bold hover:bg-brand-red-dark transition-colors"
                    >
                        <UtensilsCrossed className="w-4 h-4" /> Menu
                    </Link>

                    <Link
                        to="/cart"
                        data-testid="cart-icon-button"
                        className="relative w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center"
                    >
                        <ShoppingBag className="w-5 h-5 text-brand-ink" />
                        {totalQty > 0 && (
                            <span data-testid="cart-badge" className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-red text-white text-[11px] flex items-center justify-center font-bold">
                                {totalQty}
                            </span>
                        )}
                    </Link>

                    {user ? (
                        <div className="hidden md:flex items-center gap-2">
                            <Link to="/profile" data-testid="profile-link" className="px-3 py-2 rounded-full hover:bg-neutral-100 flex items-center gap-2 text-sm font-semibold text-brand-ink">
                                <User className="w-4 h-4" /> {user.name?.split(" ")[0] || "Profile"}
                            </Link>
                            <button onClick={() => { logout(); navigate("/"); }} data-testid="logout-button" className="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center" aria-label="Logout">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <Link to="/login" data-testid="login-link" className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-red text-white font-semibold text-sm hover:bg-brand-red-dark transition-colors">
                            Sign In
                        </Link>
                    )}

                    <button
                        className="md:hidden w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center"
                        onClick={() => setOpen(!open)}
                        data-testid="mobile-menu-toggle"
                        aria-label="Toggle menu"
                    >
                        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {open && (
                <div className="md:hidden border-t border-black/5 bg-white" data-testid="mobile-nav">
                    <div className="px-4 py-3 flex flex-col gap-1">
                        {NAV.map((n) => (
                            <NavLink
                                key={n.to}
                                to={n.to}
                                data-testid={`mobile-nav-${n.label.toLowerCase()}-link`}
                                onClick={() => setOpen(false)}
                                className={({ isActive }) =>
                                    `px-4 py-3 rounded-xl text-sm font-semibold ${isActive ? "bg-brand-red text-white" : "text-brand-ink hover:bg-neutral-100"}`
                                }
                            >
                                {n.label}
                            </NavLink>
                        ))}
                        {user ? (
                            <>
                                <Link to="/rewards" data-testid="mobile-diamonds-link" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold bg-brand-yellow text-brand-ink hover:bg-brand-yellow/90">
                                    <Diamond className="w-4 h-4" fill="currentColor" /> {diamondBalance} Diamonds
                                </Link>
                                <Link to="/orders" data-testid="mobile-orders-link" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-brand-ink hover:bg-neutral-100">
                                    <Package className="w-4 h-4" /> My Orders
                                </Link>
                                <Link to="/profile" data-testid="mobile-profile-link" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-brand-ink hover:bg-neutral-100">
                                    <User className="w-4 h-4" /> My Profile
                                </Link>
                                <button onClick={() => { logout(); setOpen(false); navigate("/"); }} data-testid="mobile-logout-button" className="text-left flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-brand-red hover:bg-neutral-100">
                                    <LogOut className="w-4 h-4" /> Sign Out
                                </button>
                            </>
                        ) : (
                            <Link to="/login" data-testid="mobile-login-link" onClick={() => setOpen(false)} className="px-4 py-3 rounded-xl bg-brand-red text-white text-sm font-semibold text-center">Sign In</Link>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
