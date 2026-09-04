import { useEffect, useState } from "react";
import api, { resolveImageUrl } from "../lib/api";
import { Tag, Flame, Timer } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import GuestGateSheet from "../components/GuestGateSheet";
import { useSeo } from "../lib/seo";

/**
 * Live countdown for a limited-time offer. Ticks off the SERVER clock
 * (valid_until + server_now from GET /offers), so changing the device clock
 * can't extend a deal. Renders nothing for offers without an expiry.
 * Always shows seconds when time remaining is less than 24 hours.
 */
export function OfferCountdown({ validUntil, serverNow, className = "" }) {
    // Offset between server time and this device, captured once per mount.
    const [offsetMs] = useState(() =>
        serverNow ? new Date(serverNow).getTime() - Date.now() : 0
    );
    const [leftMs, setLeftMs] = useState(() =>
        validUntil ? new Date(validUntil).getTime() - (Date.now() + offsetMs) : null
    );
    useEffect(() => {
        if (!validUntil) return undefined;
        const id = setInterval(() => {
            setLeftMs(new Date(validUntil).getTime() - (Date.now() + offsetMs));
        }, 1000);
        return () => clearInterval(id);
    }, [validUntil, offsetMs]);
    if (!validUntil || leftMs == null) return null;
    if (leftMs <= 0) {
        return (
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold text-neutral-400 ${className}`}>
                <Timer className="w-3 h-3" /> Expired
            </span>
        );
    }
    const s = Math.floor(leftMs / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    // Show seconds for anything under 24 hours
    const isUnder24h = d === 0;
    const label = d > 0
        ? `${d}d ${h}h left`
        : h > 0
            ? `${h}h ${m}m ${sec}s left`
            : `${m}m ${sec}s left`;
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${className}`} data-testid="offer-countdown">
            <Timer className="w-3 h-3" /> {label}
        </span>
    );
}

export default function OffersPage() {
    useSeo({
        title: "Deals & Discounts on Biryani in Lahore | Karachi Naseeb",
        description:
            "Today's deals on Karachi Naseeb biryani, pulao, BBQ and family deals in Lahore. Grab coupon codes, combo offers and Diamond rewards — order online with free delivery.",
        path: "/offers",
    });
    const [offers, setOffers] = useState([]);
    const [personalCoupons, setPersonalCoupons] = useState([]);
    const [gateOpen, setGateOpen] = useState(false);
    const [pendingCode, setPendingCode] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        // Use for_platform=website to filter out voucher_code_only offers (same logic as mobile app)
        api.get("/offers", { params: { for_platform: "website" } })
            .then((r) => setOffers(r.data))
            .catch(() => { });
    }, []);

    // Pull this customer's personal one-time codes (e.g. WELCOME2-XXXXXX) so we can
    // showcase them at the very top of the offers page. Public until-signed-in fallback
    // is a friendly "Sign in to unlock your personal code" placeholder.
    useEffect(() => {
        if (!user) { setPersonalCoupons([]); return; }
        api.get("/personal-coupons/me").then((r) => setPersonalCoupons(r.data || [])).catch(() => { });
    }, [user]);

    const copyCode = (code) => {
        if (!code) return;
        navigator.clipboard.writeText(code);
        toast.success(`Copied: ${code}`);
    };

    // Auto-stage the coupon for checkout when a signed-in customer taps it. This is the
    // sensible flow you asked for — instead of just copying the code (which a guest could
    // memorize and type in to bypass the gate), the code is saved in localStorage and
    // automatically applied at /checkout. The backend ALSO refuses any coupon_code from
    // an un-signed-in request, so neither path leaks discounts to guests.
    const stageCouponForCheckout = (code) => {
        if (!code) return;
        try { localStorage.setItem("pending_coupon_code", code); } catch { /* */ }
        try { window.dispatchEvent(new Event("pendingCouponChanged")); } catch { /* */ }
        toast.success(`Coupon ${code} ready — it will apply at checkout.`);
    };

    // When a guest taps the coupon code, open the sign-in gate first. We still allow
    // "Continue as guest" so they're never blocked from copying the public offer code.
    const handleOfferTap = (code) => {
        if (!code) return;
        if (!user) {
            setPendingCode(code);
            setGateOpen(true);
        } else {
            stageCouponForCheckout(code);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16" data-testid="offers-page">
            <div className="mb-12">
                <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Specials</span>
                <h1 className="font-display font-black text-4xl md:text-6xl text-brand-ink mt-2 flex items-center gap-3">
                    Hot Deals <Flame className="w-10 h-10 text-brand-yellow" />
                </h1>
                <p className="text-neutral-500 mt-3 max-w-xl">Save more with our limited-time offers. Tap a code to copy.</p>
            </div>

            {/* SEO Content Section */}
            <div className="mb-12 bg-neutral-50 rounded-2xl p-6 md:p-8 border border-neutral-200">
                <h2 className="font-display font-bold text-2xl text-brand-ink mb-4">Special Offers & Deals on Biryani Delivery in Lahore</h2>
                <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed space-y-4">
                    <p>
                        Craving authentic Karachi biryani at an amazing price? Check out our current special offers and combo deals on biryani, Murg Pulao, BBQ and Pakistani cuisine delivered across Lahore. All our offers are valid for both delivery and pickup orders, with free delivery available within our service area including Johar Town, Model Town, DHA, Township, Garden Town and Punjab Small Industry.
                    </p>
                    <p>
                        <strong>How Our Offers Work:</strong> Browse our active promotions below. Discounts are automatically applied at checkout when you meet the qualifying conditions. Many offers can be combined with Diamond rewards for extra savings. Most offers have limited time periods or quantities, so order today to lock in the best deals on biryani delivery in Lahore.
                    </p>
                    <p>
                        <strong>Delivery & Pickup Available:</strong> All special offers apply to both delivery and pickup orders. Order online for delivery to your home or office anywhere in our service area, or select pickup to collect from our Chatri Chowk, Punjab Small Industry location. Cash on Delivery is available for all orders, or pay online for instant confirmation.
                    </p>
                    <p>
                        <strong>Earn Diamonds on Every Order:</strong> Don't forget — you earn Diamond rewards points on every order, even when using discount codes. Visit our <a href="/rewards-program" className="text-brand-red font-semibold hover:underline">Rewards Program page</a> to learn how to get free food with your points. Combined with our special offers, you can save big on authentic Karachi-style biryani in Lahore.
                    </p>
                    <p className="text-sm text-neutral-500 pt-2 border-t border-neutral-200">
                        Questions about our offers? Check our <a href="/faq" className="text-brand-red font-semibold hover:underline">FAQ</a> or <a href="/contact" className="text-brand-red font-semibold hover:underline">contact us</a> directly. View <a href="/delivery" className="text-brand-red font-semibold hover:underline">delivery areas</a> and timings.
                    </p>
                </div>
            </div>

            {/* Personal coupons block — shows the customer's own one-time codes
                (e.g. the second-order bonus). Guests get a teaser card that opens
                the sign-in gate when tapped. */}
            {user && personalCoupons.length > 0 && (
                <div className="mb-8 bg-gradient-to-br from-brand-red to-brand-red-dark text-white rounded-2xl p-5 md:p-6 shadow-lg" data-testid="personal-coupons-banner">
                    <div className="flex items-center gap-2 mb-1">
                        <Tag className="w-4 h-4" />
                        <span className="text-[11px] uppercase tracking-[0.2em] font-bold">Just for you</span>
                    </div>
                    <h2 className="font-display font-black text-xl md:text-2xl">Your personal codes</h2>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {personalCoupons.map((pc) => (
                            <button
                                key={pc.id}
                                type="button"
                                onClick={() => copyCode(pc.code)}
                                data-testid={`personal-coupon-${pc.id}`}
                                className="text-left bg-white/15 hover:bg-white/25 backdrop-blur-sm border-2 border-dashed border-white/60 rounded-xl px-3 py-2 transition-colors"
                            >
                                <div className="font-display font-black text-lg tracking-wider">{pc.code}</div>
                                <div className="text-[11px] text-white/80">
                                    {pc.discount_percent > 0 ? `${pc.discount_percent}% OFF` : `Rs. ${pc.discount_amount} OFF`}
                                    {pc.expires_at && ` · expires ${new Date(pc.expires_at).toLocaleDateString()}`}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {/* Guests see no personal-coupons panel at all (owner request 2026-07-15:
                hide the teaser when not signed in — public offers below still show). */}

            {offers.length === 0 ? (
                <div className="text-center py-16 text-neutral-500">No active offers right now. Check back soon!</div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                    {offers.map((o) => (
                        <article key={o.id} data-testid={`offer-${o.id}`} className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
                            <div className="aspect-[4/3] overflow-hidden bg-neutral-100 relative">
                                {o.image_url && o.image_url.trim() ? (
                                    <img src={resolveImageUrl(o.image_url)} loading="lazy" alt={o.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-brand-red to-brand-yellow" />
                                )}
                                {(o.discount_percent > 0 || o.discount_amount > 0) && (
                                    <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-brand-yellow text-brand-ink font-display font-black text-xs md:text-xl px-2 py-1 md:px-3 md:py-2 rounded-lg md:rounded-xl shadow">
                                        {o.discount_percent > 0 ? `${o.discount_percent}% OFF` : `Rs.${o.discount_amount}`}
                                    </div>
                                )}
                            </div>
                            <div className="p-3 md:p-6">
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-display font-bold text-sm md:text-xl text-brand-ink mb-1 md:mb-2 line-clamp-1">{o.title}</h3>
                                    <OfferCountdown validUntil={o.valid_until} serverNow={o.server_now} className="text-brand-red shrink-0 mt-0.5" />
                                </div>
                                <p className="text-neutral-500 text-[11px] md:text-sm leading-snug md:leading-relaxed mb-3 md:mb-5 line-clamp-2 md:line-clamp-none">{o.description}</p>
                                {o.coupon_code && (
                                    <button
                                        data-testid={`offer-copy-${o.id}`}
                                        onClick={() => handleOfferTap(o.coupon_code)}
                                        className="w-full inline-flex items-center justify-center gap-1.5 md:gap-2 border-2 border-dashed border-brand-red text-brand-red rounded-lg md:rounded-xl py-2 md:py-3 font-bold text-[11px] md:text-sm uppercase tracking-wider hover:bg-brand-red hover:text-white transition-colors"
                                    >
                                        <Tag className="w-3 h-3 md:w-4 md:h-4" /> {o.coupon_code}
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <GuestGateSheet
                open={gateOpen}
                title="Sign in to use this offer"
                subtitle="Sign in so we can apply your coupon at checkout and protect it from abuse. You can still browse without signing in."
                onClose={() => setGateOpen(false)}
                onContinueGuest={() => {
                    setGateOpen(false);
                    if (pendingCode) copyCode(pendingCode);
                    setPendingCode(null);
                }}
            />
        </div>
    );
}
