import React, { useEffect, useState, useCallback, useMemo, memo, useRef } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import { fetchCached, getCached } from "../../lib/menuCache";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { ShoppingCart, Plus, Minus, Trash2, Banknote, CreditCard, Check, Percent, DollarSign, Pencil, Tag, X, Printer, Bike, Mic, Utensils, ChefHat } from "lucide-react";
import { toast } from "sonner";
import ReceiptModal from "../../components/legacy/ReceiptModal";
import VoiceAssistantModal from "../../components/legacy/VoiceAssistantModal";
import { printVendorTickets } from "../../utils/vendorTicketPrint";
import { printKitchenTicket } from "../../utils/kitchenTicketPrint";

// A POS cart line is keyed by item id (+ removals when present) so custom lines
// tally independently. Ported from Marhaba alongside the dine-in feature.
const posLineKey = (c) => {
  const remPart = (c.removed_ingredients && c.removed_ingredients.length) ? `::-${[...c.removed_ingredients].sort().join("|")}` : "";
  return `${c.item_id}${remPart}`;
};

// Stable per-line id used in dine-in mode so a "sent" line and a fresh "new" line
// of the same dish can coexist (and be updated/removed independently). In plain
// quick-sale mode lines have no uid, so lineId() falls back to posLineKey — keeping
// the existing behaviour byte-for-byte.
let _uidCounter = 0;
const makeUid = () => `L${Date.now().toString(36)}${(_uidCounter++).toString(36)}`;
const lineId = (c) => c.uid || posLineKey(c);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Pure helper – outside the component so it never causes re-renders
const luminanceTextColor = (hex) => {
  if (!hex) return "#1A1D1A";
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#1A1D1A";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return ((0.299 * r + 0.587 * g + 0.114 * b) / 255) > 0.6 ? "#1A1D1A" : "#FFFFFF";
};

// Memoized POS tile – only re-renders if its own props change.
// With 36+ items on screen, this stops a re-render storm every cart click.
const PosItemTile = memo(function PosItemTile({ item, currency, categoryColor, onAdd }) {
  const low = item.stock <= item.low_stock_threshold;
  const out = item.stock <= 0;
  const itemColor = item.color || categoryColor || null;
  const textColor = itemColor ? luminanceTextColor(itemColor) : "#1A1D1A";
  const priceColor = itemColor ? (textColor === "#FFFFFF" ? "#FFFFFF" : "#1E3F20") : "#1E3F20";
  return (
    <button
      data-testid={`pos-item-${item.id}`}
      onClick={() => onAdd(item)}
      disabled={out}
      className={`pos-item-btn flex flex-col items-center justify-center p-3 h-24 rounded-lg border shadow-sm transition-all ${out ? "opacity-50 cursor-not-allowed" : "hover:shadow-md hover:scale-[1.02] cursor-pointer"}`}
      style={{ background: itemColor || "white", borderColor: itemColor || "#E5E2DC" }}
    >
      <span className="text-sm font-semibold text-center leading-tight" style={{ color: textColor }}>{item.name}</span>
      <span className="text-xs font-bold mt-1" style={{ color: priceColor, opacity: itemColor && textColor === "#FFFFFF" ? 0.95 : 1 }}>{currency} {item.price.toFixed(2)}</span>
      {low && !out && <Badge className="mt-1 text-[10px] py-0" style={{ background: "#FDF2E9", color: "#D97736", border: "none" }}>Low: {item.stock}</Badge>}
      {out && <Badge className="mt-1 text-[10px] py-0" style={{ background: "#FCECEB", color: "#A63D31", border: "none" }}>Out of Stock</Badge>}
    </button>
  );
});

export default function POSPage() {
  // Seed state from the shared menu cache so the POS grid renders instantly
  // when the cashier reopens the page (was previously a 1-3 s blank screen
  // every time they came back from Inventory / Reports).
  const _seedCats = getCached("/categories")?.data;
  const _seedItems = getCached("/menu-items")?.data;
  const [categories, setCategories] = useState(_seedCats || []);
  const [menuItems, setMenuItems] = useState(_seedItems || []);
  const [activeCategory, setActiveCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(5);
  const [onlineTaxRate, setOnlineTaxRate] = useState(0);
  const [fp1TaxRate, setFp1TaxRate] = useState(0);
  const [fp2TaxRate, setFp2TaxRate] = useState(0);
  const [currency, setCurrency] = useState("Rs");
  const [settings, setSettings] = useState({});
  const [discountDialog, setDiscountDialog] = useState(false);
  const [discountType, setDiscountType] = useState("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [priceDialog, setPriceDialog] = useState(false);
  const [priceEditItem, setPriceEditItem] = useState(null);
  const [newPrice, setNewPrice] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);

  // --- Dine-in table mode ---------------------------------------------------
  // When the POS is opened from the Tables screen with ?openOrder=<id>&table=<name>
  // it binds to that table's OPEN order: items load from the server, adds persist
  // back to it, and payment closes the tab + frees the table. Without the param the
  // POS behaves exactly as the classic quick-sale screen.
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const openOrderId = searchParams.get("openOrder") || null;
  const tableName = searchParams.get("table") || "";
  const isTableMode = !!openOrderId;
  const hydratedRef = useRef(false); // true once the open order has loaded (guards the persist effect)
  const paidRef = useRef(false);     // true after a dine-in tab is paid → closing the bill returns to the floor

  const fetchData = useCallback(async () => {
    try {
      // Categories + menu-items go through the shared menu cache so opening
      // the POS for the second time skips the network entirely (until a menu
      // edit elsewhere busts the cache).
      const [cats, items, settingsRes] = await Promise.all([
        fetchCached("/categories", { allowStale: true }),
        fetchCached("/menu-items", { allowStale: true }),
        axios.get(`${API}/settings`, { withCredentials: true }),
      ]);
      setCategories(cats);
      setMenuItems(items);
      const s = settingsRes.data;
      setSettings(s);
      setTaxRate(s.tax_rate ?? 5);
      setOnlineTaxRate(s.online_tax_rate ?? 0);
      // Per-FoodPanda commission rates; fall back to legacy online_tax_rate
      setFp1TaxRate(s.foodpanda1_tax_rate != null ? s.foodpanda1_tax_rate : (s.online_tax_rate || 0));
      setFp2TaxRate(s.foodpanda2_tax_rate != null ? s.foodpanda2_tax_rate : (s.online_tax_rate || 0));
      setCurrency(s.currency || "Rs");
    } catch (err) { if (err.response?.status === 401) window.location.href = "/login"; }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Dine-in: load this table's OPEN order into the cart on mount.
  useEffect(() => {
    if (!openOrderId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/open-orders/${openOrderId}`, { withCredentials: true });
        if (cancelled) return;
        const loaded = (data.items || []).map((it) => ({
          item_id: it.item_id,
          name: it.name,
          price: Number(it.price),
          original_price: Number(it.original_price != null ? it.original_price : it.price),
          quantity: Number(it.quantity),
          removed_ingredients: it.removed_ingredients || [],
          uid: it.uid || makeUid(),
          kitchen_status: it.kitchen_status || "new",
        }));
        setCart(loaded);
        if (data.discount_type) setAppliedDiscount({ type: data.discount_type, value: data.discount_value });
        hydratedRef.current = true;
      } catch (err) {
        if (err.response?.status === 401) { window.location.href = "/login"; return; }
        toast.error("Could not load table order");
        hydratedRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [openOrderId]);

  // Dine-in: persist cart changes back to the open order (debounced) so re-opening
  // the table shows the same running tab.
  const persistTimer = useRef(null);
  useEffect(() => {
    if (!isTableMode || !hydratedRef.current) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const sub = cart.reduce((s, c) => s + c.price * c.quantity, 0);
      const disc = appliedDiscount ? (appliedDiscount.type === "percent" ? (sub * appliedDiscount.value) / 100 : Math.min(appliedDiscount.value, sub)) : 0;
      const after = sub - disc;
      const t = after * (taxRate / 100);
      axios.put(`${API}/open-orders/${openOrderId}`, {
        items: cart.map((c) => ({ uid: c.uid, item_id: c.item_id, name: c.name, price: c.price, original_price: c.original_price, quantity: c.quantity, removed_ingredients: c.removed_ingredients || [], kitchen_status: c.kitchen_status || "new" })),
        subtotal: Math.round(after * 100) / 100,
        tax: Math.round(t * 100) / 100,
        total: Math.round((after + t) * 100) / 100,
        discount_type: appliedDiscount?.type || null,
        discount_value: appliedDiscount?.value || 0,
        discount_amount: Math.round(disc * 100) / 100,
      }, { withCredentials: true }).catch(() => {});
    }, 500);
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current); };
  }, [cart, appliedDiscount, taxRate, isTableMode, openOrderId]);

  const filteredItems = useMemo(
    () => activeCategory === "all" ? menuItems : menuItems.filter((i) => i.category_id === activeCategory),
    [menuItems, activeCategory]
  );

  // Build a stable {categoryId: color} map so PosItemTile gets a primitive prop.
  // Without this, a new object would be created every render and break memoization.
  const categoryColorById = useMemo(() => {
    const m = {};
    for (const c of categories) m[c.id] = c.color || null;
    return m;
  }, [categories]);

  // Used only by category tabs (active state) – tiny use, OK to keep inline
  const getTextColor = luminanceTextColor;

  const addToCart = useCallback((item) => {
    if (item.stock <= 0) { toast.error(`${item.name} is out of stock!`); return; }
    setCart((prev) => {
      // Only merge into a line that hasn't been sent to the kitchen yet. In dine-in
      // mode a "sent" line is frozen, so tapping the dish again starts a fresh "new"
      // line (which the Send New button can then send). In quick-sale mode no line
      // is ever "sent", so this matches the previous merge behaviour exactly.
      const existing = prev.find((c) => c.item_id === item.id && (c.kitchen_status || "new") === "new");
      if (existing) {
        if (existing.quantity >= item.stock) { toast.error(`Only ${item.stock} in stock`); return prev; }
        return prev.map((c) => c === existing ? { ...c, quantity: c.quantity + 1 } : c);
      }
      if (item.stock <= item.low_stock_threshold) toast.warning(`Low stock: ${item.name} (${item.stock} left)`);
      const line = { item_id: item.id, name: item.name, price: item.price, original_price: item.price, quantity: 1 };
      if (isTableMode) { line.uid = makeUid(); line.kitchen_status = "new"; }
      return [...prev, line];
    });
  }, [isTableMode]);

  const updateQty = (key, delta) => { setCart((prev) => prev.map((c) => lineId(c) === key ? { ...c, quantity: c.quantity + delta } : c).filter((c) => c.quantity > 0)); };
  const removeFromCart = (key) => { setCart((prev) => prev.filter((c) => lineId(c) !== key)); };

  const openPriceEdit = (ci) => { setPriceEditItem(ci); setNewPrice(String(ci.price)); setPriceDialog(true); };
  const applyPriceChange = () => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) { toast.error("Enter a valid price"); return; }
    const editKey = lineId(priceEditItem);
    setCart((prev) => prev.map((c) => lineId(c) === editKey ? { ...c, price } : c));
    toast.success(`Price updated to ${currency} ${price.toFixed(2)}`);
    setPriceDialog(false);
  };

  const applyDiscount = () => {
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) { toast.error("Enter a valid discount value"); return; }
    if (discountType === "percent" && val > 100) { toast.error("Max 100%"); return; }
    setAppliedDiscount({ type: discountType, value: val });
    setDiscountDialog(false);
    toast.success(`Discount: ${discountType === "percent" ? `${val}%` : `${currency} ${val.toFixed(2)}`}`);
  };

  const removeDiscount = () => { setAppliedDiscount(null); toast.success("Discount removed"); };

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const discountAmount = appliedDiscount ? (appliedDiscount.type === "percent" ? (subtotal * appliedDiscount.value) / 100 : Math.min(appliedDiscount.value, subtotal)) : 0;
  const afterDiscount = subtotal - discountAmount;

  const getTaxForType = (type) => {
    if (type === "foodpanda1") return fp1TaxRate;
    if (type === "foodpanda2") return fp2TaxRate;
    return taxRate;
  };

  const placeOrder = async (paymentType) => {
    if (cart.length === 0) { toast.error("Cart is empty!"); return; }
    try {
      const isOnline = paymentType === "foodpanda1" || paymentType === "foodpanda2";

      // For FoodPanda payments, swap each cart item's price to its FP-specific price
      // (set in Menu Management). If no FP price set for an item, fall back to the
      // regular price the cashier already adjusted in the cart.
      const fpField = paymentType === "foodpanda1" ? "price_fp1" : paymentType === "foodpanda2" ? "price_fp2" : null;
      const effectiveCart = cart.map((c) => {
        if (!fpField) return c;
        const menuItem = menuItems.find((m) => m.id === c.item_id);
        const fpPrice = menuItem ? menuItem[fpField] : null;
        const usePrice = fpPrice != null && fpPrice !== "" ? Number(fpPrice) : c.price;
        return { ...c, price: usePrice };
      });

      const effSubtotal = effectiveCart.reduce((s, c) => s + c.price * c.quantity, 0);
      const effDiscount = appliedDiscount ? (appliedDiscount.type === "percent" ? (effSubtotal * appliedDiscount.value) / 100 : Math.min(appliedDiscount.value, effSubtotal)) : 0;
      const effAfter = effSubtotal - effDiscount;

      let taxAmt, totalAmt;
      if (isOnline) {
        const rate = paymentType === "foodpanda1" ? fp1TaxRate : fp2TaxRate;
        const commission = effAfter * (rate / 100);
        taxAmt = -commission; // negative = deduction (FP commission)
        totalAmt = effAfter - commission;
      } else {
        const currentTax = taxRate;
        taxAmt = effAfter * (currentTax / 100);
        totalAmt = effAfter + taxAmt;
      }
      const { data } = await axios.post(`${API}/orders`, {
        items: effectiveCart.map((c) => ({ item_id: c.item_id, name: c.name, price: c.price, original_price: c.original_price, quantity: c.quantity, removed_ingredients: c.removed_ingredients || [] })),
        payment_type: paymentType,
        subtotal: Math.round(effAfter * 100) / 100,
        tax: Math.round(taxAmt * 100) / 100,
        total: Math.round(totalAmt * 100) / 100,
        discount_type: appliedDiscount?.type || null,
        discount_value: appliedDiscount?.value || 0,
        discount_amount: Math.round(effDiscount * 100) / 100,
      }, { withCredentials: true });
      // Stock changed on the backend → invalidate the shared menu cache so the
      // post-order fetchData() below pulls fresh stock numbers.
      if (typeof window !== "undefined" && typeof window.__knb_menu_cache_bust === "function") {
        window.__knb_menu_cache_bust();
      }
      // Attach the effective cart so the receipt and kitchen ticket show the
      // exact lines even if the API echo omits any display detail.
      const enrichedOrder = { ...data, currency, items: (data.items && data.items.length ? data.items : effectiveCart) };
      setLastOrder(enrichedOrder);
      setOrderSuccess(true);

      // Kitchen ticket — items only, no prices. Prints on every order unless the
      // admin turned it off in Settings (print_kitchen_ticket). Gives the line
      // cook a clear "make this" copy. Ported from Marhaba with the dine-in feature.
      if (settings?.print_kitchen_ticket !== false) {
        setTimeout(() => printKitchenTicket(enrichedOrder, settings), 400);
      }
      const labels = { cash: "CASH", credit: "CARD", foodpanda1: "FOODPANDA 1", foodpanda2: "FOODPANDA 2" };
      toast.success(`Order placed! (${labels[paymentType] || paymentType})`);
      
      // Auto-print vendor tickets if outsourced items exist
      if (data.vendor_tickets && data.vendor_tickets.length > 0) {
        setTimeout(() => {
          printVendorTickets(data.vendor_tickets, settings);
          toast.info(`Printing ${data.vendor_tickets.length} vendor ticket(s)...`, { duration: 2000 });
        }, 1000); // Delay to avoid conflicting with customer receipt
      }
      
      setTimeout(() => { setCart([]); setOrderSuccess(false); setAppliedDiscount(null); setReceiptOpen(true); fetchData(); }, 800);
    } catch (err) {
      if (err.response?.status === 401) { toast.error("Session expired"); window.location.href = "/login"; }
      else toast.error(typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Failed to place order");
    }
  };

  // Dine-in: send only NEW items to the kitchen, then mark them sent (server is the
  // authority — it flips new→sent and returns exactly what was new this round).
  const sendNewItems = async () => {
    if (!openOrderId) return;
    if (cart.length === 0) { toast.error("Nothing to send"); return; }
    try {
      const { data } = await axios.post(`${API}/open-orders/${openOrderId}/send-kitchen`, {}, { withCredentials: true });
      const newItems = data.new_items || [];
      if (newItems.length === 0) { toast.info("No new items to send"); return; }
      // Kitchen ticket with ONLY the newly-sent items (no prices — same helper as quick-sale).
      printKitchenTicket({ items: newItems, receipt_no: `${tableName || "TABLE"}`, created_at: new Date().toISOString() }, settings);
      // Before send, every line is either already 'sent' or was 'new' → all are now sent.
      setCart((prev) => prev.map((c) => ({ ...c, kitchen_status: "sent" })));
      toast.success(`Sent ${newItems.length} item(s) to kitchen`);
    } catch (err) {
      if (err.response?.status === 401) { window.location.href = "/login"; return; }
      toast.error("Failed to send to kitchen");
    }
  };

  // Dine-in: reprint the FULL kitchen ticket for this tab (all items on the table),
  // without touching new/sent status. Recovers a KOT that failed or was cancelled at
  // the printer after the items were already marked sent — "Send New" would find
  // nothing new to send, so this is how staff get another copy.
  const reprintKitchen = () => {
    if (cart.length === 0) { toast.error("No items to print"); return; }
    printKitchenTicket({
      items: cart.map((c) => ({ name: c.name, quantity: c.quantity, removed_ingredients: c.removed_ingredients || [] })),
      receipt_no: `${tableName || "TABLE"} (REPRINT)`,
      created_at: new Date().toISOString(),
    }, settings);
    toast.success("Kitchen ticket reprinted");
  };

  // Dine-in: settle the tab. Finalises as a normal paid order (stock, reports,
  // vendor tickets), frees the table server-side, then returns to the floor.
  const payOpenOrder = async (paymentType) => {
    if (cart.length === 0) { toast.error("Cart is empty!"); return; }
    try {
      const sub = cart.reduce((s, c) => s + c.price * c.quantity, 0);
      const disc = appliedDiscount ? (appliedDiscount.type === "percent" ? (sub * appliedDiscount.value) / 100 : Math.min(appliedDiscount.value, sub)) : 0;
      const after = sub - disc;
      const t = after * (taxRate / 100);
      const { data } = await axios.post(`${API}/open-orders/${openOrderId}/pay`, {
        payment_type: paymentType,
        subtotal: Math.round(after * 100) / 100,
        tax: Math.round(t * 100) / 100,
        total: Math.round((after + t) * 100) / 100,
        discount_type: appliedDiscount?.type || null,
        discount_value: appliedDiscount?.value || 0,
        discount_amount: Math.round(disc * 100) / 100,
      }, { withCredentials: true });
      if (typeof window !== "undefined" && typeof window.__knb_menu_cache_bust === "function") window.__knb_menu_cache_bust();
      const enrichedOrder = { ...data, currency, items: (data.items && data.items.length ? data.items : cart) };
      setLastOrder(enrichedOrder);
      // At payment we print ONLY the customer receipt/bill. The kitchen already got
      // its ticket via "Send New" — reprinting the KOT here caused two print dialogs
      // where cancelling the kitchen one appeared to cancel the bill.
      hydratedRef.current = false; // stop the tab-persist effect (order is now closed)
      paidRef.current = true;      // closing the bill will return to the floor
      toast.success(`${tableName ? tableName + " " : ""}paid (${paymentType === "credit" ? "CARD" : "CASH"})`);
      setReceiptOpen(true); // opens the customer bill for review/print; closing it returns to the floor
    } catch (err) {
      if (err.response?.status === 401) { toast.error("Session expired"); window.location.href = "/login"; }
      else toast.error(typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Payment failed");
    }
  };

  // Dine-in: customer changed their mind before ordering. With ZERO items we can
  // simply cancel the tab and return the table to Available — no payment needed.
  const clearEmptyTable = async () => {
    if (!openOrderId) return;
    if (cart.length > 0) { toast.error("This order has items — settle it via payment."); return; }
    try {
      await axios.post(`${API}/open-orders/${openOrderId}/cancel`, {}, { withCredentials: true });
      hydratedRef.current = false;
      toast.success(`${tableName || "Table"} cleared`);
      navigate("/admin/tables");
    } catch (err) {
      if (err.response?.status === 401) { window.location.href = "/login"; return; }
      toast.error(typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Could not clear table");
    }
  };

  // Dynamic tax display
  const displayTax = taxRate;
  const tax = afterDiscount * (displayTax / 100);
  const total = afterDiscount + tax;

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] -m-4 md:-m-8" data-testid="pos-page">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h2 className="text-xl font-bold" style={{ fontFamily: "Manrope, sans-serif", color: "#1A1D1A" }}>Point of Sale</h2>
            {isTableMode ? (
              <div className="flex items-center gap-2" data-testid="pos-order-type-bar">
                <Badge className="flex items-center gap-1 text-xs" style={{ background: "#FCECEB", color: "#A63D31", border: "none" }}>
                  <Utensils className="w-3.5 h-3.5" /> Dine-In · {tableName || "Table"}
                </Badge>
                <button data-testid="pos-back-to-floor" onClick={() => navigate("/admin/tables")} className="text-xs font-semibold underline" style={{ color: "#1E3F20" }}>Back to Floor</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5" data-testid="pos-order-type-bar">
                <button data-testid="order-type-dinein" onClick={() => navigate("/admin/tables")} className="px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1" style={{ borderColor: "#E5E2DC", color: "#1E3F20" }}><Utensils className="w-3.5 h-3.5" /> Dine In</button>
                <button data-testid="order-type-takeaway" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: "#1E3F20" }}>Takeaway</button>
                <button data-testid="order-type-delivery" onClick={() => toast.info("Use the website or the FoodPanda buttons for delivery orders.")} className="px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1" style={{ borderColor: "#E5E2DC", color: "#5C5F5C" }}><Bike className="w-3.5 h-3.5" /> Delivery</button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pb-2" data-testid="category-tabs">
            <button data-testid="category-tab-all" onClick={() => setActiveCategory("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategory === "all" ? "text-white shadow-sm" : "border border-[#E5E2DC] hover:border-[#1E3F20]"}`}
              style={activeCategory === "all" ? { background: "#1E3F20" } : { color: "#5C5F5C" }}>All Items</button>
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              const catColor = cat.color || "#1E3F20";
              return (
                <button key={cat.id} data-testid={`category-tab-${cat.id}`} onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${isActive ? "shadow-sm" : "border-2 hover:opacity-80"}`}
                  style={isActive
                    ? { background: catColor, color: getTextColor(catColor) }
                    : { borderColor: cat.color || "#E5E2DC", color: cat.color || "#5C5F5C", background: "white" }
                  }>{cat.name}</button>
              );
            })}
          </div>
        </div>
        <ScrollArea className="flex-1 px-4 pb-4">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20" style={{ color: "#5C5F5C" }}><ShoppingCart className="w-12 h-12 mb-3 opacity-30" /><p className="text-sm">No items found.</p></div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-2">
              {filteredItems.map((item) => (
                <PosItemTile key={item.id} item={item} currency={currency} categoryColor={categoryColorById[item.category_id]} onAdd={addToCart} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Ticket Panel - stays fixed/sticky on the right; cart scrolls internally */}
      <div className="w-96 min-w-[380px] flex-shrink-0 ticket-panel border-l border-[#E5E2DC] bg-white flex flex-col overflow-hidden h-full" data-testid="ticket-panel">
        <div className="p-4 border-b border-[#E5E2DC] flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" style={{ color: "#1E3F20" }} />
            <h3 className="text-lg font-bold" style={{ fontFamily: "Manrope, sans-serif", color: "#1A1D1A" }}>Current Order</h3>
            <Badge className="ml-auto text-xs" style={{ background: "#EAF4EB", color: "#1E3F20", border: "none" }}>{cart.length} items</Badge>
          </div>
          {isTableMode && (
            <div className="mt-2 flex items-center gap-2 text-xs font-semibold" data-testid="ticket-table-indicator" style={{ color: "#A63D31" }}>
              <Utensils className="w-4 h-4" /> {tableName || "Table"} — open tab
              {cart.some((c) => (c.kitchen_status || "new") === "new") && (
                <Badge className="text-[10px] py-0" style={{ background: "#FDF2E9", color: "#D97736", border: "none" }}>
                  {cart.filter((c) => (c.kitchen_status || "new") === "new").length} new
                </Badge>
              )}
            </div>
          )}
        </div>
        <ScrollArea className="flex-1 min-h-0" data-testid="cart-scroll-area">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: "#5C5F5C" }}><ShoppingCart className="w-10 h-10 mb-2 opacity-20" /><p className="text-sm">Tap items to add</p></div>
          ) : (
            <div className="p-3 space-y-2">
              {cart.map((ci) => { const ck = lineId(ci); return (
                <div key={ck} data-testid={`cart-item-${ck}`} className="p-2 rounded-lg border border-[#E5E2DC] bg-[#F9F8F6]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#1A1D1A" }}>
                      {ci.name}
                      {isTableMode && ((ci.kitchen_status || "new") === "sent"
                        ? <Badge className="text-[9px] py-0 px-1" style={{ background: "#EAF4EB", color: "#1E3F20", border: "none" }}>sent</Badge>
                        : <Badge className="text-[9px] py-0 px-1" style={{ background: "#FDF2E9", color: "#D97736", border: "none" }}>new</Badge>)}
                    </p>
                    <p className="text-sm font-bold ml-2 whitespace-nowrap" style={{ color: "#1E3F20" }}>{currency} {(ci.price * ci.quantity).toFixed(2)}</p>
                  </div>
                  {ci.removed_ingredients && ci.removed_ingredients.length > 0 && (
                    <p className="text-[11px] font-semibold mb-1" style={{ color: "#A63D31" }}>✗ No {ci.removed_ingredients.join(", no ")}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: "#5C5F5C" }}>{currency} {ci.price.toFixed(2)} each</span>
                      {ci.price !== ci.original_price && <Badge className="text-[9px] py-0 px-1" style={{ background: "#FDF2E9", color: "#D97736", border: "none" }}>was {ci.original_price.toFixed(2)}</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button data-testid={`cart-price-edit-${ck}`} onClick={() => openPriceEdit(ci)} className="w-6 h-6 rounded flex items-center justify-center border border-[#E5E2DC] hover:bg-[#FDF2E9]"><Pencil className="w-2.5 h-2.5" style={{ color: "#D97736" }} /></button>
                      <button data-testid={`cart-decrease-${ck}`} onClick={() => updateQty(ck, -1)} className="w-6 h-6 rounded flex items-center justify-center border border-[#E5E2DC] hover:bg-[#E5E2DC]"><Minus className="w-2.5 h-2.5" /></button>
                      <span className="w-6 text-center text-sm font-bold" style={{ color: "#1A1D1A" }}>{ci.quantity}</span>
                      <button data-testid={`cart-increase-${ck}`} onClick={() => updateQty(ck, 1)} className="w-6 h-6 rounded flex items-center justify-center border border-[#E5E2DC] hover:bg-[#E5E2DC]"><Plus className="w-2.5 h-2.5" /></button>
                      <button data-testid={`cart-remove-${ck}`} onClick={() => removeFromCart(ck)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#FCECEB]" style={{ color: "#A63D31" }}><Trash2 className="w-2.5 h-2.5" /></button>
                    </div>
                  </div>
                </div>
              ); })}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-[#E5E2DC] flex-shrink-0 bg-white sticky bottom-0 shadow-[0_-4px_8px_-4px_rgba(0,0,0,0.05)]" data-testid="pos-checkout-section">
          {cart.length > 0 && !orderSuccess && (
            <div className="mb-3">
              {appliedDiscount ? (
                <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: "#FDF2E9" }}>
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4" style={{ color: "#D97736" }} />
                    <span className="text-sm font-medium" style={{ color: "#D97736" }}>{appliedDiscount.type === "percent" ? `${appliedDiscount.value}% off` : `${currency} ${appliedDiscount.value.toFixed(2)} off`}</span>
                    <span className="text-xs" style={{ color: "#5C5F5C" }}>(-{currency} {discountAmount.toFixed(2)})</span>
                  </div>
                  <button data-testid="remove-discount-btn" onClick={removeDiscount} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white" style={{ color: "#A63D31" }}><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <Button data-testid="add-discount-btn" onClick={() => { setDiscountValue(""); setDiscountDialog(true); }} variant="outline" className="w-full flex items-center gap-2 text-sm border-[#E5E2DC] border-dashed" style={{ color: "#D97736" }}><Tag className="w-4 h-4" /> Add Discount</Button>
              )}
            </div>
          )}

          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-sm"><span style={{ color: "#5C5F5C" }}>Subtotal</span><span style={{ color: "#1A1D1A" }}>{currency} {subtotal.toFixed(2)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-sm"><span style={{ color: "#D97736" }}>Discount</span><span style={{ color: "#D97736" }}>-{currency} {discountAmount.toFixed(2)}</span></div>}
            {taxRate > 0 && <div className="flex justify-between text-sm"><span style={{ color: "#5C5F5C" }}>Tax ({taxRate}%)</span><span style={{ color: "#1A1D1A" }}>{currency} {tax.toFixed(2)}</span></div>}
            {onlineTaxRate > 0 && <div className="flex justify-between text-[11px]"><span style={{ color: "#D70F64" }}>FoodPanda Commission ({onlineTaxRate}%)</span><span style={{ color: "#D70F64" }}>deducted on FP orders</span></div>}
            <Separator className="my-2" />
            <div className="flex justify-between text-lg font-bold"><span style={{ fontFamily: "Manrope, sans-serif", color: "#1A1D1A" }}>Total</span><span style={{ fontFamily: "Manrope, sans-serif", color: "#1E3F20" }}>{currency} {total.toFixed(2)}</span></div>
          </div>

          {orderSuccess ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-lg" style={{ background: "#EAF4EB", color: "#2E5C31" }}><Check className="w-5 h-5" /><span className="font-semibold">Order Placed!</span></div>
          ) : (
            <div className="space-y-2">
              {isTableMode ? (
                cart.length === 0 ? (
                  // Empty tab (customer changed their mind) → clear the table, no payment.
                  <Button data-testid="clear-table-btn" onClick={clearEmptyTable}
                    className="w-full flex items-center justify-center gap-2 font-semibold text-white" style={{ background: "#A63D31" }}>
                    <Trash2 className="w-4 h-4" /> Clear Table (no order)
                  </Button>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <Button data-testid="send-new-items-btn" onClick={sendNewItems}
                        disabled={!cart.some((c) => (c.kitchen_status || "new") === "new")}
                        className="col-span-2 flex items-center justify-center gap-2 font-semibold text-white" style={{ background: "#D97736" }}>
                        <ChefHat className="w-4 h-4" /> Send New
                        {cart.some((c) => (c.kitchen_status || "new") === "new") && ` (${cart.filter((c) => (c.kitchen_status || "new") === "new").length})`}
                      </Button>
                      <Button data-testid="reprint-kot-btn" onClick={reprintKitchen} variant="outline"
                        className="flex items-center justify-center gap-1 border-[#E5E2DC] text-sm" title="Reprint full kitchen ticket">
                        <Printer className="w-4 h-4" /> KOT
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button data-testid="pay-cash-btn" onClick={() => payOpenOrder("cash")} disabled={cart.length === 0} className="flex items-center justify-center gap-1 font-semibold text-white text-sm" style={{ background: "#1E3F20" }}><Banknote className="w-4 h-4" /> Pay Cash</Button>
                      <Button data-testid="pay-credit-btn" onClick={() => payOpenOrder("credit")} disabled={cart.length === 0} className="flex items-center justify-center gap-1 font-semibold text-white text-sm" style={{ background: "#C05746" }}><CreditCard className="w-4 h-4" /> Pay Card</Button>
                    </div>
                  </>
                )
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  <Button data-testid="pay-cash-btn" onClick={() => placeOrder("cash")} disabled={cart.length === 0} className="flex items-center gap-1 font-semibold text-white text-xs" style={{ background: "#1E3F20" }}><Banknote className="w-4 h-4" /> Cash</Button>
                  <Button data-testid="pay-credit-btn" onClick={() => placeOrder("credit")} disabled={cart.length === 0} className="flex items-center gap-1 font-semibold text-white text-xs" style={{ background: "#C05746" }}><CreditCard className="w-4 h-4" /> Card</Button>
                  <Button data-testid="pay-fp1-btn" onClick={() => placeOrder("foodpanda1")} disabled={cart.length === 0} className="flex items-center gap-1 font-semibold text-white text-xs" style={{ background: "#D70F64" }}><Bike className="w-4 h-4" /> FP1</Button>
                  <Button data-testid="pay-fp2-btn" onClick={() => placeOrder("foodpanda2")} disabled={cart.length === 0} className="flex items-center gap-1 font-semibold text-white text-xs" style={{ background: "#D70F64" }}><Bike className="w-4 h-4" /> FP2</Button>
                </div>
              )}
              {lastOrder && (
                <div className="grid grid-cols-2 gap-2">
                  <Button data-testid="reprint-receipt-btn" onClick={() => setReceiptOpen(true)} variant="outline" className="w-full flex items-center gap-2 text-sm border-[#E5E2DC]"><Printer className="w-4 h-4" /> Receipt</Button>
                  <Button data-testid="print-kitchen-btn" onClick={() => printKitchenTicket(lastOrder, settings)} variant="outline" className="w-full flex items-center gap-2 text-sm border-[#E5E2DC]"><Printer className="w-4 h-4" /> Kitchen</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Discount Dialog */}
      <Dialog open={discountDialog} onOpenChange={setDiscountDialog}>
        <DialogContent className="border-[#E5E2DC] max-w-sm">
          <DialogHeader><DialogTitle style={{ fontFamily: "Manrope" }}>Apply Discount</DialogTitle><DialogDescription>Choose type and value</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button data-testid="discount-type-percent" onClick={() => setDiscountType("percent")} className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium ${discountType === "percent" ? "text-white border-transparent" : "border-[#E5E2DC]"}`} style={discountType === "percent" ? { background: "#D97736" } : { color: "#5C5F5C" }}><Percent className="w-4 h-4" /> Percentage</button>
              <button data-testid="discount-type-flat" onClick={() => setDiscountType("flat")} className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium ${discountType === "flat" ? "text-white border-transparent" : "border-[#E5E2DC]"}`} style={discountType === "flat" ? { background: "#D97736" } : { color: "#5C5F5C" }}><DollarSign className="w-4 h-4" /> Flat Amount</button>
            </div>
            <div className="space-y-2">
              <Label>{discountType === "percent" ? "Discount %" : `Discount (${currency})`}</Label>
              <Input data-testid="discount-value-input" type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="border-[#E5E2DC] text-lg font-bold text-center" />
            </div>
          </div>
          <DialogFooter><Button data-testid="apply-discount-btn" onClick={applyDiscount} className="text-white font-semibold" style={{ background: "#D97736" }}>Apply Discount</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Change Dialog */}
      <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
        <DialogContent className="border-[#E5E2DC] max-w-sm">
          <DialogHeader><DialogTitle style={{ fontFamily: "Manrope" }}>Change Price</DialogTitle><DialogDescription>For {priceEditItem?.name} (this order only)</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="text-center"><p className="text-xs" style={{ color: "#5C5F5C" }}>Original</p><p className="text-lg font-bold line-through" style={{ color: "#5C5F5C" }}>{currency} {priceEditItem?.original_price?.toFixed(2)}</p></div>
            <div className="space-y-2"><Label>New Price ({currency})</Label><Input data-testid="new-price-input" type="number" step="0.01" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="border-[#E5E2DC] text-lg font-bold text-center" /></div>
          </div>
          <DialogFooter>
            <Button data-testid="reset-price-btn" onClick={() => setNewPrice(String(priceEditItem?.original_price || 0))} variant="outline" className="border-[#E5E2DC]">Reset</Button>
            <Button data-testid="apply-price-btn" onClick={applyPriceChange} className="text-white font-semibold" style={{ background: "#1E3F20" }}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptModal open={receiptOpen} onClose={(v) => {
        setReceiptOpen(v);
        // After settling a dine-in tab, closing the bill returns to the floor.
        if (!v && paidRef.current) { paidRef.current = false; navigate("/admin/tables"); }
      }} order={lastOrder} settings={settings} currency={currency} />

      {/* Floating voice assistant mic */}
      <button
        data-testid="voice-assistant-fab"
        onClick={() => setVoiceOpen(true)}
        className="fixed bottom-6 right-[420px] w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        style={{ background: "#1E3F20", color: "white", zIndex: 40 }}
        title="Voice order (Urdu / Punjabi)"
      >
        <Mic className="w-6 h-6" />
      </button>

      <VoiceAssistantModal
        open={voiceOpen}
        onClose={setVoiceOpen}
        currency={currency}
        menuItems={menuItems}
        onConfirm={(items) => {
          // Merge voice-parsed items into cart
          setCart((prev) => {
            const next = [...prev];
            items.forEach((vi) => {
              const menuItem = menuItems.find((m) => m.id === vi.item_id);
              // Never merge into a line already sent to the kitchen (dine-in) —
              // start a fresh "new" line instead, same rule as tapping a tile.
              const existing = next.find((c) => c.item_id === vi.item_id && (c.kitchen_status || "new") === "new");
              if (existing) existing.quantity += vi.quantity;
              else {
                const line = {
                  item_id: vi.item_id,
                  name: vi.name,
                  price: vi.price,
                  original_price: menuItem?.price ?? vi.price,
                  quantity: vi.quantity,
                };
                if (isTableMode) { line.uid = makeUid(); line.kitchen_status = "new"; }
                next.push(line);
              }
            });
            return next;
          });
        }}
      />
    </div>
  );
}
