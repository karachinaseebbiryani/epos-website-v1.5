import React, { useEffect, useState, useCallback, useMemo, memo } from "react";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { ShoppingCart, Plus, Minus, Trash2, Banknote, CreditCard, Check, Percent, DollarSign, Pencil, Tag, X, Printer, Bike, Mic } from "lucide-react";
import { toast } from "sonner";
import ReceiptModal from "../components/ReceiptModal";
import VoiceAssistantModal from "../components/VoiceAssistantModal";

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
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
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

  const fetchData = useCallback(async () => {
    try {
      const [catRes, itemRes, settingsRes] = await Promise.all([
        axios.get(`${API}/categories`, { withCredentials: true }),
        axios.get(`${API}/menu-items`, { withCredentials: true }),
        axios.get(`${API}/settings`, { withCredentials: true }),
      ]);
      setCategories(catRes.data);
      setMenuItems(itemRes.data);
      const s = settingsRes.data;
      setSettings(s);
      setTaxRate(s.tax_rate || 5);
      setOnlineTaxRate(s.online_tax_rate || 0);
      // Per-FoodPanda commission rates; fall back to legacy online_tax_rate
      setFp1TaxRate(s.foodpanda1_tax_rate != null ? s.foodpanda1_tax_rate : (s.online_tax_rate || 0));
      setFp2TaxRate(s.foodpanda2_tax_rate != null ? s.foodpanda2_tax_rate : (s.online_tax_rate || 0));
      setCurrency(s.currency || "Rs");
    } catch (err) { if (err.response?.status === 401) window.location.href = "/login"; }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      const existing = prev.find((c) => c.item_id === item.id);
      if (existing) {
        if (existing.quantity >= item.stock) { toast.error(`Only ${item.stock} in stock`); return prev; }
        return prev.map((c) => c.item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      if (item.stock <= item.low_stock_threshold) toast.warning(`Low stock: ${item.name} (${item.stock} left)`);
      return [...prev, { item_id: item.id, name: item.name, price: item.price, original_price: item.price, quantity: 1 }];
    });
  }, []);

  const updateQty = (itemId, delta) => { setCart((prev) => prev.map((c) => c.item_id === itemId ? { ...c, quantity: c.quantity + delta } : c).filter((c) => c.quantity > 0)); };
  const removeFromCart = (itemId) => { setCart((prev) => prev.filter((c) => c.item_id !== itemId)); };

  const openPriceEdit = (ci) => { setPriceEditItem(ci); setNewPrice(String(ci.price)); setPriceDialog(true); };
  const applyPriceChange = () => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) { toast.error("Enter a valid price"); return; }
    setCart((prev) => prev.map((c) => c.item_id === priceEditItem.item_id ? { ...c, price } : c));
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
        items: effectiveCart.map((c) => ({ item_id: c.item_id, name: c.name, price: c.price, original_price: c.original_price, quantity: c.quantity })),
        payment_type: paymentType,
        subtotal: Math.round(effAfter * 100) / 100,
        tax: Math.round(taxAmt * 100) / 100,
        total: Math.round(totalAmt * 100) / 100,
        discount_type: appliedDiscount?.type || null,
        discount_value: appliedDiscount?.value || 0,
        discount_amount: Math.round(effDiscount * 100) / 100,
      }, { withCredentials: true });
      setLastOrder({ ...data, currency });
      setOrderSuccess(true);
      const labels = { cash: "CASH", credit: "CARD", foodpanda1: "FOODPANDA 1", foodpanda2: "FOODPANDA 2" };
      toast.success(`Order placed! (${labels[paymentType] || paymentType})`);
      setTimeout(() => { setCart([]); setOrderSuccess(false); setAppliedDiscount(null); setReceiptOpen(true); fetchData(); }, 800);
    } catch (err) {
      if (err.response?.status === 401) { toast.error("Session expired"); window.location.href = "/login"; }
      else toast.error(typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Failed to place order");
    }
  };

  // Dynamic tax display
  const displayTax = taxRate;
  const tax = afterDiscount * (displayTax / 100);
  const total = afterDiscount + tax;

  return (
    <div className="flex-1 flex overflow-hidden" data-testid="pos-page">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-xl font-bold mb-3" style={{ fontFamily: "Manrope, sans-serif", color: "#1A1D1A" }}>Point of Sale</h2>
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

      {/* Ticket Panel - stays fixed/sticky on the right */}
      <div className="w-96 min-w-[380px] flex-shrink-0 ticket-panel border-l border-[#E5E2DC] bg-white flex flex-col overflow-hidden" data-testid="ticket-panel">
        <div className="p-4 border-b border-[#E5E2DC]">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" style={{ color: "#1E3F20" }} />
            <h3 className="text-lg font-bold" style={{ fontFamily: "Manrope, sans-serif", color: "#1A1D1A" }}>Current Order</h3>
            <Badge className="ml-auto text-xs" style={{ background: "#EAF4EB", color: "#1E3F20", border: "none" }}>{cart.length} items</Badge>
          </div>
        </div>
        <ScrollArea className="flex-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: "#5C5F5C" }}><ShoppingCart className="w-10 h-10 mb-2 opacity-20" /><p className="text-sm">Tap items to add</p></div>
          ) : (
            <div className="p-3 space-y-2">
              {cart.map((ci) => (
                <div key={ci.item_id} data-testid={`cart-item-${ci.item_id}`} className="p-2 rounded-lg border border-[#E5E2DC] bg-[#F9F8F6]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold" style={{ color: "#1A1D1A" }}>{ci.name}</p>
                    <p className="text-sm font-bold ml-2 whitespace-nowrap" style={{ color: "#1E3F20" }}>{currency} {(ci.price * ci.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: "#5C5F5C" }}>{currency} {ci.price.toFixed(2)} each</span>
                      {ci.price !== ci.original_price && <Badge className="text-[9px] py-0 px-1" style={{ background: "#FDF2E9", color: "#D97736", border: "none" }}>was {ci.original_price.toFixed(2)}</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button data-testid={`cart-price-edit-${ci.item_id}`} onClick={() => openPriceEdit(ci)} className="w-6 h-6 rounded flex items-center justify-center border border-[#E5E2DC] hover:bg-[#FDF2E9]"><Pencil className="w-2.5 h-2.5" style={{ color: "#D97736" }} /></button>
                      <button data-testid={`cart-decrease-${ci.item_id}`} onClick={() => updateQty(ci.item_id, -1)} className="w-6 h-6 rounded flex items-center justify-center border border-[#E5E2DC] hover:bg-[#E5E2DC]"><Minus className="w-2.5 h-2.5" /></button>
                      <span className="w-6 text-center text-sm font-bold" style={{ color: "#1A1D1A" }}>{ci.quantity}</span>
                      <button data-testid={`cart-increase-${ci.item_id}`} onClick={() => updateQty(ci.item_id, 1)} className="w-6 h-6 rounded flex items-center justify-center border border-[#E5E2DC] hover:bg-[#E5E2DC]"><Plus className="w-2.5 h-2.5" /></button>
                      <button data-testid={`cart-remove-${ci.item_id}`} onClick={() => removeFromCart(ci.item_id)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#FCECEB]" style={{ color: "#A63D31" }}><Trash2 className="w-2.5 h-2.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 pb-16 border-t border-[#E5E2DC]">
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
              <div className="grid grid-cols-4 gap-2">
                <Button data-testid="pay-cash-btn" onClick={() => placeOrder("cash")} disabled={cart.length === 0} className="flex items-center gap-1 font-semibold text-white text-xs" style={{ background: "#1E3F20" }}><Banknote className="w-4 h-4" /> Cash</Button>
                <Button data-testid="pay-credit-btn" onClick={() => placeOrder("credit")} disabled={cart.length === 0} className="flex items-center gap-1 font-semibold text-white text-xs" style={{ background: "#C05746" }}><CreditCard className="w-4 h-4" /> Card</Button>
                <Button data-testid="pay-fp1-btn" onClick={() => placeOrder("foodpanda1")} disabled={cart.length === 0} className="flex items-center gap-1 font-semibold text-white text-xs" style={{ background: "#D70F64" }}><Bike className="w-4 h-4" /> FP1</Button>
                <Button data-testid="pay-fp2-btn" onClick={() => placeOrder("foodpanda2")} disabled={cart.length === 0} className="flex items-center gap-1 font-semibold text-white text-xs" style={{ background: "#D70F64" }}><Bike className="w-4 h-4" /> FP2</Button>
              </div>
              {lastOrder && <Button data-testid="reprint-receipt-btn" onClick={() => setReceiptOpen(true)} variant="outline" className="w-full flex items-center gap-2 text-sm border-[#E5E2DC]"><Printer className="w-4 h-4" /> Reprint Last Receipt</Button>}
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

      <ReceiptModal open={receiptOpen} onClose={setReceiptOpen} order={lastOrder} settings={settings} currency={currency} />

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
        onConfirm={(items) => {
          // Merge voice-parsed items into cart
          setCart((prev) => {
            const next = [...prev];
            items.forEach((vi) => {
              const menuItem = menuItems.find((m) => m.id === vi.item_id);
              const existing = next.find((c) => c.item_id === vi.item_id);
              if (existing) existing.quantity += vi.quantity;
              else next.push({
                item_id: vi.item_id,
                name: vi.name,
                price: vi.price,
                original_price: menuItem?.price ?? vi.price,
                quantity: vi.quantity,
              });
            });
            return next;
          });
        }}
      />
    </div>
  );
}
