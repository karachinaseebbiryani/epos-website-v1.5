import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { formatApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { toast } from "sonner";
import { Star, RotateCcw, ChevronRight, Package, Diamond, Tag } from "lucide-react";
import { IosEnableNotificationsCard } from "../components/IosInstallPrompt";

const STATUS_COLORS = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    preparing: "bg-blue-50 text-blue-700 border-blue-200",
    ready: "bg-purple-50 text-purple-700 border-purple-200",
    out_for_delivery: "bg-indigo-50 text-indigo-700 border-indigo-200",
    delivered: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS = {
    pending: "Pending", preparing: "Preparing", ready: "Ready",
    out_for_delivery: "On the way", delivered: "Delivered", cancelled: "Cancelled",
};

export default function ProfilePage() {
    const { user, logout } = useAuth();
    const { items: cartItems, addItem } = useCart();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [diamondBalance, setDiamondBalance] = useState(0);
    const [personalCoupons, setPersonalCoupons] = useState([]);
    const [reviewOrder, setReviewOrder] = useState(null);
    const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user === null) navigate("/login");
        if (user) {
            loadOrders();
            loadBalance();
            loadPersonalCoupons();
        }
        // eslint-disable-next-line
    }, [user]);

    // Keep the Diamond balance + order statuses fresh on this page. Without this, after the
    // restaurant marks an order as Delivered, the Profile screen still showed the OLD diamond
    // total until the customer hard-refreshed — even though the Rewards page updated. This
    // listens to focus + the diamondsUpdated event and lightly polls every 30s.
    useEffect(() => {
        if (!user) return;
        const refresh = () => { loadBalance(); loadOrders(); loadPersonalCoupons(); };
        window.addEventListener("focus", refresh);
        window.addEventListener("diamondsUpdated", refresh);
        const t = setInterval(refresh, 30000);
        return () => {
            window.removeEventListener("focus", refresh);
            window.removeEventListener("diamondsUpdated", refresh);
            clearInterval(t);
        };
        // eslint-disable-next-line
    }, [user]);

    const loadBalance = async () => {
        try {
            const { data } = await api.get("/loyalty/balance");
            setDiamondBalance(data.diamond_balance || 0);
        } catch (err) { /* silent */ }
    };

    const loadPersonalCoupons = async () => {
        try {
            const { data } = await api.get("/personal-coupons/me");
            setPersonalCoupons(data || []);
        } catch (err) { /* silent */ }
    };

    const copyCoupon = (code) => {
        if (!code) return;
        try { navigator.clipboard.writeText(code); toast.success(`Copied: ${code}`); }
        catch { toast.success(`Code: ${code}`); }
    };

    const loadOrders = async () => {
        try {
            const { data } = await api.get("/online-orders/me");
            setOrders(data);
        } catch (err) {
            // ignore
        }
    };

    const repeatOrder = (order) => {
        order.items.forEach((it) => {
            addItem({ id: it.item_id, name: it.name, price: it.price, image_url: "" }, it.quantity);
        });
        toast.success("Items added to cart!");
        navigate("/cart");
    };

    const submitReview = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post("/reviews", { order_id: reviewOrder.id, rating: reviewForm.rating, comment: reviewForm.comment });
            toast.success("Thanks for your review!");
            setReviewOrder(null);
            setReviewForm({ rating: 5, comment: "" });
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-16" data-testid="profile-page">
            <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
                <div>
                    <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">My Account</span>
                    <h1 className="font-display font-black text-4xl md:text-5xl text-brand-ink mt-2">Hi, {user.name?.split(" ")[0] || "Guest"} 👋</h1>
                    <p className="text-neutral-500 mt-1">{user.email}</p>
                </div>
                <button onClick={() => { logout(); navigate("/"); }} data-testid="profile-logout"
                    className="text-sm text-neutral-500 hover:text-brand-red font-semibold">Sign Out</button>
            </div>

            {/* iOS PWA users (Add-to-Home-Screen done) get a dedicated "Enable Notifications"
                button here because iOS requires the permission dialog to be triggered
                from a direct user gesture inside the installed PWA. */}
            <IosEnableNotificationsCard />

            {/* Diamond balance — visible immediately on profile so the customer always knows where
                they stand. Auto-refreshes when an order is marked Delivered (see effect above). */}
            <Link
                to="/rewards"
                data-testid="profile-diamond-balance"
                className="inline-flex items-center gap-3 mb-8 px-5 py-4 bg-gradient-to-br from-brand-yellow to-amber-300 rounded-2xl hover:shadow-lg transition-shadow"
            >
                <Diamond className="w-8 h-8 text-brand-ink" fill="currentColor" />
                <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-brand-ink/70">Diamond Balance</p>
                    <p className="font-display font-black text-2xl text-brand-ink leading-tight">{diamondBalance} <span className="text-sm font-bold">Diamonds</span></p>
                </div>
                <ChevronRight className="w-5 h-5 text-brand-ink/60 ml-2" />
            </Link>

            {/* Personal coupons — surface the customer's unique single-use codes (e.g. the
                second-order bonus). They're auto-applied at checkout, but we show them
                here too so the customer feels rewarded and remembers they have a perk. */}
            {personalCoupons.length > 0 && (
                <div className="mb-8 p-5 bg-gradient-to-br from-brand-red to-brand-red-dark text-white rounded-2xl" data-testid="profile-personal-coupons">
                    <div className="flex items-center gap-2 mb-1">
                        <Tag className="w-4 h-4" />
                        <span className="text-[11px] uppercase tracking-[0.2em] font-bold">Just for you</span>
                    </div>
                    <h2 className="font-display font-black text-lg">Your personal codes</h2>
                    <p className="text-sm text-white/85 mt-1">Auto-applied at checkout. Tap a code to copy.</p>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {personalCoupons.map((pc) => (
                            <button
                                key={pc.id}
                                type="button"
                                onClick={() => copyCoupon(pc.code)}
                                data-testid={`profile-coupon-${pc.id}`}
                                className="text-left bg-white/15 hover:bg-white/25 backdrop-blur-sm border-2 border-dashed border-white/60 rounded-xl px-3 py-2 transition-colors"
                            >
                                <div className="font-display font-black text-base tracking-wider">{pc.code}</div>
                                <div className="text-[11px] text-white/80">
                                    {pc.discount_percent > 0 ? `${pc.discount_percent}% OFF` : `Rs. ${pc.discount_amount} OFF`}
                                    {pc.expires_at && ` · expires ${new Date(pc.expires_at).toLocaleDateString()}`}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <h2 className="font-display font-bold text-2xl text-brand-ink mb-5">Order History</h2>

            {orders.length === 0 ? (
                <div className="bg-white border border-neutral-100 rounded-2xl p-10 text-center">
                    <Package className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
                    <p className="text-neutral-500 mb-4">No orders yet.</p>
                    <Link to="/menu" className="inline-flex items-center gap-2 text-brand-red font-semibold">
                        Start Ordering <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((o) => (
                        <div key={o.id} data-testid={`order-${o.id}`} className="bg-white border border-neutral-100 rounded-2xl p-5 md:p-6 shadow-sm">
                            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                                <div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="font-display font-bold text-brand-ink">Order #{o.receipt_no}</span>
                                        <span className={`text-[11px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[o.status] || ""}`}>
                                            {STATUS_LABELS[o.status] || o.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-1">{new Date(o.created_at).toLocaleString()}</p>
                                </div>
                                <span className="font-display font-black text-xl text-brand-red">Rs. {o.total_price?.toFixed(0)}</span>
                            </div>

                            <ul className="text-sm text-neutral-600 space-y-1 mb-4 border-t border-neutral-100 pt-4">
                                {o.items.map((it, idx) => (
                                    <li key={idx} className="flex justify-between">
                                        <span>{it.quantity}× {it.name}</span>
                                        <span>Rs. {it.price * it.quantity}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => repeatOrder(o)} data-testid={`repeat-order-${o.id}`}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-brand-yellow hover:text-brand-ink text-brand-ink rounded-full text-sm font-semibold transition-colors">
                                    <RotateCcw className="w-3.5 h-3.5" /> Repeat Order
                                </button>
                                {o.status === "delivered" && (
                                    <button onClick={() => setReviewOrder(o)} data-testid={`review-order-${o.id}`}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-full text-sm font-semibold hover:bg-brand-red-dark transition-colors">
                                        <Star className="w-3.5 h-3.5" /> Leave Review
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Review modal */}
            {reviewOrder && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setReviewOrder(null)} data-testid="review-modal">
                    <form onSubmit={submitReview} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
                        <h3 className="font-display font-bold text-xl text-brand-ink mb-4">Rate your order #{reviewOrder.receipt_no}</h3>
                        <div className="flex gap-2 mb-5 justify-center">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button type="button" key={n} onClick={() => setReviewForm({ ...reviewForm, rating: n })} data-testid={`review-star-${n}`}>
                                    <Star className={`w-9 h-9 ${n <= reviewForm.rating ? "fill-brand-yellow text-brand-yellow" : "text-neutral-300"} hover:scale-110 transition`} />
                                </button>
                            ))}
                        </div>
                        <textarea required value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} data-testid="review-comment"
                            rows={4} placeholder="Share your experience..."
                            className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm resize-none mb-4" />
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setReviewOrder(null)} className="flex-1 py-3 rounded-full bg-neutral-100 font-semibold text-brand-ink">Cancel</button>
                            <button type="submit" disabled={submitting} data-testid="review-submit" className="flex-1 py-3 rounded-full bg-brand-red text-white font-semibold hover:bg-brand-red-dark disabled:opacity-50 transition-colors">
                                {submitting ? "Submitting..." : "Submit Review"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
