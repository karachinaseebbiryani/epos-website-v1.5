import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle, Clock, Phone, ArrowRight, MapPin, Star } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import axios from "axios";
import { API } from "../lib/api";

export default function OrderSuccessPage() {
    const location = useLocation();
    const { id } = useParams();
    const order = location.state?.order;
    const [info, setInfo] = useState(null);

    useEffect(() => {
        axios.get(`${API}/public/restaurant-info`).then(({ data }) => setInfo(data)).catch(() => {});
    }, []);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const reviewUrl = `${origin}/review/${id}`;
    const mapsUrl = info?.google_maps_url || "https://maps.google.com/";

    return (
        <div className="max-w-2xl mx-auto px-4 py-16 md:py-24 text-center" data-testid="order-success-page">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="font-display font-black text-4xl md:text-5xl text-brand-ink mb-3">Order Placed!</h1>
            <p className="text-neutral-500 mb-2">Your order has been received.</p>
            <p className="text-sm text-neutral-400 mb-10">
                Order ID: <span className="font-mono font-semibold text-brand-ink">{order?.receipt_no || id?.slice(-6).toUpperCase()}</span>
            </p>

            {order && (
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
                        <span className="text-brand-red text-xl">Rs. {order.total_price?.toFixed(0)}</span>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-center gap-2 text-neutral-500 text-sm mb-8">
                <Clock className="w-4 h-4 text-brand-yellow" />
                Estimated delivery: <span className="font-semibold text-brand-ink">30–45 minutes</span>
            </div>

            {/* QR codes — find us + leave review */}
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
                <a href="tel:+923004928411" data-testid="success-call-restaurant" className="inline-flex items-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-brand-ink rounded-full px-7 py-3.5 font-semibold transition-colors">
                    <Phone className="w-4 h-4" /> Call Restaurant
                </a>
            </div>
        </div>
    );
}
