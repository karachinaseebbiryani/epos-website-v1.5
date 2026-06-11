import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { API } from "../lib/api";
import { Star, CheckCircle, Loader2, Heart } from "lucide-react";
import { toast } from "sonner";

export default function ReviewPage() {
    const { orderId } = useParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState("");
    const [name, setName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await axios.get(`${API}/reviews/order/${orderId}`);
                if (cancelled) return;
                setData(data);
                if (data.review) setSubmitted(data.review);
                setName(data.order?.customer_name || "");
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.detail || "Order not found");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [orderId]);

    const submit = async () => {
        if (!rating) return;
        setSubmitting(true);
        try {
            const { data: rev } = await axios.post(`${API}/reviews/public/${orderId}`, {
                rating, comment, customer_name: name,
            });
            setSubmitted(rev);
            toast.success("Thank you for your feedback!");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Could not submit review");
        } finally { setSubmitting(false); }
    };

    if (loading) return (
        <div className="min-h-[50vh] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-brand-red animate-spin" />
        </div>
    );

    if (error) return (
        <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="review-not-found">
            <h1 className="font-display font-black text-3xl text-brand-ink mb-2">Order Not Found</h1>
            <p className="text-neutral-500 mb-6">Please check your link or scan the QR code on your receipt.</p>
            <Link to="/" className="text-brand-red font-semibold">Back to Home</Link>
        </div>
    );

    const order = data.order;
    const display = rating || hover;

    return (
        <div className="max-w-xl mx-auto px-4 md:px-8 py-10 md:py-16" data-testid="review-page">
            <div className="text-center mb-8">
                <span className="inline-block text-brand-red text-xs uppercase tracking-[0.2em] font-bold mb-2">Tell us how it went</span>
                <h1 className="font-display font-black text-3xl md:text-5xl text-brand-ink">Rate Order #{order.receipt_no}</h1>
                <p className="text-neutral-500 mt-2">{order.customer_name}{order.created_at ? ` · ${new Date(order.created_at).toLocaleDateString()}` : ""}</p>
            </div>

            {submitted ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center" data-testid="review-thanks">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white flex items-center justify-center">
                        <Heart className="w-8 h-8 text-brand-red fill-brand-red" />
                    </div>
                    <h2 className="font-display font-black text-2xl text-emerald-800 mb-2">Thank you, {submitted.customer_name}!</h2>
                    <p className="text-emerald-700 mb-4">Your feedback helps us serve you better.</p>
                    <div className="flex justify-center gap-1 mb-3">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={`w-6 h-6 ${n <= submitted.rating ? "text-yellow-500 fill-yellow-500" : "text-neutral-300"}`} />
                        ))}
                    </div>
                    {submitted.comment && <p className="text-neutral-700 italic max-w-sm mx-auto">"{submitted.comment}"</p>}
                    <Link to="/" className="inline-block mt-6 bg-brand-red text-white rounded-full px-6 py-3 text-sm font-semibold hover:bg-brand-red-dark transition-colors">
                        Order again
                    </Link>
                </div>
            ) : (
                <div className="bg-white border border-neutral-100 rounded-2xl p-6 md:p-8 shadow-sm">
                    <p className="text-sm text-neutral-500 mb-3">How would you rate this order?</p>
                    <div className="flex gap-2 mb-6 justify-center" data-testid="review-stars">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onMouseEnter={() => setHover(n)}
                                onMouseLeave={() => setHover(0)}
                                onClick={() => setRating(n)}
                                data-testid={`review-star-${n}`}
                                className="p-1 transition-transform hover:scale-110 active:scale-95"
                            >
                                <Star className={`w-10 h-10 transition-colors ${n <= display ? "text-yellow-500 fill-yellow-500" : "text-neutral-300"}`} />
                            </button>
                        ))}
                    </div>

                    <label className="block text-xs uppercase tracking-wider font-bold text-neutral-500 mb-1">Your name (optional)</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        data-testid="review-name"
                        className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 mb-4 outline-none focus:border-brand-red"
                        placeholder="Anonymous"
                    />

                    <label className="block text-xs uppercase tracking-wider font-bold text-neutral-500 mb-1">Comments (optional)</label>
                    <textarea
                        rows={4}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        data-testid="review-comment"
                        className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 mb-5 outline-none focus:border-brand-red"
                        placeholder="Tell us what you loved (or what we can improve)..."
                    />

                    <button
                        onClick={submit}
                        disabled={submitting || !rating}
                        data-testid="review-submit"
                        className="w-full bg-brand-red text-white rounded-full py-3.5 font-bold uppercase tracking-wider hover:bg-brand-red-dark disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        {submitting ? "Submitting…" : "Submit Review"}
                    </button>

                    <p className="text-[11px] text-neutral-400 mt-3 text-center">
                        One review per order · {(order.items || []).length} item{(order.items || []).length === 1 ? "" : "s"} · Rs. {Number(order.total_price || 0).toFixed(0)}
                    </p>
                </div>
            )}
        </div>
    );
}
