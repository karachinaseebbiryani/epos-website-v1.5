import { useEffect, useRef, useState, useCallback } from "react";
import api, { formatApiError, API } from "../../lib/api";
import {
    Printer, RefreshCw, Image as ImageIcon, BellRing, BellOff, CheckCircle2,
    XCircle, Pencil, Plus, Minus, Trash2, PhoneCall, Volume2, VolumeX, Clock, Truck,
} from "lucide-react";
import { toast } from "sonner";
import ReceiptModal from "../../components/legacy/ReceiptModal";

// Statuses surfaced as filter chips. We keep all legacy statuses so existing POS flows still work.
const STATUSES = ["pending", "accepted", "preparing", "ready", "out_for_delivery", "delivered", "rejected", "cancelled"];
const ACCEPTED_OR_LATER = new Set(["accepted", "preparing", "ready", "out_for_delivery"]);
const RESPONSE_WINDOW_SEC = 120; // V2 requirement: 2-minute response window

const REJECT_REASONS = [
    { value: "out_of_stock", label: "Out of stock" },
    { value: "closed", label: "Kitchen closed" },
    { value: "other", label: "Other" },
];

const POLL_MS = 4000; // 4-second polling per requirement (3-5s)
const ALERT_AUDIO_SRC = "/order-alert.wav";

export default function AdminOrders() {
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [printOrder, setPrintOrder] = useState(null);
    const [rejectFor, setRejectFor] = useState(null);
    const [modifyFor, setModifyFor] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [muted, setMuted] = useState(false);
    const [audioBlocked, setAudioBlocked] = useState(false);

    const audioRef = useRef(null);
    const lastPendingIdRef = useRef(null);
    const pendingCountRef = useRef(0);
    const [printSettings, setPrintSettings] = useState({});
    const [receiptOpen, setReceiptOpen] = useState(false);

    // Load receipt/restaurant settings once for ReceiptModal (unified with POS).
    useEffect(() => {
        api.get("/admin/online-settings")
            .then(({ data }) => setPrintSettings({
                restaurant_name: data.restaurant_name,
                restaurant_phone: data.restaurant_phone,
                restaurant_address: data.restaurant_address,
                restaurant_email: data.restaurant_email,
                restaurant_logo: data.restaurant_logo_url,
                receipt_footer_text: data.invoice_footer_text,
                enable_receipt_qr_codes: true,
            }))
            .catch(() => {});
    }, []);

    const load = useCallback(async () => {
        try {
            const { data } = await api.get("/online-orders", { params: { status: filter } });
            setOrders(data);
        } catch (err) {
            toast.error("Failed to load orders");
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { setLoading(true); load(); }, [load]);

    // Continuous polling (every 4s) for both order list AND pending count alert.
    useEffect(() => {
        const tick = async () => {
            try {
                const { data } = await api.get("/online-orders/pending-count");
                const count = data.pending_count || 0;
                pendingCountRef.current = count;
                // Trigger refresh whenever the latest pending changes (new order arrived) OR every tick.
                if (data.latest_id && data.latest_id !== lastPendingIdRef.current) {
                    lastPendingIdRef.current = data.latest_id;
                    load();
                } else {
                    load();
                }
                manageAlertSound(count);
            } catch (e) { /* silent — keep polling */ }
        };
        const t = setInterval(tick, POLL_MS);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [muted]);

    const manageAlertSound = (count) => {
        const el = audioRef.current;
        if (!el) return;
        if (count > 0 && !muted) {
            if (el.paused) {
                el.currentTime = 0;
                const p = el.play();
                if (p && typeof p.then === "function") {
                    p.then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
                }
            }
        } else {
            if (!el.paused) {
                el.pause();
                el.currentTime = 0;
            }
        }
    };

    const enableAudio = () => {
        const el = audioRef.current;
        if (!el) return;
        el.muted = false;
        el.play().then(() => { setAudioBlocked(false); el.pause(); }).catch(() => {});
        manageAlertSound(pendingCountRef.current);
    };

    // Accept / Reject / Modify action handlers
    const acceptOrder = async (id) => {
        setBusyId(id);
        try {
            await api.post(`/online-orders/${id}/accept`);
            toast.success("Order accepted — customer notified");
            load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally { setBusyId(null); }
    };

    const submitReject = async (id, reason) => {
        setBusyId(id);
        try {
            await api.post(`/online-orders/${id}/reject`, { reason });
            toast.success("Order rejected — customer notified");
            setRejectFor(null);
            load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally { setBusyId(null); }
    };

    const updateStatus = async (id, status) => {
        try {
            await api.put(`/online-orders/${id}/status`, { status });
            toast.success("Status updated");
            
            // If delivered, trigger Diamond balance refresh for customers
            if (status === "delivered") {
                window.dispatchEvent(new Event('diamondsUpdated'));
            }
            
            load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        }
    };

    const verifyPayment = async (id) => {
        try {
            await api.put(`/online-orders/${id}/payment-status`, { payment_status: "paid" });
            toast.success("Payment verified");
            load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        }
    };

    const viewScreenshot = async (path) => {
        try {
            const token = localStorage.getItem("knb_admin_token");
            const resp = await fetch(`${API}/files/${path}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!resp.ok) throw new Error("Failed");
            const blob = await resp.blob();
            window.open(URL.createObjectURL(blob), "_blank");
        } catch (err) {
            toast.error("Could not load screenshot");
        }
    };

    const handlePrint = async (order) => {
        setPrintOrder(order);
        setReceiptOpen(true);
        // Mark printed in the background — opening the modal counts as the print action.
        api.put(`/online-orders/${order.id}/printed`).catch(() => { });
    };

    const pendingTotal = orders.filter((o) => o.status === "pending").length;

    return (
        <div data-testid="admin-orders-page">
            {/* Looping ringing audio (managed by manageAlertSound) */}
            <audio ref={audioRef} src={ALERT_AUDIO_SRC} loop preload="auto" data-testid="order-alert-audio" />

            <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
                <div>
                    <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink">Online Orders</h1>
                    <p className="text-neutral-500 mt-1">Manage incoming customer orders · auto-refreshes every {POLL_MS / 1000}s</p>
                </div>
                <div className="flex items-center gap-2">
                    {pendingTotal > 0 && !muted && (
                        <span data-testid="ringing-indicator" className="inline-flex items-center gap-2 bg-brand-red text-white rounded-full px-3 py-2 text-xs font-semibold animate-pulse">
                            <BellRing className="w-4 h-4" /> {pendingTotal} new order{pendingTotal > 1 ? "s" : ""} — awaiting action
                        </span>
                    )}
                    <button
                        onClick={() => setMuted((m) => !m)}
                        data-testid="toggle-mute-btn"
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${muted ? "bg-neutral-200 text-neutral-700 hover:bg-neutral-300" : "bg-brand-ink text-white hover:bg-brand-red"}`}
                    >
                        {muted ? <><VolumeX className="w-4 h-4" /> Unmute</> : <><Volume2 className="w-4 h-4" /> Mute</>}
                    </button>
                    <button onClick={load} data-testid="orders-refresh" className="inline-flex items-center gap-2 bg-white border border-neutral-200 rounded-full px-4 py-2 text-sm font-semibold hover:bg-neutral-100">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>
            </div>

            {audioBlocked && pendingTotal > 0 && (
                <button onClick={enableAudio} data-testid="enable-audio-banner" className="w-full mb-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-4 py-3 text-sm font-semibold flex items-center justify-between hover:bg-amber-100">
                    <span className="flex items-center gap-2"><BellOff className="w-4 h-4" /> Browser blocked the alert sound. Click to enable.</span>
                    <span className="text-xs underline">Tap to allow</span>
                </button>
            )}

            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-5 -mx-1 px-1">
                {["all", ...STATUSES].map((s) => (
                    <button key={s} onClick={() => setFilter(s)} data-testid={`orders-filter-${s}`}
                        className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${filter === s ? "bg-brand-red text-white" : "bg-white border border-neutral-200 text-brand-ink hover:bg-neutral-100"}`}>
                        {s.replace(/_/g, " ")}
                    </button>
                ))}
            </div>

            {loading && orders.length === 0 ? (
                <div className="text-center py-16 text-neutral-400">Loading...</div>
            ) : orders.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center text-neutral-500" data-testid="orders-empty">No orders match this filter.</div>
            ) : (
                <div className="space-y-3">
                    {orders.map((o) => (
                        <OrderCard
                            key={o.id} o={o}
                            busyId={busyId}
                            onAccept={() => acceptOrder(o.id)}
                            onReject={() => setRejectFor(o)}
                            onModify={() => setModifyFor(o)}
                            onUpdateStatus={(s) => updateStatus(o.id, s)}
                            onVerifyPayment={() => verifyPayment(o.id)}
                            onViewScreenshot={viewScreenshot}
                            onPrint={() => handlePrint(o)}
                        />
                    ))}
                </div>
            )}

            {printOrder && (
                <ReceiptModal
                    open={receiptOpen}
                    onClose={(v) => { setReceiptOpen(v); if (!v) setTimeout(() => setPrintOrder(null), 200); }}
                    order={printOrder}
                    settings={printSettings}
                    currency="Rs"
                />
            )}

            {rejectFor && (
                <RejectModal
                    order={rejectFor}
                    busy={busyId === rejectFor.id}
                    onClose={() => setRejectFor(null)}
                    onConfirm={(reason) => submitReject(rejectFor.id, reason)}
                />
            )}
            {modifyFor && (
                <ModifyModal
                    order={modifyFor}
                    onClose={() => { setModifyFor(null); load(); }}
                    onConfirmed={() => { setModifyFor(null); load(); }}
                />
            )}
        </div>
    );
}

// Forward-only status flow, rendered as a row of separate colored buttons instead of a
// dropdown. Each stage has a FIXED colour so floor staff can be taught the press-sequence
// ("press the orange one, then the blue one…"). An order can only move to the NEXT stage —
// past and current stages are locked, so it can never go backwards.
const STATUS_FLOW = [
    { key: "accepted",         label: "Accepted",         color: "bg-green-600 hover:bg-green-700",   ring: "ring-green-400" },
    { key: "preparing",        label: "Preparing",        color: "bg-orange-500 hover:bg-orange-600", ring: "ring-orange-400" },
    { key: "ready",            label: "Ready",            color: "bg-blue-600 hover:bg-blue-700",     ring: "ring-blue-400" },
    { key: "out_for_delivery", label: "Out for Delivery", color: "bg-purple-600 hover:bg-purple-700", ring: "ring-purple-400" },
    { key: "delivered",        label: "Delivered",        color: "bg-teal-600 hover:bg-teal-700",     ring: "ring-teal-400" },
];

function StatusStepper({ order, onUpdateStatus, busy }) {
    const currentIndex = STATUS_FLOW.findIndex((s) => s.key === order.status);
    // Off-flow / terminal (delivered, cancelled, unknown): nothing is pressable.
    const terminal = currentIndex === -1 || order.status === "delivered";
    return (
        <div className="flex flex-wrap items-center gap-2" data-testid={`order-status-stepper-${order.id}`}>
            {STATUS_FLOW.map((s, i) => {
                const isNext = !terminal && i === currentIndex + 1;
                const clickable = isNext && !busy;
                let cls, showCheck = false;
                if (currentIndex >= 0 && i < currentIndex) {
                    cls = `${s.color} text-white opacity-50 cursor-not-allowed`; showCheck = true;   // completed
                } else if (i === currentIndex) {
                    cls = `${s.color} text-white ring-2 ring-offset-1 ${s.ring} cursor-not-allowed`; // current — "you are here"
                } else if (isNext) {
                    cls = `${s.color} text-white shadow-md ring-2 ring-offset-1 ${s.ring} animate-pulse`; // press this next
                } else {
                    cls = "bg-neutral-100 text-neutral-400 cursor-not-allowed"; // future preview
                }
                return (
                    <button
                        key={s.key}
                        type="button"
                        disabled={!clickable}
                        onClick={() => clickable && onUpdateStatus(s.key)}
                        data-testid={`order-status-btn-${s.key}-${order.id}`}
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${cls}`}
                    >
                        {showCheck && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {s.label}
                    </button>
                );
            })}
        </div>
    );
}

function OrderCard({ o, busyId, onAccept, onReject, onModify, onUpdateStatus, onVerifyPayment, onViewScreenshot, onPrint }) {
    const isPending = o.status === "pending";
    const isRejected = o.status === "rejected";
    const isAccepted = o.status === "accepted";
    const isModifiedAwaiting = o.modified && o.modification_pending;
    const ringClass = isPending ? "ring-2 ring-brand-red ring-offset-2 animate-pulse-ring" : "";
    const bgClass = isPending ? "bg-red-50/60 border-brand-red/40" : isRejected ? "bg-neutral-50 border-neutral-200 opacity-70" : "bg-white border-neutral-200";

    return (
        <div data-testid={`admin-order-${o.id}`} className={`border rounded-2xl p-5 transition-all ${bgClass} ${ringClass}`}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <div className="text-xs text-neutral-500 uppercase font-semibold tracking-wider">Order</div>
                    <div className="font-display font-bold text-lg flex items-center gap-2">
                        #{o.receipt_no}
                        {isPending && <span className="text-[10px] uppercase font-bold bg-brand-red text-white px-2 py-0.5 rounded-full animate-pulse">NEW</span>}
                        {o.modified && <span className="text-[10px] uppercase font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">Modified</span>}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div className="md:col-span-2">
                    <div className="text-xs text-neutral-500 uppercase font-semibold tracking-wider">Customer</div>
                    <div className="font-semibold">{o.customer_name}</div>
                    <div className="text-sm text-neutral-600">
                        <a href={`tel:${o.phone}`} className="hover:text-brand-red inline-flex items-center gap-1"><PhoneCall className="w-3.5 h-3.5" />{o.phone}</a>
                    </div>
                    <div className="text-xs text-neutral-500 mt-1 line-clamp-2">{o.address}</div>
                    {isPending && (
                        <div className="mt-2"><ResponseCountdown createdAt={o.created_at} /></div>
                    )}
                </div>
                <div className="text-right md:text-left">
                    <div className="text-xs text-neutral-500 uppercase font-semibold tracking-wider">Total</div>
                    <div className="font-display font-black text-2xl text-brand-red">Rs. {o.total_price?.toFixed(0)}</div>
                    <div className="text-xs text-neutral-500 uppercase">{o.payment_method?.toUpperCase()}</div>
                    <PaymentBadge status={o.payment_status} />
                </div>
            </div>

            <ul className="mt-3 pt-3 border-t border-neutral-100 text-sm space-y-1">
                {o.items.map((it, idx) => {
                    const isFree = (it.price === 0) || /\(FREE/i.test(it.name || "");
                    return (
                        <li key={idx} className={`flex justify-between ${isFree ? "text-emerald-700 font-semibold" : "text-neutral-700"}`}>
                            <span>{it.quantity}× {it.name}</span>
                            <span>{isFree ? "FREE" : `Rs. ${(it.price * it.quantity).toFixed(0)}`}</span>
                        </li>
                    );
                })}
            </ul>

            {/* Discount / reward summary — tells the kitchen *why* the total is lower than the items
                sum, so they don't second-guess the order and so they hand over the right freebies. */}
            {(o.coupon_code || Number(o.discount_amount) > 0 || o.reward_applied) && (
                <div className="mt-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 p-2 rounded space-y-0.5" data-testid={`order-rewards-${o.id}`}>
                    <div className="font-bold uppercase tracking-wider text-[10px] text-amber-700">Rewards / Discounts applied</div>
                    {o.coupon_code && Number(o.discount_amount) > 0 && (
                        <div>🎟️ Coupon <strong>{o.coupon_code}</strong> · saved Rs. {Number(o.discount_amount).toFixed(0)}</div>
                    )}
                    {o.reward_applied && (
                        <div>
                            💎 Loyalty reward: <strong>{o.reward_applied.title || o.reward_applied.name || "Reward"}</strong>
                            {o.reward_applied.reward_type === "free_item" && " — give the FREE item highlighted above"}
                            {o.reward_applied.reward_type === "discount_percent" && ` — ${o.reward_applied.reward_value}% off`}
                            {o.reward_applied.reward_type === "discount_fixed" && ` — Rs. ${o.reward_applied.reward_value} off`}
                            {o.reward_applied.diamonds_spent ? ` (customer paid ${o.reward_applied.diamonds_spent} 💎)` : ""}
                        </div>
                    )}
                </div>
            )}

            {o.notes && <div className="mt-2 text-xs bg-yellow-50 text-yellow-800 p-2 rounded">📝 {o.notes}</div>}

            {/* Customer-shared GPS updates. Latest pinned at top with a Google Maps deep
                link so the rider can navigate in one tap. Older entries collapsed into
                "+ N more updates" so the order card doesn't blow up vertically. */}
            {o.customer_location_history && o.customer_location_history.length > 0 && (
                <div className="mt-2 text-xs bg-blue-50 border border-blue-200 text-blue-900 p-2 rounded space-y-1" data-testid={`order-location-history-${o.id}`}>
                    <div className="font-bold uppercase tracking-wider text-[10px] text-blue-700">📍 Customer-shared location ({o.customer_location_history.length} update{o.customer_location_history.length > 1 ? "s" : ""})</div>
                    {(() => {
                        const latest = o.customer_location_history[o.customer_location_history.length - 1];
                        return (
                            <div>
                                <a
                                    href={`https://www.google.com/maps?q=${latest.lat},${latest.lng}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold underline hover:text-blue-700"
                                >Open in Google Maps →</a>
                                {latest.address && <span className="block text-blue-800 mt-0.5">{latest.address}</span>}
                                <span className="block text-[10px] text-blue-700/80 mt-0.5">{new Date(latest.updated_at).toLocaleString()}</span>
                            </div>
                        );
                    })()}
                    {o.customer_location_history.length > 1 && (
                        <details className="cursor-pointer">
                            <summary className="text-[10px] text-blue-700 hover:underline">+ {o.customer_location_history.length - 1} earlier update{o.customer_location_history.length - 1 > 1 ? "s" : ""}</summary>
                            <ul className="mt-1 space-y-1 pl-2 border-l border-blue-200">
                                {o.customer_location_history.slice(0, -1).reverse().map((e, idx) => (
                                    <li key={idx}>
                                        <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noreferrer" className="underline">Map</a>
                                        {e.address && <span> · {e.address}</span>}
                                        <span className="block text-[10px] text-blue-700/70">{new Date(e.updated_at).toLocaleString()}</span>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </div>
            )}

            {isRejected && o.rejection_reason && (
                <div data-testid={`order-rejection-${o.id}`} className="mt-2 text-xs bg-red-50 border border-red-200 text-red-800 p-2 rounded">
                    <strong>Rejected:</strong> {humanReason(o.rejection_reason)}
                </div>
            )}
            {isModifiedAwaiting && (
                <div className="mt-2 text-xs bg-amber-50 border border-amber-300 text-amber-900 p-2 rounded">
                    📞 Items were edited. <strong>Phone the customer</strong>, then click <strong>Confirm Modified</strong> in the edit panel.
                </div>
            )}

            {/* Action row */}
            <div className="mt-4 space-y-3">
                {/* Status progress — colored, forward-only stepper (replaces the old status
                    dropdown). Locked past/current stages + one pressable "next" stage. */}
                {!isPending && !isRejected && (
                    <StatusStepper order={o} onUpdateStatus={onUpdateStatus} busy={busyId === o.id} />
                )}

                <div className="flex flex-wrap gap-2 items-center">
                {isPending && (
                    <>
                        <button
                            onClick={onAccept}
                            disabled={busyId === o.id}
                            data-testid={`order-accept-${o.id}`}
                            className="inline-flex items-center gap-2 bg-green-600 text-white rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors disabled:opacity-60"
                        >
                            <CheckCircle2 className="w-4 h-4" /> Accept Order
                        </button>
                        <button
                            onClick={onReject}
                            disabled={busyId === o.id}
                            data-testid={`order-reject-${o.id}`}
                            className="inline-flex items-center gap-2 bg-red-600 text-white rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-red-700 transition-colors disabled:opacity-60"
                        >
                            <XCircle className="w-4 h-4" /> Reject Order
                        </button>
                        <button
                            onClick={onModify}
                            disabled={busyId === o.id}
                            data-testid={`order-modify-${o.id}`}
                            className="inline-flex items-center gap-2 bg-amber-500 text-white rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-amber-600 transition-colors disabled:opacity-60"
                        >
                            <Pencil className="w-4 h-4" /> Modify Order
                        </button>
                    </>
                )}

                {/* One-tap "Mark Delivered" — designed for staff who don't want to fiddle with
                    a dropdown. Big, green, unmissable. Only shows on non-terminal orders so once
                    delivered it disappears. Anyone on the floor can press it. */}
                {!isPending && !isRejected && o.status !== "delivered" && o.status !== "cancelled" && (
                    <button
                        onClick={() => onUpdateStatus("delivered")}
                        disabled={busyId === o.id}
                        data-testid={`order-mark-delivered-${o.id}`}
                        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-5 py-2.5 text-sm font-black uppercase tracking-wider shadow-md shadow-emerald-600/30 transition-colors disabled:opacity-60"
                    >
                        <CheckCircle2 className="w-5 h-5" /> Mark Delivered
                    </button>
                )}

                {/* Rider handoff — once the order is "out for delivery" we have a rider_token.
                    This copies a WhatsApp-ready link the manager can text to the rider. The
                    rider opens it on their phone and gets a single-screen delivery view
                    (navigate, call, mark delivered) — no admin login needed. */}
                {o.rider_token && o.status !== "delivered" && o.status !== "cancelled" && o.status !== "rejected" && (
                    <button
                        type="button"
                        onClick={() => {
                            const link = `${window.location.origin}/rider/${o.id}?t=${o.rider_token}`;
                            try { navigator.clipboard.writeText(link); } catch { /* */ }
                            const wa = `https://wa.me/?text=${encodeURIComponent(`Karachi Naseeb delivery #${(o.id||'').slice(-6).toUpperCase()} — ${link}`)}`;
                            window.open(wa, "_blank");
                        }}
                        data-testid={`order-rider-link-${o.id}`}
                        className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe57] text-white rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors"
                        title="Copies link + opens WhatsApp share"
                    >
                        Send rider link
                    </button>
                )}

                {isAccepted && o.modified && !o.modification_pending && (
                    <button onClick={onModify} data-testid={`order-edit-again-${o.id}`} className="inline-flex items-center gap-2 bg-white border border-amber-300 text-amber-700 rounded-full px-4 py-2 text-xs font-semibold hover:bg-amber-50">
                        <Pencil className="w-3.5 h-3.5" /> Edit again
                    </button>
                )}

                {o.payment_status === "pending_verification" && (
                    <button onClick={onVerifyPayment} data-testid={`order-verify-payment-${o.id}`}
                        className="inline-flex items-center gap-2 bg-green-600 text-white rounded-full px-4 py-2 text-xs font-semibold hover:bg-green-700 transition-colors">
                        ✓ Verify Payment
                    </button>
                )}
                {o.payment_reference && (
                    <span className="text-[11px] text-neutral-600 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1">
                        Ref: <span className="font-mono font-semibold">{o.payment_reference}</span>
                    </span>
                )}
                {o.payment_screenshot_path && (
                    <button onClick={() => onViewScreenshot(o.payment_screenshot_path)} data-testid={`order-view-screenshot-${o.id}`}
                        className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-4 py-2 text-xs font-semibold hover:bg-blue-100 transition-colors">
                        <ImageIcon className="w-3.5 h-3.5" /> View Receipt
                    </button>
                )}
                <button onClick={onPrint} data-testid={`order-print-${o.id}`}
                    className="inline-flex items-center gap-2 bg-brand-ink text-white rounded-full px-4 py-2 text-xs font-semibold hover:bg-brand-red transition-colors">
                    <Printer className="w-3.5 h-3.5" /> Print Invoice
                </button>
                {o.printed && <span className="text-xs text-green-700 bg-green-50 rounded-full px-3 py-1 font-semibold">✓ Printed</span>}
                </div>
            </div>

            {/* V2: live operations (prep time + delivery fee override) for accepted/in-flight orders */}
            {ACCEPTED_OR_LATER.has(o.status) && (
                <OperationsPanel order={o} />
            )}
        </div>
    );
}

function humanReason(r) {
    return ({ out_of_stock: "Out of stock", closed: "Kitchen closed", other: "Other" })[r] || r;
}

// V2: 2-minute response window countdown shown on every pending OrderCard.
function ResponseCountdown({ createdAt }) {
    const [secondsLeft, setSecondsLeft] = useState(() => {
        try {
            const created = new Date(createdAt).getTime();
            return Math.max(0, RESPONSE_WINDOW_SEC - Math.floor((Date.now() - created) / 1000));
        } catch { return RESPONSE_WINDOW_SEC; }
    });
    useEffect(() => {
        const t = setInterval(() => {
            try {
                const created = new Date(createdAt).getTime();
                setSecondsLeft(Math.max(0, RESPONSE_WINDOW_SEC - Math.floor((Date.now() - created) / 1000)));
            } catch { /* */ }
        }, 1000);
        return () => clearInterval(t);
    }, [createdAt]);
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const ss = String(secondsLeft % 60).padStart(2, "0");
    const expired = secondsLeft <= 0;
    return (
        <div data-testid="staff-response-countdown" className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${expired ? "bg-red-600 text-white animate-pulse" : "bg-amber-500 text-white"}`}>
            <Clock className="w-3.5 h-3.5" />
            {expired ? "RESPOND NOW" : `Respond in ${mm}:${ss}`}
        </div>
    );
}

// V2: tiny inline panel that lets staff update prep_time and override delivery_fee on
// an accepted/in-flight order. Calls PUT /api/online-orders/{id}/operations.
function OperationsPanel({ order, onSaved }) {
    const [prep, setPrep] = useState(Number(order.prep_time_min) || 30);
    const [deliveryFee, setDeliveryFee] = useState(Number(order.delivery_fee) || 0);
    const [busy, setBusy] = useState(false);

    const updatePrep = async (newVal) => {
        const v = Math.max(1, Math.min(240, Number(newVal) || 30));
        setPrep(v);
        setBusy(true);
        try {
            await api.put(`/online-orders/${order.id}/operations`, { prep_time_min: v });
            toast.success(`Preparation time updated to ${v} min`);
            onSaved && onSaved();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Failed to update");
        } finally { setBusy(false); }
    };

    const setFreeDelivery = async () => {
        setBusy(true);
        try {
            await api.put(`/online-orders/${order.id}/operations`, { free_delivery: true });
            toast.success("Delivery set to FREE — customer notified on tracking page");
            setDeliveryFee(0);
            onSaved && onSaved();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Failed to update");
        } finally { setBusy(false); }
    };

    const saveDeliveryFee = async () => {
        setBusy(true);
        try {
            await api.put(`/online-orders/${order.id}/operations`, { delivery_fee_override: Number(deliveryFee) || 0 });
            toast.success(`Delivery fee updated to Rs. ${Number(deliveryFee) || 0}`);
            onSaved && onSaved();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Failed to update");
        } finally { setBusy(false); }
    };

    return (
        <div className="mt-3 pt-3 border-t border-neutral-100 grid grid-cols-1 md:grid-cols-2 gap-3" data-testid={`ops-panel-${order.id}`}>
            <div className="bg-neutral-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-brand-red" />
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">Prep Time (default 30 min)</span>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updatePrep(prep - 5)} disabled={busy} data-testid={`ops-prep-dec-${order.id}`}
                        className="w-8 h-8 rounded-full bg-white border border-neutral-200 inline-flex items-center justify-center hover:bg-neutral-100"><Minus className="w-3.5 h-3.5" /></button>
                    <input type="number" min="1" max="240" value={prep}
                        onChange={(e) => setPrep(Number(e.target.value))}
                        onBlur={() => updatePrep(prep)}
                        data-testid={`ops-prep-input-${order.id}`}
                        className="w-16 text-center bg-white border border-neutral-200 rounded-lg px-2 py-1 text-sm font-bold" />
                    <span className="text-xs text-neutral-500">min</span>
                    <button type="button" onClick={() => updatePrep(prep + 5)} disabled={busy} data-testid={`ops-prep-inc-${order.id}`}
                        className="w-8 h-8 rounded-full bg-white border border-neutral-200 inline-flex items-center justify-center hover:bg-neutral-100"><Plus className="w-3.5 h-3.5" /></button>
                </div>
            </div>
            <div className="bg-neutral-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                    <Truck className="w-4 h-4 text-brand-red" />
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">Delivery Charge</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Rs.</span>
                    <input type="number" min="0" value={deliveryFee}
                        onChange={(e) => setDeliveryFee(e.target.value)}
                        data-testid={`ops-delivery-input-${order.id}`}
                        className="w-20 bg-white border border-neutral-200 rounded-lg px-2 py-1 text-sm font-bold" />
                    <button type="button" onClick={saveDeliveryFee} disabled={busy} data-testid={`ops-delivery-save-${order.id}`}
                        className="text-xs font-bold uppercase tracking-wider bg-brand-ink text-white rounded-full px-3 py-1 hover:bg-brand-red disabled:opacity-60">Save</button>
                    <button type="button" onClick={setFreeDelivery} disabled={busy} data-testid={`ops-delivery-free-${order.id}`}
                        className="text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-full px-3 py-1 hover:bg-green-700 disabled:opacity-60">Make Free</button>
                </div>
                {order.delivery_fee_overridden && <div className="mt-1 text-[10px] text-green-700 font-bold">✓ Override applied — customer sees this</div>}
            </div>
        </div>
    );
}

function RejectModal({ order, busy, onClose, onConfirm }) {
    const [reason, setReason] = useState("out_of_stock");
    const [note, setNote] = useState("");
    const submit = () => {
        const final = reason === "other" && note.trim() ? note.trim() : reason;
        onConfirm(final);
    };
    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose} data-testid="reject-modal">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 inline-flex items-center justify-center flex-shrink-0">
                        <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <h2 className="font-display font-black text-xl text-brand-ink">Are you sure you want to reject this order?</h2>
                        <p className="text-sm text-neutral-500 mt-1">Order <strong className="text-brand-ink">#{order.receipt_no}</strong> · The customer will be notified instantly with the reason below. This action cannot be undone.</p>
                    </div>
                </div>
                <div className="space-y-2 mt-4">
                    {REJECT_REASONS.map((r) => (
                        <label key={r.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${reason === r.value ? "border-brand-red bg-red-50" : "border-neutral-200"}`}>
                            <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={(e) => setReason(e.target.value)} data-testid={`reject-reason-${r.value}`} />
                            <span className="font-semibold text-sm">{r.label}</span>
                        </label>
                    ))}
                </div>
                {reason === "other" && (
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a short note (optional)…" data-testid="reject-other-note"
                        className="mt-3 w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-red" rows={2} />
                )}
                <div className="mt-5 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-semibold bg-neutral-100 hover:bg-neutral-200" data-testid="reject-cancel">No, keep order</button>
                    <button onClick={submit} disabled={busy} data-testid="reject-confirm" className="px-5 py-2 rounded-full text-sm font-bold uppercase tracking-wider bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                        {busy ? "Rejecting…" : "Yes, reject order"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModifyModal({ order, onClose, onConfirmed }) {
    const [items, setItems] = useState(order.items.map((it) => ({ ...it })));
    const [savingDraft, setSavingDraft] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [hasSavedDraft, setHasSavedDraft] = useState(Boolean(order.modified && order.modification_pending));

    const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    const total = Math.max(0, subtotal - (order.discount_amount || 0)) + (order.delivery_fee || 0);

    const setQty = (idx, q) => setItems((arr) => arr.map((x, i) => i === idx ? { ...x, quantity: Math.max(0, q) } : x));
    const setPrice = (idx, p) => setItems((arr) => arr.map((x, i) => i === idx ? { ...x, price: Math.max(0, Number(p) || 0) } : x));
    const removeItem = (idx) => setItems((arr) => arr.filter((_, i) => i !== idx));

    const saveDraft = async () => {
        if (!items.length || !items.some((it) => it.quantity > 0)) {
            toast.error("At least one item must remain");
            return;
        }
        setSavingDraft(true);
        try {
            const payload = {
                items: items.filter((it) => it.quantity > 0).map((it) => ({
                    item_id: it.item_id || "", name: it.name, price: Number(it.price), quantity: Number(it.quantity),
                })),
            };
            await api.put(`/online-orders/${order.id}/modify`, payload);
            toast.success("Changes saved. Now phone the customer to confirm.");
            setHasSavedDraft(true);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally { setSavingDraft(false); }
    };

    const confirmModified = async () => {
        setConfirming(true);
        try {
            await api.post(`/online-orders/${order.id}/confirm-modified`);
            toast.success("Modified order confirmed — customer notified");
            onConfirmed();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally { setConfirming(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose} data-testid="modify-modal">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h2 className="font-display font-black text-2xl text-brand-ink mb-1">Modify Order #{order.receipt_no}</h2>
                <p className="text-sm text-neutral-500 mb-4">
                    Adjust quantities or prices, or remove items. After saving, <strong>call the customer</strong> at <a className="text-brand-red font-bold" href={`tel:${order.phone}`}>{order.phone}</a> then click <strong>Confirm Modified Order</strong>.
                </p>

                <div className="space-y-2">
                    {items.map((it, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 rounded-xl border border-neutral-200" data-testid={`modify-item-${idx}`}>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm truncate">{it.name}</div>
                                <div className="text-[11px] text-neutral-500">Line: Rs. {(Number(it.price) * Number(it.quantity)).toFixed(0)}</div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setQty(idx, Number(it.quantity) - 1)} className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 inline-flex items-center justify-center" data-testid={`modify-qty-dec-${idx}`}><Minus className="w-3.5 h-3.5" /></button>
                                <input type="number" min="0" value={it.quantity} onChange={(e) => setQty(idx, Number(e.target.value))} className="w-12 text-center border border-neutral-200 rounded px-1 py-0.5 text-sm" data-testid={`modify-qty-input-${idx}`} />
                                <button onClick={() => setQty(idx, Number(it.quantity) + 1)} className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 inline-flex items-center justify-center" data-testid={`modify-qty-inc-${idx}`}><Plus className="w-3.5 h-3.5" /></button>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-neutral-500">Rs.</span>
                                <input type="number" min="0" step="1" value={it.price} onChange={(e) => setPrice(idx, e.target.value)} className="w-20 border border-neutral-200 rounded px-2 py-1 text-sm" data-testid={`modify-price-input-${idx}`} />
                            </div>
                            <button onClick={() => removeItem(idx)} className="w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100 inline-flex items-center justify-center" data-testid={`modify-remove-${idx}`}><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>

                <div className="mt-4 pt-4 border-t border-neutral-100 text-sm space-y-1">
                    <div className="flex justify-between text-neutral-600"><span>Subtotal</span><span data-testid="modify-subtotal">Rs. {subtotal.toFixed(0)}</span></div>
                    {Number(order.discount_amount) > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>− Rs. {Number(order.discount_amount).toFixed(0)}</span></div>}
                    {Number(order.delivery_fee) > 0 && <div className="flex justify-between text-neutral-500"><span>Delivery</span><span>Rs. {Number(order.delivery_fee).toFixed(0)}</span></div>}
                    <div className="flex justify-between text-lg pt-1"><span className="font-display font-bold">New Total</span><span className="font-display font-black text-brand-red" data-testid="modify-total">Rs. {total.toFixed(0)}</span></div>
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-semibold bg-neutral-100 hover:bg-neutral-200" data-testid="modify-cancel">Cancel</button>
                    <button onClick={saveDraft} disabled={savingDraft} data-testid="modify-save-draft" className="px-5 py-2 rounded-full text-sm font-bold uppercase tracking-wider bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60 inline-flex items-center gap-2">
                        <Pencil className="w-4 h-4" /> {savingDraft ? "Saving…" : "Save Changes"}
                    </button>
                    <button onClick={confirmModified} disabled={!hasSavedDraft || confirming} data-testid="modify-confirm" className="px-5 py-2 rounded-full text-sm font-bold uppercase tracking-wider bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> {confirming ? "Confirming…" : "Confirm Modified Order"}
                    </button>
                </div>
                {!hasSavedDraft && (
                    <p className="mt-2 text-[11px] text-neutral-500 text-right">Save changes before confirming, then phone the customer at <a className="text-brand-red font-semibold" href={`tel:${order.phone}`}>{order.phone}</a>.</p>
                )}
            </div>
        </div>
    );
}

function PaymentBadge({ status }) {
    if (!status || status === "pending") return <div className="text-[10px] text-neutral-500 mt-1">Payment: Pending</div>;
    const colors = {
        paid: "bg-green-100 text-green-800",
        pending_verification: "bg-yellow-100 text-yellow-800",
        failed: "bg-red-100 text-red-800",
        refunded: "bg-purple-100 text-purple-800",
    };
    return <span className={`mt-1 inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded ${colors[status] || "bg-neutral-100"}`}>{status.replace(/_/g, " ")}</span>;
}
