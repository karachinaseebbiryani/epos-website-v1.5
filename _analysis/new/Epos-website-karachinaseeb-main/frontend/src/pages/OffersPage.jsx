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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {offers.map((o) => (
                        <article key={o.id} data-testid={`offer-${o.id}`} className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
                            <div className="aspect-[4/3] overflow-hidden bg-neutral-100 relative">
                                {o.image_url && o.image_url.trim() ? (
                                    <img src={o.image_url} loading="lazy" alt={o.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-brand-red to-brand-yellow" />
                                )}
                                {(o.discount_percent > 0 || o.discount_amount > 0) && (
                                    <div className="absolute top-4 right-4 bg-brand-yellow text-brand-ink font-display font-black text-xl px-3 py-2 rounded-xl shadow">
                                        {o.discount_percent > 0 ? `${o.discount_percent}% OFF` : `Rs.${o.discount_amount}`}
                                    </div>
                                )}
                            </div>
                            <div className="p-6">
                                <h3 className="font-display font-bold text-xl text-brand-ink mb-2">{o.title}</h3>
                                <p className="text-neutral-500 text-sm leading-relaxed mb-5">{o.description}</p>
                                {o.coupon_code && (
                                    <button
                                        data-testid={`offer-copy-${o.id}`}
                                        onClick={() => copyCode(o.coupon_code)}
                                        className="w-full inline-flex items-center justify-center gap-2 border-2 border-dashed border-brand-red text-brand-red rounded-xl py-3 font-bold text-sm uppercase tracking-wider hover:bg-brand-red hover:text-white transition-colors"
                                    >
                                        <Tag className="w-4 h-4" /> {o.coupon_code}
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
