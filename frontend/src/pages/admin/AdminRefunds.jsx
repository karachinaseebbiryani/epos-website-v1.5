import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { API, formatApiError } from "../../lib/api";
import { toast } from "sonner";
import { RotateCcw, User, Phone, MapPin, Send, Image as ImageIcon, Loader2, ExternalLink } from "lucide-react";

/**
 * Admin → Refund Requests — every customer refund in one place.
 *
 * Per request: full order context (items, totals, payment), who the customer is
 * — including a prominent GUEST badge, because guests have no account/history
 * on their side, so this page is the ONLY record tying them to the request —
 * the conversation thread (customers can attach proof photos; staff can reply
 * and attach too), and the lifecycle actions. "Refund to Wallet" credits the
 * amount as store credit on the customer's account instead of real money
 * (signed-in customers only).
 */
const STATUS_META = {
    requested: { label: "Requested", cls: "bg-purple-100 text-purple-800" },
    approved: { label: "Approved", cls: "bg-blue-100 text-blue-800" },
    refunded: { label: "Refunded", cls: "bg-green-100 text-green-800" },
    rejected: { label: "Declined", cls: "bg-neutral-200 text-neutral-600" },
};

export default function AdminRefunds() {
    const [data, setData] = useState({ requests: [], counts: {} });
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    const load = async (f = filter) => {
        try {
            const { data: d } = await api.get(`/admin/refund-requests`, { params: { status: f } });
            setData(d);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Failed to load refund requests");
        } finally { setLoading(false); }
    };

    useEffect(() => { load(filter); const t = setInterval(() => load(filter), 15000); return () => clearInterval(t); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

    const act = async (orderId, action, method = "gateway") => {
        let note = "";
        if (action === "rejected") {
            note = window.prompt("Reason for declining (sent to the customer):") || "";
            if (!note.trim()) return;
        }
        if (action === "refunded" && method === "gateway" &&
            !window.confirm("Confirm you HAVE sent the money from the SafePay dashboard.")) return;
        if (action === "refunded" && method === "wallet" &&
            !window.confirm("Credit the amount to the customer's WALLET as store credit? They can spend it on future orders.")) return;
        setBusyId(orderId);
        try {
            await api.post(`/admin/online-orders/${orderId}/refund-action`, { action, note, method });
            toast.success("Done — customer notified");
            load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally { setBusyId(null); }
    };

    const totals = data.counts || {};
    const chips = [
        { key: "all", label: `All (${Object.values(totals).reduce((a, b) => a + b, 0)})` },
        { key: "requested", label: `Requested (${totals.requested || 0})` },
        { key: "approved", label: `Approved (${totals.approved || 0})` },
        { key: "refunded", label: `Refunded (${totals.refunded || 0})` },
        { key: "rejected", label: `Declined (${totals.rejected || 0})` },
    ];

    return (
        <div data-testid="admin-refunds-page">
            <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mb-2">Refund Requests</h1>
            <p className="text-neutral-500 mb-6">Review, chat with the customer, and settle — via SafePay or wallet credit.</p>

            <div className="flex flex-wrap gap-2 mb-6">
                {chips.map((c) => (
                    <button key={c.key} onClick={() => { setFilter(c.key); setLoading(true); }}
                        data-testid={`refunds-filter-${c.key}`}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${filter === c.key ? "bg-brand-red text-white border-transparent" : "border-neutral-200 text-neutral-500 hover:border-brand-red"}`}>
                        {c.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="py-16 text-center text-neutral-400">Loading…</div>
            ) : data.requests.length === 0 ? (
                <div className="py-16 text-center text-neutral-400">
                    <RotateCcw className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    No refund requests{filter !== "all" ? " in this state" : " yet"}.
                </div>
            ) : (
                <div className="space-y-4 max-w-4xl">
                    {data.requests.map((r) => (
                        <RefundCard key={r.order_id} r={r} busy={busyId === r.order_id} onAct={act} onReload={load} />
                    ))}
                </div>
            )}
        </div>
    );
}

function RefundCard({ r, busy, onAct, onReload }) {
    const rr = r.refund_request || {};
    const meta = STATUS_META[rr.status] || STATUS_META.requested;
    const [msg, setMsg] = useState("");
    const [sending, setSending] = useState(false);
    const fileRef = useRef(null);
    const [attach, setAttach] = useState(null); // data URL

    const pickImage = (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => setAttach(reader.result);
        reader.readAsDataURL(f);
    };

    const sendMsg = async () => {
        if (!msg.trim() && !attach) return;
        setSending(true);
        try {
            await api.post(`/admin/online-orders/${r.order_id}/refund-message`, { text: msg.trim(), image: attach });
            setMsg(""); setAttach(null);
            onReload();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally { setSending(false); }
    };

    return (
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm" data-testid={`refund-card-${r.order_id}`}>
            <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-lg text-brand-ink">#{r.receipt_no}</span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                        {r.is_guest ? (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800"
                                title="Ordered without an account — no order history on their side; this page is the only record. Wallet refund not possible.">
                                Guest order
                            </span>
                        ) : (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Account</span>
                        )}
                        <span className="text-xs text-neutral-400">{rr.requested_at ? new Date(rr.requested_at).toLocaleString() : ""}</span>
                    </div>
                    <div className="mt-1 text-sm text-neutral-600 flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" /> {r.customer_name || "—"}</span>
                        <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 hover:text-brand-red"><Phone className="w-3.5 h-3.5" /> {r.phone}</a>
                        {r.address && <span className="inline-flex items-center gap-1 text-xs"><MapPin className="w-3.5 h-3.5" /> {r.address}</span>}
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-display font-black text-2xl text-brand-red">Rs. {Number(rr.amount || r.total_price || 0).toFixed(0)}</div>
                    <div className="text-[11px] text-neutral-500 uppercase">{r.payment_method} · {r.payment_status}</div>
                    <Link to="/admin/orders" className="text-[11px] text-brand-red font-semibold inline-flex items-center gap-1 hover:underline">
                        View in orders <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>
            </div>

            {/* What they ordered */}
            <ul className="mt-3 pt-3 border-t border-neutral-100 text-sm text-neutral-700 space-y-0.5">
                {(r.items || []).map((it, i) => (
                    <li key={i} className="flex justify-between"><span>{it.quantity}× {it.name}</span><span>Rs. {(it.price * it.quantity).toFixed(0)}</span></li>
                ))}
            </ul>

            {/* Their reason */}
            <div className="mt-3 text-sm bg-purple-50 border border-purple-200 text-purple-900 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold tracking-wider block mb-0.5">Customer's reason</span>
                “{rr.reason}”
                {rr.admin_note && <div className="mt-1 text-xs italic">Staff note: {rr.admin_note}</div>}
                {rr.refund_method === "wallet" && <div className="mt-1 text-xs font-bold">✓ Refunded as wallet credit</div>}
            </div>

            {/* Conversation */}
            <div className="mt-3">
                <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1">Conversation</div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1" data-testid={`refund-thread-${r.order_id}`}>
                    {(rr.messages || []).length === 0 && <p className="text-xs text-neutral-400 italic">No messages yet — ask for details or a photo below.</p>}
                    {(rr.messages || []).map((m, i) => (
                        <div key={i} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.from === "staff" ? "ml-auto bg-brand-ink text-white" : "bg-neutral-100 text-neutral-800"}`}>
                            <div className="text-[10px] opacity-60 mb-0.5">{m.from === "staff" ? (m.name || "Staff") : (m.name || "Customer")} · {m.at ? new Date(m.at).toLocaleString() : ""}</div>
                            {m.text && <div>{m.text}</div>}
                            {m.image_url && (
                                <a href={`${API}${m.image_url.replace(/^\/api/, "")}`} target="_blank" rel="noreferrer">
                                    <img src={`${API}${m.image_url.replace(/^\/api/, "")}`} alt="attachment" className="mt-1 rounded-lg max-h-40" />
                                </a>
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
                    <button onClick={() => fileRef.current?.click()} title="Attach image"
                        className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 ${attach ? "border-brand-red text-brand-red" : "border-neutral-200 text-neutral-400 hover:text-brand-red"}`}>
                        <ImageIcon className="w-4 h-4" />
                    </button>
                    <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMsg()}
                        placeholder={attach ? "Image attached — add a note…" : "Message the customer (e.g. please send a photo of the order)…"}
                        className="flex-1 border border-neutral-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-red"
                        data-testid={`refund-msg-input-${r.order_id}`} />
                    <button onClick={sendMsg} disabled={sending || (!msg.trim() && !attach)}
                        data-testid={`refund-msg-send-${r.order_id}`}
                        className="w-9 h-9 rounded-full bg-brand-red text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Actions */}
            {(rr.status === "requested" || rr.status === "approved") && (
                <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-wrap gap-2">
                    {rr.status === "requested" && (
                        <>
                            <button disabled={busy} onClick={() => onAct(r.order_id, "approved")}
                                className="bg-emerald-600 text-white rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50">Approve</button>
                            <button disabled={busy} onClick={() => onAct(r.order_id, "rejected")}
                                className="bg-red-600 text-white rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50">Decline</button>
                        </>
                    )}
                    <button disabled={busy} onClick={() => onAct(r.order_id, "refunded", "gateway")}
                        className="bg-green-700 text-white rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
                        title="After sending the money from the SafePay dashboard">
                        Mark Refunded (SafePay)
                    </button>
                    {!r.is_guest && (
                        <button disabled={busy} onClick={() => onAct(r.order_id, "refunded", "wallet")}
                            className="bg-brand-ink text-white rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
                            title="Credit the amount as store credit to the customer's account wallet">
                            Refund to Wallet
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
