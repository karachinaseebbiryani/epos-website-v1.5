import { useEffect, useState } from "react";
import api, { formatApiError, resolveImageUrl } from "../../lib/api";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { title: "", description: "", discount_percent: 0, discount_amount: 0, coupon_code: "", image_url: "", active: true, min_order_amount: 0, valid_until: "" };

// <input type="datetime-local"> works in local time; the API stores UTC ISO.
const isoToLocalInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
};
const localInputToIso = (local) => {
    if (!local) return null;
    const d = new Date(local); // parsed as local time
    return isNaN(d.getTime()) ? null : d.toISOString();
};

export default function AdminOffers() {
    const [offers, setOffers] = useState([]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);

    const load = async () => {
        const { data } = await api.get("/offers", { params: { active_only: false } });
        setOffers(data);
    };
    useEffect(() => { load(); }, []);

    const openCreate = () => { setEditing("new"); setForm(EMPTY); };
    const openEdit = (o) => { setEditing(o.id); setForm({ title: o.title, description: o.description, discount_percent: o.discount_percent, discount_amount: o.discount_amount, coupon_code: o.coupon_code, image_url: o.image_url, active: o.active, min_order_amount: Number(o.min_order_amount || 0), valid_until: isoToLocalInput(o.valid_until) }); };

    const save = async (e) => {
        e.preventDefault();
        try {
            // Convert the local datetime input back to a UTC ISO string (or null).
            const validUntilIso = localInputToIso(form.valid_until);
            // Guard: a past expiry (e.g. date picked but time left at 00:00) makes the
            // offer invisible to customers immediately — almost never intended.
            if (validUntilIso && new Date(validUntilIso).getTime() <= Date.now()) {
                if (!confirm("The 'valid until' time is already in the past, so customers will NOT see this offer. Save anyway?")) return;
            }
            const payload = { ...form, valid_until: validUntilIso };
            if (editing === "new") {
                await api.post("/offers", payload);
                toast.success("Offer created");
            } else {
                await api.put(`/offers/${editing}`, payload);
                toast.success("Offer updated");
            }
            setEditing(null);
            load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        }
    };

    const remove = async (id) => {
        if (!confirm("Delete this offer?")) return;
        await api.delete(`/offers/${id}`);
        toast.success("Deleted");
        load();
    };

    return (
        <div data-testid="admin-offers-page">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
                <div>
                    <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink">Offers</h1>
                    <p className="text-neutral-500 mt-1">{offers.length} total · {offers.filter((o) => o.active).length} active</p>
                </div>
                <button onClick={openCreate} data-testid="offers-add-button"
                    className="inline-flex items-center gap-2 bg-brand-red text-white rounded-full px-5 py-2.5 font-semibold text-sm hover:bg-brand-red-dark transition-colors">
                    <Plus className="w-4 h-4" /> Add Offer
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {offers.map((o) => (
                    <div key={o.id} data-testid={`admin-offer-${o.id}`} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                        <div className="aspect-[4/3] bg-neutral-100 overflow-hidden">
                            {o.image_url && o.image_url.trim() && <img src={resolveImageUrl(o.image_url)} alt={o.title} className="w-full h-full object-cover" />}
                        </div>
                        <div className="p-4">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="font-display font-bold text-brand-ink">{o.title}</h3>
                                {o.valid_until && new Date(o.valid_until).getTime() <= Date.now()
                                    ? <span className="text-[10px] uppercase font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">Expired</span>
                                    : o.active ? <span className="text-[10px] uppercase font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">Active</span> : <span className="text-[10px] uppercase font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">Inactive</span>}
                            </div>
                            <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{o.description}</p>
                            {o.coupon_code && <p className="text-xs font-mono text-brand-red mt-2 font-bold">{o.coupon_code}</p>}
                            {Number(o.min_order_amount) > 0 && (
                                <p className="text-[11px] text-amber-700 mt-1" data-testid={`offer-min-order-${o.id}`}>Min. order: Rs. {Number(o.min_order_amount).toFixed(0)}</p>
                            )}
                            {o.valid_until && (
                                <p className="text-[11px] text-neutral-500 mt-1" data-testid={`offer-valid-until-${o.id}`}>Expires: {new Date(o.valid_until).toLocaleString()}</p>
                            )}
                            <div className="flex justify-end gap-1 mt-3">
                                <button onClick={() => openEdit(o)} data-testid={`offer-edit-${o.id}`} className="w-9 h-9 rounded-full hover:bg-neutral-100 flex items-center justify-center"><Pencil className="w-4 h-4" /></button>
                                <button onClick={() => remove(o.id)} data-testid={`offer-delete-${o.id}`} className="w-9 h-9 rounded-full hover:bg-red-50 text-red-500 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {editing && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-display font-bold text-xl text-brand-ink">{editing === "new" ? "New Offer" : "Edit Offer"}</h3>
                            <button type="button" onClick={() => setEditing(null)}><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required testid="offer-form-title" />
                            <div>
                                <label className="block text-sm font-semibold text-brand-ink mb-2">Description</label>
                                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} required data-testid="offer-form-description"
                                    className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none resize-none text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Discount %" type="number" value={form.discount_percent} onChange={(v) => setForm({ ...form, discount_percent: Number(v) })} testid="offer-form-percent" />
                                <Input label="Flat Rs." type="number" value={form.discount_amount} onChange={(v) => setForm({ ...form, discount_amount: Number(v) })} testid="offer-form-amount" />
                            </div>
                            <Input label="Coupon Code" value={form.coupon_code} onChange={(v) => setForm({ ...form, coupon_code: v.toUpperCase() })} testid="offer-form-code" />
                            <Input label="Min. Order Amount (Rs.) — 0 = no minimum" type="number" value={form.min_order_amount} onChange={(v) => setForm({ ...form, min_order_amount: Number(v) || 0 })} testid="offer-form-min-order" />
                            <Input label="Valid until (optional) — leave blank for no expiry" type="datetime-local" value={form.valid_until} onChange={(v) => setForm({ ...form, valid_until: v })} testid="offer-form-valid-until" />
                            <Input label="Image URL" value={form.image_url} onChange={(v) => setForm({ ...form, image_url: v })} testid="offer-form-image" />
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} data-testid="offer-form-active" />
                                <span className="text-sm font-semibold">Active</span>
                            </label>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => setEditing(null)} className="flex-1 py-3 rounded-full bg-neutral-100 font-semibold text-brand-ink">Cancel</button>
                            <button type="submit" data-testid="offer-form-save" className="flex-1 py-3 rounded-full bg-brand-red text-white font-semibold hover:bg-brand-red-dark transition-colors">Save</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

function Input({ label, type = "text", value, onChange, required, testid }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-brand-ink mb-2">{label}</label>
            <input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} data-testid={testid}
                className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
        </div>
    );
}
