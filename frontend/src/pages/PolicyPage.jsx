import { useEffect, useMemo } from "react";
import { useLocation, Link } from "react-router-dom";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { getPolicy } from "../lib/policies";

/**
 * Shared renderer for Privacy / Terms / Delivery / Rewards-Program.
 * Reads route slug from pathname (each policy gets its own /privacy, /terms,
 * etc. route — flat URLs are better for SEO than /policy/:slug). Pulls
 * structured content from /lib/policies.js. Updates document <title> + meta
 * description on mount for SEO, injects a page-specific BreadcrumbList JSON-LD
 * so search engines render breadcrumb-style results.
 *
 * Why one shared component instead of four files: 90% of the markup is
 * identical, and centralising it means a future style refresh hits all four
 * pages at once. Page-specific text lives in /lib/policies.js.
 */
export default function PolicyPage() {
    const location = useLocation();
    const slug = location.pathname.replace(/^\/+/, "").split("/")[0];
    const policy = useMemo(() => getPolicy(slug), [slug]);

    useEffect(() => {
        if (!policy) return undefined;
        const prevTitle = document.title;
        document.title = `${policy.title} — Karachi Naseeb Biryani`;
        const meta = document.querySelector('meta[name="description"]');
        const prevDesc = meta ? meta.getAttribute("content") : null;
        if (meta && policy.description) meta.setAttribute("content", policy.description);

        // BreadcrumbList JSON-LD so search results show Home > Section nicely.
        const schema = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.karachinaseebbiryani.com/" },
                { "@type": "ListItem", "position": 2, "name": policy.title, "item": `https://www.karachinaseebbiryani.com/${policy.slug}` },
            ],
        };
        const tag = document.createElement("script");
        tag.type = "application/ld+json";
        tag.setAttribute("data-policy-jsonld", "1");
        tag.textContent = JSON.stringify(schema);
        document.head.appendChild(tag);

        return () => {
            document.title = prevTitle;
            if (meta && prevDesc !== null) meta.setAttribute("content", prevDesc);
            document.querySelectorAll('script[data-policy-jsonld="1"]').forEach((n) => n.remove());
        };
    }, [policy]);

    if (!policy) {
        return (
            <main className="max-w-2xl mx-auto px-4 py-24 text-center" data-testid="policy-not-found">
                <h1 className="font-display font-black text-3xl text-brand-ink mb-3">Page not found</h1>
                <p className="text-neutral-500 mb-6">We couldn&apos;t find the page you&apos;re looking for.</p>
                <Link to="/" className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white rounded-full px-6 py-3 font-bold">
                    Back to Home <ChevronRight className="w-4 h-4" />
                </Link>
            </main>
        );
    }

    return (
        <main className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-20" data-testid={`policy-page-${policy.slug}`}>
            <nav className="text-xs text-neutral-500 mb-6 flex items-center gap-1.5" aria-label="Breadcrumb">
                <Link to="/" className="hover:text-brand-red">Home</Link>
                <ChevronRight className="w-3 h-3" />
                <span className="text-brand-ink font-semibold">{policy.title}</span>
            </nav>

            <header className="mb-10">
                <div className="inline-flex items-center gap-2 bg-brand-yellow/20 text-brand-ink px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
                    <ShieldCheck className="w-3.5 h-3.5" /> {policy.slug === "privacy" ? "Your data, your rights" : policy.slug === "terms" ? "Service Agreement" : policy.slug === "refunds" ? "Returns & refunds" : policy.slug === "delivery" ? "How delivery works" : "Loyalty Program"}
                </div>
                <h1 className="font-display font-black text-3xl md:text-5xl text-brand-ink mb-2" itemProp="headline">{policy.title}</h1>
                <p className="text-sm text-neutral-500">Last updated: {policy.updated}</p>
            </header>

            <article className="space-y-8" itemScope itemType="https://schema.org/Article">
                {policy.sections.map((s, i) => (
                    <section key={i} data-testid={`policy-section-${i}`}>
                        <h2 className="font-display font-bold text-xl text-brand-ink mb-2">{s.heading}</h2>
                        <p className="text-neutral-600 leading-relaxed whitespace-pre-line">{s.body}</p>
                    </section>
                ))}
            </article>

            <div className="mt-12 pt-8 border-t border-neutral-200 text-sm text-neutral-500">
                Still have a question? Visit our <Link to="/faq" className="text-brand-red font-semibold hover:underline">FAQ</Link> or <Link to="/contact" className="text-brand-red font-semibold hover:underline">contact us</Link>.
            </div>
        </main>
    );
}
