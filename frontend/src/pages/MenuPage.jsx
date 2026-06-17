import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { useCart } from "../contexts/CartContext";
import { Plus, Search, LayoutGrid, Rows3, X } from "lucide-react";
import { toast } from "sonner";

const DENSITY_KEY = "knb_menu_density_v1"; // "compact" | "comfortable"

export default function MenuPage() {
    const [data, setData] = useState({ categories: [], items: [] });
    const [activeCat, setActiveCat] = useState("all");
    const [query, setQuery] = useState("");
    const [picker, setPicker] = useState(null); // {item, defaultIdx}
    const [density, setDensity] = useState(() => localStorage.getItem(DENSITY_KEY) || "compact");
    const { addItem } = useCart();

    useEffect(() => { localStorage.setItem(DENSITY_KEY, density); }, [density]);

    useEffect(() => {
        api.get("/menu").then((r) => setData(r.data)).catch(() => toast.error("Failed to load menu"));
    }, []);

    const filtered = useMemo(() => {
        let items = data.items;
        if (activeCat !== "all") items = items.filter((i) => i.category_id === activeCat);
        if (query.trim()) {
            const q = query.toLowerCase();
            items = items.filter((i) => i.name.toLowerCase().includes(q));
        }
        return items;
    }, [data.items, activeCat, query]);

    const handleAdd = (item) => {
        if (item.variations && item.variations.length > 0) {
            setPicker({ item });
        } else {
            addItem(item);
            toast.success(`${item.name} added`);
        }
    };

    // Tailwind grid: compact => 2 cols on mobile, 3 on tablet, 4 on desktop / comfortable => 1, 2, 3.
    const gridCls = density === "compact"
        ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5"
        : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6";

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16" data-testid="menu-page">
            <div className="mb-6 md:mb-10">
                <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Our Menu</span>
                <h1 className="font-display font-black text-3xl md:text-6xl text-brand-ink mt-2">Pick Your Favorites</h1>
                <p className="text-neutral-500 mt-2 max-w-xl text-sm md:text-base">Authentic Karachi flavors, freshly prepared every day.</p>
            </div>

            {/* Search + Density toggle */}
            <div className="flex items-center gap-2 mb-5">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search dishes..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        data-testid="menu-search-input"
                        className="w-full pl-11 pr-4 py-2.5 md:py-3 bg-neutral-100 border border-transparent focus:border-brand-red focus:bg-white rounded-full outline-none text-sm"
                    />
                </div>
                <div className="flex bg-neutral-100 rounded-full p-1 shrink-0" role="tablist" aria-label="Menu density">
                    <button
                        type="button"
                        onClick={() => setDensity("compact")}
                        data-testid="menu-density-compact"
                        aria-label="Compact view"
                        title="Compact (more items per screen)"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${density === "compact" ? "bg-white shadow-sm text-brand-red" : "text-neutral-500"}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setDensity("comfortable")}
                        data-testid="menu-density-comfortable"
                        aria-label="Comfortable view"
                        title="Larger images"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${density === "comfortable" ? "bg-white shadow-sm text-brand-red" : "text-neutral-500"}`}
                    >
                        <Rows3 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-6 md:mb-8 -mx-4 px-4">
                <button
                    data-testid="menu-cat-all"
                    onClick={() => setActiveCat("all")}
                    className={`whitespace-nowrap px-4 md:px-5 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-colors ${activeCat === "all" ? "bg-brand-ink text-white" : "bg-neutral-100 text-brand-ink hover:bg-neutral-200"}`}
                >
                    All Items
                </button>
                {data.categories.map((c) => (
                    <button
                        key={c.id}
                        data-testid={`menu-cat-${c.id}`}
                        onClick={() => setActiveCat(c.id)}
                        className={`whitespace-nowrap px-4 md:px-5 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-colors ${activeCat === c.id ? "bg-brand-red text-white" : "bg-neutral-100 text-brand-ink hover:bg-neutral-200"}`}
                    >
                        {c.name}
                    </button>
                ))}
            </div>

            {/* Items grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-20 text-neutral-500">No items found.</div>
            ) : (
                <div className={gridCls}>
                    {filtered.map((item) => (
                        density === "compact"
                            ? <CompactCard key={item.id} item={item} onAdd={() => handleAdd(item)} />
                            : <ComfortableCard key={item.id} item={item} onAdd={() => handleAdd(item)} />
                    ))}
                </div>
            )}

            {picker && (
                <VariationPicker
                    item={picker.item}
                    onClose={() => setPicker(null)}
                    onPick={(variation, qty) => {
                        addItem(picker.item, qty, variation);
                        toast.success(`${picker.item.name} (${variation.name}) added`);
                        setPicker(null);
                    }}
                />
            )}
        </div>
    );
}

export function PriceBlock({ item }) {
    const has = item.variations && item.variations.length > 0;
    if (has) {
        const min = Math.min(...item.variations.map((v) => Number(v.price) || 0));
        return <span className="font-display font-black text-base md:text-xl text-brand-red leading-none">From Rs. {min}</span>;
    }
    if (item.original_price && item.original_price > item.price) {
        return (
            <span className="leading-none">
                <span className="font-display font-black text-base md:text-xl text-brand-red">Rs. {item.price}</span>
                <span className="ml-1.5 text-[11px] md:text-xs text-neutral-400 line-through font-medium">Rs. {item.original_price}</span>
            </span>
        );
    }
    return <span className="font-display font-black text-base md:text-xl text-brand-red leading-none">Rs. {item.price}</span>;
}

export function Badges({ item, compact = false }) {
    // Stack of small badges shown on top-right of the image
    const sz = compact ? "text-[9px] px-2 py-0.5" : "text-xs px-2.5 py-1";
    return (
        <div className={`absolute ${compact ? "top-2 right-2" : "top-3 right-3"} flex flex-col gap-1 items-end`}>
            {item.discount_percent > 0 && (
                <span className={`bg-green-600 text-white ${sz} font-bold uppercase tracking-wider rounded-full`}>{item.discount_percent}% OFF</span>
            )}
            {item.is_bestseller && (
                <span className={`bg-brand-red text-white ${sz} font-bold uppercase tracking-wider rounded-full`}>Bestseller</span>
            )}
        </div>
    );
}

function CompactCard({ item, onAdd }) {
    const hasVar = item.variations && item.variations.length > 0;
    return (
        <article data-testid={`menu-item-${item.id}`} className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="aspect-square overflow-hidden bg-neutral-100 relative">
                {item.image_url
                    ? <img src={item.image_url} loading="lazy" alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full bg-gradient-to-br from-brand-yellow/30 to-brand-red/20" />}
                {item.is_popular && !item.is_bestseller && (
                    <span className="absolute top-2 left-2 bg-brand-yellow text-brand-ink text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Popular
                    </span>
                )}
                {hasVar && (
                    <span className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm text-brand-ink text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                        {item.variations.length} sizes
                    </span>
                )}
                <Badges item={item} compact />
            </div>
            <div className="p-2.5 md:p-3">
                <h3 className="font-display font-bold text-xs md:text-sm text-brand-ink line-clamp-1 leading-tight">{item.name}</h3>
                <div className="flex items-center justify-between mt-2 gap-1">
                    <PriceBlock item={item} />
                    <button
                        data-testid={`menu-add-${item.id}`}
                        onClick={onAdd}
                        aria-label={hasVar ? `Choose size for ${item.name}` : `Add ${item.name}`}
                        className="bg-brand-ink hover:bg-brand-red text-white rounded-full w-8 h-8 inline-flex items-center justify-center transition-colors shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </article>
    );
}

function ComfortableCard({ item, onAdd }) {
    const hasVar = item.variations && item.variations.length > 0;
    return (
        <article data-testid={`menu-item-${item.id}`} className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="aspect-[4/3] overflow-hidden bg-neutral-100 relative">
                {item.image_url
                    ? <img src={item.image_url} loading="lazy" alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    : <div className="w-full h-full bg-gradient-to-br from-brand-yellow/30 to-brand-red/20" />}
                {item.is_popular && !item.is_bestseller && (
                    <span className="absolute top-3 left-3 bg-brand-yellow text-brand-ink text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                        Popular
                    </span>
                )}
                {hasVar && (
                    <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm text-brand-ink text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                        {item.variations.length} sizes
                    </span>
                )}
                <Badges item={item} />
            </div>
            <div className="p-5">
                <h3 className="font-display font-bold text-base text-brand-ink mb-1 line-clamp-1">{item.name}</h3>
                <p className="text-xs text-neutral-500 line-clamp-2 mb-4 min-h-[32px]">{item.description}</p>
                <div className="flex items-center justify-between">
                    <PriceBlock item={item} />
                    <button
                        data-testid={`menu-add-${item.id}`}
                        onClick={onAdd}
                        className="bg-brand-ink hover:bg-brand-red text-white rounded-full px-4 py-2 text-sm font-semibold inline-flex items-center gap-1 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> {hasVar ? "Choose" : "Add"}
                    </button>
                </div>
            </div>
        </article>
    );
}

export function VariationPicker({ item, onClose, onPick }) {
    const [selected, setSelected] = useState(item.variations[0]?.name || "");
    const [qty, setQty] = useState(1);
    const variation = item.variations.find((v) => v.name === selected) || item.variations[0];

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
            onClick={onClose}
            data-testid="variation-picker"
        >
            <div
                className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 md:p-6 max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-brand-red font-bold">Choose your size</p>
                        <h3 className="font-display font-black text-xl md:text-2xl text-brand-ink leading-tight mt-1">{item.name}</h3>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-neutral-100 flex items-center justify-center -mr-2"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-2 mb-5">
                    {item.variations.map((v) => (
                        <label
                            key={v.name}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${selected === v.name ? "border-brand-red bg-red-50/60" : "border-neutral-200 hover:bg-neutral-50"}`}
                            data-testid={`variation-option-${v.name}`}
                        >
                            <span className="flex items-center gap-3">
                                <input
                                    type="radio"
                                    name="variation"
                                    value={v.name}
                                    checked={selected === v.name}
                                    onChange={() => setSelected(v.name)}
                                    className="accent-brand-red"
                                />
                                <span className="font-semibold text-brand-ink">{v.name}</span>
                            </span>
                            <span className="font-display font-black text-brand-red">Rs. {v.price}</span>
                        </label>
                    ))}
                </div>

                <div className="flex items-center justify-between mb-5">
                    <span className="text-sm font-semibold text-neutral-600">Quantity</span>
                    <div className="flex items-center gap-1.5 bg-neutral-100 rounded-full p-1">
                        <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrement" data-testid="variation-qty-dec" className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center font-bold">−</button>
                        <span className="w-8 text-center font-bold text-sm" data-testid="variation-qty">{qty}</span>
                        <button onClick={() => setQty((q) => q + 1)} aria-label="Increment" data-testid="variation-qty-inc" className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center font-bold">+</button>
                    </div>
                </div>

                <button
                    onClick={() => onPick(variation, qty)}
                    data-testid="variation-add"
                    className="w-full bg-brand-red hover:bg-brand-red-dark text-white rounded-full py-3.5 font-bold uppercase tracking-wider text-sm transition-colors flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Add to Cart · Rs. {Number(variation.price) * qty}
                </button>
            </div>
        </div>
    );
}
