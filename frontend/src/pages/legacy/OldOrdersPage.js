import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Search, Printer, Calendar, Receipt as ReceiptIcon, Filter } from "lucide-react";
import { toast } from "sonner";
import ReceiptModal from "../../components/legacy/ReceiptModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_LABELS = { cash: "CASH", credit: "CARD", foodpanda1: "FP1", foodpanda2: "FP2" };
const PAYMENT_COLORS = {
  cash: { bg: "#EAF4EB", fg: "#1E3F20" },
  credit: { bg: "#FDF2E9", fg: "#C05746" },
  foodpanda1: { bg: "#FCECEB", fg: "#D70F64" },
  foodpanda2: { bg: "#FCECEB", fg: "#D70F64" },
};

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

export default function OldOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [paymentType, setPaymentType] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [settings, setSettings] = useState({});
  const [currency, setCurrency] = useState("Rs");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate, limit: "500" });
      if (paymentType !== "all") params.set("payment_type", paymentType);
      if (search.trim()) params.set("q", search.trim());
      const { data } = await axios.get(`${API}/orders/history?${params}`, { withCredentials: true });
      setOrders(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load orders");
    } finally { setLoading(false); }
  }, [startDate, endDate, paymentType, search]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/settings`, { withCredentials: true });
        setSettings(data); setCurrency(data.currency || "Rs");
      } catch { /* ignore */ }
    })();
    fetchOrders();
  }, []);// eslint runs only on first mount – fetchOrders ref not needed

  const openReceipt = (o) => {
    setSelected({ ...o, currency });
    setReceiptOpen(true);
  };

  const totalValue = orders.reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="flex-1 p-6 md:p-8 overflow-auto" data-testid="old-orders-page">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Manrope, sans-serif", color: "#1A1D1A" }}>Old Orders</h1>
        <p className="text-sm mt-1" style={{ color: "#5C5F5C" }}>Browse, search & reprint past receipts.</p>
      </div>

      {/* Filter bar */}
      <Card className="border-[#E5E2DC] mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> From</Label>
              <Input data-testid="filter-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-[#E5E2DC]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> To</Label>
              <Input data-testid="filter-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-[#E5E2DC]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Filter className="w-3 h-3" /> Payment</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger data-testid="filter-payment-type" className="border-[#E5E2DC]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit">Card</SelectItem>
                  <SelectItem value="foodpanda1">FoodPanda 1</SelectItem>
                  <SelectItem value="foodpanda2">FoodPanda 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Search className="w-3 h-3" /> Search (receipt #, item, cashier)</Label>
              <Input data-testid="filter-search" placeholder="e.g. 5B77D5 or Biryani" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchOrders()} className="border-[#E5E2DC]" />
            </div>
            <Button data-testid="apply-filters-btn" onClick={fetchOrders} disabled={loading} className="text-white font-semibold" style={{ background: "#1E3F20" }}>
              {loading ? "Loading..." : "Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex items-center gap-4 mb-3 text-sm" style={{ color: "#5C5F5C" }}>
        <span><strong data-testid="orders-count" style={{ color: "#1A1D1A" }}>{orders.length}</strong> orders</span>
        <span>•</span>
        <span>Total: <strong data-testid="orders-total" style={{ color: "#1E3F20" }}>{currency} {totalValue.toFixed(2)}</strong></span>
      </div>

      {/* Orders list */}
      {orders.length === 0 ? (
        <Card className="border-[#E5E2DC]"><CardContent className="flex flex-col items-center py-20">
          <ReceiptIcon className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm" style={{ color: "#5C5F5C" }}>{loading ? "Loading orders..." : "No orders match your filters."}</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="orders-list">
          {orders.map((o) => {
            const pc = PAYMENT_COLORS[o.payment_type] || { bg: "#F9F8F6", fg: "#5C5F5C" };
            const dt = o.created_at ? new Date(o.created_at) : null;
            return (
              <Card key={o.id} data-testid={`order-card-${o.receipt_no}`} className="border-[#E5E2DC] hover:shadow-md transition-shadow cursor-pointer" onClick={() => openReceipt(o)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs" style={{ color: "#5C5F5C" }}>Receipt #</p>
                      <p className="font-bold text-base" style={{ fontFamily: "Manrope", color: "#1A1D1A" }}>{o.receipt_no}</p>
                    </div>
                    <Badge className="text-xs" style={{ background: pc.bg, color: pc.fg, border: "none" }}>
                      {PAYMENT_LABELS[o.payment_type] || o.payment_type?.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold mb-2" style={{ color: "#1E3F20", fontFamily: "Manrope" }}>{currency} {o.total?.toFixed(2)}</p>
                  <div className="text-xs space-y-0.5" style={{ color: "#5C5F5C" }}>
                    <p>{o.date} {dt && `• ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</p>
                    <p className="truncate">Cashier: {o.cashier_name || "—"}</p>
                    <p className="truncate">{(o.items || []).reduce((s, i) => s + i.quantity, 0)} items — {(o.items || []).map((i) => i.name).slice(0, 3).join(", ")}{(o.items || []).length > 3 ? "…" : ""}</p>
                  </div>
                  <Button data-testid={`reprint-btn-${o.receipt_no}`} onClick={(e) => { e.stopPropagation(); openReceipt(o); }}
                    variant="outline" className="w-full mt-3 flex items-center gap-2 text-xs border-[#E5E2DC]" size="sm">
                    <Printer className="w-3 h-3" /> View / Reprint
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ReceiptModal open={receiptOpen} onClose={setReceiptOpen} order={selected} settings={settings} currency={currency} />
    </div>
  );
}
