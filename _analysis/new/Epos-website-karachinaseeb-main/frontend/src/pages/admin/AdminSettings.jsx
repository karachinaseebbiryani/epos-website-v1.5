import { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { toast } from "sonner";
import { Save, MapPin, Truck, CreditCard } from "lucide-react";

export default function AdminSettings() {
    const [s, setS] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const { data } = await api.get("/admin/online-settings");
            setS(data);
        } catch (err) {
            toast.error("Failed to load settings");
        }
    };

    const togglePM = (k) => {
        setS({ ...s, payment_methods: { ...s.payment_methods, [k]: !s.payment_methods[k] } });
    };

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put("/admin/online-settings", s);
            toast.success("Settings saved");
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally { setSaving(false); }
    };

    if (!s) return <div className="p-12 text-center text-neutral-400">Loading...</div>;

    return (
        <div data-testid="admin-settings-page">
            <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mb-2">Online Settings</h1>
            <p className="text-neutral-500 mb-8">Configure restaurant location, delivery zones, and payment options</p>

            <form onSubmit={save} className="space-y-6 max-w-3xl">
                {/* Restaurant Location */}
                <Section icon={<MapPin className="w-5 h-5" />} title="Restaurant Location">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Latitude" type="number" step="0.000001" value={s.restaurant_lat} onChange={(v) => setS({ ...s, restaurant_lat: Number(v) })} testid="settings-lat" />
                        <Input label="Longitude" type="number" step="0.000001" value={s.restaurant_lng} onChange={(v) => setS({ ...s, restaurant_lng: Number(v) })} testid="settings-lng" />
                    </div>
                    <p className="text-xs text-neutral-500 mt-2">
                        Tip: Open Google Maps, find your restaurant, right-click and copy the coordinates.
                    </p>
                </Section>

                {/* Delivery Zone */}
                <Section icon={<Truck className="w-5 h-5" />} title="Delivery Charges">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Input label="Free Radius (km)" type="number" step="0.1" value={s.delivery_free_radius_km} onChange={(v) => setS({ ...s, delivery_free_radius_km: Number(v) })} testid="settings-free-radius" />
                        <Input label="Base Fee (Rs.)" type="number" value={s.delivery_base_fee} onChange={(v) => setS({ ...s, delivery_base_fee: Number(v) })} testid="settings-base-fee" />
                        <Input label="Per km (Rs.)" type="number" value={s.delivery_per_km_fee} onChange={(v) => setS({ ...s, delivery_per_km_fee: Number(v) })} testid="settings-per-km" />
                        <Input label="Max Radius (km)" type="number" step="0.5" value={s.delivery_max_radius_km} onChange={(v) => setS({ ...s, delivery_max_radius_km: Number(v) })} testid="settings-max-radius" />
                    </div>
                    <p className="text-xs text-neutral-500 mt-2">
                        Within Free Radius = no charge. Beyond = Base Fee + (extra km × per-km rate). Beyond Max Radius, order rejected.
                    </p>
                </Section>

                {/* Payment Methods */}
                <Section icon={<CreditCard className="w-5 h-5" />} title="Payment Methods">
                    <div className="space-y-2">
                        {[
                            { k: "cod", l: "Cash on Delivery" },
                            { k: "pay_at_restaurant", l: "Pay at Restaurant (pickup)" },
                            { k: "bank_transfer", l: "Bank Transfer / EasyPaisa / JazzCash" },
                            { k: "card", l: "Credit / Debit Card (Stripe)" },
                        ].map((p) => (
                            <label key={p.k} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 cursor-pointer">
                                <input type="checkbox" checked={!!s.payment_methods?.[p.k]} onChange={() => togglePM(p.k)} data-testid={`pm-toggle-${p.k}`} className="accent-brand-red w-4 h-4" />
                                <span className="font-semibold text-brand-ink text-sm">{p.l}</span>
                            </label>
                        ))}
                    </div>
                </Section>

                {/* Bank Details */}
                <Section icon={<CreditCard className="w-5 h-5" />} title="Bank Account">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Account Title" value={s.bank_account_title} onChange={(v) => setS({ ...s, bank_account_title: v })} testid="settings-bank-title" />
                        <Input label="Bank Name" value={s.bank_name} onChange={(v) => setS({ ...s, bank_name: v })} testid="settings-bank-name" />
                        <Input label="Account Number" value={s.bank_account_number} onChange={(v) => setS({ ...s, bank_account_number: v })} testid="settings-bank-number" />
                        <Input label="IBAN" value={s.iban || ""} onChange={(v) => setS({ ...s, iban: v })} testid="settings-iban" />
                    </div>
                </Section>

                {/* EasyPaisa / JazzCash */}
                <Section icon={<CreditCard className="w-5 h-5" />} title="EasyPaisa & JazzCash">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="EasyPaisa Number" value={s.easypaisa_number} onChange={(v) => setS({ ...s, easypaisa_number: v })} testid="settings-easypaisa-number" />
                        <Input label="EasyPaisa Account Title" value={s.easypaisa_account_title || ""} onChange={(v) => setS({ ...s, easypaisa_account_title: v })} testid="settings-easypaisa-title" />
                        <Input label="JazzCash Number" value={s.jazzcash_number} onChange={(v) => setS({ ...s, jazzcash_number: v })} testid="settings-jazzcash-number" />
                        <Input label="JazzCash Account Title" value={s.jazzcash_account_title || ""} onChange={(v) => setS({ ...s, jazzcash_account_title: v })} testid="settings-jazzcash-title" />
                    </div>
                </Section>

                {/* WhatsApp Notifications */}
                <Section icon={<CreditCard className="w-5 h-5" />} title="WhatsApp Notifications (Twilio)">
                    <Input label="Twilio WhatsApp From Number" value={s.twilio_whatsapp_from || ""} onChange={(v) => setS({ ...s, twilio_whatsapp_from: v })} testid="settings-twilio-from" />
                    <p className="text-xs text-neutral-500 mt-2">
                        Format: <code>whatsapp:+14155238886</code> (Twilio sandbox) or your approved business sender. Customer must first send the sandbox join code from their phone to receive messages. Twilio Account SID and Auth Token are set in the server <code>.env</code> file.
                    </p>
                </Section>

                <button type="submit" disabled={saving} data-testid="settings-save"
                    className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full px-7 py-3.5 font-bold transition-colors">
                    <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Settings"}
                </button>
            </form>
        </div>
    );
}

function Section({ icon, title, children }) {
    return (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg text-brand-ink mb-4 flex items-center gap-2">
                <span className="text-brand-red">{icon}</span> {title}
            </h2>
            {children}
        </div>
    );
}

function Input({ label, type = "text", value, onChange, testid, step }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-brand-ink mb-2">{label}</label>
            <input type={type} step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value)} data-testid={testid}
                className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
        </div>
    );
}
