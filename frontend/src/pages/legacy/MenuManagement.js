import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Plus, Pencil, Trash2, FolderPlus, UtensilsCrossed, Package, GripVertical, Lock, Search, X,
} from "lucide-react";
import { toast } from "sonner";
import ColorPicker from "../../components/legacy/ColorPicker";
import { useStaffAuth as useAuth } from "../../contexts/StaffAuthContext";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function SortableItem({ id, children, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : "auto",
  };
  return children({ setNodeRef, style, attributes, listeners, isDragging });
}

export default function MenuManagement() {
  const { user } = useAuth() || {};
  const canEdit = user?.role === "admin" || (user?.permissions || []).includes("menu_edit");

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [catDialog, setCatDialog] = useState(false);
  const [itemDialog, setItemDialog] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState(null);
  const [itemForm, setItemForm] = useState({ name: "", price: "", price_fp1: "", price_fp2: "", category_id: "", stock: "100", low_stock_threshold: "10", color: null, is_outsourced: false, outsourced_vendor_id: "", outsourced_unit_cost: "" });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: "", id: "", name: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Sensors: hold-and-drag (smartphone-like) for both mouse & touch.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchData = useCallback(async () => {
    try {
      const [catRes, itemRes, venRes] = await Promise.all([
        axios.get(`${API}/categories`, { withCredentials: true }),
        axios.get(`${API}/menu-items`, { withCredentials: true }),
        axios.get(`${API}/vendors`, { withCredentials: true }).catch(() => ({ data: [] })),
      ]);
      setCategories(catRes.data);
      setMenuItems(itemRes.data);
      setVendors(venRes.data || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveCategory = async () => {
    if (!catName.trim()) return;
    try {
      const payload = { name: catName, color: catColor };
      if (editingCat) {
        await axios.put(`${API}/categories/${editingCat.id}`, payload, { withCredentials: true });
        toast.success("Category updated");
      } else {
        await axios.post(`${API}/categories`, payload, { withCredentials: true });
        toast.success("Category created");
      }
      setCatDialog(false); setCatName(""); setCatColor(null); setEditingCat(null); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const confirmDeleteCategory = (id, name) => setDeleteConfirm({ open: true, type: "category", id, name });
  const confirmDeleteItem = (id, name) => setDeleteConfirm({ open: true, type: "item", id, name });

  const executeDelete = async () => {
    const { type, id } = deleteConfirm;
    setDeleteConfirm({ open: false, type: "", id: "", name: "" });
    try {
      if (type === "category") {
        await axios.delete(`${API}/categories/${id}`, { withCredentials: true });
        toast.success("Category deleted");
      } else {
        await axios.delete(`${API}/menu-items/${id}`, { withCredentials: true });
        toast.success("Item deleted");
      }
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to delete"); }
  };

  const saveItem = async () => {
    if (!itemForm.name || !itemForm.price || !itemForm.category_id) {
      toast.error("Please fill all required fields"); return;
    }
    if (itemForm.is_outsourced && !itemForm.outsourced_vendor_id) {
      toast.error("Select a vendor for the outsourced product"); return;
    }
    try {
      const payload = {
        name: itemForm.name, price: parseFloat(itemForm.price), category_id: itemForm.category_id,
        price_fp1: itemForm.price_fp1 === "" ? null : parseFloat(itemForm.price_fp1),
        price_fp2: itemForm.price_fp2 === "" ? null : parseFloat(itemForm.price_fp2),
        stock: parseInt(itemForm.stock) || 100, low_stock_threshold: parseInt(itemForm.low_stock_threshold) || 10,
        color: itemForm.color,
        is_outsourced: !!itemForm.is_outsourced,
        outsourced_vendor_id: itemForm.is_outsourced ? itemForm.outsourced_vendor_id : null,
        outsourced_unit_cost: itemForm.is_outsourced && itemForm.outsourced_unit_cost !== ""
          ? parseFloat(itemForm.outsourced_unit_cost)
          : null,
      };
      if (editingItem) {
        await axios.put(`${API}/menu-items/${editingItem.id}`, payload, { withCredentials: true });
        toast.success("Item updated");
      } else {
        await axios.post(`${API}/menu-items`, payload, { withCredentials: true });
        toast.success("Item created");
      }
      setItemDialog(false);
      setItemForm({ name: "", price: "", price_fp1: "", price_fp2: "", category_id: "", stock: "100", low_stock_threshold: "10", color: null, is_outsourced: false, outsourced_vendor_id: "", outsourced_unit_cost: "" });
      setEditingItem(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const openEditCat = (cat) => { setEditingCat(cat); setCatName(cat.name); setCatColor(cat.color || null); setCatDialog(true); };
  const openEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name, price: String(item.price),
      price_fp1: item.price_fp1 != null ? String(item.price_fp1) : "",
      price_fp2: item.price_fp2 != null ? String(item.price_fp2) : "",
      category_id: item.category_id, stock: String(item.stock),
      low_stock_threshold: String(item.low_stock_threshold), color: item.color || null,
      is_outsourced: !!item.is_outsourced,
      outsourced_vendor_id: item.outsourced_vendor_id || "",
      outsourced_unit_cost: item.outsourced_unit_cost != null ? String(item.outsourced_unit_cost) : "",
    });
    setItemDialog(true);
  };
  const getCategoryName = (catId) => { const cat = categories.find((c) => c.id === catId); return cat ? cat.name : "Uncategorized"; };

  // ---- DnD handlers ----
  const handleCatDragEnd = async (event) => {
    if (!canEdit) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = categories.findIndex((c) => c.id === active.id);
    const newIdx = categories.findIndex((c) => c.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(categories, oldIdx, newIdx);
    setCategories(next);
    try {
      await axios.post(`${API}/categories/reorder`, { order: next.map((c) => c.id) }, { withCredentials: true });
      toast.success("Order saved");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Reorder failed");
      fetchData();
    }
  };

  const handleItemDragEnd = async (event) => {
    if (!canEdit) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = menuItems.findIndex((c) => c.id === active.id);
    const newIdx = menuItems.findIndex((c) => c.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(menuItems, oldIdx, newIdx);
    setMenuItems(next);
    try {
      await axios.post(`${API}/menu-items/reorder`, { order: next.map((c) => c.id) }, { withCredentials: true });
      toast.success("Order saved");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Reorder failed");
      fetchData();
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 overflow-auto" data-testid="menu-management-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Manrope, sans-serif", color: "#1A1D1A" }}>Menu Management</h1>
          <p className="text-sm mt-1" style={{ color: "#5C5F5C" }}>
            {canEdit ? "Click & hold any tile to drag-reorder, like apps on a phone." : "View only — ask an admin for the Edit Menu permission to modify."}
          </p>
        </div>
        {!canEdit && (
          <Badge data-testid="readonly-badge" className="text-xs flex items-center gap-1" style={{ background: "#FCECEB", color: "#A63D31", border: "none" }}>
            <Lock className="w-3 h-3" /> Read-only
          </Badge>
        )}
      </div>

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList className="bg-[#F9F8F6] border border-[#E5E2DC]">
          <TabsTrigger value="items" data-testid="tab-items" className="data-[state=active]:bg-white">
            <UtensilsCrossed className="w-4 h-4 mr-2" /> Menu Items
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories" className="data-[state=active]:bg-white">
            <FolderPlus className="w-4 h-4 mr-2" /> Categories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          {/* Search and Filter Bar */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border border-[#E5E2DC] rounded-lg p-4 mb-4 shadow-sm">
            {/* Search Input */}
            <div className="flex flex-col md:flex-row gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#5C5F5C" }} />
                <Input
                  data-testid="menu-search-input"
                  type="text"
                  placeholder="Search menu items by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9 border-[#E5E2DC]"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:bg-[#F9F8F6] rounded p-1"
                    aria-label="Clear search">
                    <X className="w-4 h-4" style={{ color: "#5C5F5C" }} />
                  </button>
                )}
              </div>
              <Button
                data-testid="add-item-btn"
                disabled={!canEdit}
                onClick={() => {
                  setEditingItem(null);
                  setItemForm({ name: "", price: "", price_fp1: "", price_fp2: "", category_id: "", stock: "100", low_stock_threshold: "10", color: null, is_outsourced: false, outsourced_vendor_id: "", outsourced_unit_cost: "" });
                  setItemDialog(true);
                }}
                className="flex items-center gap-2 text-white font-semibold disabled:opacity-50 shrink-0"
                style={{ background: "#1E3F20" }}>
                <Plus className="w-4 h-4" /> Add Item
              </Button>
            </div>
            
            {/* Category Filter Chips */}
            <div className="flex flex-wrap gap-2">
              <button
                data-testid="filter-all"
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  categoryFilter === "all"
                    ? "bg-[#1E3F20] text-white"
                    : "bg-[#F9F8F6] text-[#5C5F5C] hover:bg-[#EAF4EB]"
                }`}>
                All Items ({menuItems.length})
              </button>
              {categories.map((cat) => {
                const count = menuItems.filter((item) => item.category_id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    data-testid={`filter-cat-${cat.id}`}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      categoryFilter === cat.id
                        ? "text-white"
                        : "bg-[#F9F8F6] text-[#5C5F5C] hover:bg-opacity-80"
                    }`}
                    style={{
                      backgroundColor: categoryFilter === cat.id ? (cat.color || "#1E3F20") : undefined,
                    }}>
                    {cat.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtered Items Display */}
          {(() => {
            // Apply filters
            const filteredItems = menuItems.filter((item) => {
              const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesCategory = categoryFilter === "all" || item.category_id === categoryFilter;
              return matchesSearch && matchesCategory;
            });

            if (menuItems.length === 0) {
              return (
                <Card className="border-[#E5E2DC]">
                  <CardContent className="flex flex-col items-center py-16">
                    <UtensilsCrossed className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm" style={{ color: "#5C5F5C" }}>
                      No menu items yet. Create categories first, then add items.
                    </p>
                  </CardContent>
                </Card>
              );
            }

            if (filteredItems.length === 0) {
              return (
                <Card className="border-[#E5E2DC]">
                  <CardContent className="flex flex-col items-center py-16">
                    <Search className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium mb-1" style={{ color: "#1A1D1A" }}>
                      No items found
                    </p>
                    <p className="text-sm" style={{ color: "#5C5F5C" }}>
                      Try adjusting your search or filter
                    </p>
                  </CardContent>
                </Card>
              );
            }

            return (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
                <SortableContext items={filteredItems.map((i) => i.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="items-grid">
                    {filteredItems.map((item) => (
                      <SortableItem key={item.id} id={item.id} disabled={!canEdit}>
                        {({ setNodeRef, style, attributes, listeners, isDragging }) => (
                        <div ref={setNodeRef} style={style} {...attributes}
                          data-testid={`menu-item-card-${item.id}`}
                          className={`rounded-lg border bg-white shadow-sm overflow-hidden ${isDragging ? "ring-2 ring-[#1E3F20]" : ""}`}>
                          {item.color && <div className="h-1.5 w-full" style={{ background: item.color }} />}
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1">
                                <button
                                  type="button"
                                  data-testid={`drag-item-${item.id}`}
                                  {...(canEdit ? listeners : {})}
                                  disabled={!canEdit}
                                  className={`mt-0.5 p-1 rounded ${canEdit ? "cursor-grab active:cursor-grabbing hover:bg-[#F9F8F6]" : "opacity-30 cursor-not-allowed"}`}
                                  style={{ touchAction: "none" }}
                                  aria-label="Drag to reorder">
                                  <GripVertical className="w-4 h-4" style={{ color: "#5C5F5C" }} />
                                </button>
                                <div className="flex-1">
                                  <h4 className="text-base font-semibold" style={{ color: "#1A1D1A" }}>{item.name}</h4>
                                  <p className="text-lg font-bold mt-1" style={{ color: "#1E3F20" }}>${item.price.toFixed(2)}</p>
                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <Badge className="text-xs" style={{ background: "#EAF4EB", color: "#1E3F20", border: "none" }}>{getCategoryName(item.category_id)}</Badge>
                                    <Badge className="text-xs" style={{ background: item.stock <= item.low_stock_threshold ? "#FCECEB" : "#F9F8F6", color: item.stock <= item.low_stock_threshold ? "#A63D31" : "#5C5F5C", border: "none" }}>
                                      <Package className="w-3 h-3 mr-1" /> Stock: {item.stock}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              {canEdit && (
                                <div className="flex gap-1">
                                  <button data-testid={`edit-item-${item.id}`} onClick={() => openEditItem(item)}
                                    className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#EAF4EB]" style={{ color: "#1E3F20" }}>
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button data-testid={`delete-item-${item.id}`} onClick={() => confirmDeleteItem(item.id, item.name)}
                                    className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#FCECEB]" style={{ color: "#A63D31" }}>
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </div>
                      )}
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            );
          })()}
        </TabsContent>

        <TabsContent value="categories">
          <div className="flex justify-end mb-4">
            <Button data-testid="add-category-btn" disabled={!canEdit}
              onClick={() => { setEditingCat(null); setCatName(""); setCatColor(null); setCatDialog(true); }}
              className="flex items-center gap-2 text-white font-semibold disabled:opacity-50" style={{ background: "#1E3F20" }}>
              <Plus className="w-4 h-4" /> Add Category
            </Button>
          </div>
          {categories.length === 0 ? (
            <Card className="border-[#E5E2DC]"><CardContent className="flex flex-col items-center py-16">
              <FolderPlus className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm" style={{ color: "#5C5F5C" }}>No categories yet. Create one to get started.</p>
            </CardContent></Card>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCatDragEnd}>
              <SortableContext items={categories.map((c) => c.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="categories-grid">
                  {categories.map((cat) => {
                    const itemCount = menuItems.filter((i) => i.category_id === cat.id).length;
                    return (
                      <SortableItem key={cat.id} id={cat.id} disabled={!canEdit}>
                        {({ setNodeRef, style, attributes, listeners, isDragging }) => (
                          <div ref={setNodeRef} style={style} {...attributes}
                            data-testid={`category-card-${cat.id}`}
                            className={`rounded-lg border bg-white shadow-sm overflow-hidden ${isDragging ? "ring-2 ring-[#1E3F20]" : ""}`}>
                            {cat.color && <div className="h-1.5 w-full" style={{ background: cat.color }} />}
                            <CardContent className="p-4 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1">
                                <button
                                  type="button"
                                  data-testid={`drag-cat-${cat.id}`}
                                  {...(canEdit ? listeners : {})}
                                  disabled={!canEdit}
                                  className={`p-1 rounded ${canEdit ? "cursor-grab active:cursor-grabbing hover:bg-[#F9F8F6]" : "opacity-30 cursor-not-allowed"}`}
                                  style={{ touchAction: "none" }}
                                  aria-label="Drag to reorder">
                                  <GripVertical className="w-4 h-4" style={{ color: "#5C5F5C" }} />
                                </button>
                                <div>
                                  <h4 className="text-base font-semibold" style={{ color: "#1A1D1A" }}>{cat.name}</h4>
                                  <p className="text-xs mt-1" style={{ color: "#5C5F5C" }}>{itemCount} items</p>
                                </div>
                              </div>
                              {canEdit && (
                                <div className="flex gap-1">
                                  <button data-testid={`edit-cat-${cat.id}`} onClick={() => openEditCat(cat)}
                                    className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#EAF4EB]" style={{ color: "#1E3F20" }}>
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button data-testid={`delete-cat-${cat.id}`} onClick={() => confirmDeleteCategory(cat.id, cat.name)}
                                    className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#FCECEB]" style={{ color: "#A63D31" }}>
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </CardContent>
                          </div>
                        )}
                      </SortableItem>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ ...deleteConfirm, open: false })}>
        <AlertDialogContent className="border-[#E5E2DC]">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "Manrope, sans-serif" }}>Delete {deleteConfirm.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm.name}"? {deleteConfirm.type === "category" ? "All items in this category will also be deleted. " : ""}This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-btn" className="border-[#E5E2DC]">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-btn" onClick={executeDelete}
              className="text-white" style={{ background: "#A63D31" }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="border-[#E5E2DC]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Manrope, sans-serif" }}>{editingCat ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>{editingCat ? "Update the category name" : "Add a new menu category"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input data-testid="category-name-input" placeholder="e.g., Main Course" value={catName} onChange={(e) => setCatName(e.target.value)} className="border-[#E5E2DC]" />
            </div>
            <ColorPicker value={catColor} onChange={setCatColor} label="Category Button Color" />
          </div>
          <DialogFooter>
            <Button data-testid="save-category-btn" onClick={saveCategory} className="text-white font-semibold" style={{ background: "#1E3F20" }}>
              {editingCat ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="border-[#E5E2DC] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
            <DialogTitle style={{ fontFamily: "Manrope, sans-serif" }}>{editingItem ? "Edit Menu Item" : "New Menu Item"}</DialogTitle>
            <DialogDescription>{editingItem ? "Update the menu item details" : "Add a new item to your menu"}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input data-testid="item-name-input" placeholder="e.g., Grilled Chicken" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} className="border-[#E5E2DC]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Price ($) — Cash / Card / Dine-in</Label>
                <Input data-testid="item-price-input" type="number" step="0.01" placeholder="0.00" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} className="border-[#E5E2DC]" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={itemForm.category_id} onValueChange={(val) => setItemForm({ ...itemForm, category_id: val })}>
                  <SelectTrigger data-testid="item-category-select" className="border-[#E5E2DC]"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{categories.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>

            {/* FoodPanda override prices */}
            <div className="rounded-md border border-[#E5E2DC] p-3 bg-[#FFF8F1]">
              <p className="text-xs font-semibold mb-2" style={{ color: "#C05746" }}>FoodPanda Prices (override the regular price when paying via FP1 / FP2)</p>
              <p className="text-[11px] mb-2" style={{ color: "#5C5F5C" }}>Leave blank to use the regular price for that FoodPanda channel.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">FoodPanda 1 Price</Label>
                  <Input data-testid="item-price-fp1-input" type="number" step="0.01" placeholder="(optional)" value={itemForm.price_fp1} onChange={(e) => setItemForm({ ...itemForm, price_fp1: e.target.value })} className="border-[#E5E2DC]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">FoodPanda 2 Price</Label>
                  <Input data-testid="item-price-fp2-input" type="number" step="0.01" placeholder="(optional)" value={itemForm.price_fp2} onChange={(e) => setItemForm({ ...itemForm, price_fp2: e.target.value })} className="border-[#E5E2DC]" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Stock Quantity</Label>
                <Input data-testid="item-stock-input" type="number" value={itemForm.stock} onChange={(e) => setItemForm({ ...itemForm, stock: e.target.value })} className="border-[#E5E2DC]" />
              </div>
              <div className="space-y-2">
                <Label>Low Stock Alert</Label>
                <Input data-testid="item-low-stock-input" type="number" value={itemForm.low_stock_threshold} onChange={(e) => setItemForm({ ...itemForm, low_stock_threshold: e.target.value })} className="border-[#E5E2DC]" />
              </div>
            </div>
            <ColorPicker value={itemForm.color} onChange={(c) => setItemForm({ ...itemForm, color: c })} label="Item Button Color (overrides category)" />

            {/* Outsourced (vendor-linked) product — auto-creates vendor payable on sale */}
            <div className="rounded-md border border-[#E5E2DC] p-3 bg-[#F4F8FB]" data-testid="outsourced-section">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="item-outsourced-checkbox"
                  checked={!!itemForm.is_outsourced}
                  onChange={(e) => setItemForm({ ...itemForm, is_outsourced: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-semibold" style={{ color: "#1E3F20" }}>This product is outsourced (e.g., Pepsi from Khokha)</span>
              </label>
              <p className="text-[11px] mt-1" style={{ color: "#5C5F5C" }}>
                When checked, every sale automatically creates a vendor payable and tracks the quantity sold. Refunds and cancellations reverse it automatically.
              </p>
              {itemForm.is_outsourced && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Linked Vendor *</Label>
                    <Select value={itemForm.outsourced_vendor_id || ""} onValueChange={(val) => setItemForm({ ...itemForm, outsourced_vendor_id: val })}>
                      <SelectTrigger data-testid="item-outsourced-vendor-select" className="border-[#E5E2DC]"><SelectValue placeholder={vendors.length ? "Select vendor" : "No vendors yet — add one in Vendors page"} /></SelectTrigger>
                      <SelectContent>{vendors.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vendor Cost per Unit (optional)</Label>
                    <Input
                      data-testid="item-outsourced-cost-input"
                      type="number"
                      step="0.01"
                      placeholder="Defaults to selling price if empty"
                      value={itemForm.outsourced_unit_cost}
                      onChange={(e) => setItemForm({ ...itemForm, outsourced_unit_cost: e.target.value })}
                      className="border-[#E5E2DC]"
                    />
                    <p className="text-[10px]" style={{ color: "#5C5F5C" }}>Amount you owe the vendor per unit. Leave blank to use the selling price.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-[#E5E2DC] flex-shrink-0 bg-white">
            <Button data-testid="save-item-btn" onClick={saveItem} className="text-white font-semibold" style={{ background: "#1E3F20" }}>
              {editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
