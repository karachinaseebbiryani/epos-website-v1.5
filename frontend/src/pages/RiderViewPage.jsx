import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { API } from "../lib/api";
import { toast } from "sonner";
import { Loader2, MapPin, Phone, Navigation, CheckCircle2, Package, AlertTriangle } from "lucide-react";

/**
 * RiderView
 * ---------
 * Public, token-protected single-order page for delivery staff.
 *
 * URL: /rider/:orderId?t=<token>
 *  - Token is generated server-side when the order enters `out_for_delivery`.
 *  - Anyone with the link can view + mark delivered (designed for WhatsApp handoff).
 *  - Layout is mobile-first, single-purpose: customer pin → phone → items → big green button.
 *  - Auto-polls every 5s so updates from the customer (e.g. they share their location) appear.
 */
export default function RiderViewPage() {
    const { orderId } = useParams();
    const [params] = useSearchParams();
    const token = params.get("t") || params.get("token") || "";
    const [order, setOrder] = useState(null);
    const [error, setError] = useState(null);
    const [delivering, setDelivering] = useState(false);

    useEffect(() => {
        if (!orderId || !token) { setError("This rider link is missing its token."); return; }
        let alive = true;
        const load = async () => {
            try {
                const { data } = await axios.get(`${API}/rider/orders/${orderId}`, { params: { token } });
                if (alive) setOrder(data);
            } catch (err) {
                if (alive) setError(err?.response?.data?.detail || "Order not found or link expired.");
            }
        };
        load();
        const t = setInterval(load, 5000);
        return () => { alive = false; clearInterval(t); };
    }, [orderId, token]);

    const markDelivered = async () => {
        if (!orderId || !token || delivering) return;
        if (!window.confirm("Confirm: this order has been delivered to the customer?")) return;
        setDelivering(true);
        try {
            const { data } = await axios.post(`${API}/rider/orders/${orderId}/delivered`, null, { params: { token } });
            setOrder(data);
            toast.success("Marked as delivered. Thank you!");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Couldn't mark delivered. Try again.");
        } finally {
            setDelivering(false);
        }
    };

    if (error) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center px-4">
                <div className="text-center max-w-sm" data-testid="rider-error">
                    <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                    <h1 className="font-display font-bold text-xl text-brand-ink">Can't open this delivery</h1>
                    <p className="text-sm text-neutral-500 mt-2">{error}</p>
                    <p className="text-xs text-neutral-400 mt-4">Ask the restaurant for a fresh rider link.</p>
                </div>
            </div>
        );
    }
    if (!order) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-brand-red" /></div>
        );
    }

    const receipt = (order.id || "").slice(-6).toUpperCase();
    const lat = order.customer_lat ?? order.delivery_lat;
    const lng = order.customer_lng ?? order.delivery_lng;
    const hasGps = lat !== undefined && lat !== null && lng !== undefined && lng !== null;
    const mapsHref = hasGps ? `https://www.google.com/maps?q=${lat},${lng}` : null;
    const dirsHref = hasGps ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null;
    const finalAddress = order.customer_address_updated || order.address;
    const isDone = order.status === "delivered";

    return (
        <div className="min-h-screen bg-neutral-50 pb-32" data-testid="rider-view">
            <div className="bg-brand-ink text-white px-5 pt-6 pb-8">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/60">Delivery #{receipt}</p>
                <h1 className="font-display font-black text-2xl mt-1">{order.customer_name}</h1>
                <p className="text-sm text-white/80 mt-1">Status: <span className="font-semibold capitalize">{order.status.replace(/_/g, " ")}</span></p>
            </div>

            <div className="max-w-md mx-auto px-4 -mt-5 space-y-3">
                {/* Big nav-to-customer card */}
                <div className="bg-white rounded-2xl shadow-md p-5">
                    <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-brand-red mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Drop to</p>
                            <p className="text-sm text-brand-ink font-semibold leading-snug mt-0.5">{finalAddress}</p>
                            {order.customer_location_history && order.customer_location_history.length > 0 && (
                                <p className="text-[11px] text-emerald-700 mt-1">
                                    ✓ Customer shared GPS {order.customer_location_history.length}×
                                </p>
                            )}
                        </div>
                    </div>
                    {hasGps ? (
                        <a
                            href={dirsHref}
                            target="_blank"
                            rel="noreferrer"
                            data-testid="rider-navigate"
                            className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-3 font-bold uppercase tracking-wider text-sm"
                        >
                            <Navigation className="w-4 h-4" /> Navigate in Google Maps
                        </a>
                    ) : (
                        <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                            No GPS shared yet. Use the address above and call the customer if needed.
                        </p>
                    )}
                </div>

                {/* Call customer */}
                <a
                    href={`tel:${order.phone}`}
                    data-testid="rider-call"
                    className="block bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <Phone className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Customer</p>
                            <p className="text-base text-brand-ink font-bold">{order.phone}</p>
                        </div>
                        <span className="text-xs text-emerald-700 font-semibold">Tap to call</span>
                    </div>
                </a>

                {/* Items list — short, just so the rider can verify the bag */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4 text-brand-red" />
                        <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Bag contents</p>
                    </div>
                    <ul className="space-y-1 text-sm">
                        {(order.items || []).map((it, idx) => {
                            const isFree = it.price === 0 || /\(FREE/i.test(it.name || "");
                            return (
                                <li key={idx} className={`flex justify-between ${isFree ? "text-emerald-700 font-semibold" : "text-neutral-700"}`}>
                                    <span>{it.quantity}× {it.name}</span>
                                    <span>{isFree ? "FREE" : `Rs. ${Number(it.price * it.quantity).toFixed(0)}`}</span>
                                </li>
                            );
                        })}
                    </ul>
                    <div className="mt-3 pt-3 border-t border-neutral-100 flex justify-between text-sm">
                        <span className="text-neutral-500">Collect from customer</span>
                        <span className="font-display font-black text-brand-red text-lg">
                            {order.payment_status === "paid" ? "Rs. 0 (Paid)" : `Rs. ${Number(order.total_price).toFixed(0)}`}
                        </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">Payment: <span className="uppercase font-semibold">{order.payment_method}</span></p>
                </div>

                {/* Notes if any */}
                {order.notes && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-2xl p-4 text-sm">
                        <p className="font-bold text-xs uppercase tracking-wider text-yellow-700">Note from customer</p>
                        <p className="mt-1">{order.notes}</p>
                    </div>
                )}
            </div>

            {/* Sticky bottom action — big enough to tap one-handed while holding food */}
            <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-4 py-3">
                <div className="max-w-md mx-auto">
                    {isDone ? (
                        <div className="text-center bg-emerald-50 border border-emerald-200 rounded-full py-3 font-bold text-emerald-700 inline-flex items-center justify-center w-full gap-2">
                            <CheckCircle2 className="w-5 h-5" /> Delivered · thank you!
                        </div>
                    ) : (
                        <button
                            onClick={markDelivered}
                            disabled={delivering}
                            data-testid="rider-mark-delivered"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-full py-4 font-display font-black uppercase tracking-wider text-base shadow-lg shadow-emerald-600/30 inline-flex items-center justify-center gap-2"
                        >
                            {delivering ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                            {delivering ? "Marking..." : "Mark Delivered"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
