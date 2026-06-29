import { useEffect, useState } from "react";
import axios from "axios";
import { useCart } from "../contexts/CartContext";
import { API } from "../lib/api";
import { resolveImageUrl } from "../lib/api";        // for files in /pages
// or
import { resolveImageUrl } from "../../lib/api";    // for files in /pages/admin and /components
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

/**
 * "People also buy" upsell strip — shown on /cart and /checkout.
 * Calls POST /api/menu/upsell with the current cart's item_ids and renders up to N suggestions.
 */
export default function PeopleAlsoBuy({ limit = 4, compact = false, title = "People also buy" }) {
    const { items: cartItems, addItem } = useCart();
    const [picker, setPicker] = useState(null); // {item}
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Build a unique list of menu item ids in the cart (variations share the same item_id)
    const cartItemIds = Array.from(new Set(cartItems.map((i) => i.item_id))).join(",");

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            try {
                const ids = cartItemIds ? cartItemIds.split(",") : [];
                const { data } = await axios.post(`${API}/menu/upsell`, { item_ids: ids, limit });
                if (!cancelled) setSuggestions(data.items || []);
            } catch (e) {
                if (!cancelled) setSuggestions([]);
            } finally { if (!cancelled) setLoading(false); }
        };
        run();
        return () => { cancelled = true; };
    }, [cartItemIds, limit]);

    const handleAdd = (item) => {
        if (item.variations && item.variations.length > 0) {
            setPicker({ item });
        } else {
            addItem(item);
            toast.success(`${item.name} added`);
        }
    };

    if (loading || suggestions.length === 0) return null;

    return (
        <section data-testid="people-also-buy" className={`bg-white border border-neutral-100 rounded-2xl ${compact ? "p-4" : "p-5 md:p-6"} mb-6`}>
            <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand-yellow" />
                <h3 className="font-display font-bold text-base md:text-lg text-brand-ink">{title}</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-2 px-2 pb-1 snap-x snap-mandatory">
                {suggestions.map((s) => (
                    <UpsellCard key={s.id} item={s} compact={compact} onAdd={() => handleAdd(s)} />
                ))}
            </div>
            {picker && (
                <UpsellVariationPicker
                    item={picker.item}
                    onClose={() => setPicker(null)}
                    onPick={(variation, qty) => {
                        addItem(picker.item, qty, variation);
                        toast.success(`${picker.item.name} (${variation.name}) added`);
                        setPicker(null);
                    }}
                />
            )}
        </section>
    );
}

function UpsellCard({ item, compact, onAdd }) {
    const hasVar = item.variations && item.variations.length > 0;
    const w = compact ? "w-32" : "w-36 md:w-40";
    return (
        <div data-testid={`upsell-item-${item.id}`} className={`shrink-0 snap-start ${w} bg-neutral-50 rounded-2xl overflow-hidden border border-neutral-100 hover:border-brand-red transition-colors`}>
            <div className="aspect-square bg-neutral-100 relative">
                {item.image_url
                    ? <img src={resolveImageUrl(item.image_url)} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gradient-to-br from-brand-yellow/30 to-brand-red/20" />}
                <div className="absolute top-1.5 right-1.5 flex flex-col gap-0.5 items-end">
                    {item.discount_percent > 0 && (
                        <span className="bg-green-600 text-white text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">{item.discount_percent}% OFF</span>
                    )}
                    {item.is_bestseller && (
                        <span className="bg-brand-red text-white text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">Best</span>
                    )}
                </div>
            </div>
            <div className="p-2.5">
                <h4 className="font-display font-semibold text-xs text-brand-ink line-clamp-1 leading-tight">{item.name}</h4>
                <div className="flex items-center justify-between mt-1.5 gap-1">
                    <div className="leading-none">
                        <span className="font-display font-black text-sm text-brand-red">
                            {hasVar ? `From Rs. ${Math.min(...item.variations.map((v) => Number(v.price) || 0))}` : `Rs. ${item.price}`}
                        </span>
                        {item.original_price && item.original_price > item.price && (
                            <div className="text-[10px] text-neutral-400 line-through font-medium">Rs. {item.original_price}</div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onAdd}
                        data-testid={`upsell-add-${item.id}`}
                        aria-label={`Add ${item.name}`}
                        className="bg-brand-ink hover:bg-brand-red text-white rounded-full w-7 h-7 inline-flex items-center justify-center transition-colors shrink-0"
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Lightweight variation picker — a clone of MenuPage's VariationPicker so this component is self-contained.
function UpsellVariationPicker({ item, onClose, onPick }) {
    const [selected, setSelected] = useState(item.variations[0]?.name || "");
    const [qty, setQty] = useState(1);
    const variation = item.variations.find((v) => v.name === selected) || item.variations[0];
    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} data-testid="upsell-variation-picker">
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 md:p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-wider text-brand-red font-bold">Choose your size</p>
                    <h3 className="font-display font-black text-xl text-brand-ink">{item.name}</h3>
                </div>
                <div className="space-y-2 mb-4">
                    {item.variations.map((v) => (
                        <label key={v.name} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${selected === v.name ? "border-brand-red bg-red-50/60" : "border-neutral-200"}`}>
                            <span className="flex items-center gap-3">
                                <input type="radio" name="upsell-variation" value={v.name} checked={selected === v.name} onChange={() => setSelected(v.name)} className="accent-brand-red" />
                                <span className="font-semibold text-brand-ink">{v.name}</span>
                            </span>
                            <span className="font-display font-black text-brand-red">Rs. {v.price}</span>
                        </label>
                    ))}
                </div>
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-neutral-600">Quantity</span>
                    <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1">
                        <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-full hover:bg-white font-bold">−</button>
                        <span className="w-8 text-center font-bold text-sm">{qty}</span>
                        <button type="button" onClick={() => setQty((q) => q + 1)} className="w-8 h-8 rounded-full hover:bg-white font-bold">+</button>
                    </div>
                </div>
                <button type="button" onClick={() => onPick(variation, qty)} className="w-full bg-brand-red text-white rounded-full py-3 font-bold uppercase tracking-wider text-sm">
                    Add · Rs. {Number(variation.price) * qty}
                </button>
            </div>
        </div>
    );
}
