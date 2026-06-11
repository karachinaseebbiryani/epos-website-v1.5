import { useEffect, useRef, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { Plus, Pencil, Trash2, X, Upload, Link2, GripVertical, Star, Award } from "lucide-react";
import { toast } from "sonner";
import {
    DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
    SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const EMPTY_FORM = {
    name: "", price: 0, category_id: "", stock: 100, image_url: "", image_type: "url",
    description: "", is_popular: false, is_bestseller: false,
    discount_type: "", discount_value: 0,
    variations: [],
    related_item_ids: [],
};

export default function AdminMenu() {
    const [data, setData] = useState({ categories: [], items: [] });
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const fileRef = useRef(null);

    const load = async () => {
        const { data } = await api.get("/menu");
        setData(data);
    };
    useEffect(() => { load(); }, []);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const onDragEnd = async (e) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const oldIdx = data.items.findIndex((i) => i.id === active.id);
        const newIdx = data.items.findIndex((i) => i.id === over.id);
        if (oldIdx < 0 || newIdx < 0) return;
        const reordered = arrayMove(data.items, oldIdx, newIdx);
        setData((d) => ({ ...d, items: reordered }));
        try {
            await api.post("/menu-items/reorder", { order: reordered.map((i) => i.id) });
            toast.success("Order saved");
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
            load();
        }
    };

    const openCreate = () => {
        setEditing("new");
        setForm({ ...EMPTY_FORM, category_id: data.categories[0]?.id || "" });
    };

    const openEdit = (item) => {
        setEditing(item.id);
        setForm({
            name: item.name,
            price: Number(item.original_price || item.price) || 0,
            category_id: item.category_id,
            stock: item.stock,
            image_url: item.image_url || "",
            image_type: item.image_type || (String(item.image_url || "").startsWith("data:") ? "upload" : "url"),
            description: item.description || "",
            is_popular: !!item.is_popular,
            is_bestseller: !!item.is_bestseller,
            discount_type: item.discount_type || "",
            discount_value: Number(item.discount_value || 0),
            variations: Array.isArray(item.variations) ? item.variations.map((v) => ({ name: v.name, price: Number(v.price) || 0 })) : [],
            related_item_ids: Array.isArray(item.related_item_ids) ? item.related_item_ids.filter((id) => id !== item.id) : [],
        });
    };

    const toggleRelated = (id) => setForm((f) => ({
        ...f,
        related_item_ids: f.related_item_ids.includes(id)
            ? f.related_item_ids.filter((x) => x !== id)
            : [...f.related_item_ids, id],
    }));

    // Variations
    const addVariation = () => setForm((f) => ({ ...f, variations: [...f.variations, { name: "", price: f.price || 0 }] }));
    const updateVariation = (idx, patch) => setForm((f) => ({ ...f, variations: f.variations.map((v, i) => i === idx ? { ...v, ...patch } : v) }));
    const removeVariation = (idx) => setForm((f) => ({ ...f, variations: f.variations.filter((_, i) => i !== idx) }));

    // Image upload from PC → base64 (resize if too large)
    const onPickFile = async (file) => {
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) { toast.error("Image too large (max 4 MB)"); return; }
        const dataUrl = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsDataURL(file);
        });
        // Optional resize/compress
        const compressed = await compressImage(dataUrl, 900, 0.82);
        setForm((f) => ({ ...f, image_url: compressed, image_type: "upload" }));
        toast.success("Image attached");
    };

    const save = async (e) => {
        e.preventDefault();
        const cleanVariations = form.variations
            .map((v) => ({ name: (v.name || "").trim(), price: Number(v.price) }))
            .filter((v) => v.name);
        for (const v of cleanVariations) {
            if (!Number.isFinite(v.price) || v.price < 0) { toast.error(`Variation "${v.name}" needs a valid price`); return; }
        }
        const dv = Number(form.discount_value) || 0;
        if (form.discount_type === "percentage" && (dv < 0 || dv > 100)) { toast.error("Percentage must be 0–100"); return; }
        if (form.discount_type === "fixed" && dv < 0) { toast.error("Fixed discount must be ≥ 0"); return; }
        const payload = {
            ...form,
            variations: cleanVariations,
            discount_type: form.discount_type || null,
            discount_value: form.discount_type ? dv : 0,
        };
        try {
            if (editing === "new") {
                await api.post("/menu-items", payload);
                toast.success("Item added");
            } else {
                await api.put(`/menu-items/${editing}`, payload);
                toast.success("Item updated");
            }
            setEditing(null);
            load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        }
    };

    const remove = async (id) => {
        if (!confirm("Delete this item?")) return;
        try {
            await api.delete(`/menu-items/${id}`);
            toast.success("Deleted");
            load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        }
    };

    return (
        <div data-testid="admin-menu-page">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
                <div>
                    <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink">Menu Management</h1>
                    <p className="text-neutral-500 mt-1">{data.items.length} items in {data.categories.length} categories · drag <GripVertical className="inline w-3.5 h-3.5" /> to reorder</p>
                </div>
                <button onClick={openCreate} data-testid="menu-add-button"
                    className="inline-flex items-center gap-2 bg-brand-red text-white rounded-full px-5 py-2.5 font-semibold text-sm hover:bg-brand-red-dark transition-colors">
                    <Plus className="w-4 h-4" /> Add Item
                </button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={data.items.map((i) => i.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.items.map((item) => (
                            <SortableMenuItem
                                key={item.id} item={item}
                                category={data.categories.find((c) => c.id === item.category_id)}
                                onEdit={() => openEdit(item)}
                                onDelete={() => remove(item.id)}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {editing && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-display font-bold text-xl text-brand-ink">{editing === "new" ? "Add Item" : "Edit Item"}</h3>
                            <button type="button" onClick={() => setEditing(null)}><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4 text-sm">
                            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required testid="menu-form-name" />
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Base price (Rs.)" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: Number(v) })} required testid="menu-form-price" />
                                <Input label="Stock" type="number" value={form.stock} onChange={(v) => setForm({ ...form, stock: Number(v) })} testid="menu-form-stock" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-brand-ink mb-2">Category</label>
                                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required data-testid="menu-form-category"
                                    className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none">
                                    <option value="">Select category</option>
                                    {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            {/* Image: URL OR upload from PC */}
                            <div>
                                <label className="block text-sm font-semibold text-brand-ink mb-2">Image</label>
                                <div className="flex gap-1 mb-2 bg-neutral-100 rounded-full p-1 w-fit">
                                    <button type="button" onClick={() => setForm((f) => ({ ...f, image_type: "url" }))} data-testid="menu-form-image-mode-url"
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 ${form.image_type === "url" ? "bg-white shadow-sm text-brand-red" : "text-neutral-500"}`}>
                                        <Link2 className="w-3.5 h-3.5" /> URL
                                    </button>
                                    <button type="button" onClick={() => setForm((f) => ({ ...f, image_type: "upload" }))} data-testid="menu-form-image-mode-upload"
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 ${form.image_type === "upload" ? "bg-white shadow-sm text-brand-red" : "text-neutral-500"}`}>
                                        <Upload className="w-3.5 h-3.5" /> Upload
                                    </button>
                                </div>
                                {form.image_type === "url" ? (
                                    <input type="text" value={String(form.image_url || "").startsWith("data:") ? "" : form.image_url}
                                        onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                                        placeholder="https://..."
                                        data-testid="menu-form-image-url"
                                        className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
                                ) : (
                                    <div>
                                        <input ref={fileRef} type="file" accept="image/*" onChange={(e) => onPickFile(e.target.files?.[0])} className="hidden" data-testid="menu-form-image-file" />
                                        <button type="button" onClick={() => fileRef.current?.click()}
                                            className="w-full border-2 border-dashed border-neutral-300 hover:border-brand-red rounded-xl py-4 text-sm font-semibold text-neutral-600 inline-flex items-center justify-center gap-2 transition-colors">
                                            <Upload className="w-4 h-4" /> Choose image from your computer
                                        </button>
                                    </div>
                                )}
                                {form.image_url && (
                                    <div className="mt-2 flex items-start gap-2">
                                        <img src={form.image_url} alt="preview" className="w-16 h-16 rounded-lg object-cover border border-neutral-200" />
                                        <button type="button" onClick={() => setForm({ ...form, image_url: "" })} className="text-xs text-red-500 underline">Remove</button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-brand-ink mb-2">Description</label>
                                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} data-testid="menu-form-description"
                                    className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none resize-none" />
                            </div>

                            {/* Discount editor */}
                            <div className="border border-neutral-200 rounded-xl p-4">
                                <label className="block text-sm font-bold text-brand-ink mb-2">Item discount</label>
                                <div className="flex gap-2 items-center">
                                    <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} data-testid="menu-form-discount-type"
                                        className="px-3 py-2 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-lg outline-none text-sm">
                                        <option value="">No discount</option>
                                        <option value="percentage">Percent (%)</option>
                                        <option value="fixed">Fixed (Rs.)</option>
                                    </select>
                                    <input type="number" value={form.discount_value}
                                        onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
                                        disabled={!form.discount_type}
                                        data-testid="menu-form-discount-value"
                                        className="w-28 px-3 py-2 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-lg outline-none text-sm disabled:opacity-50" />
                                    {form.discount_type && form.discount_value > 0 && (
                                        <span className="text-xs text-green-600 font-semibold">
                                            Sale: Rs. {form.discount_type === "percentage"
                                                ? Math.max(0, Math.round(form.price * (1 - form.discount_value / 100)))
                                                : Math.max(0, form.price - form.discount_value)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Variations editor */}
                            <div className="border border-neutral-200 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <label className="block text-sm font-bold text-brand-ink">Size variations</label>
                                        <p className="text-[11px] text-neutral-500">e.g. Half / Full / Family · price each</p>
                                    </div>
                                    <button type="button" onClick={addVariation} data-testid="menu-form-add-variation"
                                        className="inline-flex items-center gap-1 bg-brand-ink text-white rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-brand-red transition-colors">
                                        <Plus className="w-3.5 h-3.5" /> Add
                                    </button>
                                </div>
                                {form.variations.length === 0 && <p className="text-[11px] text-neutral-400 italic">Leave empty for a single-price item.</p>}
                                <div className="space-y-2">
                                    {form.variations.map((v, idx) => (
                                        <div key={idx} className="flex items-center gap-2" data-testid={`menu-form-variation-${idx}`}>
                                            <input type="text" placeholder="Name (e.g. Half)" value={v.name} onChange={(e) => updateVariation(idx, { name: e.target.value })} data-testid={`menu-form-variation-name-${idx}`}
                                                className="flex-1 px-3 py-2 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-lg outline-none text-sm" />
                                            <input type="number" placeholder="Price" value={v.price} onChange={(e) => updateVariation(idx, { price: Number(e.target.value) })} data-testid={`menu-form-variation-price-${idx}`}
                                                className="w-24 px-3 py-2 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-lg outline-none text-sm" />
                                            <button type="button" onClick={() => removeVariation(idx)} data-testid={`menu-form-variation-remove-${idx}`} className="w-9 h-9 rounded-full bg-red-50 text-red-500 hover:bg-red-100 inline-flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Related items (upsell) */}
                            <div className="border border-neutral-200 rounded-xl p-4">
                                <label className="block text-sm font-bold text-brand-ink mb-1">Related items <span className="font-normal text-neutral-500">(People also buy)</span></label>
                                <p className="text-[11px] text-neutral-500 mb-3">When this item is in a customer's cart, these will appear as suggestions.</p>
                                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                                    {data.items.filter((i) => i.id !== editing).map((i) => {
                                        const on = form.related_item_ids.includes(i.id);
                                        return (
                                            <button type="button" key={i.id} onClick={() => toggleRelated(i.id)}
                                                data-testid={`menu-form-related-${i.id}`}
                                                className={`text-xs px-2.5 py-1.5 rounded-full border font-semibold transition-colors ${on ? "bg-brand-red text-white border-brand-red" : "bg-white text-brand-ink border-neutral-200 hover:border-brand-red"}`}>
                                                {on ? "✓ " : ""}{i.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={form.is_popular} onChange={(e) => setForm({ ...form, is_popular: e.target.checked })} data-testid="menu-form-popular" />
                                    <span className="text-sm font-semibold inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 text-brand-yellow" /> Popular</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={form.is_bestseller} onChange={(e) => setForm({ ...form, is_bestseller: e.target.checked })} data-testid="menu-form-bestseller" />
                                    <span className="text-sm font-semibold inline-flex items-center gap-1"><Award className="w-3.5 h-3.5 text-brand-red" /> Bestseller</span>
                                </label>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => setEditing(null)} className="flex-1 py-3 rounded-full bg-neutral-100 font-semibold text-brand-ink">Cancel</button>
                            <button type="submit" data-testid="menu-form-save" className="flex-1 py-3 rounded-full bg-brand-red text-white font-semibold hover:bg-brand-red-dark transition-colors">Save</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

function SortableMenuItem({ item, category, onEdit, onDelete }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 1 };
    const variations = Array.isArray(item.variations) ? item.variations : [];
    const hasDiscount = item.original_price && item.original_price > item.price;
    return (
        <div ref={setNodeRef} style={style} data-testid={`admin-menu-item-${item.id}`}
            className="bg-white border border-neutral-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="aspect-[4/3] bg-neutral-100 overflow-hidden relative">
                <button {...attributes} {...listeners} aria-label="Drag to reorder" data-testid={`admin-menu-drag-${item.id}`}
                    className="absolute top-2 left-2 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white text-neutral-700 inline-flex items-center justify-center cursor-grab active:cursor-grabbing shadow-sm">
                    <GripVertical className="w-4 h-4" />
                </button>
                {item.image_url && item.image_url.trim() && <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />}
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    {item.is_bestseller && <span className="bg-brand-red text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">Bestseller</span>}
                    {item.is_popular && <span className="bg-brand-yellow text-brand-ink text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">Popular</span>}
                    {hasDiscount && <span className="bg-green-600 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">{item.discount_percent}% OFF</span>}
                </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-display font-bold text-brand-ink truncate">{item.name}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">{category?.name || "—"} · Stock: {item.stock}</p>
                {variations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1" data-testid={`admin-menu-variations-${item.id}`}>
                        {variations.map((v, idx) => (
                            <span key={idx} className="text-[10px] uppercase tracking-wider font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full">
                                {v.name} · Rs. {v.price}
                            </span>
                        ))}
                    </div>
                )}
                <div className="flex items-center justify-between mt-auto pt-3">
                    <span className="font-display font-black text-lg text-brand-red">
                        {variations.length > 0 ? `From Rs. ${Math.min(...variations.map((v) => Number(v.price) || 0))}` : (
                            hasDiscount ? <span className="inline-flex items-baseline gap-2"><span>Rs. {item.price}</span><span className="text-xs text-neutral-400 line-through font-normal">Rs. {item.original_price}</span></span> : <span>Rs. {item.price}</span>
                        )}
                    </span>
                    <div className="flex gap-1">
                        <button type="button" onClick={onEdit} data-testid={`menu-edit-${item.id}`} className="w-9 h-9 rounded-full hover:bg-neutral-100 flex items-center justify-center"><Pencil className="w-4 h-4" /></button>
                        <button type="button" onClick={onDelete} data-testid={`menu-delete-${item.id}`} className="w-9 h-9 rounded-full hover:bg-red-50 text-red-500 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
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

// Resize a data URL using canvas, return new data URL.
async function compressImage(dataUrl, maxWidth = 900, quality = 0.85) {
    return new Promise((res) => {
        const img = new window.Image();
        img.onload = () => {
            const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
            const w = Math.round(img.width * ratio);
            const h = Math.round(img.height * ratio);
            const c = document.createElement("canvas");
            c.width = w; c.height = h;
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            try {
                res(c.toDataURL("image/jpeg", quality));
            } catch (e) {
                res(dataUrl);
            }
        };
        img.onerror = () => res(dataUrl);
        img.src = dataUrl;
    });
}
