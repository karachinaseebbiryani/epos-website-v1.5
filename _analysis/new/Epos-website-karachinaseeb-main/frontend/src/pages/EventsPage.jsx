import { useState } from "react";
import api, { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { Calendar, Users, Phone, User, MessageSquare, PartyPopper, Mail } from "lucide-react";

const EVENT_TYPES = ["Wedding", "Birthday", "Corporate Event", "Mehndi", "Aqeeqa", "Family Gathering", "Other"];

export default function EventsPage() {
    const [form, setForm] = useState({
        name: "", phone: "", email: "", event_type: "Wedding", guests: 50, event_date: "", message: "",
    });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.phone || !form.event_date) {
            toast.error("Please fill in name, phone and event date");
            return;
        }
        setLoading(true);
        try {
            await api.post("/event-bookings", { ...form, guests: Number(form.guests) });
            setSubmitted(true);
            toast.success("Booking received!");
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="max-w-xl mx-auto px-4 py-24 text-center" data-testid="events-thank-you">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
                    <PartyPopper className="w-9 h-9 text-green-600" />
                </div>
                <h1 className="font-display font-black text-3xl text-brand-ink mb-3">Booking Received!</h1>
                <p className="text-neutral-500 mb-8">We&apos;ll contact you within 24 hours to finalize your event details.</p>
                <button onClick={() => { setSubmitted(false); setForm({ name: "", phone: "", email: "", event_type: "Wedding", guests: 50, event_date: "", message: "" }); }}
                    className="text-brand-red font-semibold">Submit another booking</button>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-16" data-testid="events-page">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="lg:sticky lg:top-24 self-start">
                    <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Catering &amp; Events</span>
                    <h1 className="font-display font-black text-4xl md:text-5xl text-brand-ink mt-2 mb-5">Book Your Event With Us</h1>
                    <p className="text-neutral-500 leading-relaxed mb-8">
                        From intimate family gatherings to grand weddings — let us handle the food. Authentic biryani, pulao, and BBQ catering for any party size.
                    </p>
                    <div className="rounded-2xl overflow-hidden">
                        <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?crop=entropy&cs=srgb&fm=jpg&q=85" alt="Restaurant" className="w-full h-72 object-cover" />
                    </div>
                </div>

                <form onSubmit={submit} className="bg-white border border-neutral-100 rounded-2xl p-6 md:p-8 shadow-sm space-y-5">
                    <h2 className="font-display font-bold text-2xl text-brand-ink mb-1">Tell us about your event</h2>
                    <p className="text-sm text-neutral-500 mb-4">We&apos;ll respond within 24 hours.</p>

                    <Field icon={<User className="w-4 h-4" />} label="Your Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="event-name" />
                    <Field icon={<Phone className="w-4 h-4" />} label="Phone *" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testid="event-phone" />
                    <Field icon={<Mail className="w-4 h-4" />} label="Email (optional)" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="event-email" />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-brand-ink mb-2">Event Type</label>
                            <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} data-testid="event-type"
                                className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm">
                                {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-brand-ink mb-2">Guests</label>
                            <div className="relative">
                                <Users className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input type="number" min="1" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} data-testid="event-guests"
                                    className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-brand-ink mb-2">Event Date *</label>
                        <div className="relative">
                            <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input type="date" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} data-testid="event-date"
                                className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-brand-ink mb-2">Message (optional)</label>
                        <div className="relative">
                            <MessageSquare className="w-4 h-4 absolute left-4 top-4 text-neutral-400" />
                            <textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} data-testid="event-message"
                                placeholder="Special requirements, menu preferences, venue, etc."
                                className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm resize-none" />
                        </div>
                    </div>

                    <button type="submit" disabled={loading} data-testid="event-submit"
                        className="w-full bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full py-3.5 font-bold transition-colors">
                        {loading ? "Submitting..." : "Request Booking"}
                    </button>
                </form>
            </div>
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
