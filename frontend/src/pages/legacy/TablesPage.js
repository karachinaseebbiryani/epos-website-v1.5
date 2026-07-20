import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { Users, Plus, Pencil, Trash2, Utensils, LayoutGrid, Settings } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Status → colour + label. Kept local so the floor reads at a glance.
const STATUS_META = {
  available: { label: "Available", bg: "#EAF4EB", fg: "#1E3F20", dot: "#2E7D32" },
  occupied:  { label: "Occupied",  bg: "#FCECEB", fg: "#A63D31", dot: "#C0392B" },
  reserved:  { label: "Reserved",  bg: "#EAF1FB", fg: "#274690", dot: "#2E5CB8" },
  cleaning:  { label: "Cleaning",  bg: "#F3F1EC", fg: "#6B6256", dot: "#9C8F7A" },
};
const STATUSES = ["available", "occupied", "reserved", "cleaning"];

export default function TablesPage() {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [editing, setEditing] = useState(null); // table being edited, or null for new
  const [form, setForm] = useState({ name: "", section: "Main Hall", capacity: 4, status: "available" });
  // Manage mode gates add/edit/delete so daily operation is just tap-to-select.
  // Tables are permanent — only their status changes during service.
  const [manageMode, setManageMode] = useState(false);
  const [currency, setCurrency] = useState("Rs");

  // Live floor: auto-refresh so a table's LIVE-order flag stays current even when
  // the bill is settled from the POS on another screen.
  useEffect(() => {
    axios.get(`${API}/settings`, { withCredentials: true })
      .then((r) => setCurrency(r.data?.currency || "Rs")).catch(() => {});
  }, []);

  const fetchTables = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/tables`, { withCredentials: true });
      setTables(data);
    } catch (err) {
      if (err.response?.status === 401) window.location.href = "/login";
      else toast.error("Failed to load tables");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  // Poll every 15s so a table's LIVE-order flag / bill total stays current when an
  // order is settled or updated from the POS on another screen.
  useEffect(() => {
    const id = setInterval(() => { fetchTables(); }, 15000);
    return () => clearInterval(id);
  }, [fetchTables]);

  // Group tables by section for the floor layout.
  const sections = useMemo(() => {
    const map = {};
    for (const t of tables) { (map[t.section || "Main Hall"] ||= []).push(t); }
    return Object.entries(map);
  }, [tables]);

  // Tap a table: open (or resume) its dine-in order and jump into the POS.
  const openTable = async (t) => {
    // If a live tab exists we must ALWAYS be able to open it — even if someone set
    // the table to Reserved/Cleaning by accident — otherwise the unpaid order is
    // stranded. Only block reserved/cleaning when there is no live order at all.
    const hasTab = !!t.open_order;
    if (!hasTab && (t.status === "reserved" || t.status === "cleaning")) {
      toast.info(`${t.name} is ${t.status}. Set it Available first to seat guests.`);
      return;
    }
    try {
      // POST returns the existing open order if the table is occupied, otherwise
      // creates a fresh one — this enforces one open order per table.
      const { data } = await axios.post(`${API}/open-orders`, { table_id: t.id }, { withCredentials: true });
      navigate(`/admin/pos?openOrder=${data.id}&table=${encodeURIComponent(t.name)}`);
    } catch (err) {
      toast.error(typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Could not open table");
    }
  };

  const openNew = () => { setEditing(null); setForm({ name: "", section: "Main Hall", capacity: 4, status: "available" }); setEditDialog(true); };
  const openEdit = (t) => { setEditing(t); setForm({ name: t.name, section: t.section, capacity: t.capacity, status: t.status }); setEditDialog(true); };

  const saveTable = async () => {
    if (!form.name.trim()) { toast.error("Table name is required"); return; }
    try {
      if (editing) {
        await axios.put(`${API}/tables/${editing.id}`, form, { withCredentials: true });
        toast.success(`${form.name} updated`);
      } else {
        await axios.post(`${API}/tables`, form, { withCredentials: true });
        toast.success(`${form.name} added`);
      }
      setEditDialog(false);
      fetchTables();
    } catch (err) {
      toast.error(typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Failed to save table");
    }
  };

  const setStatus = async (t, status) => {
    if (status === t.status) return; // no-op tap on the already-active status
    // Accidental-tap guard: a table with a live UNPAID tab must not silently be moved
    // to Available/Reserved/Cleaning — the order would still be open and owed.
    const liveItems = t.open_order?.item_count || 0;
    if (liveItems > 0 && status !== "occupied") {
      const bill = Number(t.open_order?.total || 0).toFixed(2);
      const ok = window.confirm(
        `${t.name} has a LIVE unpaid order (${liveItems} item(s), ${currency}${bill}).\n\n` +
        `Changing it to "${STATUS_META[status].label}" will NOT clear the bill — the order stays open.\n\nChange status anyway?`
      );
      if (!ok) return;
    }
    try {
      await axios.put(`${API}/tables/${t.id}`, { status }, { withCredentials: true });
      fetchTables();
    } catch (err) {
      toast.error(typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Failed to update status");
    }
  };

  const deleteTable = async (t) => {
    if (!window.confirm(`Delete ${t.name}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/tables/${t.id}`, { withCredentials: true });
      toast.success(`${t.name} deleted`);
      fetchTables();
    } catch (err) {
      toast.error(typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Failed to delete table");
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] -m-4 md:-m-8" data-testid="tables-page">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <LayoutGrid className="w-6 h-6" style={{ color: "#1E3F20" }} />
        <h2 className="text-xl font-bold" style={{ fontFamily: "Manrope, sans-serif", color: "#1A1D1A" }}>Tables / Floor</h2>
        <div className="ml-auto flex items-center gap-2">
          {manageMode && (
            <Button data-testid="add-table-btn" onClick={openNew} className="flex items-center gap-1 text-white font-semibold" style={{ background: "#1E3F20" }}>
              <Plus className="w-4 h-4" /> Add Table
            </Button>
          )}
          <Button data-testid="manage-tables-toggle" onClick={() => setManageMode((m) => !m)} variant="outline"
            className="flex items-center gap-1 border-[#E5E2DC] font-semibold" style={{ color: manageMode ? "#A63D31" : "#5C5F5C" }}>
            <Settings className="w-4 h-4" /> {manageMode ? "Done" : "Manage Tables"}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pb-2 flex flex-wrap gap-3">
        {STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#5C5F5C" }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[s].dot }} /> {STATUS_META[s].label}
          </span>
        ))}
      </div>

      <ScrollArea className="flex-1 px-4 pb-6">
        {loading ? (
          <div className="py-20 text-center text-sm" style={{ color: "#5C5F5C" }}>Loading floor…</div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: "#5C5F5C" }}>
            <Utensils className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No tables yet. Tap “Manage Tables” to add them.</p>
          </div>
        ) : (
          sections.map(([section, list]) => (
            <div key={section} className="mb-6" data-testid={`table-section-${section}`}>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-3 mt-2" style={{ color: "#5C5F5C" }}>{section}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {list.map((t) => {
                  const meta = STATUS_META[t.status] || STATUS_META.available;
                  // Live tab = an OPEN order with items on this table. Shown INDEPENDENTLY
                  // of the status colour so a mis-tapped status can never hide an unpaid bill.
                  const live = !!t.open_order && (t.open_order.item_count || 0) > 0;
                  const seatedNoItems = !!t.open_order && (t.open_order.item_count || 0) === 0;
                  return (
                    <div key={t.id} data-testid={`table-card-${t.id}`}
                      className="rounded-xl border p-3 flex flex-col gap-2 shadow-sm"
                      style={{ background: meta.bg, borderColor: live ? "#A63D31" : meta.dot + "55",
                               boxShadow: live ? "0 0 0 2px #A63D31" : undefined }}>
                      {/* LIVE-ORDER banner — always red + always visible when a bill is open,
                          regardless of the table's Available/Reserved/Cleaning status colour. */}
                      {live && (
                        <button data-testid={`table-live-${t.id}`} onClick={() => openTable(t)}
                          className="rounded-md px-2 py-1 flex items-center justify-between w-full" style={{ background: "#A63D31", color: "white" }}>
                          <span className="flex items-center gap-1 text-[11px] font-bold">
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE ORDER
                          </span>
                          <span className="text-[11px] font-black">{currency}{Number(t.open_order.total || 0).toFixed(2)}</span>
                        </button>
                      )}
                      {seatedNoItems && (
                        <div data-testid={`table-seated-${t.id}`} className="rounded-md px-2 py-1 text-[11px] font-semibold text-center" style={{ background: "#FDF2E9", color: "#D97736" }}>
                          Seated · no items yet
                        </div>
                      )}
                      <button onClick={() => openTable(t)} data-testid={`table-open-${t.id}`} className="text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-black" style={{ color: meta.fg, fontFamily: "Manrope, sans-serif" }}>{t.name}</span>
                          <span className="w-3 h-3 rounded-full" style={{ background: meta.dot }} />
                        </div>
                        <div className="flex items-center gap-1 text-xs mt-1 flex-wrap" style={{ color: meta.fg }}>
                          <Users className="w-3.5 h-3.5" /> {t.capacity}
                          <Badge className="ml-1 text-[10px] py-0" style={{ background: "white", color: meta.fg, border: "none" }}>{meta.label}</Badge>
                          {live && (
                            <Badge className="text-[10px] py-0" style={{ background: "#A63D31", color: "white", border: "none" }}>
                              {t.open_order.item_count} item{t.open_order.item_count === 1 ? "" : "s"}
                              {t.open_order.unsent_count > 0 ? ` · ${t.open_order.unsent_count} to send` : ""}
                            </Badge>
                          )}
                        </div>
                      </button>
                      {/* One-click status buttons — faster + fewer mistakes than a dropdown. */}
                      <div className="grid grid-cols-2 gap-1">
                        {STATUSES.map((s) => {
                          const on = t.status === s;
                          const sm = STATUS_META[s];
                          return (
                            <button key={s} data-testid={`table-set-${s}-${t.id}`} onClick={() => setStatus(t, s)}
                              className="flex items-center justify-center gap-1 text-[11px] font-semibold rounded px-1 py-1 border transition-all"
                              style={on
                                ? { background: sm.dot, color: "white", borderColor: sm.dot }
                                : { background: "white", color: sm.fg, borderColor: "#E5E2DC" }}>
                              <span className="w-2 h-2 rounded-full" style={{ background: on ? "white" : sm.dot }} /> {sm.label}
                            </button>
                          );
                        })}
                      </div>
                      {manageMode && (
                        <div className="flex items-center gap-1 justify-end">
                          <button data-testid={`table-edit-${t.id}`} onClick={() => openEdit(t)} className="w-6 h-6 rounded flex items-center justify-center border bg-white hover:bg-[#F9F8F6]" style={{ borderColor: "#E5E2DC" }}><Pencil className="w-3 h-3" style={{ color: "#5C5F5C" }} /></button>
                          <button data-testid={`table-delete-${t.id}`} onClick={() => deleteTable(t)} className="w-6 h-6 rounded flex items-center justify-center border bg-white hover:bg-[#FCECEB]" style={{ borderColor: "#E5E2DC" }}><Trash2 className="w-3 h-3" style={{ color: "#A63D31" }} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </ScrollArea>

      {/* Add / edit table dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="border-[#E5E2DC] max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Manrope" }}>{editing ? `Edit ${editing.name}` : "Add Table"}</DialogTitle>
            <DialogDescription>Name, section and capacity</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name / Number</Label><Input data-testid="table-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="T1" className="border-[#E5E2DC]" /></div>
            <div className="space-y-1"><Label>Section</Label><Input data-testid="table-section-input" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="Main Hall" className="border-[#E5E2DC]" /></div>
            <div className="space-y-1"><Label>Capacity</Label><Input data-testid="table-capacity-input" type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })} className="border-[#E5E2DC]" /></div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select data-testid="table-status-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border px-3 py-2 text-sm bg-white" style={{ borderColor: "#E5E2DC" }}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="save-table-btn" onClick={saveTable} className="text-white font-semibold" style={{ background: "#1E3F20" }}>{editing ? "Save" : "Add Table"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
