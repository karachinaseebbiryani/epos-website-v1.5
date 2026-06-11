import { Link, useLocation } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import { ShoppingBag } from "lucide-react";

export default function FloatingCart() {
    const { totalQty, subtotal } = useCart();
    const location = useLocation();
    if (totalQty === 0) return null;
    if (location.pathname.startsWith("/cart") || location.pathname.startsWith("/checkout") || location.pathname.startsWith("/admin")) return null;

    return (
        <Link
            to="/cart"
            data-testid="floating-cart-button"
            className="fixed bottom-24 md:bottom-6 right-4 md:right-8 z-30 bg-brand-red text-white rounded-full pl-5 pr-6 py-3.5 shadow-lg shadow-brand-red/30 flex items-center gap-3 hover:bg-brand-red-dark hover:scale-105 active:scale-95 transition-all animate-pulse-ring"
        >
            <ShoppingBag className="w-5 h-5" />
            <div className="flex flex-col leading-none">
                <span className="text-[11px] uppercase tracking-wider opacity-80 font-medium">View Cart</span>
                <span className="font-bold text-sm">{totalQty} item{totalQty > 1 ? "s" : ""} · Rs. {subtotal}</span>
            </div>
        </Link>
    );
}
