import { useEffect, useState } from "react";
import axios from "axios";
import { API } from "../lib/api";
import { Phone, Mail, MapPin, Clock, MessageCircle, Send, Instagram, Facebook } from "lucide-react";

/**
 * Contact Us — clearly displays phone, email, address, opening hours and
 * social links. Opening hours are pulled live from /api/public/restaurant-info
 * so they stay in sync with whatever the admin configured.
 *
 * The "send a message" form opens the user's mail client (mailto:) — no
 * backend endpoint needed, no spam vector. If the operator later wants a
 * proper contact form, we can add a /api/contact endpoint that emails via
 * SMTP, but that needs a mail integration (SendGrid etc.) which we deferred.
 */
export default function ContactPage() {
    const [info, setInfo] = useState(null);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const prevTitle = document.title;
        document.title = "Contact Us — Karachi Naseeb Biryani";
        const meta = document.querySelector('meta[name="description"]');
        const prevDesc = meta ? meta.getAttribute("content") : null;
        if (meta) meta.setAttribute("content", "Get in touch with Karachi Naseeb Biryani in Lahore — phone, WhatsApp, email, address and opening hours. We're at 68 Chatri Chowk, D Block.");

        // ContactPage JSON-LD for SEO + AI assistants.
        const schema = {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            "mainEntity": {
                "@type": "Restaurant",
                "name": "Karachi Naseeb Biryani and Murg Pulao",
                "telephone": "+92-300-4928411",
                "email": "karachinaseebbiryani599@gmail.com",
                "address": { "@type": "PostalAddress", "streetAddress": "68 Chatri Chowk, Punjab Small Industry, D Block", "addressLocality": "Lahore", "addressCountry": "PK" },
                "url": "https://www.karachinaseebbiryani.com/",
            },
        };
        const tag = document.createElement("script");
        tag.type = "application/ld+json";
        tag.setAttribute("data-contact-jsonld", "1");
        tag.textContent = JSON.stringify(schema);
        document.head.appendChild(tag);

        // Live hours / contact info from settings (already exists)
        axios.get(`${API}/public/restaurant-info`).then(({ data }) => setInfo(data)).catch(() => {});

        return () => {
            document.title = prevTitle;
            if (meta && prevDesc !== null) meta.setAttribute("content", prevDesc);
            document.querySelectorAll('script[data-contact-jsonld="1"]').forEach((n) => n.remove());
        };
    }, []);

    const submit = (e) => {
        e.preventDefault();
        const subject = encodeURIComponent(`Website enquiry from ${name || "a customer"}`);
        const body = encodeURIComponent(`${message}\n\n— ${name}${email ? `\n${email}` : ""}`);
        window.location.href = `mailto:karachinaseebbiryani599@gmail.com?subject=${subject}&body=${body}`;
    };

    const phone = info?.phone || "+923004928411";
    const address = info?.address || "68 Chatri Chowk, Punjab Small Industry, D Block, Lahore";
    const restaurantEmail = info?.email || "karachinaseebbiryani599@gmail.com";

    // Default opening hours fallback if the backend doesn't provide them
    const hoursList = info?.opening_hours_text || "Open daily · 11:30 AM – 11:30 PM";

    return (
        <main className="max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-20" data-testid="contact-page">
            <header className="text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-brand-red/10 text-brand-red px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
                    <MessageCircle className="w-3.5 h-3.5" /> Talk to us
                </div>
                <h1 className="font-display font-black text-4xl md:text-6xl text-brand-ink mb-3">Contact Us</h1>
                <p className="text-neutral-500 max-w-xl mx-auto">Questions, feedback or wholesale enquiries — we usually reply within a few hours.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Quick info — left column */}
                <section className="lg:col-span-2 space-y-4">
                    <a href={`tel:${phone}`} data-testid="contact-call" className="block bg-white border border-neutral-200 rounded-2xl p-5 hover:border-brand-red transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center"><Phone className="w-5 h-5" /></div>
                            <div>
                                <div className="text-xs uppercase tracking-wider font-bold text-neutral-500">Call</div>
                                <div className="font-display font-bold text-brand-ink">{phone}</div>
                            </div>
                        </div>
                    </a>

                    <a href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" data-testid="contact-whatsapp" className="block bg-white border border-neutral-200 rounded-2xl p-5 hover:border-brand-red transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center"><MessageCircle className="w-5 h-5" /></div>
                            <div>
                                <div className="text-xs uppercase tracking-wider font-bold text-neutral-500">WhatsApp</div>
                                <div className="font-display font-bold text-brand-ink">Chat with us</div>
                            </div>
                        </div>
                    </a>

                    <a href={`mailto:${restaurantEmail}`} data-testid="contact-email" className="block bg-white border border-neutral-200 rounded-2xl p-5 hover:border-brand-red transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-brand-yellow/30 text-brand-ink flex items-center justify-center"><Mail className="w-5 h-5" /></div>
                            <div className="min-w-0">
                                <div className="text-xs uppercase tracking-wider font-bold text-neutral-500">Email</div>
                                <div className="font-display font-bold text-brand-ink truncate">{restaurantEmail}</div>
                            </div>
                        </div>
                    </a>

                    <div className="bg-white border border-neutral-200 rounded-2xl p-5">
                        <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0"><MapPin className="w-5 h-5" /></div>
                            <div>
                                <div className="text-xs uppercase tracking-wider font-bold text-neutral-500">Visit</div>
                                <div className="font-display font-bold text-brand-ink leading-snug">{address}</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                        <iframe
                            src="https://www.google.com/maps/embed/v1/place?key=AIzaSyD55uTcF0f508i3m9SRfPHO_rTwNn7nFf0&q=31.4520,74.2680&zoom=15"
                            width="100%"
                            height="280"
                            style={{ border: 0 }}
                            allowFullScreen=""
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Restaurant location map"
                        />
                    </div>

                    <div className="bg-white border border-neutral-200 rounded-2xl p-5">
                        <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><Clock className="w-5 h-5" /></div>
                            <div>
                                <div className="text-xs uppercase tracking-wider font-bold text-neutral-500">Hours</div>
                                <div className="font-display font-bold text-brand-ink leading-snug" data-testid="contact-hours">{hoursList}</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-11 h-11 rounded-full bg-white border border-neutral-200 hover:bg-brand-red hover:text-white hover:border-brand-red text-neutral-500 flex items-center justify-center transition-colors"><Instagram className="w-4 h-4" /></a>
                        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-11 h-11 rounded-full bg-white border border-neutral-200 hover:bg-brand-red hover:text-white hover:border-brand-red text-neutral-500 flex items-center justify-center transition-colors"><Facebook className="w-4 h-4" /></a>
                    </div>
                </section>

                {/* Message form — right column */}
                <section className="lg:col-span-3">
                    <form onSubmit={submit} className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8" data-testid="contact-form">
                        <h2 className="font-display font-bold text-2xl text-brand-ink mb-1">Send us a message</h2>
                        <p className="text-sm text-neutral-500 mb-6">Your default mail app will open with your message pre-filled.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Your name</label>
                                <input value={name} onChange={(e) => setName(e.target.value)} required data-testid="contact-name"
                                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-brand-red transition-colors text-sm" placeholder="Ali Khan" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Your email</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="contact-email-input"
                                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-brand-red transition-colors text-sm" placeholder="ali@example.com" />
                            </div>
                        </div>
                        <div className="mb-5">
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Message</label>
                            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={6} data-testid="contact-message"
                                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-brand-red transition-colors text-sm" placeholder="How can we help?" />
                        </div>
                        <button type="submit" data-testid="contact-send"
                            className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white rounded-full px-6 py-3 font-bold transition-colors">
                            Send message <Send className="w-4 h-4" />
                        </button>
                    </form>
                </section>
            </div>
        </main>
    );
}
