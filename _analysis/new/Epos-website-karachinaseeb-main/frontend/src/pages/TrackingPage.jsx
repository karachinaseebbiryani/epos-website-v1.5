import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { API } from "../lib/api";
import { CheckCircle, Clock, Phone, MapPin, Package, ChefHat, Truck, Home, Loader2, Hourglass, Sparkles, Pencil } from "lucide-react";

const STEPS = [
    { key: "pending", label: "Order Placed", icon: Package },
    { key: "accepted", label: "Accepted", icon: CheckCircle },
    { key: "preparing", label: "Preparing", icon: ChefHat },
    { key: "ready", label: "Ready", icon: Package },
    { key: "out_for_delivery", label: "On the way", icon: Truck },
    { key: "delivered", label: "Delivered", icon: Home },
];

// For step progress, we treat "accepted" as the second step. "rejected" is a terminal sad state.
function progressIndex(status) {
    if (status === "rejected" || status === "cancelled") return -1;
    const idx = STEPS.findIndex((s) => s.key === status);
    return idx === -1 ? 0 : idx;
}

export default function TrackingPage() {
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await axios.get(`${API}/track/${id}`);
                setOrder(data);
            } catch (err) {
                setError("Order not found");
            }
        };
        load();
        const t = setInterval(load, 5000); // 5s polling — matches POS so customer sees updates fast
        return () => clearInterval(t);
    }, [id]);

    if (error) return (
        <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="tracking-not-found">
            <h1 className="font-display font-black text-3xl text-brand-ink mb-2">Order Not Found</h1>
            <p className="text-neutral-500 mb-6">Please check your tracking link.</p>
            <Link to="/" className="text-brand-red font-semibold">Back to Home</Link>
        </div>
    );

    if (!order) return (
        <div className="min-h-[50vh] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-brand-red animate-spin" />
        </div>
    );

    const currentIdx = progressIndex(order.status);
    const isCancelled = order.status === "cancelled";
    const isRejected = order.status === "rejected";
    const isPending = order.status === "pending";
    const isAccepted = order.status === "accepted";
    const wasModified = order.modified;

    const created = new Date(order.created_at);
    const eta = new Date(created.getTime() + 40 * 60000);

    return (
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-10 md:py-16" data-testid="tracking-page">
            <div className="text-center mb-8">
                <span className="inline-block text-brand-red text-xs uppercase tracking-[0.2em] font-bold mb-2">Live Tracking</span>
                <h1 className="font-display font-black text-3xl md:text-5xl text-brand-ink">Order #{order.receipt_no}</h1>
                <p className="text-neutral-500 mt-2">{order.customer_name} · Placed {created.toLocaleString()}</p>
            </div>

            {/* Status banner */}
            <StatusBanner status={order.status} reason={order.rejection_reason} modified={wasModified} />

            {/* Progress stepper (hidden for rejected/cancelled) */}
            {!isCancelled && !isRejected && (
                <div className="bg-white border border-neutral-100 rounded-2xl p-6 md:p-8 shadow-sm mb-6 mt-6">
                    <div className="relative">
                        {/* Mobile vertical layout */}
                        <div className="md:hidden space-y-4">
                            {STEPS.map((s, idx) => {
                                const Icon = s.icon;
                                const done = idx < currentIdx;
                                const active = idx === currentIdx;
                                return (
                                    <div key={s.key} className="flex items-start gap-3" data-testid={`step-mobile-${s.key}`}>
                                        <div className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${done ? "bg-green-600 text-white" : active ? "bg-brand-red text-white animate-pulse-ring" : "bg-neutral-100 text-neutral-400"}`}>
                                            {done ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1 pt-2">
                                            <div className={`text-sm font-semibold ${active ? "text-brand-red" : done ? "text-brand-ink" : "text-neutral-400"}`}>{s.label}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop horizontal layout */}
                        <div className="hidden md:flex items-center justify-between relative">
                            <div className="absolute top-5 left-0 right-0 h-1 bg-neutral-100 rounded-full" />
                            <div
                                className="absolute top-5 left-0 h-1 bg-green-600 rounded-full transition-all duration-700"
                                style={{ width: `${currentIdx >= 0 ? (currentIdx / (STEPS.length - 1)) * 100 : 0}%` }}
                            />
                            {STEPS.map((s, idx) => {
                                const Icon = s.icon;
                                const done = idx < currentIdx;
                                const active = idx === currentIdx;
                                return (
                                    <div key={s.key} className="relative z-10 flex flex-col items-center" data-testid={`step-${s.key}`}>
                                        <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${done ? "bg-green-600 text-white" : active ? "bg-brand-red text-white animate-pulse-ring" : "bg-white border-2 border-neutral-200 text-neutral-400"}`}>
                                            {done ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                        </div>
                                        <div className={`mt-3 text-xs font-semibold text-center max-w-[80px] ${active ? "text-brand-red" : done ? "text-brand-ink" : "text-neutral-400"}`}>{s.label}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {!isPending && (
                        <div className="mt-6 pt-6 border-t border-neutral-100 flex items-center justify-center gap-2 text-sm text-neutral-600">
                            <Clock className="w-4 h-4 text-brand-yellow" />
                            Estimated delivery by <span className="font-bold text-brand-ink">{eta.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Order Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-6">
                <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display font-bold text-base text-brand-ink">Order Items</h3>
                        {wasModified && <span data-testid="track-modified-tag" className="text-[10px] uppercase font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Updated</span>}
                    </div>
                    <ul className="space-y-2 text-sm">
                        {order.items.map((it, idx) => (
                            <li key={idx} className="flex justify-between">
                                <span className="text-neutral-600">{it.quantity}× {it.name}</span>
                                <span className="font-semibold">Rs. {it.price * it.quantity}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-3 pt-3 border-t border-neutral-100 space-y-1 text-sm">
                        {order.discount_amount > 0 && <div className="flex justify-between text-green-600 font-semibold"><span>Discount</span><span>− Rs. {order.discount_amount}</span></div>}
                        {order.delivery_fee > 0 && <div className="flex justify-between"><span className="text-neutral-500">Delivery</span><span>Rs. {order.delivery_fee}</span></div>}
                        <div className="flex justify-between pt-2 border-t border-neutral-100">
                            <span className="font-display font-bold text-brand-ink">Total</span>
                            <span data-testid="track-total" className="font-display font-black text-xl text-brand-red">Rs. {order.total_price?.toFixed(0)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-display font-bold text-base text-brand-ink mb-3">Delivery</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-brand-red mt-0.5 flex-shrink-0" />
                            <span className="text-neutral-600">{order.address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-brand-red" />
                            <a href={`tel:${order.phone}`} className="text-neutral-600 hover:text-brand-red">{order.phone}</a>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-neutral-100 text-xs text-neutral-500">
                        <div>Payment: <span className="font-semibold uppercase text-brand-ink">{order.payment_method}</span></div>
                        <div className="mt-1">Payment Status: <span className={`font-semibold uppercase ${order.payment_status === "paid" ? "text-green-700" : order.payment_status === "pending_verification" ? "text-yellow-700" : "text-neutral-600"}`}>{order.payment_status?.replace(/_/g, " ")}</span></div>
                    </div>
                </div>
            </div>

            <div className="mt-8 text-center">
                <a href="tel:+923004928411" data-testid="track-call-restaurant" className="inline-flex items-center gap-2 bg-neutral-100 hover:bg-brand-red hover:text-white text-brand-ink rounded-full px-6 py-3 font-semibold text-sm transition-colors">
                    <Phone className="w-4 h-4" /> Call Restaurant
                </a>
            </div>

            <p className="text-center text-xs text-neutral-400 mt-6">
                Bookmark this page — updates live every 5 seconds.
            </p>
        </div>
    );
}

function StatusBanner({ status, reason, modified }) {
    if (status === "pending") {
        return (
            <div data-testid="track-status-pending" className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-3">
                <Hourglass className="w-6 h-6 text-amber-600 animate-pulse flex-shrink-0" />
                <div>
                    <div className="font-display font-bold text-amber-800">Waiting for restaurant confirmation…</div>
                    <div className="text-sm text-amber-700/80">We'll let you know on WhatsApp the moment your order is accepted.</div>
                </div>
            </div>
        );
    }
    if (status === "accepted") {
        return (
            <div data-testid="track-status-accepted" className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <div>
                    <div className="font-display font-bold text-emerald-800">{modified ? "Your order has been updated and confirmed!" : "Your order has been accepted!"}</div>
                    <div className="text-sm text-emerald-700/80">{modified ? "Thanks for confirming the changes — we're starting to prepare it." : "We're getting started on your food now."}</div>
                </div>
            </div>
        );
    }
    if (status === "rejected") {
        const reasonLabel = ({ out_of_stock: "Out of stock", closed: "Kitchen is currently closed", other: "Other" })[reason] || reason;
        return (
            <div data-testid="track-status-rejected" className="bg-red-50 border border-red-200 rounded-2xl p-5">
                <div className="font-display font-bold text-red-800">Sorry — your order was rejected</div>
                <div className="text-sm text-red-700/80 mt-1">{reasonLabel ? <>Reason: <strong>{reasonLabel}</strong>.</> : null} Please call us if you need help.</div>
            </div>
        );
    }
    if (status === "cancelled") {
        return (
            <div data-testid="track-status-cancelled" className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 text-center">
                <p className="font-display font-bold text-neutral-700">Order Cancelled</p>
                <p className="text-sm text-neutral-500 mt-1">Please contact us if this was a mistake.</p>
            </div>
        );
    }
    if (modified) {
        return (
            <div data-testid="track-status-modified" className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-3">
                <Pencil className="w-6 h-6 text-amber-600 flex-shrink-0" />
                <div>
                    <div className="font-display font-bold text-amber-800">Your order was updated</div>
                    <div className="text-sm text-amber-700/80">A staff member adjusted some items after speaking with you.</div>
                </div>
            </div>
        );
    }
    return null;
}
