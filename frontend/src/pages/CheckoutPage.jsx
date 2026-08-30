import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import api, { formatApiError } from "../lib/api";
import { submitGatewayForm } from "../lib/gatewayRedirect";
import { toast } from "sonner";
import { Phone, MapPin, User, MessageSquare, Tag, Banknote, ArrowLeft, CreditCard, Building2, Smartphone, Store, Navigation, Loader2, UserPlus, UserCheck, Diamond, X as XIcon, Truck } from "lucide-react";
import PeopleAlsoBuy from "../components/PeopleAlsoBuy";
import ClosedBanner from "../components/ClosedBanner";
import useBusinessHours from "../hooks/useBusinessHours";
    import LocationPicker from "../components/LocationPicker";
const PAYMENT_LABELS = {
    cod: { label: "Cash on Delivery", icon: Banknote, desc: "Pay when your order arrives" },
    pay_at_restaurant: { label: "Pay at Restaurant", icon: Store, desc: "Pay in person if picking up" },
    bank_transfer: { label: "Bank Transfer / EasyPaisa / JazzCash", icon: Building2, desc: "Transfer & share reference" },
    card: { label: "Pay by Card", icon: CreditCard, desc: "Visa / Mastercard via Stripe" },
    easypaisa: { label: "EasyPaisa", icon: Smartphone, desc: "Pay online with your EasyPaisa account" },
    jazzcash: { label: "JazzCash", icon: Smartphone, desc: "Pay online with your JazzCash wallet" },
    safepay: { label: "Pay by Card / Wallet", icon: CreditCard, desc: "Visa / Mastercard / wallets — SafePay secure checkout" },
};

const GUEST_KEY = "knb_guest_v1";

function loadGuestPrefill() {
    try {
        const raw = localStorage.getItem(GUEST_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

function saveGuestPrefill(form) {
    try {
        localStorage.setItem(GUEST_KEY, JSON.stringify({
            customer_name: form.customer_name || "",
            phone: form.phone || "",
            address: form.address || "",
            updated_at: new Date().toISOString(),
        }));
    } catch { /* */ }
}

export default function CheckoutPage() {
    const { items, subtotal, clear } = useCart();
    const { user } = useAuth();
    // Wallet redemption (store credit from refunds). Server-authoritative: we
    // only send the intent; the backend atomically applies min(balance, total).
    const [useWallet, setUseWallet] = useState(false);
    const navigate = useNavigate();
    const guest = !user ? loadGuestPrefill() : null;
    const [authChoice, setAuthChoice] = useState(() => {
        if (user) return "logged-in";
        return guest ? "guest" : null; // null forces choice if first-time guest
    });
    const [form, setForm] = useState({
        customer_name: user?.name || guest?.customer_name || "",
        phone: user?.phone || guest?.phone || "",
        address: guest?.address || "",
        notes: "",
        coupon_code: "",
        payment_method: "cod",
    });
    const [order_type, setOrderType] = useState("delivery"); // NEW: delivery or pickup
    const [coupon, setCoupon] = useState(null);
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState(null);
    const [coords, setCoords] = useState(null);
    const [delivery, setDelivery] = useState({ distance_km: null, fee: 0, in_range: true, free_delivery: false });
    const [locating, setLocating] = useState(false);
    // Map pin picker: lets the customer confirm/fine-tune their EXACT drop point
    // so the distance + delivery fee are correct. `gpsAccuracy` (metres) lets us
    // warn when the device only returned a coarse (network/IP) fix.
    const [showMap, setShowMap] = useState(false);
    const [gpsAccuracy, setGpsAccuracy] = useState(null);
    // V2: track the customer's selected Diamond reward so we can show it as a chip and let
    // them remove it. The actual Diamond debit happens server-side when the order is placed.
    const [reward, setReward] = useState(() => {
        try { const raw = localStorage.getItem("selected_reward"); return raw ? JSON.parse(raw) : null; } catch { return null; }
    });
    useEffect(() => {
        const sync = () => {
            try { const raw = localStorage.getItem("selected_reward"); setReward(raw ? JSON.parse(raw) : null); } catch { setReward(null); }
        };
        window.addEventListener("rewardSelectionChanged", sync);
        window.addEventListener("storage", sync);
        return () => {
            window.removeEventListener("rewardSelectionChanged", sync);
            window.removeEventListener("storage", sync);
        };
    }, []);
    const removeReward = () => {
        localStorage.removeItem("selected_reward");
        setReward(null);
        try { window.dispatchEvent(new Event("rewardSelectionChanged")); window.dispatchEvent(new Event("diamondsUpdated")); } catch { /* */ }
        toast.success("Reward removed — your Diamonds stay in your balance");
    };
    const bh = useBusinessHours();
    const isClosed = !!(bh && bh.enabled && !bh.is_open);

    useEffect(() => {
        api.get("/public/settings").then((r) => setSettings(r.data)).catch(() => { });
    }, []);
    useEffect(() => {
        if (user) {
            setAuthChoice("logged-in");
            setForm((f) => ({ ...f, customer_name: user.name || f.customer_name, phone: user.phone || f.phone }));
        }
    }, [user]);

    // Re-quote delivery whenever subtotal changes (free-delivery threshold may flip)
    // Only for delivery orders; reset fee for pickup
    useEffect(() => {
        if (order_type === "pickup") {
            setDelivery({ distance_km: null, fee: 0, in_range: true, free_delivery: false });
            return;
        }
        if (!coords) return;
        api.post("/delivery/quote", { ...coords, subtotal }).then(({ data }) => setDelivery(data)).catch(() => {});
    }, [subtotal, coords, order_type]);

    // Auto-switch payment method when order type changes (e.g., COD not available for pickup)
    useEffect(() => {
        if (!settings) return;
        const enabledMethods = {
            ...(settings?.payment_methods || { cod: true }),
            easypaisa: !!settings?.easypaisa_gateway_enabled,
            jazzcash: !!settings?.jazzcash_gateway_enabled,
            safepay: !!settings?.safepay_gateway_enabled,
        };
        if (enabledMethods.safepay) enabledMethods.card = false;
        const availableMethods = order_type === "pickup" ? { ...enabledMethods, cod: false } : enabledMethods;

        if (!availableMethods[form.payment_method]) {
            const firstAvailable = Object.entries(availableMethods).find(([_, enabled]) => enabled)?.[0];
            if (firstAvailable) {
                setForm((f) => ({ ...f, payment_method: firstAvailable }));
            }
        }
    }, [order_type, settings, form.payment_method]);

    // Auto-apply the customer's most recent personal coupon when they reach checkout,
    // so they don't have to copy-paste their own one-time code. Only fires once and
    // only if the user hasn't already typed something in the coupon field.
    // NOTE: Must be declared BEFORE any conditional early-return below to satisfy
    // react-hooks/rules-of-hooks (every render must call the same hooks in the same order).
    useEffect(() => {
        if (!user) return;
        if (form.coupon_code || coupon) return;
        let cancelled = false;
        // 1) PUBLIC coupon staged from the Offers page (tap-to-apply). Highest priority
        //    because the customer explicitly chose this code.
        let stagedCode = null;
        try { stagedCode = localStorage.getItem("pending_coupon_code"); } catch { /* */ }
        if (stagedCode) {
            setForm((f) => ({ ...f, coupon_code: stagedCode }));
            // Look up the offer details to compute the discount immediately.
            api.get("/offers").then(({ data }) => {
                if (cancelled) return;
                const found = (data || []).find((o) => (o.coupon_code || "").toUpperCase() === stagedCode.toUpperCase() && o.active);
                if (!found) return;
                const minAmount = Number(found.min_order_amount || 0);
                if (minAmount > 0 && subtotal < minAmount) {
                    toast.error(`Add Rs. ${(minAmount - subtotal).toFixed(0)} more to unlock ${stagedCode}.`);
                    return;
                }
                let discount = 0;
                if (found.discount_percent) discount = (subtotal * found.discount_percent) / 100;
                else if (found.discount_amount) discount = found.discount_amount;
                setCoupon({ ...found, discount: Math.min(discount, subtotal) });
                toast.success(`Coupon ${stagedCode} auto-applied · saved Rs. ${Math.min(discount, subtotal).toFixed(0)}`);
            }).catch(() => { /* silent */ });
            // Whether or not the look-up succeeds, consume the staged code so it doesn't
            // re-apply itself on every revisit.
            try { localStorage.removeItem("pending_coupon_code"); } catch { /* */ }
            return () => { cancelled = true; };
        }
        // 2) Personal coupons (e.g. WELCOME2-XXXXXX) — auto-applied as a fallback.
        api.get("/personal-coupons/me").then(({ data }) => {
            if (cancelled || !data || !data.length) return;
            const top = data[0];
            setForm((f) => ({ ...f, coupon_code: top.code }));
            // Compute discount inline so we don't have to re-call applyCoupon.
            let discount = 0;
            if (top.discount_percent) discount = (subtotal * top.discount_percent) / 100;
            else discount = top.discount_amount;
            setCoupon({
                coupon_code: top.code,
                title: "Personal coupon",
                discount: Math.min(discount, subtotal),
                discount_percent: top.discount_percent || 0,
                discount_amount: top.discount_amount || 0,
                personal: true,
            });
            toast.success(`Your personal coupon ${top.code} was auto-applied`);
        }).catch(() => { /* silent */ });
        return () => { cancelled = true; };
        // eslint-disable-next-line
    }, [user]);

    const detectLocation = () => {
        if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                const accuracy = pos.coords.accuracy; // metres
                setCoords(c);
                setGpsAccuracy(accuracy);
                setShowMap(true); // reveal the pin so they can confirm the exact spot
                try {
                    const { data } = await api.post("/delivery/quote", { ...c, subtotal });
                    setDelivery(data);
                    if (!data.in_range) {
                        toast.error(`Sorry, you're ${data.distance_km}km away — outside our ${data.max_radius_km}km service area.`);
                    } else if (data.free_delivery) {
                        toast.success(`You're ${data.distance_km}km away. FREE delivery!`);
                    } else {
                        toast.success(`Delivery fee: Rs. ${data.fee} (${data.distance_km}km)`);
                    }
                    // A coarse fix (network/IP based) can be off by kilometres and
                    // inflate the fee — nudge them to drag the pin to their door.
                    if (accuracy && accuracy > 200) {
                        toast("Location looks approximate — drag the pin to your exact spot for the correct fee.", { icon: "📍" });
                    }
                } catch (err) { toast.error("Could not calculate delivery"); }
                setLocating(false);
            },
            (err) => {
                setLocating(false);
                setShowMap(true); // let them place the pin manually instead
                toast.error("Location permission denied. Drop a pin on the map or enter it below.");
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const setManualCoords = async (lat, lng) => {
        const c = { lat: Number(lat), lng: Number(lng) };
        setCoords(c);
        try {
            const { data } = await api.post("/delivery/quote", { ...c, subtotal });
            setDelivery(data);
        } catch { /* */ }
    };

    if (items.length === 0) {
        return (
            <div className="max-w-md mx-auto px-4 py-24 text-center">
                <p className="text-neutral-500 mb-6">Your cart is empty.</p>
                <Link to="/menu" className="text-brand-red font-semibold">Browse Menu</Link>
            </div>
        );
    }

   const applyCoupon = async () => {
        const code = form.coupon_code.trim().toUpperCase();
        if (!code) return;
        // Stacking guard applies to both personal and public coupons against Diamond discount rewards.
        if (reward && (reward.reward_type === "discount_percent" || reward.reward_type === "discount_fixed")) {
            setCoupon(null);
            toast.error("You can use either a coupon OR a Diamond discount — not both. Remove your Diamond reward first to apply this coupon.");
            return;
        }
        try {
            // 1) Try the customer's personal coupons first (only available when signed in).
            //    These are unique single-use codes (e.g. WELCOME2-XXXXXX from the
            //    second-order bonus). They take priority over public offers and the
            //    backend will validate ownership + expiry again at order-place time.
            if (user) {
                try {
                    const { data: personal } = await api.get("/personal-coupons/me");
                    const myCode = (personal || []).find((p) => (p.code || "").toUpperCase() === code);
                    if (myCode) {
                        let discount = 0;
                        if (myCode.discount_percent) discount = (subtotal * myCode.discount_percent) / 100;
                        else discount = myCode.discount_amount;
                        setCoupon({
                            coupon_code: myCode.code,
                            title: "Personal coupon",
                            discount: Math.min(discount, subtotal),
                            discount_percent: myCode.discount_percent || 0,
                            discount_amount: myCode.discount_amount || 0,
                            personal: true,
                        });
                        toast.success(`Personal coupon applied · saved Rs. ${Math.min(discount, subtotal).toFixed(0)}`);
                        return;
                    }
                } catch { /* fall through to public offers */ }
            }

            // 2) Public offers AND private voucher codes. The /offers/lookup
            //    endpoint resolves BOTH publicly-listed offers and private
            //    'voucher_code_only' codes (which never appear in GET /offers),
            //    and runs the same server-side validation as order-place time.
            try {
                const { data: found } = await api.get("/offers/lookup", { params: { code } });
                // V2: enforce minimum order on offers
                const minAmount = Number(found.min_order_amount || 0);
                if (minAmount > 0 && subtotal < minAmount) {
                    setCoupon(null);
                    toast.error(`Spend at least Rs. ${minAmount.toFixed(0)} to use ${found.coupon_code}. Add Rs. ${(minAmount - subtotal).toFixed(0)} more.`);
                    return;
                }
                let discount = 0;
                if (found.discount_percent) discount = (subtotal * found.discount_percent) / 100;
                else if (found.discount_amount) discount = found.discount_amount;
                setCoupon({ ...found, discount: Math.min(discount, subtotal) });
                toast.success(`Coupon applied: ${found.title}`);
            } catch (err) {
                setCoupon(null);
                const msg = err?.response?.data?.detail || "Invalid coupon code";
                toast.error(msg);
            }
        } catch (e) {
            toast.error("Failed to validate coupon");
        }
    };
    const total = Math.max(0, subtotal - (coupon?.discount || 0)) + (order_type === "delivery" ? (delivery.fee || 0) : 0);
    // Preview the Diamond reward's effect on the total BEFORE placing the order, so the
    // customer doesn't have to take it on faith. Free-item rewards already render their
    // own line item (Rs. 0) elsewhere — this block handles the discount-type rewards.
    let rewardDiscountPreview = 0;
    if (reward && reward.reward_type === "discount_percent") {
        rewardDiscountPreview = Math.round((total * Number(reward.reward_value || 0)) / 100);
    } else if (reward && reward.reward_type === "discount_fixed") {
        rewardDiscountPreview = Math.min(Number(reward.reward_value || 0), total);
    }
    const totalAfterReward = Math.max(0, total - rewardDiscountPreview);
    // Hosted wallet gateways are flagged separately from payment_methods —
    // the backend reports them true only when enabled AND credentialed.
    const enabledMethods = {
        ...(settings?.payment_methods || { cod: true }),
        easypaisa: !!settings?.easypaisa_gateway_enabled,
        jazzcash: !!settings?.jazzcash_gateway_enabled,
        safepay: !!settings?.safepay_gateway_enabled,
    };
    // One online-payment option only: SafePay's hosted page already takes
    // Visa/Mastercard, so showing the separate Stripe "card" entry next to it
    // just confuses customers. Stripe stays as an automatic fallback whenever
    // SafePay is disabled/uncredentialed. WEB-ONLY rule — the mobile app's
    // card option maps payment_methods.card → SafePay and is unaffected.
    if (enabledMethods.safepay) enabledMethods.card = false;

    // NEW: Filter payment methods based on order type
    // Pickup orders cannot use Cash on Delivery
    const availableMethods = order_type === "pickup" ? { ...enabledMethods, cod: false } : enabledMethods;

    const submitOrder = async (e) => {
        e.preventDefault();
        if (isClosed) {
            toast.error("Restaurant is currently closed. Please try again during business hours.");
            return;
        }
        if (!form.customer_name.trim() || !form.phone.trim()) {
            toast.error("Please fill in name and phone"); return;
        }
        // Address required only for delivery orders
        if (order_type === "delivery" && !form.address.trim()) {
            toast.error("Please fill in delivery address"); return;
        }
        const phoneDigits = (form.phone || "").replace(/\D/g, "");
        if (phoneDigits.length < 11) {
            toast.error("Phone number must contain at least 11 digits"); return;
        }
        // Location validation only for delivery orders
        if (order_type === "delivery") {
            if (!coords) {
                toast.error("Please press \"Use My Location\" (or drop a pin on the map) to set your delivery location before placing your order.");
                return;
            }
            if (coords && !delivery.in_range) {
                toast.error("Your location is outside our delivery area."); return;
            }
        }
        setLoading(true);
        try {
            // Check if reward is selected
            const selectedReward = localStorage.getItem('selected_reward');
            const rewardId = selectedReward ? JSON.parse(selectedReward).id : null;
            
            const { data: order } = await api.post("/online-orders", {
                items: items.map((i) => ({ item_id: i.item_id, name: i.name, variation_name: i.variation_name || null, price: i.price, quantity: i.quantity })),
                total_price: subtotal,
                customer_name: form.customer_name,
                phone: form.phone,
                address: order_type === "delivery" ? form.address : "",  // Only send address for delivery
                notes: form.notes,
                payment_method: form.payment_method,
                coupon_code: coupon?.coupon_code || null,
                delivery_lat: order_type === "delivery" ? (coords?.lat || null) : null,  // Only send coords for delivery
                delivery_lng: order_type === "delivery" ? (coords?.lng || null) : null,
                order_type: order_type,  // NEW: Send order type
                reward_id: rewardId, // NEW: Diamond reward redemption
                use_wallet: !!(user && useWallet && Number(user.wallet_balance) > 0),
            });

            // Wallet covered the whole bill → the order is already PAID on the
            // server; skip any gateway redirect and go straight to tracking.
            if (order.payment_status === "paid") {
                clear();
                if (!user) saveGuestPrefill(form);
                toast.success("Paid with wallet credit — order placed!");
                navigate(`/order/${order.id}/success`, { state: { order } });
                return;
            }
            
            // Clear selected reward after order
            localStorage.removeItem('selected_reward');
            try { window.dispatchEvent(new Event("rewardSelectionChanged")); window.dispatchEvent(new Event("diamondsUpdated")); } catch { /* */ }
            
            // Show Diamonds to be earned after delivery
            if (order.diamonds_earned && order.diamonds_earned > 0) {
                setTimeout(() => {
                    toast.success(`✨ You'll earn ${order.diamonds_earned} Diamonds when order is delivered!`, { duration: 5000 });
                }, 1000);
            }
            
            clear();
            // Persist guest info so next checkout prefills automatically
            if (!user) saveGuestPrefill(form);
            // Branch by payment method
            if (form.payment_method === "card") {
                try {
                    const { data: sess } = await api.post("/payments/stripe/create-session", {
                        order_id: order.id,
                        origin_url: window.location.origin,
                    });
                    window.location.href = sess.url;
                    return;
                } catch (err) {
                    toast.error("Could not initiate card payment");
                    navigate(`/order/${order.id}/success`, { state: { order } });
                    return;
                }
            }
            if (form.payment_method === "safepay") {
                try {
                    // SafePay returns a hosted-checkout URL (like Stripe) —
                    // full-page redirect; the result page polls status by tracker.
                    const { data: sess } = await api.post("/payments/safepay/create-session", {
                        order_id: order.id,
                        origin_url: window.location.origin,
                    });
                    window.location.href = sess.url;
                    return;
                } catch (err) {
                    toast.error("Could not start the payment. You can pay via manual transfer instead.");
                    navigate(`/order/${order.id}/bank-payment`, { state: { order, settings } });
                    return;
                }
            }
            if (form.payment_method === "easypaisa" || form.payment_method === "jazzcash") {
                try {
                    const { data: sess } = await api.post(`/payments/${form.payment_method}/create-session`, {
                        order_id: order.id,
                        origin_url: window.location.origin,
                    });
                    // Browser navigates away to the gateway's hosted page.
                    submitGatewayForm(sess.action_url, sess.fields);
                    return;
                } catch (err) {
                    toast.error("Could not start the payment. You can pay via manual transfer instead.");
                    navigate(`/order/${order.id}/bank-payment`, { state: { order, settings } });
                    return;
                }
            }
            if (form.payment_method === "bank_transfer") {
                navigate(`/order/${order.id}/bank-payment`, { state: { order, settings } });
                return;
            }
            // COD or pay_at_restaurant
            toast.success("Order placed successfully!");
            navigate(`/order/${order.id}/success`, { state: { order } });
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Order failed");
        } finally { setLoading(false); }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-16" data-testid="checkout-page">
            <Link to="/cart" className="inline-flex items-center gap-2 text-neutral-500 hover:text-brand-red text-sm mb-6">
                <ArrowLeft className="w-4 h-4" /> Back to cart
            </Link>
            <h1 className="font-display font-black text-4xl md:text-5xl text-brand-ink mb-10">Checkout</h1>

            {isClosed && (
                <div className="mb-6">
                    <ClosedBanner inline />
                </div>
            )}

            {/* Auth choice gate — only shown for new guests */}
            {authChoice === null && !user && (
                <AuthChoicePanel onContinueAsGuest={() => setAuthChoice("guest")} />
            )}

            {(authChoice !== null || user) && (
            <>
            {!user && authChoice === "guest" && (
                <GuestStrip
                    hasSavedInfo={Boolean(guest)}
                    onClear={() => { localStorage.removeItem(GUEST_KEY); setForm((f) => ({ ...f, customer_name: "", phone: "", address: "" })); toast.success("Saved info cleared"); }}
                />
            )}

            <form onSubmit={submitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-5">
                    {/* Order Type Selection */}
                    <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
                        <h2 className="font-display font-bold text-lg mb-5">Order Type</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <label className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-colors ${order_type === "delivery" ? "border-brand-red bg-brand-red/5" : "border-neutral-200 hover:border-neutral-300"}`}>
                                <input type="radio" name="order_type" value="delivery" checked={order_type === "delivery"} onChange={() => setOrderType("delivery")} className="accent-brand-red" />
                                <span className="font-semibold"><Truck className="w-4 h-4 inline mr-2" />Delivery</span>
                            </label>
                            <label className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-colors ${order_type === "pickup" ? "border-brand-red bg-brand-red/5" : "border-neutral-200 hover:border-neutral-300"}`}>
                                <input type="radio" name="order_type" value="pickup" checked={order_type === "pickup"} onChange={() => setOrderType("pickup")} className="accent-brand-red" />
                                <span className="font-semibold"><Store className="w-4 h-4 inline mr-2" />Pickup</span>
                            </label>
                        </div>
                    </div>

                    {/* Delivery/Pickup details */}
                    <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
                        <h2 className="font-display font-bold text-lg mb-5">{order_type === "delivery" ? "Delivery" : "Pickup"} Details</h2>
                        <div className="space-y-4">
                            <Field icon={<User className="w-4 h-4" />} label="Full Name *" value={form.customer_name} onChange={(v) => setForm({ ...form, customer_name: v })} testid="checkout-name" />
                            <Field icon={<Phone className="w-4 h-4" />} label="Phone Number * (11+ digits)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, "") })} testid="checkout-phone" type="tel" />
                            {order_type === "delivery" && (
                            <>
                            <div>
                                <label className="block text-sm font-semibold text-brand-ink mb-2">Delivery Address *</label>
                                <div className="relative">
                                    <MapPin className="w-4 h-4 absolute left-4 top-4 text-neutral-400" />
                                    <textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="checkout-address"
                                        placeholder="House no., Street, Area, City"
                                        className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm resize-none" />
                                </div>
                            </div>

                            {/* Geolocation block — only for delivery */}
                            <div className="bg-neutral-50 rounded-xl p-4">
                                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                                    <div>
                                        <div className="text-sm font-semibold text-brand-ink">Delivery Distance</div>
                                        <div className="text-xs text-neutral-500">For accurate delivery fee, share your location</div>
                                    </div>
                                    <button type="button" onClick={detectLocation} disabled={locating} data-testid="detect-location-button"
                                        className="inline-flex items-center gap-2 bg-brand-yellow text-brand-ink rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-brand-yellow-dark hover:text-white disabled:opacity-50 transition-colors">
                                        {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                                        {locating ? "Detecting..." : "Use My Location"}
                                    </button>
                                </div>
                                {coords && (
                                    <div className="text-xs text-neutral-600" data-testid="location-result">
                                        📍 {delivery.distance_km}km from restaurant ·{" "}
                                        {delivery.in_range ? (
                                            delivery.free_delivery ? <span className="text-green-700 font-bold">FREE delivery</span> : <span className="font-bold">Delivery: Rs. {delivery.fee}</span>
                                        ) : <span className="text-red-600 font-bold">OUTSIDE service area ({delivery.max_radius_km}km max)</span>}
                                        {gpsAccuracy && gpsAccuracy > 200 && (
                                            <span className="block text-amber-600 mt-0.5">Approximate location (±{Math.round(gpsAccuracy)}m) — drag the pin below for an exact fee.</span>
                                        )}
                                    </div>
                                )}

                                {/* Map pin picker — customers confirm / fine-tune the exact
                                    delivery point. Dragging the pin re-quotes the fee. */}
                                {showMap && (
                                    <div className="mt-3" data-testid="location-picker-wrap">
                                        <p className="text-xs text-neutral-500 mb-1.5">Drag the pin to your exact location (or tap the map).</p>
                                        <LocationPicker
                                            lat={coords?.lat}
                                            lng={coords?.lng}
                                            onChange={(la, ln) => setManualCoords(la, ln)}
                                            height={220}
                                        />
                                    </div>
                                )}

                                {!showMap && (
                                    <button type="button" onClick={() => setShowMap(true)} data-testid="pin-on-map-button"
                                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-red hover:underline">
                                        <MapPin className="w-3.5 h-3.5" /> Set location on map
                                    </button>
                                )}

                                {!coords && (
                                    <details className="text-xs text-neutral-500 mt-2">
                                        <summary className="cursor-pointer hover:text-brand-red">Enter coordinates manually</summary>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <input type="number" step="0.0001" placeholder="Latitude" data-testid="manual-lat"
                                                onChange={(e) => { const lat = e.target.value; const lng = document.querySelector('[data-testid="manual-lng"]').value; if (lat && lng) setManualCoords(lat, lng); }}
                                                className="px-3 py-2 bg-white border border-neutral-200 rounded-lg outline-none focus:border-brand-red" />
                                            <input type="number" step="0.0001" placeholder="Longitude" data-testid="manual-lng"
                                                onChange={(e) => { const lng = e.target.value; const lat = document.querySelector('[data-testid="manual-lat"]').value; if (lat && lng) setManualCoords(lat, lng); }}
                                                className="px-3 py-2 bg-white border border-neutral-200 rounded-lg outline-none focus:border-brand-red" />
                                        </div>
                                    </details>
                                )}
                            </div>
                            </>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-brand-ink mb-2">Order Notes (optional)</label>
                                <div className="relative">
                                    <MessageSquare className="w-4 h-4 absolute left-4 top-4 text-neutral-400" />
                                    <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="checkout-notes"
                                        placeholder="Less spicy, extra raita, etc."
                                        className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm resize-none" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* People also buy upsell — shown before Payment so customers can grab a side */}
                    <PeopleAlsoBuy compact title="Add a side?" />

                    {/* Payment method */}
                    <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
                        <h2 className="font-display font-bold text-lg mb-5">Payment Method</h2>

                        {/* Wallet credit — signed-in customers with a balance can apply it.
                            Covers the whole bill → order is instantly paid (no gateway);
                            covers part → the rest is paid by the method chosen below. */}
                        {user && Number(user.wallet_balance) > 0 && (
                            <label data-testid="checkout-use-wallet"
                                className={`flex items-center gap-3 p-4 mb-4 rounded-2xl border-2 cursor-pointer transition-colors ${useWallet ? "border-emerald-500 bg-emerald-50" : "border-neutral-200 hover:border-emerald-300"}`}>
                                <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)}
                                    className="accent-emerald-600 w-4 h-4" />
                                <span className="text-2xl">👛</span>
                                <span className="flex-1">
                                    <span className="block text-sm font-bold text-brand-ink">Use wallet credit — Rs {Number(user.wallet_balance).toFixed(0)} available</span>
                                    <span className="block text-xs text-neutral-500">
                                        {useWallet
                                            ? "Applied at order time. If it covers the full bill, no other payment is needed."
                                            : "Store credit from refunds. Tick to apply it to this order."}
                                    </span>
                                </span>
                            </label>
                        )}
                        {order_type === "pickup" && (
                            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs text-amber-900 font-semibold">💡 Cash on Delivery is not available for pickup orders. Please choose another payment method.</p>
                            </div>
                        )}
                        <div className="space-y-2">
                            {Object.entries(PAYMENT_LABELS).map(([key, info]) => {
                                if (!availableMethods[key]) return null;
                                const Icon = info.icon;
                                const selected = form.payment_method === key;
                                return (
                                    <label key={key} data-testid={`payment-${key}`}
                                        className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${selected ? "border-brand-red bg-brand-red/5" : "border-neutral-200 hover:border-neutral-300"}`}>
                                        <input type="radio" name="payment_method" value={key} checked={selected} onChange={() => setForm({ ...form, payment_method: key })} className="accent-brand-red" />
                                        <Icon className={`w-6 h-6 ${selected ? "text-brand-red" : "text-neutral-500"}`} />
                                        <div className="flex-1">
                                            <div className={`font-semibold ${selected ? "text-brand-ink" : "text-brand-ink"}`}>{info.label}</div>
                                            <div className="text-xs text-neutral-500">{info.desc}</div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Order Summary */}
                <aside className="lg:sticky lg:top-24 self-start">
                    <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
                        <h2 className="font-display font-bold text-lg mb-4">Order Summary</h2>
                        <div className="space-y-2 mb-4 max-h-48 overflow-auto pr-1">
                            {items.map((i) => (
                                <div key={i.item_id} className="flex justify-between text-sm">
                                    <span className="text-neutral-600 truncate pr-2">{i.quantity}× {i.name}</span>
                                    <span className="font-semibold whitespace-nowrap">Rs. {i.price * i.quantity}</span>
                                </div>
                            ))}
                        </div>

                        {/* V2: selected Diamond reward chip with remove */}
                        {reward && (
                            <div data-testid="checkout-reward-banner" className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
                                <Diamond className="w-4 h-4 text-amber-700 mt-0.5" fill="currentColor" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-amber-900 truncate">Reward: {reward.title}</div>
                                    <div className="text-[11px] text-amber-700">Costs {reward.cost_diamonds} Diamonds — only deducted when the order is placed.</div>
                                </div>
                                <button type="button" onClick={removeReward} data-testid="checkout-reward-remove" className="text-amber-700 hover:text-red-600 p-1">
                                    <XIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                        {/* Free-item reward — show the actual item the customer will receive so they
                            (and our support team if they call in) see exactly what's coming free. */}
                        {reward && reward.reward_type === "free_item" && (
                            <div data-testid="checkout-free-item-line" className="mb-3 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                {reward.free_item_image && (
                                    <img src={reward.free_item_image} alt={reward.free_item_name} className="w-10 h-10 rounded-lg object-cover" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-emerald-900 line-clamp-1">1× {reward.free_item_name || "Free reward item"}</div>
                                    <div className="text-[10px] text-emerald-700 uppercase tracking-wider font-bold">FREE · Diamond Reward</div>
                                </div>
                                <span className="text-emerald-700 font-display font-black text-sm">Rs. 0</span>
                            </div>
                        )}

                        <div className="flex gap-2 mb-4">
                            <div className="relative flex-1">
                                <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input type="text" placeholder="Coupon code" value={form.coupon_code} onChange={(e) => setForm({ ...form, coupon_code: e.target.value })} data-testid="checkout-coupon-input"
                                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-lg outline-none text-sm uppercase" />
                            </div>
                            <button type="button" onClick={applyCoupon} data-testid="checkout-coupon-apply" className="px-4 py-2.5 rounded-lg bg-brand-yellow text-brand-ink font-semibold text-sm hover:bg-brand-yellow-dark hover:text-white transition-colors">
                                Apply
                            </button>
                        </div>

                        <div className="border-t border-neutral-100 pt-4 space-y-1.5 text-sm">
                            <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span>Rs. {subtotal}</span></div>
                            {coupon && <div className="flex justify-between text-green-600 font-semibold"><span>{coupon.personal ? "Personal coupon" : "Coupon"} discount</span><span>− Rs. {coupon.discount.toFixed(0)}</span></div>}
                            <div className="flex justify-between">
                                <span className="text-neutral-500">Delivery {delivery.distance_km !== null && `(${delivery.distance_km}km)`}</span>
                                <span data-testid="checkout-delivery-fee" className={delivery.fee === 0 ? "text-green-600 font-semibold" : ""}>
                                    {delivery.fee === 0 ? (delivery.distance_km !== null ? "Free" : "—") : `Rs. ${delivery.fee}`}
                                </span>
                            </div>
                            )}
                            {order_type === "pickup" && (
                            <div className="flex justify-between text-green-600 font-semibold">
                                <span>Pickup</span>
                                <span>Free</span>
                            </div>
                            )}
                            {rewardDiscountPreview > 0 && (
                                <div data-testid="checkout-reward-discount" className="flex justify-between text-amber-700 font-semibold">
                                    <span className="inline-flex items-center gap-1">
                                        <Diamond className="w-3.5 h-3.5" fill="currentColor" />
                                        Diamond discount
                                        {reward.reward_type === "discount_percent" && ` (${reward.reward_value}%)`}
                                    </span>
                                    <span>− Rs. {rewardDiscountPreview.toFixed(0)}</span>
                                </div>
                            )}
                            <div className="flex justify-between pt-2 border-t border-neutral-100">
                                <span className="font-display font-bold text-brand-ink">Total</span>
                                <span data-testid="checkout-total" className="font-display font-black text-2xl text-brand-red">Rs. {totalAfterReward.toFixed(0)}</span>
                            </div>
                        </div>

                        <button type="submit" disabled={loading || isClosed} data-testid="checkout-place-order"
                            className="w-full mt-6 bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full px-8 py-3.5 font-bold transition-colors">
                            {isClosed ? "Closed — try again later" : (loading ? "Processing..." : `Place Order — Rs. ${total.toFixed(0)}`)}
                        </button>
                        <p className="text-[11px] text-neutral-400 text-center mt-3">
                            {order_type === "delivery" ? "Estimated delivery 30–45 min" : "Ready for pickup in 30–45 min"}
                        </p>
                        <p className="text-[11px] text-neutral-400 text-center mt-1">
                            By placing an order you agree to our{" "}
                            <Link to="/terms" className="underline hover:text-brand-red">Terms</Link>,{" "}
                            <Link to="/refunds" className="underline hover:text-brand-red">Refund Policy</Link> and{" "}
                            <Link to="/privacy" className="underline hover:text-brand-red">Privacy Policy</Link>.
                        </p>
                    </div>
                </aside>
            </form>
            </>
            )}
        </div>
    );
}

function AuthChoicePanel({ onContinueAsGuest }) {
    return (
        <div className="bg-white border border-neutral-100 rounded-2xl p-6 md:p-8 shadow-sm mb-8" data-testid="auth-choice-panel">
            <div className="text-center mb-6">
                <h2 className="font-display font-black text-2xl md:text-3xl text-brand-ink">Almost there!</h2>
                <p className="text-neutral-500 text-sm mt-1">Sign in for faster checkout next time, or continue as a guest.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Link
                    to="/login?redirect=/checkout"
                    data-testid="auth-choice-signin"
                    className="border-2 border-brand-red text-brand-red hover:bg-brand-red hover:text-white rounded-2xl p-5 text-left transition-colors group"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-red-50 group-hover:bg-white/20 inline-flex items-center justify-center"><UserCheck className="w-5 h-5" /></div>
                        <span className="font-display font-bold text-lg">Sign In</span>
                    </div>
                    <p className="text-xs opacity-80">Already have an account? Earn loyalty points and re-order with one tap.</p>
                </Link>
                <Link
                    to="/register?redirect=/checkout"
                    data-testid="auth-choice-signup"
                    className="border-2 border-brand-ink text-brand-ink hover:bg-brand-ink hover:text-white rounded-2xl p-5 text-left transition-colors group"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 group-hover:bg-white/20 inline-flex items-center justify-center"><UserPlus className="w-5 h-5" /></div>
                        <span className="font-display font-bold text-lg">Create Account</span>
                    </div>
                    <p className="text-xs opacity-80">30 seconds. Save your address & track orders forever.</p>
                </Link>
            </div>
            <button
                type="button"
                onClick={onContinueAsGuest}
                data-testid="auth-choice-guest"
                className="w-full mt-4 text-sm font-semibold text-neutral-500 hover:text-brand-ink py-3 inline-flex items-center justify-center gap-1.5"
            >
                Continue as Guest <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </button>
            <p className="text-[11px] text-neutral-400 text-center mt-1">We'll save your details on this device for next time.</p>
        </div>
    );
}

function GuestStrip({ hasSavedInfo, onClear }) {
    return (
        <div data-testid="guest-strip" className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 min-w-0">
                <UserPlus className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-amber-900 truncate">
                    Continuing as guest{hasSavedInfo ? " — your saved info has been pre-filled" : ""}.
                    {" "}<Link to="/register?redirect=/checkout" className="font-bold underline whitespace-nowrap">Create account</Link>
                </span>
            </div>
            {hasSavedInfo && (
                <button type="button" onClick={onClear} data-testid="guest-clear-info" className="text-[11px] text-amber-800 underline whitespace-nowrap">Clear saved info</button>
            )}
        </div>
    );
}

function Field({ icon, label, type = "text", value, onChange, testid }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-brand-ink mb-2">{label}</label>
            <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">{icon}</span>
                <input type={type} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid}
                    className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
            </div>
        </div>
    );
}
