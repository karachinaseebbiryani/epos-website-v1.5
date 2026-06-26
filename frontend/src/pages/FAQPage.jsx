import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API } from "../lib/api";
import { ChevronDown, HelpCircle } from "lucide-react";

/**
 * Public FAQ page — also injects a FAQPage schema.org JSON-LD block into the
 * document head so Google can render rich-result expandables directly in
 * search results. AI assistants (ChatGPT/Perplexity/Gemini) also pick this up
 * to answer questions about the restaurant.
 *
 * The schema is rebuilt every time the FAQ list changes (e.g. when the admin
 * edits one and the public page polls /api/faqs again). We carefully clean up
 * any previously-injected script tag so we never leave stale content in the
 * head.
 */
export default function FAQPage() {
    const [faqs, setFaqs] = useState([]);
    const [openId, setOpenId] = useState(null);

    useEffect(() => {
        let cancelled = false;
        axios.get(`${API}/faqs`).then(({ data }) => {
            if (!cancelled) setFaqs(Array.isArray(data) ? data : []);
        }).catch(() => {
            if (!cancelled) setFaqs([]);
        });
        return () => { cancelled = true; };
    }, []);

    // Inject / remove FAQPage JSON-LD. Tagged with data-faq-jsonld so we can
    // find and clean it up on unmount and avoid duplicate blocks if React
    // re-renders unexpectedly.
    useEffect(() => {
        if (!faqs.length) return undefined;
        const schema = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqs.map((f) => ({
                "@type": "Question",
                "name": f.question,
                "acceptedAnswer": { "@type": "Answer", "text": f.answer },
            })),
        };
        const tag = document.createElement("script");
        tag.type = "application/ld+json";
        tag.setAttribute("data-faq-jsonld", "1");
        tag.textContent = JSON.stringify(schema);
        document.head.appendChild(tag);
        return () => {
            document.querySelectorAll('script[data-faq-jsonld="1"]').forEach((n) => n.remove());
        };
    }, [faqs]);

    // Update <title> + meta description on mount so SSR-less Vercel deploys
    // still ship the right SEO signals to crawlers that execute JS (Googlebot
    // does; some AI assistants do too).
    useEffect(() => {
        const prevTitle = document.title;
        document.title = "FAQ — Karachi Naseeb Biryani & Murg Pulao";
        const meta = document.querySelector('meta[name="description"]');
        const prevDesc = meta ? meta.getAttribute("content") : null;
        if (meta) meta.setAttribute("content", "Frequently asked questions about ordering biryani, BBQ and Pakistani food online from Karachi Naseeb Biryani — delivery, payments, rewards, and more.");
        return () => {
            document.title = prevTitle;
            if (meta && prevDesc !== null) meta.setAttribute("content", prevDesc);
        };
    }, []);

    const hasFaqs = useMemo(() => faqs.length > 0, [faqs]);

    return (
        <main className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-20" data-testid="faq-page">
            <header className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-brand-red/10 text-brand-red px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
                    <HelpCircle className="w-3.5 h-3.5" /> Help Centre
                </div>
                <h1 className="font-display font-black text-3xl md:text-5xl text-brand-ink mb-3">Frequently Asked Questions</h1>
                <p className="text-neutral-500">Everything you need to know about ordering, delivery, payments and Diamonds rewards.</p>
            </header>

            {!hasFaqs ? (
                <div className="text-center text-neutral-400 py-16" data-testid="faq-empty">
                    No FAQs yet — please check back soon.
                </div>
            ) : (
                <section className="space-y-3" itemScope itemType="https://schema.org/FAQPage">
                    {faqs.map((f) => {
                        const open = openId === f.id;
                        return (
                            <article
                                key={f.id}
                                data-testid={`faq-item-${f.id}`}
                                itemScope
                                itemProp="mainEntity"
                                itemType="https://schema.org/Question"
                                className="bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:border-brand-red/40 transition-colors">
                                <button
                                    type="button"
                                    onClick={() => setOpenId(open ? null : f.id)}
                                    data-testid={`faq-toggle-${f.id}`}
                                    aria-expanded={open}
                                    className="w-full px-5 md:px-7 py-5 flex items-center justify-between gap-4 text-left">
                                    <h2 itemProp="name" className="font-display font-bold text-base md:text-lg text-brand-ink">{f.question}</h2>
                                    <ChevronDown className={`w-5 h-5 text-neutral-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
                                </button>
                                {open && (
                                    <div
                                        itemScope
                                        itemProp="acceptedAnswer"
                                        itemType="https://schema.org/Answer"
                                        className="px-5 md:px-7 pb-5 -mt-1">
                                        <div itemProp="text" className="text-neutral-600 leading-relaxed whitespace-pre-line">{f.answer}</div>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </section>
            )}
        </main>
    );
}
