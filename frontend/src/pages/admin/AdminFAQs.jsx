import { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { Plus, Trash2, Pencil, X, ArrowUp, ArrowDown, Eye, EyeOff, HelpCircle } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { question: "", answer: "", sort_order: 0, enabled: true };

/**
 * Admin FAQ management — list, create, edit, delete, enable/disable, reorder
 * via up/down arrows. Reorder calls POST /admin/faqs/reorder with the full
 * id list after each swap so server-side sort_order stays in sync. The public
 * /faq page polls /api/faqs and auto-rebuilds its FAQPage JSON-LD schema, so
 * search engines pick up changes within ~24h of crawl.
 */
export default function AdminFAQs() {
    const [faqs, setFaqs] = useState([]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        try {
            const { data } = await api.get("/admin/faqs");
            setFaqs(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Could not load FAQs");
        }
    };
    useEffect(() => { load(); }, []);

    const openCreate = () => { setEditing("new"); setForm(EMPTY); };
    const openEdit = (f) => {
        setEditing(f.id);
        setForm({ question: f.question, answer: f.answer, sort_order: f.sort_order, enabled: f.enabled });
    };
    const cancel = () => { setEditing(null); setForm(EMPTY); };

    const save = async (e) => {
        e.preventDefault();
        if (!form.question.trim() || !form.answer.trim()) {
            toast.error("Both question and answer are required");
            return;
        }
        setLoading(true);
        try {
            if (editing === "new") {
                await api.post("/admin/faqs", form);
                toast.success("FAQ created");
            } else {
                await api.put(`/admin/faqs/${editing}`, form);
                toast.success("FAQ updated");
            }
            cancel();
            await load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Save failed");
        } finally {
            setLoading(false);
        }
    };

    const remove = async (id) => {
        if (!window.confirm("Delete this FAQ? This cannot be undone.")) return;
        try {
            await api.delete(`/admin/faqs/${id}`);
            toast.success("FAQ deleted");
            await load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Delete failed");
        }
    };

    const toggleEnabled = async (faq) => {
        try {
            await api.put(`/admin/faqs/${faq.id}`, { enabled: !faq.enabled });
            await load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Toggle failed");
        }
    };

    // Reorder by swapping with neighbour and persisting the new full-list order.
    const move = async (idx, delta) => {
        const newIdx = idx + delta;
        if (newIdx < 0 || newIdx >= faqs.length) return;
        const next = [...faqs];
        [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
        setFaqs(next);  // optimistic UI
        try {
            await api.post("/admin/faqs/reorder", { ids: next.map((f) => f.id) });
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Reorder failed");
            await load();  // roll back to server truth
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8" data-testid="admin-faqs-page">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
                <div>
                    <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mb-1">FAQs</h1>
                    <p className="text-sm text-neutral-500">Add and order questions shown on the public /faq page. Changes appear within minutes.</p>
                </div>
                <button onClick={openCreate} data-testid="faq-add"
                    className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white rounded-full px-5 py-3 font-bold transition-colors">
                    <Plus className="w-4 h-4" /> Add FAQ
                </button>
            </div>

            {editing && (
                <form onSubmit={save} className="bg-white border-2 border-brand-red/30 rounded-2xl p-5 md:p-7 mb-6" data-testid="faq-form">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-display font-bold text-lg text-brand-ink">{editing === "new" ? "New FAQ" : "Edit FAQ"}</h2>
                        <button type="button" onClick={cancel} className="text-neutral-400 hover:text-brand-ink" data-testid="faq-form-close">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-brand-ink mb-1.5">Question</label>
                            <input
                                value={form.question}
                                onChange={(e) => setForm({ ...form, question: e.target.value })}
                                data-testid="faq-question-input"
                                placeholder="e.g. How long does delivery take?"
                                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-brand-red transition-colors text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-brand-ink mb-1.5">Answer</label>
                            <textarea
                                value={form.answer}
                                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                                data-testid="faq-answer-input"
                                rows={5}
                                placeholder="Plain-text answer. Line breaks are preserved on the public page."
                                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-brand-red transition-colors text-sm" />
                        </div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!form.enabled}
                                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                                data-testid="faq-enabled-toggle"
                                className="accent-brand-red w-4 h-4" />
                            Enabled (visible on the public /faq page)
                        </label>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button type="submit" disabled={loading} data-testid="faq-save"
                            className="bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full px-7 py-3 font-bold transition-colors">
                            {loading ? "Saving…" : editing === "new" ? "Create" : "Save changes"}
                        </button>
                        <button type="button" onClick={cancel} className="text-neutral-500 hover:text-brand-ink px-4 py-3 text-sm font-semibold">Cancel</button>
                    </div>
                </form>
            )}

            <div className="bg-white border border-neutral-200 rounded-2xl divide-y divide-neutral-100" data-testid="faq-list">
                {faqs.length === 0 ? (
                    <div className="text-center text-neutral-400 py-16 px-4">
                        <HelpCircle className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
                        <p className="font-semibold mb-1">No FAQs yet</p>
                        <p className="text-sm">Click <span className="font-bold text-brand-red">Add FAQ</span> to create your first one.</p>
                    </div>
                ) : (
                    faqs.map((f, idx) => (
                        <div key={f.id} data-testid={`faq-row-${f.id}`} className={`flex items-center gap-3 p-4 md:p-5 ${!f.enabled ? "opacity-60" : ""}`}>
                            <div className="flex flex-col gap-1 shrink-0">
                                <button onClick={() => move(idx, -1)} disabled={idx === 0} data-testid={`faq-up-${f.id}`}
                                    className="text-neutral-400 hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed">
                                    <ArrowUp className="w-4 h-4" />
                                </button>
                                <button onClick={() => move(idx, 1)} disabled={idx === faqs.length - 1} data-testid={`faq-down-${f.id}`}
                                    className="text-neutral-400 hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed">
                                    <ArrowDown className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-display font-bold text-brand-ink truncate">{f.question}</div>
                                <div className="text-sm text-neutral-500 line-clamp-2 mt-0.5 whitespace-pre-line">{f.answer}</div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => toggleEnabled(f)} title={f.enabled ? "Disable" : "Enable"} data-testid={`faq-toggle-enabled-${f.id}`}
                                    className={`p-2 rounded-full ${f.enabled ? "text-emerald-600 hover:bg-emerald-50" : "text-neutral-400 hover:bg-neutral-100"}`}>
                                    {f.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                                <button onClick={() => openEdit(f)} data-testid={`faq-edit-${f.id}`}
                                    className="p-2 rounded-full text-neutral-500 hover:text-brand-ink hover:bg-neutral-100">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => remove(f.id)} data-testid={`faq-delete-${f.id}`}
                                    className="p-2 rounded-full text-brand-red hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
