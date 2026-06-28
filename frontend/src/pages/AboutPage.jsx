import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Award, ChefHat, Heart, MapPin, Phone, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

/**
 * About Us — the story page. Mostly static copy + a LocalBusiness JSON-LD
 * block so AI assistants and Google's knowledge panel have a single
 * authoritative place to learn what the restaurant is.
 *
 * Why static + not driven by /lib/policies: this page has bespoke visual
 * structure (hero, value cards, story timeline) that the generic PolicyPage
 * shell isn't designed for.
 */
export default function AboutPage() {
    useEffect(() => {
        const prevTitle = document.title;
        document.title = "About — Karachi Naseeb Biryani & Murg Pulao";
        const meta = document.querySelector('meta[name="description"]');
        const prevDesc = meta ? meta.getAttribute("content") : null;
        if (meta) meta.setAttribute("content", "Family-owned Karachi Naseeb Biryani has been serving authentic Karachi-style biryani, Murg Pulao and BBQ in Lahore for over 15 years. Slow-cooked, hand-spiced, generations-tested recipes.");

        // Bonus JSON-LD: AboutPage + LocalBusiness. Helps Google's knowledge
        // panel + AI assistants summarise the business accurately.
        const schema = {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            "mainEntity": {
                "@type": "Restaurant",
                "name": "Karachi Naseeb Biryani and Murg Pulao",
                "image": "https://www.karachinaseebbiryani.com/og-image.jpg",
                "logo": "https://www.karachinaseebbiryani.com/logo-512.png",
                "description": "Authentic Karachi-style biryani, Murg Pulao and BBQ delivered across Lahore since 2009.",
                "address": { "@type": "PostalAddress", "streetAddress": "68 Chatri Chowk, Punjab Small Industry, D Block", "addressLocality": "Lahore", "addressCountry": "PK" },
                "telephone": "+92-300-4928411",
                "servesCuisine": ["Pakistani", "Biryani", "BBQ", "Karahi"],
                "priceRange": "Rs",
                "foundingDate": "2009",
            },
        };
        const tag = document.createElement("script");
        tag.type = "application/ld+json";
        tag.setAttribute("data-about-jsonld", "1");
        tag.textContent = JSON.stringify(schema);
        document.head.appendChild(tag);

        return () => {
            document.title = prevTitle;
            if (meta && prevDesc !== null) meta.setAttribute("content", prevDesc);
            document.querySelectorAll('script[data-about-jsonld="1"]').forEach((n) => n.remove());
        };
    }, []);

    return (
        <main className="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-20" data-testid="about-page">
            <header className="text-center mb-14">
                <div className="inline-flex items-center gap-2 bg-brand-red/10 text-brand-red px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
                    <Heart className="w-3.5 h-3.5" /> Our Story
                </div>
                <h1 className="font-display font-black text-4xl md:text-6xl text-brand-ink mb-4">A Karachi recipe, cooked in Lahore.</h1>
                <p className="text-neutral-500 max-w-2xl mx-auto text-lg leading-relaxed">
                    Three generations of biryani-making in one family kitchen. Slow-cooked basmati, hand-picked spices,
                    and a recipe we&apos;ve been refining since 2009.
                </p>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
                {[
                    { icon: ChefHat, title: "Hand-cooked daily", body: "Every pot of biryani is made fresh that morning. No frozen, no microwaved, no shortcuts." },
                    { icon: Award, title: "15+ years tradition", body: "We&apos;ve been at 68 Chatri Chowk since 2009. Our regulars are now bringing their kids." },
                    { icon: Sparkles, title: "Crowd-pleaser spice", body: "Bold flavour without being aggressive — kids and grandparents at the same table both go for seconds." },
                ].map((card, i) => (
                    <article key={i} data-testid={`about-value-${i}`} className="bg-white border border-neutral-200 rounded-2xl p-6 hover:border-brand-red/40 transition-colors">
                        <card.icon className="w-7 h-7 text-brand-red mb-3" />
                        <h2 className="font-display font-bold text-lg text-brand-ink mb-2" dangerouslySetInnerHTML={{ __html: card.title }} />
                        <p className="text-sm text-neutral-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: card.body }} />
                    </article>
                ))}
            </section>

            <section className="bg-brand-ink text-white rounded-3xl p-8 md:p-14 mb-16">
                <h2 className="font-display font-black text-3xl md:text-4xl mb-6 text-brand-yellow">What we promise</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 text-sm md:text-base leading-relaxed text-white/85">
                    <div>
                        <h3 className="font-display font-bold text-brand-yellow text-lg mb-1.5">Fresh, never frozen</h3>
                        <p>We cook in batches throughout the day. If it&apos;s on the menu, it was made within the last few hours.</p>
                    </div>
                    <div>
                        <h3 className="font-display font-bold text-brand-yellow text-lg mb-1.5">Hot at your door</h3>
                        <p>Our delivery riders use insulated bags. If anything arrives cold, message us — we&apos;ll make it right.</p>
                    </div>
                    <div>
                        <h3 className="font-display font-bold text-brand-yellow text-lg mb-1.5">Honest pricing</h3>
                        <p>The total you see at checkout is the total you pay. No surprise service charges, ever.</p>
                    </div>
                    <div>
                        <h3 className="font-display font-bold text-brand-yellow text-lg mb-1.5">Genuine reviews</h3>
                        <p>Every star on this site comes from a verified customer who actually received an order from us.</p>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
                <Link to="/menu" className="group bg-white border border-neutral-200 rounded-2xl p-6 flex items-center justify-between hover:border-brand-red transition-colors" data-testid="about-to-menu">
                    <div>
                        <div className="font-display font-black text-2xl text-brand-ink">Browse the menu</div>
                        <div className="text-sm text-neutral-500 mt-1">Biryani, Murg Pulao, BBQ &amp; more.</div>
                    </div>
                    <ArrowRight className="w-6 h-6 text-brand-red group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/contact" className="group bg-brand-yellow rounded-2xl p-6 flex items-center justify-between hover:brightness-95 transition" data-testid="about-to-contact">
                    <div>
                        <div className="font-display font-black text-2xl text-brand-ink">Get in touch</div>
                        <div className="text-sm text-brand-ink/70 mt-1">Visit, call or book an event.</div>
                    </div>
                    <ArrowRight className="w-6 h-6 text-brand-ink group-hover:translate-x-1 transition-transform" />
                </Link>
            </section>

            <div className="text-sm text-neutral-500 flex items-center gap-2 justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Verified business · <MapPin className="w-3.5 h-3.5" /> Lahore · <Phone className="w-3.5 h-3.5" /> +92 300 4928411
            </div>
        </main>
    );
}
