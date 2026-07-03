import { useEffect, useMemo, useRef, useState, memo, useCallback } from "react";
import { fetchCached, getCached } from "../lib/menuCache";
import { resolveImageUrl } from "../lib/api";        // for files in /pages
import { useCart } from "../contexts/CartContext";
import { Plus, Search, LayoutGrid, Rows3, X } from "lucide-react";
import { toast } from "sonner";
import { useSeo } from "../lib/seo";
const DENSITY_KEY = "knb_menu_density_v1"; // "compact" | "comfortable"

const SITE = "https://www.karachinaseebbiryani.com";

// Extract a plain numeric price from an item regardless of how the backend
// shapes it (flat `price`, or a list of `variations` with their own prices).
// Returns the lowest available price, or null if none is parseable.
function itemPrice(item) {
    const nums = [];
    if (item.price != null && !Number.isNaN(Number(item.price))) nums.push(Number(item.price));
    if (Array.isArray(item.variations)) {
        item.variations.forEach((v) => {
            if (v && v.price != null && !Number.isNaN(Number(v.price))) nums.push(Number(v.price));
        });
    }
    return nums.length ? Math.min(...nums) : null;
}

export default function MenuPage() {
    useSeo({
        title: "Order Biryani, Pulao & BBQ Online in Lahore | Karachi Naseeb Menu",
        description:
            "Browse the full Karachi Naseeb menu — Karachi-style biryani, Murg Pulao, BBQ, karahi and more. Order online in Lahore with free delivery and Cash on Delivery.",
        path: "/menu",
    });
    const [data, setData] = useState({ categories: [], items: [] });
    const [loading, setLoading] = useState(true);
    const [activeCat, setActiveCat] = useState(null);
    const [query, setQuery] = useState("");
    const [picker, setPicker] = useState(null); // {item}
    const [density, setDensity] = useState(() => localStorage.getItem(DENSITY_KEY) || "compact");
    const { addItem } = useCart();
    const sectionRefs = useRef({}); // catId -> HTMLElement
    const tabRefs = useRef({});     // catId -> HTMLButtonElement
    const tabBarRef = useRef(null);
    const isUserScrollingRef = useRef(false); // suppress observer right after a tab-click jump

    useEffect(() => { localStorage.setItem(DENSITY_KEY, density); }, [density]);

    useEffect(() => {
        let cancelled = false;
        // Show a previously-cached menu instantly (no network) so navigating
        // back to /menu feels instantaneous. Then revalidate in the background.
        const cached = getCached("/menu");
        if (cached && cached.data) {
            setData(cached.data);
            if (cached.data.categories?.length) setActiveCat((c) => c || cached.data.categories[0].id);
            setLoading(false);
        }
        fetchCached("/menu", { allowStale: false })
            .then((d) => {
                if (cancelled) return;
                setData(d);
                if (d.categories?.length) setActiveCat((c) => c || d.categories[0].id);
                setLoading(false);
            })
            .catch(() => { if (!cancelled) { if (!cached) toast.error("Failed to load menu"); setLoading(false); } });
        return () => { cancelled = true; };
    }, []);

    // Inject a schema.org Menu / MenuItem block built from the REAL menu data so
    // the page is eligible for Google's menu rich results and AI assistants can
    // read the actual dishes + prices. Rebuilt whenever the menu changes; the
    // previous block is removed on cleanup so we never leave stale content.
    useEffect(() => {
        if (!data.categories?.length || !data.items?.length) return undefined;
        try {
            const schema = {
                "@context": "https://schema.org",
                "@type": "Menu",
                "name": "Karachi Naseeb Biryani Menu",
                "url": `${SITE}/menu`,
                "hasMenuSection": data.categories.map((c) => ({
                    "@type": "MenuSection",
                    "name": c.name,
                    "hasMenuItem": data.items
                        .filter((i) => i.category_id === c.id)
                        .map((i) => {
                            const price = itemPrice(i);
                            const node = { "@type": "MenuItem", "name": i.name };
                            if (i.description) node.description = i.description;
                            if (price != null) {
                                node.offers = {
                                    "@type": "Offer",
                                    "price": String(price),
                                    "priceCurrency": "PKR",
                                };
                            }
                            return node;
                        }),
                })).filter((s) => s.hasMenuItem.length),
            };
            const tag = document.createElement("script");
            tag.type = "application/ld+json";
            tag.setAttribute("data-menu-jsonld", "1");
            tag.textContent = JSON.stringify(schema);
            document.head.appendChild(tag);
            return () => {
                document.querySelectorAll('script[data-menu-jsonld="1"]').forEach((n) => n.remove());
            };
        } catch {
            return undefined;
        }
    }, [data]);

    // Group items per category (preserves the order returned by the backend).
    // When a search query is active we still split by category so the sticky
    // category bar continues to make sense.
    const grouped = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filterFn = (i) => !q || i.name.toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q);
        return data.categories.map((c) => ({
            category: c,
            items: data.items.filter((i) => i.category_id === c.id && filterFn(i)),
        }));
    }, [data, query]);

    // IntersectionObserver — pick the topmost visible section and set it active.
    useEffect(() => {
        if (loading || !data.categories.length) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (isUserScrollingRef.current) return;
                // Choose the entry with the smallest positive top (closest to the top of the viewport).
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible.length) {
                    const id = visible[0].target.getAttribute("data-cat-id");
                    if (id) setActiveCat(id);
                }
            },
            {
                // Trigger when a section is in the top ~40% of the viewport.
                // rootMargin pushes the trigger line down from the very top so
                // the active tab updates as a category "enters" the screen, not
                // only when it fully fills it.
                rootMargin: "-25% 0px -60% 0px",
                threshold: 0,
            }
        );
        Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
        return () => observer.disconnect();
    }, [loading, data.categories]);

    // Keep the active tab horizontally visible inside the scrollable tab bar.
    useEffect(() => {
        if (!activeCat) return;
        const tab = tabRefs.current[activeCat];
        const bar = tabBarRef.current;
        if (tab && bar) {
            const tLeft = tab.offsetLeft;
            const tRight = tLeft + tab.offsetWidth;
            const bLeft = bar.scrollLeft;
            const bRight = bLeft + bar.clientWidth;
            if (tLeft < bLeft + 16) bar.scrollTo({ left: tLeft - 16, behavior: "smooth" });
            else if (tRight > bRight - 16) bar.scrollTo({ left: tRight - bar.clientWidth + 16, behavior: "smooth" });
        }
    }, [activeCat]);

    const handleAdd = useCallback((item) => {
        if (item.variations && item.variations.length > 0) {
            setPicker({ item });
        } else {
            addItem(item);
            toast.success(`${item.name} added`);
        }
    }, [addItem]);

    const jumpToCategory = (catId) => {
        const el = sectionRefs.current[catId];
        if (!el) return;
        setActiveCat(catId);
        // Suppress observer briefly so it doesn't override the click during the scroll animation.
        isUserScrollingRef.current = true;
        // Offset by ~90px so the section heading isn't hidden behind the sticky tab bar.
        const top = el.getBoundingClientRect().top + window.scrollY - 90;
        window.scrollTo({ top, behavior: "smooth" });
        setTimeout(() => { isUserScrollingRef.current = false; }, 700);
    };

    const gridCls = density === "compact"
        ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5"
        : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6";

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 md:pt-12 pb-12 md:pb-16" data-testid="menu-page">
            <div className="mb-5 md:mb-8">
                <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Our Menu</span>
                <h1 className="font-display font-black text-3xl md:text-6xl text-brand-ink mt-2">Pick Your Favorites</h1>
                <p className="text-neutral-500 mt-2 max-w-xl text-sm md:text-base">Authentic Karachi flavors, freshly prepared every day.</p>
            </div>

            {/* Search + Density toggle */}
            <div className="flex items-center gap-2 mb-3">
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

            {/* Sticky category bar — pinned to the very top of the viewport so it
                stays visible after the site header slides away on scroll-down. */}
            <div
                className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-2 bg-white/95 backdrop-blur-md border-b border-neutral-200/70 mb-6 md:mb-8"
                data-testid="menu-cat-bar"
            >
                <div
                    ref={tabBarRef}
                    className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1"
                >
                    {data.categories.map((c) => {
                        const active = activeCat === c.id;
                        return (
                            <button
                                key={c.id}
                                ref={(el) => (tabRefs.current[c.id] = el)}
                                data-testid={`menu-cat-${c.id}`}
                                data-active={active ? "true" : "false"}
                                onClick={() => jumpToCategory(c.id)}
                                className={`whitespace-nowrap px-4 md:px-5 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-colors ${active ? "bg-brand-red text-white shadow-md shadow-brand-red/30" : "bg-neutral-100 text-brand-ink hover:bg-neutral-200"}`}
                            >
                                {c.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Loading skeletons or grouped items */}
            {loading ? (
                <div className={gridCls} data-testid="menu-skeletons">
                    {Array.from({ length: density === "compact" ? 10 : 6 }).map((_, i) => (
                        <SkeletonCard key={i} density={density} />
                    ))}
                </div>
            ) : grouped.every((g) => g.items.length === 0) ? (
                <div className="text-center py-20 text-neutral-500" data-testid="menu-empty">No items found.</div>
            ) : (
                grouped.map(({ category, items }) => (
                    items.length > 0 && (
                        <section
                            key={category.id}
                            data-cat-id={category.id}
                            data-testid={`menu-section-${category.id}`}
                            ref={(el) => (sectionRefs.current[category.id] = el)}
                            className="scroll-mt-28 mb-10 md:mb-14"
                        >
                            <h2 className="font-display font-black text-2xl md:text-3xl text-brand-ink mb-4 md:mb-6">{category.name}</h2>
                            <div className={gridCls}>
                                {items.map((item) => (
                                    density === "compact"
                                        ? <CompactCard key={item.id} item={item} onAdd={handleAdd} />
                                        : <ComfortableCard key={item.id} item={item} onAdd={handleAdd} />
                                ))}
                            </div>
                        </section>
                    )
                ))
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
        // Find the cheapest variation's sale price AND its original (pre-discount) price.
        // If the discount made the price drop, show "From Rs. X" + strikethrough "Rs. Y"
        // so customers see the price cut on items with sizes too.
        const sale_min = Math.min(...item.variations.map((v) => Number(v.price) || 0));
        const orig_min = Math.min(...item.variations.map((v) => Number(v.original_price || v.price) || 0));
        if (orig_min > sale_min) {
            return (
                <span className="leading-none">
                    <span className="font-display font-black text-base md:text-xl text-brand-red">From Rs. {sale_min}</span>
                    <span className="ml-1.5 text-[11px] md:text-xs text-neutral-400 line-through font-medium">Rs. {orig_min}</span>
                </span>
            );
        }
        return <span className="font-display font-black text-base md:text-xl text-brand-red leading-none">From Rs. {sale_min}</span>;
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

function SkeletonCard({ density }) {
    const aspect = density === "compact" ? "aspect-square" : "aspect-[4/3]";
    return (
        <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm animate-pulse" data-testid="menu-skeleton">
            <div className={`${aspect} bg-neutral-200`} />
            <div className="p-3 md:p-4 space-y-2">
                <div className="h-3 bg-neutral-200 rounded w-3/4" />
                <div className="h-3 bg-neutral-200 rounded w-1/2" />
                <div className="flex items-center justify-between pt-2">
                    <div className="h-4 bg-neutral-200 rounded w-16" />
                    <div className="h-8 w-8 bg-neutral-200 rounded-full" />
                </div>
            </div>
        </div>
    );
}

const CompactCard = memo(function CompactCard({ item, onAdd }) {
    const hasVar = item.variations && item.variations.length > 0;
    return (
        <article data-testid={`menu-item-${item.id}`} className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="aspect-square overflow-hidden bg-neutral-100 relative">
                {item.image_url
                    ? <img src={resolveImageUrl(item.image_url)} loading="lazy" alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                {item.description && (
                    <p className="text-[10px] md:text-xs text-neutral-500 line-clamp-2 leading-snug mt-1">{item.description}</p>
                )}
                <div className="flex items-center justify-between mt-2 gap-1">
                    <PriceBlock item={item} />
                    <button
                        data-testid={`menu-add-${item.id}`}
                        onClick={() => onAdd(item)}
                        aria-label={hasVar ? `Choose size for ${item.name}` : `Add ${item.name}`}
                        className="bg-brand-ink hover:bg-brand-red text-white rounded-full w-8 h-8 inline-flex items-center justify-center transition-colors shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </article>
    );
});

const ComfortableCard = memo(function ComfortableCard({ item, onAdd }) {
    const hasVar = item.variations && item.variations.length > 0;
    return (
        <article data-testid={`menu-item-${item.id}`} className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="aspect-[4/3] overflow-hidden bg-neutral-100 relative">
                {item.image_url
                    ? <img src={resolveImageUrl(item.image_url)} loading="lazy" alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
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
                        onClick={() => onAdd(item)}
                        className="bg-brand-ink hover:bg-brand-red text-white rounded-full px-4 py-2 text-sm font-semibold inline-flex items-center gap-1 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> {hasVar ? "Choose" : "Add"}
                    </button>
                </div>
            </div>
        </article>
    );
});

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
                            <span className="text-right leading-none">
                                <span className="font-display font-black text-brand-red">Rs. {v.price}</span>
                                {v.original_price && v.original_price > v.price && (
                                    <span className="ml-1.5 text-[11px] text-neutral-400 line-through font-medium">Rs. {v.original_price}</span>
                                )}
                            </span>
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
