import { ShieldCheck, Lock, CreditCard, Wallet, Banknote, Smartphone } from "lucide-react";

/**
 * Reusable trust strip — drop it under checkout / cart / homepage to reassure
 * the customer the site is legit before they hand over payment details.
 * Three variants:
 *   - "checkout"  : full strip with secure badge + all payment methods.
 *   - "compact"   : just the payment-method icons + secure label (footer use).
 *   - "homepage"  : 4-up reassurance cards (verified, secure, hot, fresh).
 */
export default function TrustStrip({ variant = "checkout", className = "" }) {
    if (variant === "homepage") {
        const cards = [
            { icon: ShieldCheck, label: "Verified Restaurant", body: "Registered + reviewed by real customers since 2009." },
            { icon: Lock,         label: "Secure Checkout",    body: "Card data never touches our servers — handled by certified processors." },
            { icon: Banknote,     label: "COD Available",      body: "Pay on delivery if you'd rather not pay online." },
            { icon: Smartphone,   label: "Live Order Tracking",body: "Push + WhatsApp updates from acceptance to delivery." },
        ];
        return (
            <section className={`bg-white border-y border-neutral-200 ${className}`} data-testid="trust-strip-home">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                    {cards.map((c, i) => (
                        <div key={i} data-testid={`trust-card-${i}`} className="flex flex-col items-start gap-2">
                            <c.icon className="w-6 h-6 text-brand-red" />
                            <div className="font-display font-bold text-brand-ink text-sm md:text-base">{c.label}</div>
                            <div className="text-xs md:text-sm text-neutral-500 leading-snug">{c.body}</div>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (variant === "compact") {
        return (
            <div className={`flex items-center gap-2 text-white/60 text-xs ${className}`} data-testid="trust-strip-compact">
                <Lock className="w-3.5 h-3.5" />
                <span>Secure checkout · Cash, card, bank, wallet accepted</span>
            </div>
        );
    }

    // default: "checkout"
    const methods = [
        { icon: Banknote,   label: "Cash on Delivery" },
        { icon: CreditCard, label: "Card" },
        { icon: Wallet,     label: "JazzCash / Easypaisa" },
        { icon: Smartphone, label: "Bank Transfer" },
    ];
    return (
        <div className={`bg-emerald-50 border border-emerald-200 rounded-2xl p-4 ${className}`} data-testid="trust-strip-checkout">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-3">
                <ShieldCheck className="w-4 h-4" />
                <span>Your order is secure</span>
            </div>
            <p className="text-xs text-emerald-900/70 mb-3 leading-relaxed">
                All prices are recomputed on our servers — you only pay what you see. Card data is processed by certified gateways and never stored on this site.
            </p>
            <div className="flex flex-wrap gap-2">
                {methods.map((m, i) => (
                    <div key={i} data-testid={`trust-method-${i}`} className="inline-flex items-center gap-1.5 bg-white border border-emerald-200 rounded-full px-3 py-1 text-xs font-semibold text-emerald-900">
                        <m.icon className="w-3.5 h-3.5" /> {m.label}
                    </div>
                ))}
            </div>
        </div>
    );
}
