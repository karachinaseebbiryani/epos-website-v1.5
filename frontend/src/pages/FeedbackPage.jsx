import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { Star, Send, MessageSquare } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FeedbackPage() {
    const { user } = useAuth();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({ rating: 5, comment: "", customer_name: "", email: "", phone: "" });

    const load = () => {
        setLoading(true);
        axios.get(`${API}/reviews`, { params: { limit: 50 } })
            .then(({ data }) => setReviews(data || []))
            .catch(() => toast.error("Failed to load reviews"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        if (user) {
            setForm((f) => ({ ...f, customer_name: f.customer_name || user.name || "", email: f.email || user.email || "" }));
        }
    }, [user]);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.comment.trim()) {
            toast.error("Please share your feedback before submitting.");
            return;
        }
        const phoneDigits = (form.phone || "").replace(/\D/g, "");
        if (phoneDigits && phoneDigits.length < 11) {
            toast.error("Phone number must contain at least 11 digits.");
            return;
        }
        setSubmitting(true);
        try {
            await axios.post(`${API}/feedback`, {
                rating: Number(form.rating),
                comment: form.comment.trim(),
                customer_name: form.customer_name || (user?.name || "Anonymous"),
                email: form.email || (user?.email || ""),
                phone: phoneDigits,
            });
            toast.success("Thank you for your feedback!");
            setForm((f) => ({ ...f, comment: "" }));
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Could not submit feedback");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-14" data-testid="feedback-page">
            <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Your Voice Matters</span>
            <h1 className="font-display font-black text-4xl md:text-5xl text-brand-ink mt-2">Customer Feedback</h1>
            <p className="text-neutral-500 mt-2 max-w-2xl">
                Read what our guests are saying and share your own thoughts. The kitchen team reads every message.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-10">
                {/* Submit form */}
                <form onSubmit={submit} className="lg:col-span-1 bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4 self-start" data-testid="feedback-form">
                    <h2 className="font-display font-bold text-lg flex items-center gap-2 text-brand-ink">
                        <Send className="w-4 h-4 text-brand-red" /> Share Your Feedback
                    </h2>

                    <div>
                        <label className="block text-sm font-semibold text-brand-ink mb-2">Your Rating</label>
                        <div className="flex items-center gap-1.5" data-testid="feedback-stars">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setForm({ ...form, rating: n })}
                                    data-testid={`feedback-star-${n}`}
                                    className="transition-transform hover:scale-110"
                                >
                                    <Star
                                        className="w-7 h-7"
                                        fill={n <= form.rating ? "#D29C2C" : "transparent"}
                                        stroke={n <= form.rating ? "#D29C2C" : "#a3a3a3"}
                                    />
                                </button>
                            ))}
                            <span className="text-sm text-neutral-500 ml-2">{form.rating}/5</span>
                        </div>
                    </div>

                    {!user && (
                        <>
                            <Field label="Name" value={form.customer_name} onChange={(v) => setForm({ ...form, customer_name: v })} testid="feedback-name" />
                            <Field label="Email (optional)" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="feedback-email" />
                            <Field
                                label="Phone (optional, 11+ digits)"
                                type="tel"
                                value={form.phone}
                                onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, "") })}
                                testid="feedback-phone"
                            />
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-brand-ink mb-2">Your Message</label>
                        <textarea
                            rows={4}
                            value={form.comment}
                            onChange={(e) => setForm({ ...form, comment: e.target.value })}
                            data-testid="feedback-comment"
                            placeholder="Tell us how we did, what you'd like to see, or just say hi…"
                            className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm resize-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        data-testid="feedback-submit"
                        className="w-full inline-flex items-center justify-center gap-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full py-3 font-bold transition-colors"
                    >
                        <Send className="w-4 h-4" /> {submitting ? "Sending…" : "Send Feedback"}
                    </button>
                </form>

                {/* Reviews list */}
                <div className="lg:col-span-2">
                    <h2 className="font-display font-bold text-lg mb-4 text-brand-ink flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-brand-red" /> Recent Reviews & Replies
                    </h2>
                    {loading ? (
                        <div className="text-center py-12 text-neutral-400" data-testid="feedback-loading">Loading…</div>
                    ) : reviews.length === 0 ? (
                        <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center text-neutral-500" data-testid="feedback-empty">
                            No reviews yet. Be the first to leave one!
                        </div>
                    ) : (
                        <div className="space-y-3" data-testid="feedback-list">
                            {reviews.map((r) => (
                                <ReviewCard key={r.id} review={r} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ReviewCard({ review }) {
    const dt = review.created_at ? new Date(review.created_at) : null;
    return (
        <div className="bg-white border border-neutral-200 rounded-2xl p-5" data-testid={`review-card-${review.id}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="font-bold text-brand-ink">{review.customer_name || "Customer"}</div>
                    <div className="flex items-center gap-1 mt-1" data-testid={`review-stars-${review.id}`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                                key={n}
                                className="w-4 h-4"
                                fill={n <= review.rating ? "#D29C2C" : "transparent"}
                                stroke={n <= review.rating ? "#D29C2C" : "#a3a3a3"}
                            />
                        ))}
                    </div>
                </div>
                {dt && <div className="text-xs text-neutral-400">{dt.toLocaleDateString()}</div>}
            </div>

            {review.comment && (
                <p className="text-sm text-neutral-700 mt-3 whitespace-pre-wrap">{review.comment}</p>
            )}

            {review.admin_reply && (
                <div className="mt-3 ml-2 pl-4 border-l-4 border-brand-yellow bg-amber-50/50 py-3 px-4 rounded-r-lg" data-testid={`review-reply-${review.id}`}>
                    <div className="text-xs font-bold text-brand-ink uppercase tracking-wider">Reply from {review.replied_by || "the team"}</div>
                    <p className="text-sm text-neutral-700 mt-1 whitespace-pre-wrap">{review.admin_reply}</p>
                </div>
            )}
        </div>
    );
}

function Field({ label, type = "text", value, onChange, testid }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-brand-ink mb-2">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                data-testid={testid}
                className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm"
            />
        </div>
    );
}
