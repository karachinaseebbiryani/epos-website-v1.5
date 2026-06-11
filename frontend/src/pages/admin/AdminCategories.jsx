import { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { Plus, Pencil, Trash2, X, GripVertical, FolderTree } from "lucide-react";
import { toast } from "sonner";
import {
    DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
    SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function AdminCategories() {
    const [data, setData] = useState({ categories: [], items: [] });
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: "", color: "" });

    const load = async () => {
        const { data } = await api.get("/menu");
        setData(data);
    };
    useEffect(() => { load(); }, []);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const onDragEnd = async (e) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const oldIdx = data.categories.findIndex((c) => c.id === active.id);
        const newIdx = data.categories.findIndex((c) => c.id === over.id);
        if (oldIdx < 0 || newIdx < 0) return;
        const reordered = arrayMove(data.categories, oldIdx, newIdx);
        setData((d) => ({ ...d, categories: reordered }));
        try {
            await api.post("/categories/reorder", { order: reordered.map((c) => c.id) });
            toast.success("Order saved");
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
            load();
        }
    };

    const openCreate = () => { setEditing("new"); setForm({ name: "", color: "" }); };
    const openEdit = (c) => { setEditing(c.id); setForm({ name: c.name, color: c.color || "" }); };

    const save = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error("Name is required"); return; }
        try {
            if (editing === "new") {
                await api.post("/categories", form);
                toast.success("Category added");
            } else {
                await api.put(`/categories/${editing}`, form);
                toast.success("Category updated");
            }
            setEditing(null); load();
        } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    };

    const remove = async (cat) => {
        const itemsIn = data.items.filter((i) => i.category_id === cat.id).length;
        if (itemsIn > 0) {
            if (!confirm(`Category "${cat.name}" has ${itemsIn} items. Delete anyway? Items will need to be reassigned.`)) return;
        } else if (!confirm(`Delete category "${cat.name}"?`)) {
            return;
        }
        try { await api.delete(`/categories/${cat.id}`); toast.success("Deleted"); load(); }
        catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    };

    return (
        <div data-testid="admin-categories-page">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
                <div>
                    <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink inline-flex items-center gap-2"><FolderTree className="w-7 h-7 text-brand-red" /> Categories</h1>
                    <p className="text-neutral-500 mt-1">{data.categories.length} categories · drag <GripVertical className="inline w-3.5 h-3.5" /> to reorder</p>
                </div>
                <button onClick={openCreate} data-testid="category-add-button"
                    className="inline-flex items-center gap-2 bg-brand-red text-white rounded-full px-5 py-2.5 font-semibold text-sm hover:bg-brand-red-dark transition-colors">
                    <Plus className="w-4 h-4" /> Add Category
                </button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={data.categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="bg-white border border-neutral-100 rounded-2xl divide-y divide-neutral-100 overflow-hidden">
                        {data.categories.length === 0 && <p className="p-6 text-sm text-neutral-500 text-center">No categories yet. Click <strong>Add Category</strong> to start.</p>}
                        {data.categories.map((c) => {
                            const itemsIn = data.items.filter((i) => i.category_id === c.id).length;
                            return <SortableCategory key={c.id} cat={c} itemsIn={itemsIn} onEdit={() => openEdit(c)} onDelete={() => remove(c)} />;
                        })}
                    </div>
                </SortableContext>
            </DndContext>

            {editing && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-sm w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-display font-bold text-xl text-brand-ink">{editing === "new" ? "Add Category" : "Edit Category"}</h3>
                            <button type="button" onClick={() => setEditing(null)}><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-brand-ink mb-2">Name</label>
                                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="category-form-name"
                                    className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-brand-ink mb-2">Color (optional)</label>
                                <input type="color" value={form.color || "#dc2626"} onChange={(e) => setForm({ ...form, color: e.target.value })} data-testid="category-form-color"
                                    className="w-full h-12 px-2 py-1 bg-neutral-50 rounded-xl border border-neutral-200 cursor-pointer" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => setEditing(null)} className="flex-1 py-3 rounded-full bg-neutral-100 font-semibold text-brand-ink">Cancel</button>
                            <button type="submit" data-testid="category-form-save" className="flex-1 py-3 rounded-full bg-brand-red text-white font-semibold hover:bg-brand-red-dark transition-colors">Save</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

function SortableCategory({ cat, itemsIn, onEdit, onDelete }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 1 };
    return (
        <div ref={setNodeRef} style={style} data-testid={`admin-category-${cat.id}`}
            className="flex items-center gap-3 p-4 bg-white hover:bg-neutral-50">
            <button {...attributes} {...listeners} aria-label="Drag to reorder" data-testid={`admin-category-drag-${cat.id}`}
                className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 inline-flex items-center justify-center cursor-grab active:cursor-grabbing">
                <GripVertical className="w-4 h-4" />
            </button>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || "#dc2626" }} aria-hidden="true" />
            <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-brand-ink truncate">{cat.name}</h3>
                <p className="text-xs text-neutral-500">{itemsIn} item{itemsIn === 1 ? "" : "s"}</p>
            </div>
            <div className="flex gap-1">
                <button type="button" onClick={onEdit} data-testid={`category-edit-${cat.id}`} className="w-9 h-9 rounded-full hover:bg-neutral-100 flex items-center justify-center"><Pencil className="w-4 h-4" /></button>
                <button type="button" onClick={onDelete} data-testid={`category-delete-${cat.id}`} className="w-9 h-9 rounded-full hover:bg-red-50 text-red-500 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
            </div>
        </div>
    );
}
