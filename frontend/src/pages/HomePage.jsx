import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { resolveImageUrl } from "../lib/api";
import { fetchCached, getCached } from "../lib/menuCache";
import { useCart } from "../contexts/CartContext";
import { ArrowRight, Star, Clock, Phone, Award, Plus, Flame } from "lucide-react";
import { toast } from "sonner";
import { VariationPicker, PriceBlock, Badges } from "./MenuPage";
import TrustStrip from "../components/TrustStrip";
import { useRestaurantInfo } from "../lib/restaurantInfo";
import { useSeo } from "../lib/seo";

export default function HomePage() {
    useSeo({
        title: "Karachi Naseeb Biryani & Murg Pulao — Order Online in Lahore",
        description:
            "Order authentic Karachi-style biryani, Murg Pulao, BBQ and karahi online in Lahore. Free delivery, live order tracking and Cash on Delivery. Earn Diamonds on every order.",
        path: "/",
    });
    const info = useRestaurantInfo();
    const [menuData, setMenuData] = useState(() => getCached("/menu")?.data || { categories: [], items: [] });
    const [offers, setOffers] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [picker, setPicker] = useState(null); // { item } when a variation-required item is being chosen
    const { addItem } = useCart();

    useEffect(() => {
        // /menu is the heaviest payload on the page — use the shared cache so
        // navigating Home → Menu → Home doesn't refetch the same JSON every time.
        fetchCached("/menu", { allowStale: false }).then((d) => setMenuData(d)).catch(() => { });
        api.get("/offers").then((r) => setOffers(r.data)).catch(() => { });
        api.get("/reviews").then((r) => setReviews(r.data)).catch(() => { });
    }, []);

    const popular = menuData.items.filter((i) => i.is_popular).slice(0, 6);

    // Handle bestseller "+" tap. If the item declares variations (Small/Medium/Large
    // etc.), open the same picker MenuPage uses so the customer chooses a size
    // BEFORE the item lands in the cart. Plain items go straight into the cart.
    const handleAdd = (item) => {
        if (item.variations && item.variations.length > 0) {
            setPicker({ item });
            return;
        }
        addItem(item);
        toast.success(`${item.name} added to cart`);
    };

    return (
        <div data-testid="home-page">
            {/* HERO */}
            <section className="relative overflow-hidden">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?crop=entropy&cs=srgb&fm=jpg&q=85')" }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/10" />
                <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-10 sm:py-16 md:py-28 lg:py-36">
                    <div className="max-w-2xl">
                        <span className="inline-flex items-center gap-2 bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/30 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.2em] font-bold mb-4 md:mb-6" data-testid="hero-badge">
                            <Flame className="w-3.5 h-3.5" /> Authentic Karachi Flavors
                        </span>
                        <h1 className="font-display font-black text-white text-3xl sm:text-5xl lg:text-7xl leading-[1.05] tracking-tight mb-4 md:mb-6">
                            Karachi Naseeb<br />
                            <span className="text-brand-yellow">Biryani</span> &amp; <span className="text-brand-red">Murg Pulao</span>
                        </h1>
                        <p className="text-white/85 text-sm md:text-lg max-w-xl mb-6 md:mb-10 leading-relaxed">
                            Slow-cooked basmati, hand-picked spices, generations of recipe. Order online — fresh, fast, and full of soul.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Link to="/menu" data-testid="hero-cta-menu" className="bg-brand-red hover:bg-brand-red-dark text-white rounded-full px-7 py-4 font-bold inline-flex items-center gap-2 transition-colors shadow-xl shadow-brand-red/30">
                                View Menu <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link to="/events" data-testid="hero-cta-events" className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-full px-7 py-4 font-bold inline-flex items-center gap-2 transition-colors">
                                Book an Event
                            </Link>
                        </div>

                        <div className="mt-12 flex flex-wrap gap-6 text-white/80 text-sm">
                            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-brand-yellow" /> <span>30–45 min delivery</span></div>
                            <div className="flex items-center gap-2"><Award className="w-4 h-4 text-brand-yellow" /> <span>15+ years tradition</span></div>
                            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-brand-yellow" /> <a href={`tel:${(info?.phone || "+923004928411").replace(/\s/g, "")}`} className="hover:text-white">{info?.phone || "+92 300 4928411"}</a></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* OFFERS STRIP */}
            {offers.length > 0 && (
                <section className="bg-brand-yellow text-brand-ink py-3 overflow-hidden">
                    <div className="flex gap-12 animate-pulse-x whitespace-nowrap text-sm font-semibold">
                        {[...offers, ...offers].map((o, idx) => (
                            <span key={idx} className="inline-flex items-center gap-2"><Flame className="w-4 h-4" /> {o.title}</span>
                        ))}
                    </div>
                </section>
            )}

            {/* POPULAR ITEMS */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 py-20 md:py-28" data-testid="popular-section">
                <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
                    <div>
                        <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Most Loved</span>
                        <h2 className="font-display font-black text-3xl md:text-5xl text-brand-ink mt-2">Our Bestsellers</h2>
                    </div>
                    <Link to="/menu" data-testid="popular-view-all" className="text-brand-red font-semibold inline-flex items-center gap-2 hover:gap-3 transition-all">
                        View Full Menu <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* Best Sellers grid — mirrors the menu layout (2 cols on mobile, 3 on tablet,
                    4 on large) so customers see multiple bestsellers above the fold on phones
                    instead of one large card per row. Gap + padding tuned for smaller cards. */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
                    {popular.map((item) => (
                        <article key={item.id} data-testid={`popular-item-${item.id}`} className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
                            <div className="aspect-[4/3] overflow-hidden bg-neutral-100 relative">
                                <img src={resolveImageUrl(item.image_url)} loading="lazy" alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                <Badges item={item} compact />
                            </div>
                            <div className="p-3 sm:p-4 md:p-5">
                                <h3 className="font-display font-bold text-sm sm:text-base md:text-lg text-brand-ink mb-1 line-clamp-1">{item.name}</h3>
                                <p className="hidden sm:block text-sm text-neutral-500 line-clamp-2 mb-4 min-h-[40px]">{item.description}</p>
                                <div className="flex items-center justify-between gap-2 mt-2 sm:mt-0">
                                    <PriceBlock item={item} />
                                    <button
                                        data-testid={`popular-add-${item.id}`}
                                        onClick={() => handleAdd(item)}
                                        className="bg-brand-ink hover:bg-brand-red text-white rounded-full w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center transition-colors shrink-0"
                                        aria-label={`Add ${item.name} to cart`}
                                    >
                                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {/* OFFERS SECTION */}
            {offers.length > 0 && (
                <section className="bg-neutral-50 py-20 md:py-28" data-testid="offers-section">
                    <div className="max-w-7xl mx-auto px-4 md:px-8">
                        <div className="text-center mb-12">
                            <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Limited Time</span>
                            <h2 className="font-display font-black text-3xl md:text-5xl text-brand-ink mt-2">Exclusive Offers</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {offers.slice(0, 3).map((offer) => (
                                <div key={offer.id} className="relative rounded-2xl overflow-hidden bg-brand-ink text-white aspect-[4/3] group" data-testid={`offer-card-${offer.id}`}>
                                    {offer.image_url && offer.image_url.trim() && (
                                        <img src={resolveImageUrl(offer.image_url)} alt={offer.title} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-brand-ink via-brand-ink/60 to-transparent" />
                                    <div className="relative h-full flex flex-col justify-end p-6">
                                        {offer.coupon_code && (
                                            <span className="self-start bg-brand-yellow text-brand-ink text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">
                                                {offer.coupon_code}
                                            </span>
                                        )}
                                        <h3 className="font-display font-bold text-xl mb-2">{offer.title}</h3>
                                        <p className="text-white/80 text-sm">{offer.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* REVIEWS */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 py-20 md:py-28" data-testid="reviews-section">
                <div className="text-center mb-12">
                    <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Customer Love</span>
                    <h2 className="font-display font-black text-3xl md:text-5xl text-brand-ink mt-2">What Our Guests Say</h2>
                </div>
                {reviews.length === 0 ? (
                    <p className="text-center text-neutral-500">Be the first to leave a review after your order!</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {reviews.slice(0, 6).map((r) => (
                            <div key={r.id} className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex gap-0.5 mb-3">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className={`w-4 h-4 ${i < r.rating ? "fill-brand-yellow text-brand-yellow" : "text-neutral-300"}`} />
                                    ))}
                                </div>
                                <p className="text-brand-ink leading-relaxed mb-4">&ldquo;{r.comment}&rdquo;</p>
                                <p className="text-sm text-neutral-500 font-semibold">— {r.customer_name}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* CTA */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 pb-12">
                <div className="bg-gradient-to-br from-brand-red to-brand-red-dark rounded-3xl p-10 md:p-16 text-white text-center relative overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-brand-yellow/20 blur-3xl" />
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
                    <h2 className="relative font-display font-black text-3xl md:text-5xl mb-4">Hungry yet?</h2>
                    <p className="relative text-white/90 mb-8 max-w-md mx-auto">Order in 2 quick steps. Cash on Delivery. Hot &amp; fresh, straight to your door.</p>
                    <Link to="/menu" data-testid="cta-order-now" className="relative bg-white text-brand-red rounded-full px-8 py-4 font-bold inline-flex items-center gap-2 hover:scale-105 transition-transform">
                        Order Now <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </section>

            {/* Trust strip — reassurance just before the customer scrolls into the
                footer. Shows verified badge, secure checkout, COD support, live tracking. */}
            <TrustStrip variant="homepage" />

            {/* Size / variation picker shared with MenuPage so the UX is identical
                whether the customer taps "+" on the home bestsellers or in the full menu. */}
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
