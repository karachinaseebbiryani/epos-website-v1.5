import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Clock, Bike } from "lucide-react";

/**
 * Local Areas page - SEO landing page targeting "near me" and
 * neighborhood-specific searches around Chatri Chowk, DHA Phase 5.
 *
 * This page helps rank for:
 * - "biryani near chatri chowk"
 * - "biryani delivery dha phase 5"
 * - "biryani near alfalah town"
 * - "food delivery chatri chowk"
 */
export default function LocalAreasPage() {
    useEffect(() => {
        document.title = "Biryani Delivery Near You in Chatri Chowk, DHA, Alfalah Town | Karachi Naseeb";
        const meta = document.querySelector('meta[name="description"]');
        if (meta) {
            meta.setAttribute("content", "Order authentic Karachi biryani delivery near Chatri Chowk, DHA Phase 5, Alfalah Town, V Block and surrounding areas in Lahore. Free delivery within 7km. Order now!");
        }
    }, []);

    const nearbyAreas = [
        { name: "Chatri Chowk", distance: "Our Location", time: "Pickup available" },
        { name: "DHA Phase 5", distance: "2 km", time: "25-30 min" },
        { name: "Alfalah Town", distance: "1.5 km", time: "20-25 min" },
        { name: "V Block", distance: "1 km", time: "15-20 min" },
        { name: "Shahangai", distance: "2.5 km", time: "30-35 min" },
        { name: "Sandhu Road", distance: "2 km", time: "25-30 min" },
        { name: "Punjab Small Industry", distance: "0.5 km", time: "10-15 min" },
        { name: "B Block DHA", distance: "3 km", time: "30-35 min" },
    ];

    return (
        <main className="max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-16">
            {/* Hero Section */}
            <header className="text-center mb-12">
                <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Near You</span>
                <h1 className="font-display font-black text-4xl md:text-6xl text-brand-ink mt-2 mb-4">
                    Biryani Delivery Near Chatri Chowk
                </h1>
                <p className="text-neutral-600 text-lg max-w-3xl mx-auto leading-relaxed">
                    Fast, fresh Karachi-style biryani delivery to your neighborhood. Serving Chatri Chowk, DHA Phase 5, Alfalah Town, V Block and surrounding areas in Lahore. Order online for delivery or pickup.
                </p>
            </header>

            {/* Quick Info Grid */}
            <div className="grid sm:grid-cols-3 gap-4 mb-16">
                <div className="bg-white border-2 border-neutral-200 rounded-2xl p-6 text-center">
                    <MapPin className="w-8 h-8 mx-auto mb-3 text-brand-red" />
                    <div className="font-display font-bold text-xl text-brand-ink mb-1">7 km Radius</div>
                    <div className="text-sm text-neutral-500">Free delivery within range</div>
                </div>
                <div className="bg-white border-2 border-neutral-200 rounded-2xl p-6 text-center">
                    <Clock className="w-8 h-8 mx-auto mb-3 text-brand-red" />
                    <div className="font-display font-bold text-xl text-brand-ink mb-1">25-35 min</div>
                    <div className="text-sm text-neutral-500">Average delivery time</div>
                </div>
                <div className="bg-white border-2 border-neutral-200 rounded-2xl p-6 text-center">
                    <Bike className="w-8 h-8 mx-auto mb-3 text-brand-red" />
                    <div className="font-display font-bold text-xl text-brand-ink mb-1">Own Fleet</div>
                    <div className="text-sm text-neutral-500">Direct from our kitchen</div>
                </div>
            </div>

            {/* SEO Content Section */}
            <div className="bg-neutral-50 rounded-2xl p-6 md:p-8 border border-neutral-200 mb-12">
                <h2 className="font-display font-bold text-2xl text-brand-ink mb-4">
                    Authentic Karachi Biryani Delivery in Chatri Chowk & Nearby Areas
                </h2>
                <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed space-y-4">
                    <p>
                        Looking for the <strong>best biryani near Chatri Chowk</strong>? Karachi Naseeb Biryani & Murg Pulao brings authentic Karachi-style biryani, traditional Murg Pulao, BBQ and Pakistani cuisine right to your door. Located at 68 Chatri Chowk, Punjab Small Industry, D Block, we deliver hot, fresh food across nearby neighborhoods in Lahore including DHA Phase 5, Alfalah Town, V Block, Shahangai, and Sandhu Road area.
                    </p>
                    <p>
                        <strong>Why customers in Chatri Chowk and DHA Phase 5 choose us:</strong> We specialize in authentic Karachi-style biryani prepared with premium basmati rice, quality halal meat, and traditional spices. Every order is cooked fresh to order — no pre-made or reheated food. Whether you're in Alfalah Town, V Block or anywhere within our 7 km delivery radius, your biryani arrives hot and fresh in 25-35 minutes with free delivery and Cash on Delivery available.
                    </p>
                    <p>
                        <strong>Order biryani near me in these areas:</strong> We deliver to Chatri Chowk (our location with pickup available), DHA Phase 5 B Block and surrounding blocks, Alfalah Town residential areas, V Block Entrance and nearby streets, Shahangai neighborhoods, Sandhu Road commercial and residential areas, Punjab Small Industry businesses and warehouses, and all surrounding areas within 7 km of Chatri Chowk. Enter your address at checkout to confirm you're in our delivery zone.
                    </p>
                    <p>
                        <strong>What we deliver near you:</strong> Our menu includes Chicken Biryani, Mutton Biryani, Beef Biryani, traditional Murg Pulao, BBQ items (Chicken Tikka, Seekh Kabab, Malai Boti, Chicken Boti), Karahi (Chicken and Mutton), and family combo deals. All dishes are served with raita, salad and our special green chutney. Order through our website for easy online payment or choose Cash on Delivery.
                    </p>
                    <p>
                        <strong>Fast delivery to your neighborhood:</strong> Living in DHA Phase 5? Your biryani arrives in 25-30 minutes. In Alfalah Town? Expect delivery in 20-25 minutes. V Block residents get their orders in just 15-20 minutes. We use our own delivery fleet (not third-party riders) so you get direct contact with our restaurant, accurate delivery times, and hot food delivered with care. Track your order in real-time from our kitchen to your doorstep.
                    </p>
                    <p className="text-sm text-neutral-500 pt-4 border-t border-neutral-200">
                        <strong>Ready to order?</strong> Visit our <Link to="/menu" className="text-brand-red font-semibold hover:underline">menu</Link> to browse all items and prices, check our <Link to="/offers" className="text-brand-red font-semibold hover:underline">current offers</Link> for discounts and deals, or <Link to="/contact" className="text-brand-red font-semibold hover:underline">call us</Link> at +92 300 4928411 for catering and bulk orders. Join our <Link to="/rewards-program" className="text-brand-red font-semibold hover:underline">Diamonds rewards program</Link> to earn free food on every order.
                    </p>
                </div>
            </div>

            {/* Areas We Serve */}
            <section className="mb-12">
                <h2 className="font-display font-bold text-2xl text-brand-ink mb-6 text-center">
                    Areas We Deliver To Near Chatri Chowk
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {nearbyAreas.map((area, idx) => (
                        <div key={idx} className="bg-white border border-neutral-200 rounded-xl p-4 hover:border-brand-red transition-colors">
                            <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-brand-red shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-display font-bold text-brand-ink">{area.name}</div>
                                    <div className="text-xs text-neutral-500">{area.distance} · {area.time}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-center text-sm text-neutral-500 mt-6">
                    Don't see your area? Enter your address at checkout — we deliver within 7 km of Chatri Chowk.
                </p>
            </section>

            {/* CTA Section */}
            <div className="bg-gradient-to-br from-brand-red to-brand-red-dark rounded-3xl p-10 md:p-12 text-white text-center">
                <h2 className="font-display font-black text-3xl md:text-4xl mb-4">
                    Craving Biryani Near You?
                </h2>
                <p className="text-white/90 mb-6 max-w-xl mx-auto">
                    Order now for delivery to Chatri Chowk, DHA Phase 5, Alfalah Town and nearby areas. Fresh, hot and delivered fast.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        to="/menu"
                        className="bg-white text-brand-red rounded-full px-8 py-4 font-bold inline-flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                    >
                        Order Now
                    </Link>
                    <a
                        href="tel:+923004928411"
                        className="bg-brand-yellow text-brand-ink rounded-full px-8 py-4 font-bold inline-flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                    >
                        <Phone className="w-4 h-4" />
                        Call Us
                    </a>
                </div>
            </div>
        </main>
    );
}
