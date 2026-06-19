import { useEffect, useState } from "react";
import api from "../lib/api";
import { Tag, Flame } from "lucide-react";
import { toast } from "sonner";

export default function OffersPage() {
    const [offers, setOffers] = useState([]);

    useEffect(() => {
        api.get("/offers").then((r) => setOffers(r.data)).catch(() => { });
    }, []);

    const copyCode = (code) => {
        if (!code) return;
        navigator.clipboard.writeText(code);
        toast.success(`Copied: ${code}`);
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

            {offers.length === 0 ? (
                <div className="text-center py-16 text-neutral-500">No active offers right now. Check back soon!</div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                    {offers.map((o) => (
                        <article key={o.id} data-testid={`offer-${o.id}`} className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
                            <div className="aspect-[4/3] overflow-hidden bg-neutral-100 relative">
                                {o.image_url && o.image_url.trim() ? (
                                    <img src={o.image_url} loading="lazy" alt={o.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
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
                                <h3 className="font-display font-bold text-sm md:text-xl text-brand-ink mb-1 md:mb-2 line-clamp-1">{o.title}</h3>
                                <p className="text-neutral-500 text-[11px] md:text-sm leading-snug md:leading-relaxed mb-3 md:mb-5 line-clamp-2 md:line-clamp-none">{o.description}</p>
                                {o.coupon_code && (
                                    <button
                                        data-testid={`offer-copy-${o.id}`}
                                        onClick={() => copyCode(o.coupon_code)}
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
        </div>
    );
}
