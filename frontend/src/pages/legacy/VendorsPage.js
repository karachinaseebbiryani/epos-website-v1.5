import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useStaffAuth as useAuth } from "../../contexts/StaffAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Plus, Trash2, Pencil, Truck, DollarSign, Printer, ArrowUpDown, CreditCard } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VendorsPage() {
  const { user } = useAuth();
  const canReprint = user?.role === "admin" || (user?.permissions || []).includes("reprint_invoices");
  const [vendors, setVendors] = useState([]);
  const [currency, setCurrency] = useState("Rs");
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [vendorDialog, setVendorDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [vendorForm, setVendorForm] = useState({ name: "", contact: "", items_supplied: "" });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: "", name: "" });
  // Transaction dialog
  const [txnDialog, setTxnDialog] = useState(false);
  const [txnVendor, setTxnVendor] = useState(null);
  const [txnItems, setTxnItems] = useState([{ name: "", quantity: "1", unit_price: "" }]);
  const [txnNotes, setTxnNotes] = useState("");
  // Payment dialog
  const [payDialog, setPayDialog] = useState(false);
  const [payVendor, setPayVendor] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  // Detail view
  const [detailVendor, setDetailVendor] = useState(null);
  const [detailTxns, setDetailTxns] = useState([]);
  const [detailPmts, setDetailPmts] = useState([]);
  const [detailToday, setDetailToday] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const printRef = useRef(null);

  const fetchVendors = useCallback(async () => {
    try {
      const [vRes, sRes] = await Promise.all([
        axios.get(`${API}/vendors`, { withCredentials: true }),
        axios.get(`${API}/settings`, { withCredentials: true }),
      ]);
      setVendors(vRes.data);
      setCurrency(sRes.data.currency || "Rs");
      setSettings(sRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const saveVendor = async () => {
    if (!vendorForm.name.trim()) { toast.error("Vendor name required"); return; }
    try {
      if (editingVendor) {
        await axios.put(`${API}/vendors/${editingVendor.id}`, vendorForm, { withCredentials: true });
        toast.success("Vendor updated");
      } else {
        await axios.post(`${API}/vendors`, vendorForm, { withCredentials: true });
        toast.success("Vendor added");
      }
      setVendorDialog(false); fetchVendors();
    } catch (err) { toast.error("Failed"); }
  };

  const deleteVendor = async () => {
    const { id } = deleteConfirm;
    setDeleteConfirm({ open: false, id: "", name: "" });
    try { await axios.delete(`${API}/vendors/${id}`, { withCredentials: true }); toast.success("Deleted"); fetchVendors(); }
    catch { toast.error("Failed"); }
  };

  // Transactions
  const openTxn = (v) => { setTxnVendor(v); setTxnItems([{ name: "", quantity: "1", unit_price: "" }]); setTxnNotes(""); setTxnDialog(true); };
  const addTxnItem = () => { setTxnItems([...txnItems, { name: "", quantity: "1", unit_price: "" }]); };
  const updateTxnItem = (idx, field, val) => { const items = [...txnItems]; items[idx][field] = val; setTxnItems(items); };
  const removeTxnItem = (idx) => { setTxnItems(txnItems.filter((_, i) => i !== idx)); };
  const txnTotal = txnItems.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);

  // Print purchase ticket
  const printPurchaseTicket = (vendorName, items, total, ticketNo, isReprint = false) => {
    const iframe = printRef.current;
    if (!iframe) return;
    const rName = settings?.restaurant_name || "KARACHI NASEEB BIRYANI";
    const now = new Date();
    const itemsHTML = items.map((i) => `<div style="display:flex;justify-content:space-between;font-size:12px;margin:2px 0"><span>${i.name} x${i.quantity}</span><span>${currency} ${(i.quantity * i.unit_price).toFixed(2)}</span></div><div style="font-size:10px;padding-left:8px;color:#666">@ ${currency} ${i.unit_price} each</div>`).join("");
    const html = `<html><head><style>body{font-family:'Courier New',monospace;padding:15px;font-size:12px;max-width:280px;color:#000}.center{text-align:center}.line{border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between;margin:2px 0}@media print{body{margin:0;padding:10px}@page{margin:3mm}}</style></head><body>
      ${isReprint ? '<div class="center" style="font-weight:bold;font-size:14px;border:1px solid #000;padding:2px;margin-bottom:6px">** REPRINT INVOICE **</div>' : ''}
      <div class="center"><h3 style="margin:2px 0;font-size:14px">${rName}</h3><p style="font-size:10px">PURCHASE TICKET</p></div><div class="line"></div>
      <div class="row"><span>Ticket #:</span><span style="font-weight:bold">${ticketNo}</span></div>
      <div class="row"><span>Vendor:</span><span style="font-weight:bold">${vendorName}</span></div>
      <div class="row"><span>Date:</span><span>${now.toLocaleDateString()}</span></div>
      <div class="row"><span>Time:</span><span>${now.toLocaleTimeString()}</span></div><div class="line"></div>
      <div style="font-weight:bold;margin-bottom:4px">Items Purchased:</div>${itemsHTML}<div class="line"></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold"><span>TOTAL:</span><span>${currency} ${total.toFixed(2)}</span></div>
      <div class="line"></div><div class="center" style="font-size:10px">Vendor copy - keep for records</div>
    </body></html>`;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 300);
  };

  const saveTxn = async () => {
    const validItems = txnItems.filter((i) => i.name.trim() && i.unit_price);
    if (!validItems.length) { toast.error("Add at least one item"); return; }
    const items = validItems.map((i) => ({ name: i.name, quantity: parseInt(i.quantity) || 1, unit_price: parseFloat(i.unit_price) || 0 }));
    const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    try {
      const { data } = await axios.post(`${API}/vendors/${txnVendor.id}/transactions`, { vendor_id: txnVendor.id, items, total: Math.round(total * 100) / 100, notes: txnNotes }, { withCredentials: true });
      toast.success("Transaction recorded");
      setTxnDialog(false);
      // Auto-print purchase ticket
      printPurchaseTicket(txnVendor.name, items, Math.round(total * 100) / 100, data.ticket_no || "N/A", false);
      fetchVendors();
    } catch { toast.error("Failed"); }
  };

  // Payments
  const openPay = (v) => { setPayVendor(v); setPayAmount(""); setPayNotes(""); setPayDialog(true); };
  const savePay = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) { toast.error("Enter valid amount"); return; }
    try {
      await axios.post(`${API}/vendors/${payVendor.id}/payments`, { vendor_id: payVendor.id, amount: parseFloat(payAmount), notes: payNotes }, { withCredentials: true });
      toast.success("Payment recorded");
      setPayDialog(false); fetchVendors();
    } catch { toast.error("Failed"); }
  };

  // Detail view
  const openDetail = async (v) => {
    setDetailVendor(v);
    try {
      const [txnRes, pmtRes, todayRes] = await Promise.all([
        axios.get(`${API}/vendors/${v.id}/transactions`, { withCredentials: true }),
        axios.get(`${API}/vendors/${v.id}/payments`, { withCredentials: true }),
        axios.get(`${API}/vendors/${v.id}/today`, { withCredentials: true }),
      ]);
      setDetailTxns(txnRes.data);
      setDetailPmts(pmtRes.data);
      setDetailToday(todayRes.data);
      setShowDetail(true);
    } catch { toast.error("Failed to load"); }
  };

  // Print vendor ticket
  const printTicket = () => {
    if (!detailToday || !detailVendor) return;
    const iframe = printRef.current;
    if (!iframe) return;
    const rName = settings?.restaurant_name || "KARACHI NASEEB BIRYANI";
    const itemsHTML = detailToday.items?.map((i) => `<div style="display:flex;justify-content:space-between;font-size:12px;margin:2px 0"><span>${i.name} x${i.quantity}</span><span>${currency} ${(i.quantity * i.unit_price).toFixed(2)}</span></div>`).join("") || "";
    const html = `<html><head><style>body{font-family:'Courier New',monospace;padding:15px;font-size:12px;max-width:280px;color:#000}.center{text-align:center}.line{border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between;margin:2px 0}@media print{body{margin:0;padding:10px}@page{margin:3mm}}</style></head><body>
      <div class="center"><h3 style="margin:2px 0;font-size:14px">${rName}</h3><p style="font-size:10px">VENDOR TICKET</p></div><div class="line"></div>
      <div class="row"><span>Vendor:</span><span style="font-weight:bold">${detailVendor.name}</span></div>
      <div class="row"><span>Date:</span><span>${detailToday.date}</span></div><div class="line"></div>
      <div style="font-weight:bold;margin-bottom:4px">Items Supplied Today:</div>${itemsHTML}<div class="line"></div>
      <div class="row" style="font-weight:bold;font-size:13px"><span>Today Total:</span><span>${currency} ${detailToday.total_billed.toFixed(2)}</span></div>
      <div class="row"><span>Paid Today:</span><span>${currency} ${detailToday.total_paid.toFixed(2)}</span></div>
      <div class="row" style="font-weight:bold;font-size:13px"><span>${detailToday.balance >= 0 ? 'Remaining:' : 'Overpaid:'}</span><span>${currency} ${Math.abs(detailToday.balance).toFixed(2)}</span></div>
      <div class="line"></div>
      <div class="row" style="font-size:11px"><span>All-Time Balance:</span><span style="font-weight:bold">${currency} ${detailVendor.balance >= 0 ? detailVendor.balance.toFixed(2) : '-' + Math.abs(detailVendor.balance).toFixed(2)}</span></div>
      <div class="line"></div><div class="center" style="font-size:10px;margin-top:4px">Keep this ticket for your records</div>
    </body></html>`;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 300);
  };

  const c = currency;
  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><p style={{ color: "#5C5F5C" }}>Loading...</p></div>;

  return (
    <div className="flex-1 p-6 md:p-8 overflow-auto" data-testid="vendors-page">
      <iframe ref={printRef} title="vendor-print" style={{ position: "absolute", width: 0, height: 0, border: "none", left: "-9999px" }} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Manrope", color: "#1A1D1A" }}>Vendors</h1>
          <p className="text-sm mt-1" style={{ color: "#5C5F5C" }}>Manage suppliers, transactions & payments</p>
        </div>
        <Button data-testid="add-vendor-btn" onClick={() => { setEditingVendor(null); setVendorForm({ name: "", contact: "", items_supplied: "" }); setVendorDialog(true); }} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}><Plus className="w-4 h-4" /> Add Vendor</Button>
      </div>

      {/* Vendor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.map((v) => (
          <Card key={v.id} data-testid={`vendor-card-${v.id}`} className="border-[#E5E2DC]">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-base font-semibold" style={{ color: "#1A1D1A" }}>{v.name}</h4>
                  {v.contact && <p className="text-xs" style={{ color: "#5C5F5C" }}>{v.contact}</p>}
                  {v.items_supplied && <Badge className="text-[10px] mt-1" style={{ background: "#EAF4EB", color: "#1E3F20", border: "none" }}>{v.items_supplied}</Badge>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingVendor(v); setVendorForm({ name: v.name, contact: v.contact, items_supplied: v.items_supplied }); setVendorDialog(true); }} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#EAF4EB]" style={{ color: "#1E3F20" }}><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeleteConfirm({ open: true, id: v.id, name: v.name })} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#FCECEB]" style={{ color: "#A63D31" }}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <Separator className="mb-3" />
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div><p className="text-[10px] uppercase" style={{ color: "#5C5F5C" }}>Billed</p><p className="text-sm font-bold" style={{ color: "#1A1D1A" }}>{c} {v.total_billed.toFixed(0)}</p></div>
                <div><p className="text-[10px] uppercase" style={{ color: "#5C5F5C" }}>Paid</p><p className="text-sm font-bold" style={{ color: "#2E5C31" }}>{c} {v.total_paid.toFixed(0)}</p></div>
                <div><p className="text-[10px] uppercase" style={{ color: "#5C5F5C" }}>Balance</p><p className="text-sm font-bold" style={{ color: v.balance > 0 ? "#A63D31" : v.balance < 0 ? "#2E5C31" : "#1A1D1A" }}>{v.balance > 0 ? `-${c} ${v.balance.toFixed(0)}` : v.balance < 0 ? `+${c} ${Math.abs(v.balance).toFixed(0)}` : `${c} 0`}</p></div>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => openTxn(v)} className="flex-1 text-xs text-white" style={{ background: "#D97736" }}><Plus className="w-3 h-3 mr-1" /> Purchase</Button>
                <Button size="sm" onClick={() => openPay(v)} className="flex-1 text-xs text-white" style={{ background: "#1E3F20" }}><CreditCard className="w-3 h-3 mr-1" /> Pay</Button>
                <Button size="sm" variant="outline" onClick={() => openDetail(v)} className="text-xs border-[#E5E2DC]"><ArrowUpDown className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {vendors.length === 0 && <Card className="border-[#E5E2DC] col-span-full"><CardContent className="flex flex-col items-center py-16"><Truck className="w-12 h-12 mb-3 opacity-20" /><p className="text-sm" style={{ color: "#5C5F5C" }}>No vendors yet. Add one to get started.</p></CardContent></Card>}
      </div>

      {/* Vendor Dialog */}
      <Dialog open={vendorDialog} onOpenChange={setVendorDialog}>
        <DialogContent className="border-[#E5E2DC]"><DialogHeader><DialogTitle style={{ fontFamily: "Manrope" }}>{editingVendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle><DialogDescription>Supplier details</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Vendor Name</Label><Input data-testid="vendor-name-input" placeholder="e.g., Coke Supplier" value={vendorForm.name} onChange={(e) => setVendorForm({...vendorForm, name: e.target.value})} className="border-[#E5E2DC]" /></div>
            <div className="space-y-1"><Label>Contact</Label><Input placeholder="Phone or address" value={vendorForm.contact} onChange={(e) => setVendorForm({...vendorForm, contact: e.target.value})} className="border-[#E5E2DC]" /></div>
            <div className="space-y-1"><Label>Items Supplied</Label><Input placeholder="e.g., Drinks, Chicken, Rice" value={vendorForm.items_supplied} onChange={(e) => setVendorForm({...vendorForm, items_supplied: e.target.value})} className="border-[#E5E2DC]" /></div>
          </div>
          <DialogFooter><Button data-testid="save-vendor-btn" onClick={saveVendor} className="text-white font-semibold" style={{ background: "#1E3F20" }}>{editingVendor ? "Update" : "Add Vendor"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog with Product Dropdown */}
      <Dialog open={txnDialog} onOpenChange={setTxnDialog}>
        <DialogContent className="border-[#E5E2DC] max-w-lg"><DialogHeader><DialogTitle style={{ fontFamily: "Manrope" }}>Record Purchase - {txnVendor?.name}</DialogTitle><DialogDescription>Select products or type new ones</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {txnItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1"><Label className="text-xs">Item</Label>
                  <div className="relative">
                    <Input placeholder="Type or select product" value={item.name} onChange={(e) => updateTxnItem(idx, "name", e.target.value)} className="border-[#E5E2DC]" list={`products-${idx}`} />
                    <datalist id={`products-${idx}`}>
                      {(txnVendor?.products || []).map((p, i) => (
                        <option key={i} value={p.name}>{p.name} - {c} {p.default_price}</option>
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="w-16"><Label className="text-xs">Qty</Label><Input type="number" min="1" value={item.quantity} onChange={(e) => updateTxnItem(idx, "quantity", e.target.value)} className="border-[#E5E2DC]" /></div>
                <div className="w-24"><Label className="text-xs">Price ({c})</Label><Input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateTxnItem(idx, "unit_price", e.target.value)} className="border-[#E5E2DC]" /></div>
                <button onClick={() => removeTxnItem(idx)} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#FCECEB]" style={{ color: "#A63D31" }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addTxnItem} className="text-xs border-[#E5E2DC]"><Plus className="w-3 h-3 mr-1" /> Add Row</Button>
              {(txnVendor?.products || []).map((p, i) => (
                <Button key={i} variant="outline" size="sm" onClick={() => { setTxnItems([...txnItems, { name: p.name, quantity: "1", unit_price: String(p.default_price) }]); }} className="text-xs border-[#E5E2DC]" style={{ color: "#1E3F20" }}>+ {p.name}</Button>
              ))}
            </div>
            <div className="space-y-1"><Label className="text-xs">Notes</Label><Input placeholder="Optional notes" value={txnNotes} onChange={(e) => setTxnNotes(e.target.value)} className="border-[#E5E2DC]" /></div>
            <Separator />
            <div className="flex justify-between font-bold"><span>Total:</span><span>{c} {txnTotal.toFixed(2)}</span></div>
          </div>
          <DialogFooter><Button onClick={saveTxn} className="text-white font-semibold" style={{ background: "#D97736" }}>Record Purchase</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="border-[#E5E2DC]"><DialogHeader><DialogTitle style={{ fontFamily: "Manrope" }}>Pay Vendor - {payVendor?.name}</DialogTitle><DialogDescription>Outstanding: {c} {payVendor?.balance?.toFixed(2)}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Amount ({c})</Label><Input data-testid="vendor-pay-input" type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="border-[#E5E2DC] text-lg font-bold" /></div>
            <div className="space-y-1"><Label className="text-xs">Notes</Label><Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="border-[#E5E2DC]" placeholder="Optional" /></div>
          </div>
          <DialogFooter><Button onClick={savePay} className="text-white font-semibold" style={{ background: "#1E3F20" }}>Record Payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail/History Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="border-[#E5E2DC] max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle style={{ fontFamily: "Manrope" }}>{detailVendor?.name} - History</DialogTitle><DialogDescription>All transactions & payments</DialogDescription></DialogHeader>
          {detailToday && (
            <Card className="border-[#E5E2DC] mb-4"><CardHeader className="py-2 px-4"><CardTitle className="text-sm">Today's Summary</CardTitle></CardHeader><CardContent className="px-4 pb-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-xs" style={{ color: "#5C5F5C" }}>Billed</p><p className="font-bold">{c} {detailToday.total_billed.toFixed(2)}</p></div>
                <div><p className="text-xs" style={{ color: "#5C5F5C" }}>Paid</p><p className="font-bold" style={{ color: "#2E5C31" }}>{c} {detailToday.total_paid.toFixed(2)}</p></div>
                <div><p className="text-xs" style={{ color: "#5C5F5C" }}>Balance</p><p className="font-bold" style={{ color: detailToday.balance > 0 ? "#A63D31" : "#2E5C31" }}>{c} {detailToday.balance.toFixed(2)}</p></div>
              </div>
              <Button size="sm" variant="outline" onClick={printTicket} className="mt-3 w-full flex items-center gap-2 border-[#E5E2DC]"><Printer className="w-3 h-3" /> Print Vendor Ticket</Button>
            </CardContent></Card>
          )}
          <h4 className="text-sm font-semibold" style={{ color: "#1A1D1A" }}>Transactions</h4>
          <Table><TableBody>
            {detailTxns.map((t) => (
              <TableRow key={t.id} className="border-[#E5E2DC]">
                <TableCell className="text-xs font-mono" style={{ color: "#1E3F20" }}>{t.ticket_no || "-"}</TableCell>
                <TableCell className="text-xs" style={{ color: "#5C5F5C" }}>{t.date}</TableCell>
                <TableCell className="text-xs">{t.items?.map((i) => `${i.name}x${i.quantity}`).join(", ")}</TableCell>
                <TableCell className="text-xs font-bold" style={{ color: "#D97736" }}>{c} {t.total.toFixed(2)}</TableCell>
                {canReprint && <TableCell>
                  <button onClick={() => printPurchaseTicket(detailVendor?.name, t.items || [], t.total, t.ticket_no || "N/A", true)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#EAF4EB]" style={{ color: "#1E3F20" }} title="Reprint Invoice"><Printer className="w-3.5 h-3.5" /></button>
                </TableCell>}
              </TableRow>
            ))}
            {!detailTxns.length && <TableRow><TableCell colSpan={canReprint ? 5 : 4} className="text-center text-xs py-4" style={{ color: "#5C5F5C" }}>No transactions</TableCell></TableRow>}
          </TableBody></Table>
          <h4 className="text-sm font-semibold mt-3" style={{ color: "#1A1D1A" }}>Payments</h4>
          <Table><TableBody>
            {detailPmts.map((p) => (
              <TableRow key={p.id} className="border-[#E5E2DC]">
                <TableCell className="text-xs" style={{ color: "#5C5F5C" }}>{p.date}</TableCell>
                <TableCell className="text-xs">{p.notes || "-"}</TableCell>
                <TableCell className="text-xs font-bold" style={{ color: "#2E5C31" }}>{c} {p.amount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {!detailPmts.length && <TableRow><TableCell colSpan={3} className="text-center text-xs py-4" style={{ color: "#5C5F5C" }}>No payments</TableCell></TableRow>}
          </TableBody></Table>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(o) => !o && setDeleteConfirm({...deleteConfirm, open: false})}>
        <AlertDialogContent className="border-[#E5E2DC]"><AlertDialogHeader><AlertDialogTitle>Delete Vendor?</AlertDialogTitle><AlertDialogDescription>Delete "{deleteConfirm.name}"?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="border-[#E5E2DC]">Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteVendor} className="text-white" style={{ background: "#A63D31" }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
