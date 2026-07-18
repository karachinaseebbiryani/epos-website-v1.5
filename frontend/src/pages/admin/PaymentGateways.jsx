import { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { toast } from "sonner";
import { Save, CreditCard, Smartphone, Wallet, Copy, Info } from "lucide-react";

// Admin configuration for the hosted payment gateways (EasyPaisa, JazzCash,
// and — pre-staged — PayFast). Secrets are write-only: the backend returns
// only <field>_set / <field>_last4, and a blank input means "keep the saved
// value". Saved to GET/PUT /admin/payment-gateways.

const SECRET_FIELDS = ["hash_key", "inquiry_password", "password", "integrity_salt", "secured_key"];

export default function PaymentGateways() {
    const [s, setS] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const { data } = await api.get("/admin/payment-gateways");
            setS(data);
        } catch (err) {
            toast.error("Failed to load payment gateway settings");
        }
    };

    const update = (gw, patch) => setS({ ...s, [gw]: { ...s[gw], ...patch } });

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Strip blank secrets so the backend keeps the stored values.
            const payload = {};
            for (const gw of ["easypaisa", "jazzcash", "payfast"]) {
                const cfg = { ...s[gw] };
                delete cfg.callback_url;
                delete cfg.note;
                for (const f of SECRET_FIELDS) {
                    delete cfg[`${f}_set`];
                    delete cfg[`${f}_last4`];
                    if (!(cfg[f] || "").trim()) delete cfg[f];
                }
                payload[gw] = cfg;
            }
            const { data } = await api.put("/admin/payment-gateways", payload);
            setS(data);
            toast.success("Payment gateway settings saved");
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally { setSaving(false); }
    };

    if (!s) return <div className="p-12 text-center text-neutral-400">Loading...</div>;

    return (
        <div data-testid="admin-payment-gateways-page">
            <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mb-2">Payment Gateways</h1>
            <p className="text-neutral-500 mb-8">
                Configure hosted online payments. Enabled gateways appear as payment options at checkout.
                Test in Sandbox mode first — going live only requires switching the mode and entering live credentials.
            </p>

            <form onSubmit={save} className="space-y-6 max-w-3xl">
                {/* EasyPaisa */}
                <GatewayCard
                    gw="easypaisa" title="EasyPaisa" icon={<Smartphone className="w-5 h-5" />}
                    cfg={s.easypaisa} update={(patch) => update("easypaisa", patch)}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Store ID" value={s.easypaisa.store_id || ""}
                            onChange={(v) => update("easypaisa", { store_id: v })}
                            testid="pg-easypaisa-store-id" />
                        <SecretInput label="Hash Key (16 characters)" field="hash_key" cfg={s.easypaisa}
                            onChange={(v) => update("easypaisa", { hash_key: v })}
                            testid="pg-easypaisa-hash-key" />
                        <Input label="Inquiry API Username (optional)" value={s.easypaisa.inquiry_username || ""}
                            onChange={(v) => update("easypaisa", { inquiry_username: v })}
                            testid="pg-easypaisa-inquiry-username" />
                        <SecretInput label="Inquiry API Password (optional)" field="inquiry_password" cfg={s.easypaisa}
                            onChange={(v) => update("easypaisa", { inquiry_password: v })}
                            testid="pg-easypaisa-inquiry-password" />
                    </div>
                    <p className="text-xs text-neutral-500 mt-3">
                        Store ID and Hash Key are in the Easypay merchant portal (Account Settings → Generate Hashkey).
                        The optional Inquiry API credentials enable automatic payment confirmation — without them,
                        successful payments appear as <b>Pending Verification</b> for manual approval in Orders.
                    </p>
                    <CallbackUrl url={s.easypaisa.callback_url}
                        caption="Sent automatically with each transaction as the postBackURL — no portal registration needed."
                        testid="pg-easypaisa-callback" />
                </GatewayCard>

                {/* JazzCash */}
                <GatewayCard
                    gw="jazzcash" title="JazzCash" icon={<Wallet className="w-5 h-5" />}
                    cfg={s.jazzcash} update={(patch) => update("jazzcash", patch)}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Merchant ID" value={s.jazzcash.merchant_id || ""}
                            onChange={(v) => update("jazzcash", { merchant_id: v })}
                            testid="pg-jazzcash-merchant-id" />
                        <SecretInput label="Password" field="password" cfg={s.jazzcash}
                            onChange={(v) => update("jazzcash", { password: v })}
                            testid="pg-jazzcash-password" />
                        <SecretInput label="Integrity Salt" field="integrity_salt" cfg={s.jazzcash}
                            onChange={(v) => update("jazzcash", { integrity_salt: v })}
                            testid="pg-jazzcash-integrity-salt" />
                    </div>
                    <p className="text-xs text-neutral-500 mt-3">
                        Credentials come from the JazzCash merchant portal (sandbox: self-register at
                        sandbox.jazzcash.com.pk). Amounts are charged in PKR.
                    </p>
                    <CallbackUrl url={s.jazzcash.callback_url}
                        caption="Register this Return URL (or its prefix) in the JazzCash merchant portal before going live."
                        testid="pg-jazzcash-callback" />
                </GatewayCard>

                {/* PayFast — saved but inert; live integration still runs on env vars */}
                <GatewayCard
                    gw="payfast" title="PayFast" icon={<CreditCard className="w-5 h-5" />}
                    cfg={s.payfast} update={(patch) => update("payfast", patch)}
                >
                    <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800" data-testid="pg-payfast-note">
                        <Info className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>
                            These credentials are <b>saved but not yet used</b> — PayFast currently runs from server
                            environment variables (<code>PAYFAST_MERCHANT_ID</code> / <code>PAYFAST_SECURED_KEY</code> /
                            <code>PAYFAST_ENV</code>). This card pre-stages the switch to database configuration;
                            enabling it here has no effect on the live PayFast integration yet.
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Merchant ID" value={s.payfast.merchant_id || ""}
                            onChange={(v) => update("payfast", { merchant_id: v })}
                            testid="pg-payfast-merchant-id" />
                        <SecretInput label="Secured Key" field="secured_key" cfg={s.payfast}
                            onChange={(v) => update("payfast", { secured_key: v })}
                            testid="pg-payfast-secured-key" />
                    </div>
                </GatewayCard>

                <button type="submit" disabled={saving} data-testid="pg-save"
                    className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full px-7 py-3.5 font-bold transition-colors">
                    <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Gateways"}
                </button>
            </form>
        </div>
    );
}

function GatewayCard({ gw, title, icon, cfg, update, children }) {
    return (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-display font-bold text-lg text-brand-ink flex items-center gap-2">
                    <span className="text-brand-red">{icon}</span> {title}
                </h2>
                <div className="flex items-center gap-4">
                    {/* Sandbox / Live */}
                    <div className="flex items-center gap-3 text-sm">
                        {["sandbox", "live"].map((m) => (
                            <label key={m} className="inline-flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" name={`pg-${gw}-mode`} checked={cfg.mode === m}
                                    onChange={() => update({ mode: m })}
                                    data-testid={`pg-${gw}-mode-${m}`}
                                    className="accent-brand-red" />
                                <span className={cfg.mode === m ? "font-semibold text-brand-ink" : "text-neutral-500"}>
                                    {m === "sandbox" ? "Sandbox" : "Live"}
                                </span>
                            </label>
                        ))}
                    </div>
                    {/* Enable */}
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={!!cfg.enabled}
                            onChange={(e) => update({ enabled: e.target.checked })}
                            data-testid={`pg-${gw}-enabled`}
                            className="accent-brand-red w-4 h-4" />
                        <span className="font-semibold text-brand-ink">Enabled</span>
                    </label>
                </div>
            </div>
            {cfg.mode === "live" && (
                <div className="mb-4 text-xs font-semibold text-brand-red" data-testid={`pg-${gw}-live-warning`}>
                    Live mode — real customer payments will be charged.
                </div>
            )}
            {children}
        </div>
    );
}

function CallbackUrl({ url, caption, testid }) {
    if (!url) return null;
    const copy = () => {
        navigator.clipboard.writeText(url).then(
            () => toast.success("Copied"),
            () => toast.error("Could not copy"),
        );
    };
    return (
        <div className="mt-4">
            <label className="block text-sm font-semibold text-brand-ink mb-2">Callback / Return URL</label>
            <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs break-all" data-testid={testid}>
                    {url}
                </code>
                <button type="button" onClick={copy} data-testid={`${testid}-copy`}
                    className="p-2.5 rounded-xl border border-neutral-200 hover:border-brand-red text-neutral-500 hover:text-brand-red transition-colors">
                    <Copy className="w-4 h-4" />
                </button>
            </div>
            <p className="text-xs text-neutral-500 mt-1">{caption}</p>
        </div>
    );
}

function Input({ label, type = "text", value, onChange, testid, placeholder }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-brand-ink mb-2">{label}</label>
            <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
                data-testid={testid} placeholder={placeholder}
                className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
        </div>
    );
}

function SecretInput({ label, field, cfg, onChange, testid }) {
    const isSet = !!cfg[`${field}_set`];
    const last4 = cfg[`${field}_last4`] || "";
    return (
        <div>
            <label className="block text-sm font-semibold text-brand-ink mb-2">{label}</label>
            <input type="password" value={cfg[field] ?? ""} onChange={(e) => onChange(e.target.value)}
                data-testid={testid} autoComplete="new-password"
                placeholder={isSet ? `Saved (…${last4}) — leave blank to keep` : "Not set"}
                className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
        </div>
    );
}
