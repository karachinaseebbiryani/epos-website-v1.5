import { useEffect, useRef, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { toast } from "sonner";
import { Bell, Send, Loader2, Users, History, Image as ImageIcon, X, RefreshCw, ShieldAlert, ShieldCheck, Copy } from "lucide-react";

/**
 * AdminNotifications
 * ------------------
 * Marketing-style broadcast UI. Sits on top of /api/admin/notifications/* and
 * /api/admin/push/vapid/*.
 *
 * Flow:
 *  - Type title + message (+ optional deep-link URL + banner image).
 *  - "Send test" pushes only to the admin's own subscriptions.
 *  - "Send to all" fans out to every push_subscriptions doc.
 *  - "Regenerate keys" rotates the VAPID keypair when notifications start failing
 *    in production (operator usually pasted env vars with stripped newlines).
 *  - The health badge tells the operator at a glance whether the configured private
 *    key actually parses — no more silent "all sends failed" mysteries.
 */
export default function AdminNotifications() {
    const [form, setForm] = useState({ title: "", body: "", url: "/", image: "" });
    const [stats, setStats] = useState({ subscriber_count: 0, last_broadcast: null });
    const [history, setHistory] = useState([]);
    const [vapid, setVapid] = useState(null); // health diagnostic
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null); // "test" | "broadcast" | "upload" | "regen"
    const [newKeys, setNewKeys] = useState(null); // shown after regenerate
    const fileInputRef = useRef(null);

    const refresh = async () => {
        try {
            const [s, h, v] = await Promise.all([
                api.get("/admin/notifications/stats"),
                api.get("/admin/notifications/history"),
                api.get("/admin/push/vapid/status").catch(() => ({ data: null })),
            ]);
            setStats(s.data);
            setHistory(h.data);
            setVapid(v.data);
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { refresh(); }, []);

    const uploadImage = async (file) => {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error("Banner must be 2MB or smaller.");
            return;
        }
        setBusy("upload");
        try {
            const fd = new FormData();
            fd.append("file", file);
            const { data } = await api.post("/admin/notifications/upload-image", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setForm((f) => ({ ...f, image: data.image_url }));
            toast.success("Banner uploaded.");
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setBusy(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const send = async (testOnly) => {
        if (!form.title.trim() || !form.body.trim()) {
            toast.error("Title and message are required.");
            return;
        }
        setBusy(testOnly ? "test" : "broadcast");
        try {
            const { data } = await api.post("/admin/notifications/broadcast", {
                title: form.title.trim(),
                body: form.body.trim(),
                url: form.url || "/",
                image: form.image || null,
                test_only: testOnly,
            });
            if (testOnly) {
                if (data.failed > 0 && data.errors_sample?.length) {
                    toast.error(`Test failed: ${data.errors_sample[0]}`);
                } else {
                    toast.success(`Test sent · ${data.sent} delivered, ${data.failed} failed`);
                }
            } else {
                if (data.failed > 0 && data.errors_sample?.length) {
                    toast.warning(`Sent ${data.sent}/${data.audience_size}. First error: ${data.errors_sample[0]}`, { duration: 8000 });
                } else {
                    toast.success(`Broadcast complete · ${data.sent} delivered, ${data.failed} failed (audience ${data.audience_size})`);
                }
                setForm({ title: "", body: "", url: "/", image: "" });
            }
            refresh();
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setBusy(null);
        }
    };

    const regenerate = async () => {
        if (!window.confirm("This rotates your VAPID keys and unsubscribes every device. Users will be re-prompted next time they open the site. Continue?")) return;
        setBusy("regen");
        try {
            const { data } = await api.post("/admin/push/vapid/regenerate");
            setNewKeys(data);
            toast.success(`Keys regenerated · ${data.subscriptions_wiped} stale subscriptions wiped`);
            refresh();
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setBusy(null);
        }
    };

    const remaining = 140 - form.body.length;

    return (
        <div className="p-6 md:p-10 max-w-5xl mx-auto" data-testid="admin-notifications">
            <header className="mb-8">
                <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Marketing</span>
                <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mt-1">Notifications</h1>
                <p className="text-sm text-neutral-500 mt-1">Send a push notification to every customer who has opted in. Tapping the notification deep-links them to the URL you set.</p>
            </header>

            {/* VAPID health */}
            {vapid && (
                <VapidHealthCard vapid={vapid} onRegenerate={regenerate} busy={busy === "regen"} />
            )}

            {/* Regenerate output — only shown right after a successful rotate */}
            {newKeys && (
                <NewKeysReveal data={newKeys} onClose={() => setNewKeys(null)} />
            )}

            {/* Subscriber stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <StatCard icon={<Users className="w-5 h-5" />} label="Subscribers" value={loading ? "—" : stats.subscriber_count} testid="admin-notif-subscribers" />
                <StatCard icon={<Send className="w-5 h-5" />} label="Last sent" value={stats.last_broadcast ? `${stats.last_broadcast.sent} of ${stats.last_broadcast.audience_size}` : "Never"} testid="admin-notif-last-sent" />
                <StatCard icon={<History className="w-5 h-5" />} label="Broadcasts logged" value={history.length} testid="admin-notif-history-count" />
            </div>

            {/* Composer */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-bold text-lg text-brand-ink flex items-center gap-2 mb-5">
                    <Bell className="w-5 h-5 text-brand-red" /> New notification
                </h2>
                <div className="space-y-4">
                    <Field label="Title" hint="Short headline — first thing customers see.">
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            maxLength={60}
                            placeholder="Weekend special — 20% off all BBQ platters"
                            data-testid="admin-notif-title"
                            className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-red focus:bg-white rounded-xl px-4 py-2.5 outline-none"
                        />
                    </Field>
                    <Field label="Message" hint={`${remaining} characters left · keep it punchy.`}>
                        <textarea
                            value={form.body}
                            onChange={(e) => setForm({ ...form, body: e.target.value })}
                            maxLength={140}
                            placeholder="Tap to grab today's deal — limited to the first 50 orders."
                            data-testid="admin-notif-body"
                            rows={3}
                            className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-red focus:bg-white rounded-xl px-4 py-2.5 outline-none resize-none"
                        />
                    </Field>
                    <Field label="Banner image (optional)" hint="JPG/PNG/WebP, max 2MB. Shown as a large hero on Android & macOS. Skipped silently on older devices.">
                        {form.image ? (
                            <div className="relative rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50">
                                <img src={form.image} alt="Banner preview" className="w-full h-40 object-cover" data-testid="admin-notif-banner-preview" />
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, image: "" })}
                                    data-testid="admin-notif-banner-remove"
                                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white inline-flex items-center justify-center"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={busy === "upload"}
                                data-testid="admin-notif-banner-upload"
                                className="w-full h-32 border-2 border-dashed border-neutral-300 hover:border-brand-red hover:bg-brand-red/5 rounded-xl flex flex-col items-center justify-center gap-2 text-neutral-500 text-sm transition-colors"
                            >
                                {busy === "upload" ? (
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                ) : (
                                    <>
                                        <ImageIcon className="w-6 h-6" />
                                        <span>Upload from device</span>
                                    </>
                                )}
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => uploadImage(e.target.files?.[0])}
                            className="hidden"
                            data-testid="admin-notif-banner-input"
                        />
                    </Field>
                    <Field label="Open this URL when tapped" hint="Use a path on your site like /offers or /menu. Defaults to home page.">
                        <input
                            type="text"
                            value={form.url}
                            onChange={(e) => setForm({ ...form, url: e.target.value })}
                            placeholder="/offers"
                            data-testid="admin-notif-url"
                            className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-red focus:bg-white rounded-xl px-4 py-2.5 outline-none font-mono text-sm"
                        />
                    </Field>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                    <button
                        type="button"
                        onClick={() => send(true)}
                        disabled={busy !== null || !form.title || !form.body}
                        data-testid="admin-notif-test"
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-yellow hover:bg-brand-yellow/90 text-brand-ink font-bold uppercase tracking-wider text-xs py-3 rounded-full disabled:opacity-50"
                    >
                        {busy === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send test (to me)
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!window.confirm(`Send to ALL ${stats.subscriber_count} subscriber(s)? This can't be undone.`)) return;
                            send(false);
                        }}
                        disabled={busy !== null || !form.title || !form.body || stats.subscriber_count === 0}
                        data-testid="admin-notif-broadcast"
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white font-bold uppercase tracking-wider text-xs py-3 rounded-full disabled:opacity-50"
                    >
                        {busy === "broadcast" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send to all {stats.subscriber_count > 0 ? `(${stats.subscriber_count})` : ""}
                    </button>
                </div>
            </div>

            {/* History */}
            <div className="mt-8">
                <h2 className="font-display font-bold text-lg text-brand-ink mb-3 flex items-center gap-2">
                    <History className="w-5 h-5 text-brand-red" /> Recent broadcasts
                </h2>
                {history.length === 0 ? (
                    <div className="text-sm text-neutral-500 bg-neutral-50 rounded-xl p-6 text-center">No broadcasts yet. Your first one will show up here.</div>
                ) : (
                    <ul className="space-y-2" data-testid="admin-notif-history">
                        {history.map((h) => (
                            <li key={h.id} className="bg-white border border-neutral-200 rounded-xl p-4 flex items-start gap-4">
                                {h.image && (
                                    <img src={h.image} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-display font-bold text-brand-ink">{h.title}</div>
                                    <div className="text-sm text-neutral-600 line-clamp-2">{h.body}</div>
                                    <div className="text-[11px] text-neutral-400 mt-1">
                                        {new Date(h.created_at).toLocaleString()} · sent by {h.sent_by || "—"}
                                        {h.url && h.url !== "/" && (
                                            <> · linked to <span className="font-mono">{h.url}</span></>
                                        )}
                                    </div>
                                    {h.failed > 0 && h.errors_sample?.length > 0 && (
                                        <details className="mt-2">
                                            <summary className="text-[11px] text-red-600 cursor-pointer">View error ({h.errors_sample.length})</summary>
                                            <pre className="text-[10px] text-red-700 bg-red-50 p-2 rounded mt-1 whitespace-pre-wrap break-words">{h.errors_sample.join("\n")}</pre>
                                        </details>
                                    )}
                                </div>
                                <div className="text-right text-xs flex-shrink-0">
                                    <div className="text-emerald-700 font-bold">{h.sent} sent</div>
                                    {h.failed > 0 && <div className="text-red-600">{h.failed} failed</div>}
                                    <div className="text-neutral-400">of {h.audience_size}</div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function VapidHealthCard({ vapid, onRegenerate, busy }) {
    const healthy = vapid.parsable;
    return (
        <div
            className={`mb-6 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 ${healthy ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}
            data-testid="admin-vapid-health"
        >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${healthy ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {healthy ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className={`font-display font-bold text-sm ${healthy ? "text-emerald-900" : "text-red-900"}`}>
                    {healthy ? "Push keys healthy" : "Push keys NOT parseable"}
                </div>
                <p className={`text-xs mt-0.5 ${healthy ? "text-emerald-800" : "text-red-800"}`}>
                    {healthy
                        ? `Configured from ${vapid.source}. ${vapid.public_key_preview} · private key is PEM with newlines.`
                        : vapid.parse_error || "Private key can't be loaded by cryptography. Likely cause: env var pasted without newlines."}
                </p>
            </div>
            <button
                type="button"
                onClick={onRegenerate}
                disabled={busy}
                data-testid="admin-vapid-regenerate"
                className="inline-flex items-center gap-2 bg-brand-ink hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-full px-4 py-2 disabled:opacity-60"
            >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Regenerate keys
            </button>
        </div>
    );
}

function NewKeysReveal({ data, onClose }) {
    const copy = (text) => {
        navigator.clipboard?.writeText(text);
        toast.success("Copied to clipboard");
    };
    return (
        <div className="mb-6 rounded-2xl bg-brand-ink text-white p-5" data-testid="admin-new-vapid-keys">
            <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-sm">New VAPID keys generated</div>
                    <p className="text-xs text-white/70 mt-1">{data.subscriptions_wiped} stale subscription(s) cleared. For production: copy these into your hosting environment as <code className="font-mono text-brand-yellow">VAPID_PUBLIC_KEY</code> and <code className="font-mono text-brand-yellow">VAPID_PRIVATE_KEY</code>, then redeploy.</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    data-testid="admin-new-vapid-keys-close"
                    className="w-8 h-8 rounded-full hover:bg-white/10 inline-flex items-center justify-center"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="mt-4 space-y-3">
                <KeyRow label="VAPID_PUBLIC_KEY" value={data.public_key} onCopy={() => copy(data.public_key)} />
                <KeyRow label="VAPID_PRIVATE_KEY" value={data.private_key} onCopy={() => copy(data.private_key)} multiline />
            </div>
        </div>
    );
}

function KeyRow({ label, value, onCopy, multiline = false }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-white/60 font-bold">{label}</span>
                <button
                    type="button"
                    onClick={onCopy}
                    className="text-[11px] text-brand-yellow hover:text-yellow-200 inline-flex items-center gap-1"
                >
                    <Copy className="w-3 h-3" /> Copy
                </button>
            </div>
            <pre className={`bg-black/40 rounded-lg p-3 text-[10px] font-mono text-white/80 ${multiline ? "whitespace-pre overflow-x-auto" : "truncate"}`}>{value}</pre>
        </div>
    );
}

function StatCard({ icon, label, value, testid }) {
    return (
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center gap-3" data-testid={testid}>
            <div className="w-10 h-10 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center">{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">{label}</div>
                <div className="font-display font-black text-xl text-brand-ink truncate">{value}</div>
            </div>
        </div>
    );
}

function Field({ label, hint, children }) {
    return (
        <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">{label}</span>
            {children}
            {hint && <span className="block text-[11px] text-neutral-400 mt-1">{hint}</span>}
        </label>
    );
}
