import { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { Plus, Trash2, Pencil, X, ArrowUp, ArrowDown, Eye, EyeOff, MapPin } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", note: "", sort_order: 0, enabled: true };

/**
 * Admin Delivery Areas management — list, create, edit, delete, enable/disable,
 * reorder via up/down arrows. Mirrors AdminFAQs. Reorder calls
 * POST /admin/delivery-areas/reorder with the full id list after each swap so
 * server-side sort_order stays in sync. The public /delivery page reads
 * /api/delivery-areas, so changes appear within minutes of a crawl.
 */
export default function AdminDeliveryAreas() {
    const [areas, setAreas] = useState([]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        try {
            const { data } = await api.get("/admin/delivery-areas");
            setAreas(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Could not load delivery areas");
        }
    };
    useEffect(() => { load(); }, []);

    const openCreate = () => { setEditing("new"); setForm(EMPTY); };
    const openEdit = (a) => {
        setEditing(a.id);
        setForm({ name: a.name, note: a.note || "", sort_order: a.sort_order, enabled: a.enabled });
    };
    const cancel = () => { setEditing(null); setForm(EMPTY); };

    const save = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            toast.error("Area name is required");
            return;
        }
        setLoading(true);
        try {
            if (editing === "new") {
                await api.post("/admin/delivery-areas", form);
                toast.success("Delivery area added");
            } else {
                await api.put(`/admin/delivery-areas/${editing}`, form);
                toast.success("Delivery area updated");
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
        if (!window.confirm("Delete this delivery area? This cannot be undone.")) return;
        try {
            await api.delete(`/admin/delivery-areas/${id}`);
            toast.success("Delivery area deleted");
            await load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Delete failed");
        }
    };

    const toggleEnabled = async (area) => {
        try {
            await api.put(`/admin/delivery-areas/${area.id}`, { enabled: !area.enabled });
            await load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Toggle failed");
        }
    };

    // Reorder by swapping with neighbour and persisting the new full-list order.
    const move = async (idx, delta) => {
        const newIdx = idx + delta;
        if (newIdx < 0 || newIdx >= areas.length) return;
        const next = [...areas];
        [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
        setAreas(next);  // optimistic UI
        try {
            await api.post("/admin/delivery-areas/reorder", { ids: next.map((a) => a.id) });
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Reorder failed");
            await load();  // roll back to server truth
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8" data-testid="admin-delivery-areas-page">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
                <div>
                    <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mb-1">Delivery Areas</h1>
                    <p className="text-sm text-neutral-500">Add and order the areas you deliver to. These appear on the public /delivery page. Changes appear within minutes.</p>
                </div>
                <button onClick={openCreate} data-testid="area-add"
                    className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white rounded-full px-5 py-3 font-bold transition-colors">
                    <Plus className="w-4 h-4" /> Add Area
                </button>
            </div>

            {editing && (
                <form onSubmit={save} className="bg-white border-2 border-brand-red/30 rounded-2xl p-5 md:p-7 mb-6" data-testid="area-form">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-display font-bold text-lg text-brand-ink">{editing === "new" ? "New Delivery Area" : "Edit Delivery Area"}</h2>
                        <button type="button" onClick={cancel} className="text-neutral-400 hover:text-brand-ink" data-testid="area-form-close">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-brand-ink mb-1.5">Area name</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                data-testid="area-name-input"
                                placeholder="e.g. Johar Town"
                                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-brand-red transition-colors text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-brand-ink mb-1.5">Note <span className="font-normal text-neutral-400">(optional)</span></label>
                            <input
                                value={form.note}
                                onChange={(e) => setForm({ ...form, note: e.target.value })}
                                data-testid="area-note-input"
                                placeholder="e.g. Free delivery · ~35 min"
                                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-brand-red transition-colors text-sm" />
                        </div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!form.enabled}
                                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                                data-testid="area-enabled-toggle"
                                className="accent-brand-red w-4 h-4" />
                            Enabled (visible on the public /delivery page)
                        </label>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button type="submit" disabled={loading} data-testid="area-save"
                            className="bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full px-7 py-3 font-bold transition-colors">
                            {loading ? "Saving…" : editing === "new" ? "Create" : "Save changes"}
                        </button>
                        <button type="button" onClick={cancel} className="text-neutral-500 hover:text-brand-ink px-4 py-3 text-sm font-semibold">Cancel</button>
                    </div>
                </form>
            )}

            <div className="bg-white border border-neutral-200 rounded-2xl divide-y divide-neutral-100" data-testid="area-list">
                {areas.length === 0 ? (
                    <div className="text-center text-neutral-400 py-16 px-4">
                        <MapPin className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
                        <p className="font-semibold mb-1">No delivery areas yet</p>
                        <p className="text-sm">Click <span className="font-bold text-brand-red">Add Area</span> to list where you deliver.</p>
                    </div>
                ) : (
                    areas.map((a, idx) => (
                        <div key={a.id} data-testid={`area-row-${a.id}`} className={`flex items-center gap-3 p-4 md:p-5 ${!a.enabled ? "opacity-60" : ""}`}>
                            <div className="flex flex-col gap-1 shrink-0">
                                <button onClick={() => move(idx, -1)} disabled={idx === 0} data-testid={`area-up-${a.id}`}
                                    className="text-neutral-400 hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed">
                                    <ArrowUp className="w-4 h-4" />
                                </button>
                                <button onClick={() => move(idx, 1)} disabled={idx === areas.length - 1} data-testid={`area-down-${a.id}`}
                                    className="text-neutral-400 hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed">
                                    <ArrowDown className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-display font-bold text-brand-ink truncate">{a.name}</div>
                                {a.note ? <div className="text-sm text-neutral-500 line-clamp-2 mt-0.5">{a.note}</div> : null}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => toggleEnabled(a)} title={a.enabled ? "Disable" : "Enable"} data-testid={`area-toggle-enabled-${a.id}`}
                                    className={`p-2 rounded-full ${a.enabled ? "text-emerald-600 hover:bg-emerald-50" : "text-neutral-400 hover:bg-neutral-100"}`}>
                                    {a.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                                <button onClick={() => openEdit(a)} data-testid={`area-edit-${a.id}`}
                                    className="p-2 rounded-full text-neutral-500 hover:text-brand-ink hover:bg-neutral-100">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => remove(a.id)} data-testid={`area-delete-${a.id}`}
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
