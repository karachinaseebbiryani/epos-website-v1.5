import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useCart } from "../contexts/CartContext";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Truck, Sparkles, Diamond, X as XIcon } from "lucide-react";
import { API, resolveImageUrl } from "../lib/api";
import PeopleAlsoBuy from "../components/PeopleAlsoBuy";
import { toast } from "sonner";

export default function CartPage() {
    const { items, updateQty, removeItem, subtotal, lineKey } = useCart();
    const [freeMin, setFreeMin] = useState(0);
    // V2: surface the selected Diamond reward and let the user clear it before going to checkout.
    const [reward, setReward] = useState(() => {
        try { const raw = localStorage.getItem("selected_reward"); return raw ? JSON.parse(raw) : null; } catch { return null; }
    });
    useEffect(() => {
        const sync = () => {
            try { const raw = localStorage.getItem("selected_reward"); setReward(raw ? JSON.parse(raw) : null); } catch { setReward(null); }
        };
        window.addEventListener("rewardSelectionChanged", sync);
        window.addEventListener("storage", sync);
        return () => {
            window.removeEventListener("rewardSelectionChanged", sync);
            window.removeEventListener("storage", sync);
        };
    }, []);
    const removeReward = () => {
        localStorage.removeItem("selected_reward");
        setReward(null);
        try { window.dispatchEvent(new Event("rewardSelectionChanged")); window.dispatchEvent(new Event("diamondsUpdated")); } catch { /* */ }
        toast.success("Reward removed — your Diamonds stay safe in your balance");
    };

    useEffect(() => {
        axios.get(`${API}/public/settings`).then(({ data }) => setFreeMin(Number(data?.free_delivery_min_subtotal || 0))).catch(() => {});
    }, []);

    if (items.length === 0) {
        return (
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-24 text-center" data-testid="cart-empty">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-neutral-100 flex items-center justify-center">
                    <ShoppingBag className="w-10 h-10 text-neutral-400" />
                </div>
                <h1 className="font-display font-black text-3xl text-brand-ink mb-3">Your cart is empty</h1>
                <p className="text-neutral-500 mb-8">Browse our menu and add your favorites!</p>
                <Link to="/menu" data-testid="cart-empty-cta" className="inline-flex items-center gap-2 bg-brand-red text-white rounded-full px-8 py-3.5 font-semibold hover:bg-brand-red-dark transition-colors">
                    Explore Menu <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-16" data-testid="cart-page">
            <h1 className="font-display font-black text-4xl md:text-5xl text-brand-ink mb-10">Your Cart</h1>

            {/* Free-delivery progress bar — shown only when restaurant has set a threshold */}
            {freeMin > 0 && (
                <FreeDeliveryProgress subtotal={subtotal} threshold={freeMin} />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-3">
                    {items.map((item) => {
                        const key = lineKey(item);
                        return (
                        <div key={key} data-testid={`cart-item-${key}`} className="bg-white border border-neutral-100 rounded-2xl p-4 flex gap-4 items-center shadow-sm">
                            <img src={resolveImageUrl(item.image_url)} alt={item.name} className="w-20 h-20 rounded-xl object-cover bg-neutral-100" />
                            <div className="flex-1 min-w-0">
                                <h3 className="font-display font-semibold text-brand-ink text-sm md:text-base leading-tight break-words">{item.base_name || item.name}</h3>
                                {item.variation_name && <p className="text-[11px] text-neutral-500 mt-0.5">Size: {item.variation_name}</p>}
                                <p className="text-brand-red font-bold mt-1 text-sm">Rs. {item.price}</p>
                            </div>
                            <div className="flex items-center gap-1.5 bg-neutral-100 rounded-full p-1">
                                <button
                                    data-testid={`cart-decrement-${key}`}
                                    onClick={() => updateQty(key, item.quantity - 1)}
                                    className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center"
                                    aria-label="Decrement"
                                >
                                    <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span data-testid={`cart-qty-${key}`} className="w-7 text-center font-bold text-sm">{item.quantity}</span>
                                <button
                                    data-testid={`cart-increment-${key}`}
                                    onClick={() => updateQty(key, item.quantity + 1)}
                                    className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center"
                                    aria-label="Increment"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <button
                                data-testid={`cart-remove-${key}`}
                                onClick={() => removeItem(key)}
                                className="w-9 h-9 rounded-full hover:bg-red-50 text-red-500 flex items-center justify-center"
                                aria-label="Remove"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        );
                    })}

                    {/* People also buy upsell strip */}
                    <PeopleAlsoBuy />
                </div>

                <aside className="lg:sticky lg:top-24 self-start">
                    <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
                        <h2 className="font-display font-bold text-xl text-brand-ink mb-4">Order Summary</h2>
                        {reward && (
                            <div data-testid="cart-reward-banner" className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
                                <Diamond className="w-4 h-4 text-amber-700 mt-0.5" fill="currentColor" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-amber-900 truncate">Reward: {reward.title}</div>
                                    <div className="text-[11px] text-amber-700">{reward.cost_diamonds} Diamonds will be deducted only when the order is placed.</div>
                                </div>
                                <button type="button" onClick={removeReward} data-testid="cart-reward-remove" className="text-amber-700 hover:text-red-600 p-1">
                                    <XIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                        {/* Show the free item line in the summary so customers see exactly what they're
                            getting BEFORE they place the order — not only on the tracking page. */}
                        {reward && reward.reward_type === "free_item" && (
                            <div data-testid="cart-free-item-line" className="mb-4 -mt-2 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                {reward.free_item_image && (
                                    <img src={reward.free_item_image} alt={reward.free_item_name} className="w-10 h-10 rounded-lg object-cover" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-emerald-900 line-clamp-1">1× {reward.free_item_name || "Free reward item"}</div>
                                    <div className="text-[10px] text-emerald-700 uppercase tracking-wider font-bold">FREE · Diamond Reward</div>
                                </div>
                                <span className="text-emerald-700 font-display font-black text-sm">Rs. 0</span>
                            </div>
                        )}
                        <div className="space-y-2 text-sm border-b border-neutral-100 pb-4 mb-4">
                            <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span className="font-semibold">Rs. {subtotal}</span></div>
                            <div className="flex justify-between"><span className="text-neutral-500">Delivery</span><span className="font-semibold text-green-600">Free</span></div>
                        </div>
                        <div className="flex justify-between mb-6">
                            <span className="font-display font-bold text-brand-ink">Total</span>
                            <span data-testid="cart-total" className="font-display font-black text-2xl text-brand-red">Rs. {subtotal}</span>
                        </div>
                        <Link
                            to="/checkout"
                            data-testid="cart-checkout-button"
                            className="block text-center bg-brand-red hover:bg-brand-red-dark text-white rounded-full px-8 py-3.5 font-bold transition-colors"
                        >
                            Proceed to Checkout
                        </Link>
                        <p className="text-xs text-neutral-400 text-center mt-3">Cash on Delivery available</p>
                    </div>
                </aside>
            </div>
        </div>
    );
}

function FreeDeliveryProgress({ subtotal, threshold }) {
    const reached = subtotal >= threshold;
    const remaining = Math.max(0, threshold - subtotal);
    const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
    return (
        <div data-testid="free-delivery-progress" className={`mb-6 rounded-2xl border p-4 md:p-5 flex items-center gap-3 transition-colors ${reached ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${reached ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}>
                {reached ? <Sparkles className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
                <p data-testid="free-delivery-message" className={`font-display font-bold text-sm md:text-base ${reached ? "text-emerald-800" : "text-amber-800"}`}>
                    {reached ? "🎉 You've unlocked FREE delivery!" : `Add Rs. ${remaining.toFixed(0)} more for FREE delivery`}
                </p>
                <div className="mt-2 h-2 rounded-full bg-white/70 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${reached ? "bg-emerald-600" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                </div>
            </div>
        </div>
    );
}

