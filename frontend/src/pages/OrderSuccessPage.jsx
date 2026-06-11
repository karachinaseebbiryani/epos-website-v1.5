import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { CheckCircle, Clock, Phone, ArrowRight, MapPin, Star, Sparkles } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { API } from "../lib/api";

/**
 * V2 changes:
 * - Polls /api/track/{id} every 3 seconds.
 * - The moment the restaurant accepts (or modifies+confirms) the order, the customer
 *   is auto-redirected to /track/{id} so they see the live status timeline.
 * - While the order is still "pending", a 2-minute response countdown (driven by the
 *   server's response_deadline_seconds field) is shown together with a Call Restaurant
 *   CTA.
 */
export default function OrderSuccessPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { id } = useParams();
    const initialOrder = location.state?.order;
    const [order, setOrder] = useState(initialOrder || null);
    const [info, setInfo] = useState(null);
    const [secondsLeft, setSecondsLeft] = useState(initialOrder?.response_deadline_seconds ?? 120);
    const redirectedRef = useRef(false);

    useEffect(() => {
        axios.get(`${API}/public/restaurant-info`).then(({ data }) => setInfo(data)).catch(() => {});
    }, []);

    // Poll order status every 3s. Auto-redirect to /track/:id once the restaurant takes action.
    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        const fetchStatus = async () => {
            try {
                const { data } = await axios.get(`${API}/track/${id}`);
                if (cancelled) return;
                setOrder((prev) => ({ ...(prev || {}), ...data }));
                if (typeof data.response_deadline_seconds === "number") {
                    setSecondsLeft(data.response_deadline_seconds);
                }
                if (!redirectedRef.current && data.status && data.status !== "pending") {
                    redirectedRef.current = true;
                    // Give the user a fraction of a second to see the new state before navigating.
                    setTimeout(() => navigate(`/track/${id}`, { replace: false }), 600);
                }
            } catch (e) { /* silent — keep polling */ }
        };
        fetchStatus();
        const t = setInterval(fetchStatus, 3000);
        return () => { cancelled = true; clearInterval(t); };
    }, [id, navigate]);

    // Local tick-down so the countdown looks responsive between polls.
    useEffect(() => {
        if (secondsLeft <= 0) return;
        if (order && order.status && order.status !== "pending") return;
        const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(t);
    }, [secondsLeft, order]);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const reviewUrl = `${origin}/review/${id}`;
    const mapsUrl = info?.google_maps_url || "https://maps.google.com/";
    const restaurantPhone = info?.phone || info?.whatsapp || "+923004928411";

    const isPending = !order || order.status === "pending" || !order.status;
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const ss = String(secondsLeft % 60).padStart(2, "0");

    return (
        <div className="max-w-2xl mx-auto px-4 py-16 md:py-24 text-center" data-testid="order-success-page">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${isPending ? "bg-amber-50" : "bg-green-50"}`}>
                {isPending ? <Sparkles className="w-12 h-12 text-amber-600 animate-pulse" /> : <CheckCircle className="w-12 h-12 text-green-600" />}
            </div>
            <h1 className="font-display font-black text-4xl md:text-5xl text-brand-ink mb-3">{isPending ? "Order Placed!" : "Order Confirmed!"}</h1>
            <p className="text-neutral-500 mb-2">{isPending ? "Waiting for the restaurant to accept your order…" : "The restaurant is preparing your order."}</p>
            <p className="text-sm text-neutral-400 mb-8">
                Order ID: <span className="font-mono font-semibold text-brand-ink">{order?.receipt_no || id?.slice(-6).toUpperCase()}</span>
            </p>

            {/* V2: 2-minute response countdown shown while pending */}
            {isPending && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 max-w-md mx-auto" data-testid="response-countdown-panel">
                    <div className="text-xs uppercase tracking-[0.2em] font-bold text-amber-700 mb-1">Restaurant response window</div>
                    <div className="font-display font-black text-5xl tabular-nums text-amber-800" data-testid="response-countdown-timer">
                        {mm}:{ss}
                    </div>
                    <p className="text-xs text-amber-700/80 mt-2">
                        We&apos;ll redirect you to live tracking as soon as the restaurant responds. If the timer runs out, please call us.
                    </p>
                    <a href={`tel:${restaurantPhone}`} data-testid="success-call-restaurant-now"
                        className="inline-flex items-center gap-2 mt-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full px-5 py-2 text-sm font-bold transition-colors">
                        <Phone className="w-4 h-4" /> Call Restaurant
                    </a>
                </div>
            )}

            {order?.items && (
                <div className="bg-white border border-neutral-100 rounded-2xl p-6 text-left shadow-sm mb-8 max-w-md mx-auto">
                    <h3 className="font-display font-bold mb-4">Order Summary</h3>
                    <ul className="space-y-2 mb-4 border-b border-neutral-100 pb-3">
                        {order.items.map((i, idx) => (
                            <li key={idx} className="flex justify-between text-sm">
                                <span className="text-neutral-600">{i.quantity}× {i.name}</span>
                                <span className="font-semibold">Rs. {i.price * i.quantity}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="flex justify-between font-display font-bold">
                        <span>Total</span>
                        <span className="text-brand-red text-xl">Rs. {Number(order.total_price || 0).toFixed(0)}</span>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-center gap-2 text-neutral-500 text-sm mb-8">
                <Clock className="w-4 h-4 text-brand-yellow" />
                Estimated delivery: <span className="font-semibold text-brand-ink">30–45 minutes</span>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-10">
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" data-testid="qr-find-us"
                    className="bg-white border border-neutral-100 rounded-2xl p-4 hover:border-brand-red transition-colors">
                    <div className="text-xs uppercase tracking-wider font-bold text-neutral-500 mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-brand-red" /> Find Us</div>
                    <div className="bg-white p-2 rounded-lg flex items-center justify-center">
                        <QRCodeSVG value={mapsUrl} size={120} level="M" />
                    </div>
                    <div className="mt-2 text-[11px] text-neutral-500">Tap to open Google Maps</div>
                </a>
                <Link to={`/review/${id}`} data-testid="qr-leave-review"
                    className="bg-white border border-neutral-100 rounded-2xl p-4 hover:border-brand-red transition-colors block">
                    <div className="text-xs uppercase tracking-wider font-bold text-neutral-500 mb-2 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-brand-yellow" /> Rate Order</div>
                    <div className="bg-white p-2 rounded-lg flex items-center justify-center">
                        <QRCodeSVG value={reviewUrl} size={120} level="M" />
                    </div>
                    <div className="mt-2 text-[11px] text-neutral-500">Scan to leave a review</div>
                </Link>
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
                <Link to={`/track/${id}`} data-testid="success-track-order" className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white rounded-full px-7 py-3.5 font-semibold transition-colors">
                    Track Order <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/menu" data-testid="success-continue-shopping" className="inline-flex items-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-brand-ink rounded-full px-7 py-3.5 font-semibold transition-colors">
                    Continue Shopping
                </Link>
                <a href={`tel:${restaurantPhone}`} data-testid="success-call-restaurant" className="inline-flex items-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-brand-ink rounded-full px-7 py-3.5 font-semibold transition-colors">
                    <Phone className="w-4 h-4" /> Call Restaurant
                </a>
            </div>
        </div>
    );
}
