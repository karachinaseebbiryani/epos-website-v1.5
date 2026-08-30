import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api, { formatApiError, API } from "../../lib/api";
import {
    Printer, RefreshCw, Image as ImageIcon, BellRing, BellOff, CheckCircle2, CircleAlert,
    XCircle, Pencil, Plus, Minus, Trash2, PhoneCall, Volume2, VolumeX, Clock, Truck, Store,
} from "lucide-react";
import { toast } from "sonner";
import ReceiptModal from "../../components/legacy/ReceiptModal";
import { resolveAlertSrc, useAlertPrefs } from "../../lib/alertSound";

const RESPONSE_WINDOW_SEC = 120;
const POLL_MS = 4000;
const LIST_REFRESH_EVERY = 5;

const REJECT_REASONS = [
    { value: "out_of_stock", label: "Out of stock" },
    { value: "closed", label: "Kitchen closed" },
    { value: "other", label: "Other" },
];

export default function AdminOrdersLive() {
    const [searchParams] = useSearchParams();
    const customerFilter = searchParams.get('customer');
    const [orders, setOrders] = useState([]);
    const [viewMode, setViewMode] = useState("live"); // live, completed, cancelled
    const [loading, setLoading] = useState(true);
    const [printOrder, setPrintOrder] = useState(null);
    const [rejectFor, setRejectFor] = useState(null);
    const [modifyFor, setModifyFor] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [muted, setMuted] = useState(false);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [pollCountdown, setPollCountdown] = useState(POLL_MS / 1000);
    const [pollStatus, setPollStatus] = useState("healthy");
    const prefs = useAlertPrefs();

    const audioRef = useRef(null);
    const lastPendingIdRef = useRef(null);
    const pendingCountRef = useRef(0);
    const tickCountRef = useRef(0);
    const pollingRef = useRef(false);
    const [printSettings, setPrintSettings] = useState({});
    const [receiptOpen, setReceiptOpen] = useState(false);

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
            const { data } = await api.get("/online-orders");
            let filteredData = customerFilter
                ? data.filter(order => order.customer_id === customerFilter)
                : data;

            if (viewMode === "live") {
                filteredData = filteredData.filter(order =>
                    !["delivered", "picked_up", "cancelled", "rejected"].includes(order.status)
                );
            } else if (viewMode === "completed") {
                filteredData = filteredData.filter(order => order.status === "delivered");
            } else if (viewMode === "cancelled") {
                filteredData = filteredData.filter(order => ["cancelled", "rejected"].includes(order.status));
            }

            setOrders(filteredData);
        } catch (err) {
            toast.error("Failed to load orders");
        } finally {
            setLoading(false);
        }
    }, [viewMode, customerFilter]);

    useEffect(() => { setLoading(true); load(); }, [load]);

    useEffect(() => {
        const tick = async () => {
            if (pollingRef.current) return;
            pollingRef.current = true;
            try {
                const { data } = await api.get("/online-orders/pending-count");
                const count = data.pending_count || 0;
                pendingCountRef.current = count;
                tickCountRef.current = (tickCountRef.current + 1) % LIST_REFRESH_EVERY;
                const newOrderArrived = data.latest_id && data.latest_id !== lastPendingIdRef.current;
                if (newOrderArrived) lastPendingIdRef.current = data.latest_id;
                if (newOrderArrived || tickCountRef.current === 0) load();
                manageAlertSound(count);
                setPollStatus("healthy");
            } catch (e) {
                // If auth fails (401/403), the axios interceptor will try to refresh the token.
                // If that also fails, user gets redirected to sign-in. But if we're already on
                // the page after a fresh sign-in, the polling should just retry on next tick.
                console.error("Polling error:", e.response?.status, e.message);
                setPollStatus("error");
                // Auto-retry: on auth errors after sign-in, next poll will likely succeed
                // once the new token is properly set. For network errors, same logic applies.
            } finally {
                pollingRef.current = false;
            }
        };
        const t = setInterval(() => {
            setPollCountdown((seconds) => {
                if (seconds <= 1) {
                    void tick();
                    return POLL_MS / 1000;
                }
                return seconds - 1;
            });
        }, 1000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [muted, load]);

    useEffect(() => {
        const el = audioRef.current;
        if (el) el.volume = prefs.volume;
    }, [prefs.volume]);

    const manageAlertSound = (cnt) => {
        const el = audioRef.current;
        if (!el) return;
        if (muted || cnt === 0) {
            el.pause();
            el.currentTime = 0;
            return;
        }
        el.play().catch((e) => {
            if (e.name === "NotAllowedError") setAudioBlocked(true);
        });
    };

    const enableAudio = () => {
        const el = audioRef.current;
        if (!el) return;
        el.play()
            .then(() => { setAudioBlocked(false); el.pause(); el.currentTime = 0; })
            .catch(() => toast.error("Still blocked. Please check browser settings."));
    };

    const acceptOrder = async (id) => {
        setBusyId(id);
        try {
            await api.post(`/admin/online-orders/${id}/accept`);
            toast.success("Order accepted");
            load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally { setBusyId(null); }
    };

    const rejectOrder = async () => {
        if (!rejectFor) return;
        const reason = document.querySelector(`input[name="reject_reason_${rejectFor.id}"]:checked`)?.value;
        if (!reason) { toast.error("Please select a reason"); return; }
        setBusyId(rejectFor.id);
        try {
            await api.post(`/admin/online-orders/${rejectFor.id}/reject`, { reason });
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

            if (status === "delivered") {
                window.dispatchEvent(new Event('diamondsUpdated'));
            }

            load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        }
    };

    const handlePrint = async (order) => {
        setPrintOrder(order);
        setReceiptOpen(true);
        api.put(`/online-orders/${order.id}/printed`).catch(() => { });
    };

    const pendingTotal = orders.filter((o) => o.status === "pending").length;

    // Group orders by status for board view
    const pendingOrders = orders.filter(o => o.status === "pending");
    const acceptedOrders = orders.filter(o => o.status === "accepted");
    const preparingOrders = orders.filter(o => o.status === "preparing");
    const readyOrders = orders.filter(o => o.status === "ready");
    const outForDeliveryOrders = orders.filter(o => o.status === "out_for_delivery");

    return (
        <div data-testid="admin-orders-page">
            <audio ref={audioRef} src={resolveAlertSrc(prefs.sound)} loop preload="auto" data-testid="order-alert-audio" />

            <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
                <div>
                    <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink">Online Orders</h1>
                    <p className="text-neutral-500 mt-1">Manage incoming customer orders · auto-refreshes every {POLL_MS / 1000}s</p>
                </div>
                <div className="flex items-center gap-2">
                    <div
                        data-testid="orders-poll-indicator"
                        title={pollStatus === "error" ? "Order refresh failed" : "Order refresh is active"}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${pollStatus === "error" ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
                    >
                        {pollStatus === "error" ? <CircleAlert className="w-4 h-4" /> : <RefreshCw className="w-4 h-4 animate-spin" />}
                        <span>{pollStatus === "error" ? "Refresh error" : `Next refresh in ${pollCountdown}`}</span>
                    </div>
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

            {/* View Mode Tabs */}
            <div className="flex gap-2 mb-6 border-b border-neutral-200">
                <button
                    onClick={() => setViewMode("live")}
                    className={`px-6 py-3 font-semibold transition-colors ${viewMode === "live" ? "text-brand-red border-b-2 border-brand-red" : "text-neutral-600 hover:text-brand-ink"}`}
                >
                    Live Orders
                </button>
                <button
                    onClick={() => setViewMode("completed")}
                    className={`px-6 py-3 font-semibold transition-colors ${viewMode === "completed" ? "text-brand-red border-b-2 border-brand-red" : "text-neutral-600 hover:text-brand-ink"}`}
                >
                    Completed
                </button>
                <button
                    onClick={() => setViewMode("cancelled")}
                    className={`px-6 py-3 font-semibold transition-colors ${viewMode === "cancelled" ? "text-brand-red border-b-2 border-brand-red" : "text-neutral-600 hover:text-brand-ink"}`}
                >
                    Cancelled
                </button>
            </div>

            {loading && orders.length === 0 ? (
                <div className="text-center py-16 text-neutral-400">Loading...</div>
            ) : viewMode === "live" ? (
                <LiveOrdersBoard
                    pendingOrders={pendingOrders}
                    acceptedOrders={acceptedOrders}
                    preparingOrders={preparingOrders}
                    readyOrders={readyOrders}
                    outForDeliveryOrders={outForDeliveryOrders}
                    onAccept={acceptOrder}
                    onReject={(order) => setRejectFor(order)}
                    onUpdateStatus={updateStatus}
                    onPrint={handlePrint}
                    busyId={busyId}
                />
            ) : (
                <div className="space-y-3">
                    {orders.length === 0 ? (
                        <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center text-neutral-500">
                            No {viewMode} orders.
                        </div>
                    ) : (
                        orders.map((o) => (
                            <CompletedOrderCard
                                key={o.id}
                                order={o}
                                onPrint={() => handlePrint(o)}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Reject Modal */}
            {rejectFor && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setRejectFor(null)}>
                    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
                        <h3 className="font-display font-bold text-xl text-brand-ink mb-4">Reject Order #{rejectFor.receipt_no}</h3>
                        <p className="text-neutral-600 mb-4">Please select a reason (will be sent to the customer):</p>
                        <div className="space-y-3 mb-6">
                            {REJECT_REASONS.map((r) => (
                                <label key={r.value} className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer">
                                    <input type="radio" name={`reject_reason_${rejectFor.id}`} value={r.value} className="w-4 h-4" />
                                    <span className="font-semibold text-brand-ink">{r.label}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setRejectFor(null)}
                                className="flex-1 py-3 rounded-full bg-neutral-100 hover:bg-neutral-200 font-semibold text-brand-ink transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={rejectOrder}
                                disabled={busyId === rejectFor.id}
                                className="flex-1 py-3 rounded-full bg-brand-red text-white font-semibold hover:bg-brand-red-dark disabled:opacity-50 transition-colors">
                                {busyId === rejectFor.id ? "Rejecting..." : "Confirm Reject"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {printOrder && (
                <ReceiptModal
                    open={receiptOpen}
                    onClose={() => { setReceiptOpen(false); setPrintOrder(null); }}
                    order={printOrder}
                    settings={printSettings}
                />
            )}
        </div>
    );
}

function LiveOrdersBoard({ pendingOrders, acceptedOrders, preparingOrders, readyOrders, outForDeliveryOrders, onAccept, onReject, onUpdateStatus, onPrint, busyId }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatusColumn title="New" count={pendingOrders.length} orders={pendingOrders} status="pending" onAccept={onAccept} onReject={onReject} onPrint={onPrint} busyId={busyId} />
            <StatusColumn title="Accepted" count={acceptedOrders.length} orders={acceptedOrders} status="accepted" onUpdateStatus={onUpdateStatus} onPrint={onPrint} busyId={busyId} />
            <StatusColumn title="Preparing" count={preparingOrders.length} orders={preparingOrders} status="preparing" onUpdateStatus={onUpdateStatus} onPrint={onPrint} busyId={busyId} />
            <StatusColumn title="Ready" count={readyOrders.length} orders={readyOrders} status="ready" onUpdateStatus={onUpdateStatus} onPrint={onPrint} busyId={busyId} />
            <StatusColumn title="Out for Delivery" count={outForDeliveryOrders.length} orders={outForDeliveryOrders} status="out_for_delivery" onUpdateStatus={onUpdateStatus} onPrint={onPrint} busyId={busyId} />
        </div>
    );
}

function StatusColumn({ title, count, orders, status, onAccept, onReject, onUpdateStatus, onPrint, busyId }) {
    return (
        <div className="bg-neutral-50 rounded-xl p-4 min-h-[600px]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-brand-ink">{title}</h3>
                <span className="bg-brand-red text-white text-xs font-bold px-2 py-1 rounded-full">{count}</span>
            </div>
            <div className="space-y-3">
                {orders.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400 text-sm">No orders</div>
                ) : (
                    orders.map((order) => (
                        <OrderBoardCard
                            key={order.id}
                            order={order}
                            status={status}
                            onAccept={onAccept}
                            onReject={onReject}
                            onUpdateStatus={onUpdateStatus}
                            onPrint={onPrint}
                            busyId={busyId}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function OrderBoardCard({ order, status, onAccept, onReject, onUpdateStatus, onPrint, busyId }) {
    const isPickup = order.order_type === 'pickup';
    const nextStatus = getNextStatus(status, isPickup);

    return (
        <div className="bg-white rounded-lg p-3 shadow-sm border border-neutral-200 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                    <div className="font-bold text-brand-ink">#{order.receipt_no}</div>
                    <div className="text-xs text-neutral-500">{order.items?.length || 0} item(s)</div>
                </div>
                {isPickup ? (
                    <Store className="w-4 h-4 text-orange-600" title="Pickup" />
                ) : (
                    <Truck className="w-4 h-4 text-blue-600" title="Delivery" />
                )}
            </div>

            <div className="text-sm text-neutral-700 mb-2">
                <div className="font-semibold">{order.customer_name}</div>
                {order.phone && <div className="text-xs">{order.phone}</div>}
            </div>

            <div className="text-xs font-bold text-brand-red mb-3">
                Rs. {order.total_price?.toFixed(0)}
            </div>

            {status === "pending" ? (
                <div className="flex gap-2">
                    <button
                        onClick={() => onAccept(order.id)}
                        disabled={busyId === order.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                    >
                        Accept
                    </button>
                    <button
                        onClick={() => onReject(order)}
                        disabled={busyId === order.id}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                    >
                        Reject
                    </button>
                </div>
            ) : nextStatus ? (
                <button
                    onClick={() => onUpdateStatus(order.id, nextStatus)}
                    className="w-full bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold py-2 rounded-lg"
                >
                    Mark {getStatusLabel(nextStatus)}
                </button>
            ) : null}
        </div>
    );
}

function CompletedOrderCard({ order, onPrint }) {
    const isPickup = order.order_type === 'pickup';

    return (
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-lg">#{order.receipt_no}</span>
                        {isPickup ? (
                            <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-full text-xs font-semibold">
                                <Store className="w-3 h-3" /> Pickup
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold">
                                <Truck className="w-3 h-3" /> Delivery
                            </span>
                        )}
                    </div>
                    <div className="text-sm text-neutral-600">
                        <div>{order.customer_name} • {order.phone}</div>
                        {order.created_at && (
                            <div className="text-xs mt-1">{new Date(order.created_at).toLocaleString()}</div>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-bold text-xl text-brand-red">Rs. {order.total_price?.toFixed(0)}</div>
                    <button
                        onClick={onPrint}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-brand-ink hover:text-brand-red"
                    >
                        <Printer className="w-3 h-3" /> Print
                    </button>
                </div>
            </div>
        </div>
    );
}

function getNextStatus(currentStatus, isPickup) {
    if (currentStatus === "accepted") return "preparing";
    if (currentStatus === "preparing") return "ready";
    if (currentStatus === "ready") return isPickup ? "delivered" : "out_for_delivery";
    if (currentStatus === "out_for_delivery") return "delivered";
    return null;
}

function getStatusLabel(status) {
    const labels = {
        "preparing": "Preparing",
        "ready": "Ready",
        "out_for_delivery": "Out for Delivery",
        "delivered": "Delivered",
    };
    return labels[status] || status;
}
