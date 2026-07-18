import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { formatApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { toast } from "sonner";
import { Star, RotateCcw, ChevronRight, Package, Clock, CheckCircle2, XCircle, Truck } from "lucide-react";
import EnableNotificationsCard from "../components/EnableNotificationsCard";
import { IosEnableNotificationsCard } from "../components/IosInstallPrompt";

const STATUS_COLORS = {
    awaiting_payment: "bg-amber-50 text-amber-700 border-amber-200",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    accepted: "bg-blue-50 text-blue-700 border-blue-200",
    preparing: "bg-blue-50 text-blue-700 border-blue-200",
    ready: "bg-purple-50 text-purple-700 border-purple-200",
    out_for_delivery: "bg-indigo-50 text-indigo-700 border-indigo-200",
    delivered: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS = {
    awaiting_payment: "Awaiting Payment",
    pending: "Pending",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready",
    out_for_delivery: "On the way",
    delivered: "Delivered",
    cancelled: "Cancelled",
    rejected: "Rejected",
};

const STATUS_ICONS = {
    awaiting_payment: Clock,
    pending: Clock,
    accepted: CheckCircle2,
    preparing: Package,
    ready: Package,
    out_for_delivery: Truck,
    delivered: CheckCircle2,
    cancelled: XCircle,
    rejected: XCircle,
};

export default function OrdersPage() {
    const { user } = useAuth();
    const { addItem } = useCart();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [reviewOrder, setReviewOrder] = useState(null);
    const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user === null) navigate("/login");
        if (user) loadOrders();
        // eslint-disable-next-line
    }, [user]);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/online-orders/me");
            setOrders(data);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally {
            setLoading(false);
        }
    };

    const repeatOrder = (order) => {
        order.items.forEach((it) => {
            addItem({ id: it.item_id, name: it.name, price: it.price, image_url: "" }, it.quantity);
        });
        toast.success("Items added to cart!");
        navigate("/cart");
    };

    const openReviewModal = (order) => {
        setReviewOrder(order);
        setReviewForm({ rating: 5, comment: "" });
    };

    const submitReview = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post("/reviews", {
                order_id: reviewOrder.id,
                rating: reviewForm.rating,
                comment: reviewForm.comment
            });
            toast.success("Thanks for your review!");
            setReviewOrder(null);
            setReviewForm({ rating: 5, comment: "" });
            loadOrders(); // Reload to get updated review status
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) return null;

    const filteredOrders = orders.filter((o) => {
        if (filter === "all") return true;
        if (filter === "active") return ["pending", "accepted", "preparing", "ready", "out_for_delivery"].includes(o.status);
        if (filter === "delivered") return o.status === "delivered";
        if (filter === "cancelled") return ["cancelled", "rejected"].includes(o.status);
        return true;
    });

    return (
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12" data-testid="orders-page">
            {/* Header */}
            <div className="mb-8">
                <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Order History</span>
                <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mt-2">My Orders</h1>
                <p className="text-neutral-500 mt-1">Track and manage your orders</p>
            </div>

            <EnableNotificationsCard />
            <IosEnableNotificationsCard />

            {/* Filter Tabs */}
            <div className="sticky top-16 md:top-20 z-10 bg-white/95 backdrop-blur-sm border-b border-neutral-100 -mx-4 px-4 md:-mx-8 md:px-8 mb-6">
                <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-px">
                    {[
                        { key: "all", label: "All Orders", count: orders.length },
                        { key: "active", label: "Active", count: orders.filter((o) => ["pending", "accepted", "preparing", "ready", "out_for_delivery"].includes(o.status)).length },
                        { key: "delivered", label: "Delivered", count: orders.filter((o) => o.status === "delivered").length },
                        { key: "cancelled", label: "Cancelled", count: orders.filter((o) => ["cancelled", "rejected"].includes(o.status)).length },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            data-testid={`filter-${tab.key}`}
                            onClick={() => setFilter(tab.key)}
                            className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                                filter === tab.key
                                    ? "border-b-2 border-brand-red text-brand-red"
                                    : "text-neutral-500 hover:text-brand-ink"
                            }`}>
                            {tab.label} {tab.count > 0 && <span className="text-xs">({tab.count})</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders List */}
            {loading ? (
                <div className="text-center py-16">
                    <div className="inline-block w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-neutral-500 mt-3">Loading orders...</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="bg-white border border-neutral-100 rounded-2xl p-10 md:p-16 text-center">
                    <Package className="w-16 h-16 mx-auto text-neutral-300 mb-4" />
                    <h3 className="font-display font-bold text-xl text-brand-ink mb-2">
                        {filter === "all" ? "No orders yet" : `No ${filter} orders`}
                    </h3>
                    <p className="text-neutral-500 mb-6">
                        {filter === "all" ? "Start ordering your favorite dishes!" : "Try adjusting your filter"}
                    </p>
                    {filter === "all" && (
                        <Link
                            to="/menu"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-red text-white font-semibold rounded-full hover:bg-brand-red-dark transition-colors">
                            Browse Menu <ChevronRight className="w-4 h-4" />
                        </Link>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredOrders.map((order) => {
                        const StatusIcon = STATUS_ICONS[order.status] || Package;
                        const canReview = order.status === "delivered";
                        
                        return (
                            <div
                                key={order.id}
                                data-testid={`order-${order.id}`}
                                className="bg-white border border-neutral-100 rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                                {/* Order Header */}
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 flex-wrap mb-2">
                                            <span className="font-display font-bold text-lg text-brand-ink">
                                                #{order.receipt_no}
                                            </span>
                                            <span
                                                className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border ${
                                                    STATUS_COLORS[order.status] || ""
                                                }`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {STATUS_LABELS[order.status] || order.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-500">
                                            {new Date(order.created_at).toLocaleDateString("en-US", {
                                                weekday: "short",
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-display font-black text-2xl text-brand-red">
                                            Rs. {order.total_price?.toFixed(0)}
                                        </span>
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div className="border-t border-neutral-100 pt-4 mb-4">
                                    <ul className="space-y-2">
                                        {order.items.map((item, idx) => (
                                            <li
                                                key={idx}
                                                className="flex justify-between items-center text-sm">
                                                <span className="text-neutral-700">
                                                    <span className="font-semibold text-brand-ink">{item.quantity}×</span> {item.name}
                                                </span>
                                                <span className="font-semibold text-neutral-600">
                                                    Rs. {(item.price * item.quantity).toFixed(0)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Delivery Info */}
                                {order.address && (
                                    <div className="bg-neutral-50 rounded-lg p-3 mb-4 text-xs text-neutral-600">
                                        <p className="font-semibold text-brand-ink mb-1">Delivery Address</p>
                                        <p>{order.address}</p>
                                        {order.phone && <p className="mt-1">📱 {order.phone}</p>}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2">
                                    <Link
                                        to={order.track_token ? `/track/${order.id}?t=${encodeURIComponent(order.track_token)}` : `/track/${order.id}`}
                                        data-testid={`track-order-${order.id}`}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-brand-ink rounded-full text-sm font-semibold transition-colors">
                                        <Package className="w-3.5 h-3.5" /> Track Order
                                    </Link>
                                    
                                    {["delivered", "cancelled", "rejected"].includes(order.status) && (
                                        <button
                                            onClick={() => repeatOrder(order)}
                                            data-testid={`repeat-order-${order.id}`}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-yellow hover:bg-brand-yellow/90 text-brand-ink rounded-full text-sm font-semibold transition-colors">
                                            <RotateCcw className="w-3.5 h-3.5" /> Reorder
                                        </button>
                                    )}
                                    
                                    {canReview && (
                                        <button
                                            onClick={() => openReviewModal(order)}
                                            data-testid={`review-order-${order.id}`}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white rounded-full text-sm font-semibold transition-colors">
                                            <Star className="w-3.5 h-3.5" /> {order.has_review ? "Edit Review" : "Leave Review"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Review Modal */}
            {reviewOrder && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                    onClick={() => setReviewOrder(null)}
                    data-testid="review-modal">
                    <form
                        onSubmit={submitReview}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <h3 className="font-display font-bold text-xl text-brand-ink mb-4">
                            Rate Order #{reviewOrder.receipt_no}
                        </h3>
                        
                        {/* Star Rating */}
                        <div className="flex gap-2 mb-5 justify-center">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                    type="button"
                                    key={n}
                                    onClick={() => setReviewForm({ ...reviewForm, rating: n })}
                                    data-testid={`review-star-${n}`}
                                    className="transition-transform hover:scale-110">
                                    <Star
                                        className={`w-9 h-9 ${
                                            n <= reviewForm.rating
                                                ? "fill-brand-yellow text-brand-yellow"
                                                : "text-neutral-300"
                                        }`}
                                    />
                                </button>
                            ))}
                        </div>
                        
                        {/* Comment */}
                        <textarea
                            required
                            value={reviewForm.comment}
                            onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                            data-testid="review-comment"
                            rows={4}
                            placeholder="Share your experience..."
                            className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm resize-none mb-4"
                        />
                        
                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setReviewOrder(null)}
                                className="flex-1 py-3 rounded-full bg-neutral-100 hover:bg-neutral-200 font-semibold text-brand-ink transition-colors">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                data-testid="review-submit"
                                className="flex-1 py-3 rounded-full bg-brand-red text-white font-semibold hover:bg-brand-red-dark disabled:opacity-50 transition-colors">
                                {submitting ? "Submitting..." : "Submit Review"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
