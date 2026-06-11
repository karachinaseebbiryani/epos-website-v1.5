import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { toast } from "sonner";
import api, { formatApiError } from "../../lib/api";
import { MessageSquare, Star, Trash2, Send, Mail, Phone } from "lucide-react";

/**
 * Restaurant portal — Review & Feedback management.
 *
 * V2 fixes:
 * - Uses the shared `api` instance (Bearer admin token) instead of raw axios + cookies,
 *   which is why this screen previously showed "Failed to load reviews".
 * - Splits the list into two tabs: public REVIEWS (tied to a delivered order) and private
 *   FEEDBACK (general feedback w/ email + phone) per requirement #10/#16.
 */
export default function ReviewManagement() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("reviews"); // 'reviews' | 'feedback' | 'pending' | 'replied'
    const [replyDialog, setReplyDialog] = useState(null);
    const [replyText, setReplyText] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadReviews();
        // eslint-disable-next-line
    }, []);

    const loadReviews = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/admin/reviews", { params: { status: "all", limit: 200 } });
            setReviews(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Failed to load reviews");
        } finally {
            setLoading(false);
        }
    };

    const visible = reviews.filter((r) => {
        if (tab === "reviews") return !r.is_feedback;
        if (tab === "feedback") return !!r.is_feedback;
        if (tab === "pending") return !r.admin_reply;
        if (tab === "replied") return !!r.admin_reply;
        return true;
    });

    const openReplyDialog = (review) => {
        setReplyDialog(review);
        setReplyText(review.admin_reply || "");
    };

    const submitReply = async () => {
        if (!replyText.trim()) {
            toast.error("Reply cannot be empty");
            return;
        }
        setSubmitting(true);
        try {
            await api.post(`/admin/reviews/${replyDialog.id}/reply`, { reply: replyText });
            toast.success("Reply posted!");
            setReplyDialog(null);
            setReplyText("");
            loadReviews();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Failed to post reply");
        } finally {
            setSubmitting(false);
        }
    };

    const deleteReview = async (id) => {
        if (!window.confirm("Delete this entry? This cannot be undone.")) return;
        try {
            await api.delete(`/admin/reviews/${id}`);
            toast.success("Deleted");
            loadReviews();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Failed to delete");
        }
    };

    const renderStars = (rating) => (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={`w-4 h-4 ${i <= rating ? "fill-brand-yellow text-brand-yellow" : "text-neutral-300"}`} />
            ))}
        </div>
    );

    const counts = {
        reviews: reviews.filter((r) => !r.is_feedback).length,
        feedback: reviews.filter((r) => r.is_feedback).length,
        pending: reviews.filter((r) => !r.admin_reply).length,
        replied: reviews.filter((r) => r.admin_reply).length,
    };

    return (
        <div className="space-y-6" data-testid="review-management-page">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-6 h-6" style={{ color: "#1E3F20" }} />
                        <h1 className="text-2xl font-bold" style={{ color: "#1A1D1A" }}>Reviews &amp; Feedback</h1>
                    </div>
                    <p className="text-sm" style={{ color: "#5C5F5C" }}>Public order reviews show on the website; private feedback is yours alone.</p>
                </div>
                <button onClick={loadReviews} data-testid="reviews-refresh" className="text-xs font-semibold underline text-neutral-500 hover:text-brand-ink">Refresh</button>
            </div>

            <div className="flex gap-2 border-b border-neutral-200 pb-px overflow-x-auto">
                {[
                    { key: "reviews", label: `Order Reviews (${counts.reviews})` },
                    { key: "feedback", label: `Private Feedback (${counts.feedback})` },
                    { key: "pending", label: `Awaiting Reply (${counts.pending})` },
                    { key: "replied", label: `Replied (${counts.replied})` },
                ].map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        data-testid={`filter-${t.key}`}
                        className={`whitespace-nowrap px-4 py-2 text-sm font-semibold transition-colors ${
                            tab === t.key ? "border-b-2 border-[#1E3F20] text-[#1E3F20]" : "text-[#5C5F5C] hover:text-[#1A1D1A]"
                        }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64" data-testid="reviews-loading">
                    <div className="w-8 h-8 border-4 border-[#1E3F20] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : visible.length === 0 ? (
                <Card className="border-[#E5E2DC]">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-sm font-semibold mb-1" style={{ color: "#1A1D1A" }}>Nothing here yet</p>
                        <p className="text-sm" style={{ color: "#5C5F5C" }}>{tab === "feedback" ? "No private feedback received." : "No reviews match this filter."}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {visible.map((review) => (
                        <Card key={review.id} className={`border-[#E5E2DC] ${review.is_feedback ? "bg-amber-50/40" : ""}`}>
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                            <span className="font-bold text-[#1A1D1A]">{review.customer_name}</span>
                                            {renderStars(review.rating)}
                                            {review.is_feedback ? (
                                                <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Private Feedback</span>
                                            ) : (
                                                <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-[#5C5F5C]">
                                                    Order #{review.order_receipt_no}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[#5C5F5C]">
                                            {new Date(review.created_at).toLocaleDateString("en-US", {
                                                year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                                            })}
                                        </p>
                                        {review.is_feedback && (review.customer_email || review.customer_phone) && (
                                            <div className="flex items-center gap-4 mt-2 text-xs text-[#5C5F5C]">
                                                {review.customer_email && (
                                                    <a href={`mailto:${review.customer_email}`} className="inline-flex items-center gap-1 hover:text-brand-red" data-testid={`feedback-email-${review.id}`}>
                                                        <Mail className="w-3 h-3" /> {review.customer_email}
                                                    </a>
                                                )}
                                                {review.customer_phone && (
                                                    <a href={`tel:${review.customer_phone}`} className="inline-flex items-center gap-1 hover:text-brand-red" data-testid={`feedback-phone-${review.id}`}>
                                                        <Phone className="w-3 h-3" /> {review.customer_phone}
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <p className="text-sm text-[#1A1D1A] whitespace-pre-wrap">{review.comment}</p>
                                </div>

                                {review.admin_reply && (
                                    <div className="bg-[#EAF4EB] border border-[#1E3F20]/20 rounded-lg p-4 mb-4">
                                        <p className="text-xs font-semibold text-[#1E3F20] mb-1">Restaurant Reply:</p>
                                        <p className="text-sm text-[#1A1D1A] mb-2 whitespace-pre-wrap">{review.admin_reply}</p>
                                        <p className="text-xs text-[#5C5F5C]">By {review.replied_by} • {new Date(review.replied_at).toLocaleDateString()}</p>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => openReplyDialog(review)}
                                        size="sm"
                                        className="flex items-center gap-2 text-white"
                                        style={{ background: "#1E3F20" }}
                                        data-testid={`reply-review-${review.id}`}>
                                        <Send className="w-3 h-3" />
                                        {review.admin_reply ? "Update Reply" : "Reply"}
                                    </Button>
                                    <Button
                                        onClick={() => deleteReview(review.id)}
                                        variant="outline"
                                        size="sm"
                                        className="border-red-200 text-red-600 hover:bg-red-50"
                                        data-testid={`delete-review-${review.id}`}>
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={!!replyDialog} onOpenChange={() => setReplyDialog(null)}>
                <DialogContent className="max-w-md border-[#E5E2DC]">
                    <DialogHeader>
                        <DialogTitle>Reply to {replyDialog?.is_feedback ? "Feedback" : "Review"}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {replyDialog && (
                            <>
                                <div className="bg-[#F9F8F6] rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        {renderStars(replyDialog.rating)}
                                        <span className="text-xs text-[#5C5F5C]">by {replyDialog.customer_name}</span>
                                    </div>
                                    <p className="text-sm text-[#1A1D1A] whitespace-pre-wrap">{replyDialog.comment}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-2">Your Reply</label>
                                    <textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        data-testid="reply-textarea"
                                        rows={4}
                                        placeholder="Thank you for your feedback..."
                                        className="w-full px-4 py-3 bg-neutral-50 border border-[#E5E2DC] rounded-xl outline-none focus:border-[#1E3F20] text-sm resize-none"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReplyDialog(null)} className="border-[#E5E2DC]">Cancel</Button>
                        <Button
                            onClick={submitReply}
                            disabled={submitting}
                            className="text-white"
                            style={{ background: "#1E3F20" }}
                            data-testid="submit-reply-btn">
                            {submitting ? "Posting..." : "Post Reply"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
