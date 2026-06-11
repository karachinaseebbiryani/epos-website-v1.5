import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useStaffAuth as useAuth } from "../../contexts/StaffAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { RotateCcw, DollarSign, Printer } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RefundsPage() {
  const { user } = useAuth();
  const [refunds, setRefunds] = useState([]);
  const [summary, setSummary] = useState(null);
  const [currency, setCurrency] = useState("Rs");
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [refundDialog, setRefundDialog] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const printRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [refRes, sumRes, setRes] = await Promise.all([
        axios.get(`${API}/refunds/today`, { withCredentials: true }),
        axios.get(`${API}/refunds/summary`, { withCredentials: true }),
        axios.get(`${API}/settings`, { withCredentials: true }),
      ]);
      setRefunds(refRes.data);
      setSummary(sumRes.data);
      setCurrency(setRes.data.currency || "Rs");
      setSettings(setRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const printRefundReceipt = (refund) => {
    const iframe = printRef.current;
    if (!iframe) return;
    const rName = settings?.restaurant_name || "KARACHI NASEEB BIRYANI";
    const dt = refund.created_at ? new Date(refund.created_at) : new Date();
    const html = `<html><head><style>body{font-family:'Courier New',monospace;padding:15px;font-size:12px;max-width:280px;color:#000}.center{text-align:center}.line{border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between;margin:2px 0}@media print{body{margin:0;padding:10px}@page{margin:3mm}}</style></head><body>
      <div class="center"><h3 style="margin:2px 0;font-size:14px">${rName}</h3><p style="font-size:12px;font-weight:bold;border:1px solid #000;padding:2px;margin:4px 0">REFUND RECEIPT</p></div><div class="line"></div>
      <div class="row"><span>Refund #:</span><span style="font-weight:bold">${refund.refund_no}</span></div>
      <div class="row"><span>Date:</span><span>${dt.toLocaleDateString()}</span></div>
      <div class="row"><span>Time:</span><span>${dt.toLocaleTimeString()}</span></div>
      <div class="row"><span>Processed by:</span><span>${refund.refunded_by_name}</span></div>
      ${refund.order_id ? `<div class="row"><span>Order Ref:</span><span>${refund.order_id.slice(-6).toUpperCase()}</span></div>` : ""}
      <div class="line"></div>
      <div class="row"><span>Reason:</span><span>${refund.reason}</span></div>
      <div class="line"></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold"><span>REFUND:</span><span>${currency} ${refund.amount.toFixed(2)}</span></div>
      <div class="line"></div><div class="center" style="font-size:10px">Customer copy</div>
    </body></html>`;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 300);
  };

  const submitRefund = async () => {
    if (!orderId.trim()) { toast.error("Receipt number is required for refund"); return; }
    if (!reason.trim() || !amount) { toast.error("Reason and amount required"); return; }
    try {
      const { data } = await axios.post(`${API}/refunds`, { order_id: orderId || "", reason, amount: parseFloat(amount) }, { withCredentials: true });
      toast.success(`Refund ${data.refund_no} processed`);
      setRefundDialog(false); setOrderId(""); setReason(""); setAmount("");
      // Auto-print refund receipt
      printRefundReceipt(data);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Refund failed - check permissions");
    }
  };

  const c = currency;
  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><p style={{ color: "#5C5F5C" }}>Loading...</p></div>;

  return (
    <div className="flex-1 p-6 md:p-8 overflow-auto" data-testid="refunds-page">
      <iframe ref={printRef} title="refund-print" style={{ position: "absolute", width: 0, height: 0, border: "none", left: "-9999px" }} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Manrope", color: "#1A1D1A" }}>Refunds</h1>
          <p className="text-sm mt-1" style={{ color: "#5C5F5C" }}>Process and track refunds</p>
        </div>
        <Button data-testid="new-refund-btn" onClick={() => setRefundDialog(true)} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#A63D31" }}>
          <RotateCcw className="w-4 h-4" /> New Refund
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card className="border-[#E5E2DC]"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#FCECEB" }}><DollarSign className="w-5 h-5" style={{ color: "#A63D31" }} /></div>
          <div><p className="text-xs uppercase tracking-wider" style={{ color: "#5C5F5C" }}>Today's Refunds</p><p className="text-xl font-bold" style={{ fontFamily: "Manrope", color: "#A63D31" }}>{c} {summary?.total_refunds?.toFixed(2) || "0.00"}</p></div>
        </CardContent></Card>
        <Card className="border-[#E5E2DC]"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#FDF2E9" }}><RotateCcw className="w-5 h-5" style={{ color: "#D97736" }} /></div>
          <div><p className="text-xs uppercase tracking-wider" style={{ color: "#5C5F5C" }}>Refund Count</p><p className="text-xl font-bold" style={{ fontFamily: "Manrope" }}>{summary?.count || 0}</p></div>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card className="border-[#E5E2DC]"><Table>
        <TableHeader><TableRow className="border-[#E5E2DC]">
          <TableHead style={{ color: "#5C5F5C" }}>Refund #</TableHead>
          <TableHead style={{ color: "#5C5F5C" }}>Reason</TableHead>
          <TableHead style={{ color: "#5C5F5C" }}>Amount</TableHead>
          <TableHead style={{ color: "#5C5F5C" }}>Processed By</TableHead>
          <TableHead style={{ color: "#5C5F5C" }}>Time</TableHead>
          <TableHead style={{ color: "#5C5F5C" }}>Print</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {refunds.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8" style={{ color: "#5C5F5C" }}>No refunds today</TableCell></TableRow>
          ) : refunds.map((r) => (
            <TableRow key={r.id} className="border-[#E5E2DC]">
              <TableCell className="font-mono text-sm font-bold" style={{ color: "#A63D31" }}>{r.refund_no}</TableCell>
              <TableCell style={{ color: "#1A1D1A" }}>{r.reason}</TableCell>
              <TableCell className="font-bold" style={{ color: "#A63D31" }}>{c} {r.amount.toFixed(2)}</TableCell>
              <TableCell style={{ color: "#5C5F5C" }}>{r.refunded_by_name}</TableCell>
              <TableCell style={{ color: "#5C5F5C" }}>{r.created_at ? new Date(r.created_at).toLocaleTimeString() : ""}</TableCell>
              <TableCell>
                <button onClick={() => printRefundReceipt(r)} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#EAF4EB]" style={{ color: "#1E3F20" }}><Printer className="w-4 h-4" /></button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></Card>

      {/* Refund Dialog */}
      <Dialog open={refundDialog} onOpenChange={setRefundDialog}>
        <DialogContent className="border-[#E5E2DC]">
          <DialogHeader><DialogTitle style={{ fontFamily: "Manrope" }}>Process Refund</DialogTitle><DialogDescription>Enter refund details. Requires refund permission.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Receipt / Order Number *</Label><Input data-testid="refund-order-id" placeholder="Required - enter receipt number" value={orderId} onChange={(e) => setOrderId(e.target.value)} className="border-[#E5E2DC]" /></div>
            <div className="space-y-1"><Label>Reason</Label><Input data-testid="refund-reason-input" placeholder="e.g., Wrong order, customer complaint" value={reason} onChange={(e) => setReason(e.target.value)} className="border-[#E5E2DC]" /></div>
            <div className="space-y-1"><Label>Refund Amount ({c})</Label><Input data-testid="refund-amount-input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="border-[#E5E2DC] text-lg font-bold" /></div>
          </div>
          <DialogFooter><Button data-testid="submit-refund-btn" onClick={submitRefund} className="text-white font-semibold" style={{ background: "#A63D31" }}>Process Refund</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
