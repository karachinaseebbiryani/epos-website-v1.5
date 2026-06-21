import { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { toast } from "sonner";
import { Bell, Send, Loader2, Users, History, ExternalLink } from "lucide-react";

/**
 * AdminNotifications
 * ------------------
 * Marketing-style broadcast UI. Sits on top of the existing /api/admin/notifications
 * push-notification backend — does NOT regenerate VAPID keys (those are already
 * persisted via env vars in production).
 *
 * Flow:
 *  - Type title + message (+ optional deep-link URL).
 *  - "Send test" pushes only to your own subscriptions so you can preview on your phone.
 *  - "Send to all" fans out to every push_subscriptions doc.
 *  - History below shows the last 50 broadcasts with sent / failed counts.
 */
export default function AdminNotifications() {
    const [form, setForm] = useState({ title: "", body: "", url: "/" });
    const [stats, setStats] = useState({ subscriber_count: 0, last_broadcast: null });
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null); // "test" | "broadcast"

    const refresh = async () => {
        try {
            const [s, h] = await Promise.all([
                api.get("/admin/notifications/stats"),
                api.get("/admin/notifications/history"),
            ]);
            setStats(s.data);
            setHistory(h.data);
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { refresh(); }, []);

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
                test_only: testOnly,
            });
            if (testOnly) {
                toast.success(`Test sent · ${data.sent} delivered, ${data.failed} failed`);
            } else {
                toast.success(`Broadcast complete · ${data.sent} delivered, ${data.failed} failed (audience ${data.audience_size})`);
                setForm({ title: "", body: "", url: "/" });
            }
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
                            placeholder="🔥 Weekend special — 20% off all BBQ platters"
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
                                <div className="flex-1 min-w-0">
                                    <div className="font-display font-bold text-brand-ink">{h.title}</div>
                                    <div className="text-sm text-neutral-600 line-clamp-2">{h.body}</div>
                                    <div className="text-[11px] text-neutral-400 mt-1">
                                        {new Date(h.created_at).toLocaleString()} · sent by {h.sent_by || "—"}
                                        {h.url && h.url !== "/" && (
                                            <> · linked to <span className="font-mono">{h.url}</span></>
                                        )}
                                    </div>
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

// Keep the unused import linter quiet — ExternalLink is referenced once you add link previews.
// eslint-disable-next-line no-unused-expressions
ExternalLink;
