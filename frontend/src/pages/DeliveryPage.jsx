import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { useSeo } from "../lib/seo";
import { MapPin, Clock, Truck, Phone, ArrowRight } from "lucide-react";

/**
 * Public /delivery page. Lists the admin-managed delivery areas (GET
 * /delivery-areas) plus the static delivery policy (radius, timings, fees).
 *
 * SEO value: naming the specific areas we serve (Johar Town, Model Town, DHA…)
 * on a crawlable page helps rank for "biryani delivery in <area>" searches and
 * gives AI assistants concrete coverage info. We also emit a Restaurant JSON-LD
 * block whose `areaServed` is built from the live area list.
 */
export default function DeliveryPage() {
    useSeo({
        title: "Delivery Areas & Info — Biryani Delivery in Lahore | Karachi Naseeb",
        description:
            "Where we deliver in Lahore, delivery timings, fees and how it works. Order authentic Karachi Naseeb biryani, pulao and BBQ with free delivery and Cash on Delivery.",
        path: "/delivery",
    });

    const [areas, setAreas] = useState([]);

    useEffect(() => {
        let cancelled = false;
        api.get("/delivery-areas")
            .then(({ data }) => { if (!cancelled) setAreas(Array.isArray(data) ? data : []); })
            .catch(() => { if (!cancelled) setAreas([]); });
        return () => { cancelled = true; };
    }, []);

    // Inject a Restaurant JSON-LD block whose areaServed lists the real areas,
    // so search engines and AI assistants know exactly where we deliver.
    useEffect(() => {
        if (!areas.length) return undefined;
        const schema = {
            "@context": "https://schema.org",
            "@type": "Restaurant",
            "name": "Karachi Naseeb Biryani and Murg Pulao",
            "url": "https://www.karachinaseebbiryani.com/delivery",
            "servesCuisine": ["Pakistani", "Biryani", "BBQ", "Karahi"],
            "areaServed": areas.map((a) => ({ "@type": "Place", "name": a.name })),
        };
        const tag = document.createElement("script");
        tag.type = "application/ld+json";
        tag.setAttribute("data-delivery-jsonld", "1");
        tag.textContent = JSON.stringify(schema);
        document.head.appendChild(tag);
        return () => {
            document.querySelectorAll('script[data-delivery-jsonld="1"]').forEach((n) => n.remove());
        };
    }, [areas]);

    return (
        <main className="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-16" data-testid="delivery-page">
            <header className="text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-brand-red/10 text-brand-red px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
                    <Truck className="w-3.5 h-3.5" /> Delivery
                </div>
                <h1 className="font-display font-black text-4xl md:text-6xl text-brand-ink mb-4">Biryani delivery across Lahore</h1>
                <p className="text-neutral-500 max-w-2xl mx-auto text-lg leading-relaxed">
                    Hot, fresh Karachi-style biryani, Murg Pulao and BBQ delivered to your door. Free delivery in our service area, with live order tracking and Cash on Delivery.
                </p>
            </header>

            {/* Quick facts */}
            <div className="grid sm:grid-cols-3 gap-4 mb-12">
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 text-center">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-brand-red" />
                    <div className="font-display font-bold text-brand-ink">30–45 min</div>
                    <div className="text-sm text-neutral-500">Typical delivery time</div>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 text-center">
                    <MapPin className="w-6 h-6 mx-auto mb-2 text-brand-red" />
                    <div className="font-display font-bold text-brand-ink">Within ~7 km</div>
                    <div className="text-sm text-neutral-500">of Chatri Chowk, Lahore</div>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 text-center">
                    <Truck className="w-6 h-6 mx-auto mb-2 text-brand-red" />
                    <div className="font-display font-bold text-brand-ink">Own fleet</div>
                    <div className="text-sm text-neutral-500">Cash on Delivery available</div>
                </div>
            </div>

            {/* Areas we deliver to */}
            <section className="mb-12">
                <h2 className="font-display font-bold text-2xl text-brand-ink mb-5">Areas we deliver to</h2>
                {areas.length === 0 ? (
                    <p className="text-neutral-500">
                        We deliver within roughly a 7 km radius of our kitchen at 68 Chatri Chowk, Punjab Small
                        Industry, D Block, Lahore. Not sure if we reach you? Call{" "}
                        <a href="tel:+923004928411" className="text-brand-red font-semibold">+92 300 4928411</a>.
                    </p>
                ) : (
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3" data-testid="delivery-area-grid">
                        {areas.map((a) => (
                            <div key={a.id} className="flex items-start gap-3 bg-white border border-neutral-200 rounded-xl p-4">
                                <MapPin className="w-5 h-5 text-brand-red shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                    <div className="font-semibold text-brand-ink">{a.name}</div>
                                    {a.note ? <div className="text-sm text-neutral-500">{a.note}</div> : null}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <p className="text-sm text-neutral-400 mt-4">
                    Don't see your area? Call <a href="tel:+923004928411" className="text-brand-red font-semibold">+92 300 4928411</a> — we may still be able to help.
                </p>
            </section>

            {/* How it works */}
            <section className="mb-14">
                <h2 className="font-display font-bold text-2xl text-brand-ink mb-5">How delivery works</h2>
                <ol className="space-y-3 text-neutral-600">
                    <li><span className="font-bold text-brand-ink">1.</span> Browse the <Link to="/menu" className="text-brand-red font-semibold">menu</Link> and add items to your cart.</li>
                    <li><span className="font-bold text-brand-ink">2.</span> Enter your delivery address at checkout — we'll confirm we reach you.</li>
                    <li><span className="font-bold text-brand-ink">3.</span> Pay online or choose Cash on Delivery.</li>
                    <li><span className="font-bold text-brand-ink">4.</span> Track your order live and get WhatsApp updates until it arrives hot.</li>
                </ol>
            </section>

            <div className="text-center">
                <Link to="/menu"
                    className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white rounded-full px-8 py-4 font-bold text-lg transition-colors">
                    Order now <ArrowRight className="w-5 h-5" />
                </Link>
                <div className="mt-4 text-sm text-neutral-500">
                    Questions? See our <Link to="/faq" className="text-brand-red font-semibold">FAQ</Link> or call{" "}
                    <a href="tel:+923004928411" className="text-brand-red font-semibold inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />+92 300 4928411</a>.
                </div>
            </div>
        </main>
    );
}
