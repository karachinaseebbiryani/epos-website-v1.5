import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "knb_cart_v1";

// A cart line is identified by `line_id = item_id` OR `${item_id}::${variation_name}` when a variation is picked.
// The `item_id` field still mirrors the menu item id so the backend order schema is unchanged.
const lineKey = (it) => it.variation_name ? `${it.item_id}::${it.variation_name}` : it.item_id;

export function CartProvider({ children }) {
    const [items, setItems] = useState(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        // V2: if the cart goes empty by any path (remove last item, etc.), also drop any
        // reserved Diamond reward — see clear() comment.
        if (items.length === 0) {
            try {
                const had = localStorage.getItem("selected_reward");
                localStorage.removeItem("selected_reward");
                if (had) window.dispatchEvent(new Event("rewardSelectionChanged"));
            } catch { /* */ }
        }
    }, [items]);

    /**
     * Add a menu item to the cart.
     * @param {object} item - the menu item from /api/menu
     * @param {number} qty - quantity to add (default 1)
     * @param {object|null} variation - optional {name, price} variation override
     */
    const addItem = (item, qty = 1, variation = null) => {
        const variation_name = variation?.name || null;
        const price = variation ? Number(variation.price) : Number(item.price);
        const display_name = variation_name ? `${item.name} (${variation_name})` : item.name;
        const line = { item_id: item.id, name: display_name, base_name: item.name, variation_name, price, image_url: item.image_url, quantity: qty };
        const key = lineKey(line);

        setItems((prev) => {
            const existing = prev.find((i) => lineKey(i) === key);
            if (existing) {
                return prev.map((i) => lineKey(i) === key ? { ...i, quantity: i.quantity + qty } : i);
            }
            return [...prev, line];
        });
    };

    const updateQty = (key, qty) => {
        if (qty <= 0) return removeItem(key);
        setItems((prev) => prev.map((i) => lineKey(i) === key ? { ...i, quantity: qty } : i));
    };

    const removeItem = (key) => setItems((prev) => prev.filter((i) => lineKey(i) !== key));
    const clear = () => {
        setItems([]);
        // V2: When the cart is fully cleared, also drop any reserved Diamond reward so the
        // customer doesn't carry a phantom reward to the next checkout. Diamonds were never
        // actually debited (debit only happens server-side on order creation), so this is
        // purely a UX cleanup.
        try { localStorage.removeItem("selected_reward"); window.dispatchEvent(new Event("rewardSelectionChanged")); } catch { /* */ }
    };

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);

    return (
        <CartContext.Provider value={{ items, addItem, updateQty, removeItem, clear, subtotal, totalQty, lineKey }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    return useContext(CartContext);
}
