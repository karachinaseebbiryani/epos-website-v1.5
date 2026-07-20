import { Link } from "react-router-dom";
import { Phone, MapPin, Mail, Instagram, Facebook, Clock, ShieldCheck, Banknote, CreditCard, Wallet, Smartphone } from "lucide-react";
import { useRestaurantInfo } from "../lib/restaurantInfo";

export default function Footer() {
    // Live restaurant info from Admin → Settings; hard-coded strings kept as fallbacks.
    const info = useRestaurantInfo();
    const phone = info?.phone || "+92 300 4928411";
    const email = info?.email || "karachinaseebbiryani599@gmail.com";
    const address = info?.address || "68 Chatri Chowk, Punjab Small Industry, D Block, Lahore";
    const hours = info?.opening_hours || "Daily · 11:30 AM – 11:30 PM";
    const instagram = info?.instagram_url || "https://instagram.com";
    const facebook = info?.facebook_url || "https://facebook.com";
    return (
        <footer className="bg-brand-ink text-white mt-20" data-testid="site-footer">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-10">
                <div className="col-span-2 md:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-brand-red flex items-center justify-center font-display font-black text-xl">K</div>
                        <div>
                            <div className="font-display font-bold text-lg leading-tight">{info?.name || "Karachi Naseeb"}</div>
                            {!info?.name && <div className="text-brand-yellow text-sm font-semibold">Biryani &amp; Murg Pulao</div>}
                        </div>
                    </div>
                    <p className="text-white/60 max-w-md text-sm leading-relaxed mb-4">
                        Authentic Karachi-style biryani and Murg Pulao, freshly cooked with traditional recipes.
                        Family-owned, flavor-driven, in Lahore since 2009.
                    </p>
                    <div className="inline-flex items-center gap-2 bg-emerald-900/40 text-emerald-200 border border-emerald-700/40 rounded-full px-3 py-1 text-xs font-semibold" data-testid="footer-secure-badge">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified business · Secure checkout
                    </div>
                </div>

                <div>
                    <h3 className="font-display font-bold mb-4 text-sm uppercase tracking-wider text-brand-yellow">Order</h3>
                    <ul className="space-y-2 text-white/70 text-sm">
                        <li><Link to="/menu" data-testid="footer-menu-link" className="hover:text-white">Menu</Link></li>
                        <li><Link to="/offers" data-testid="footer-offers-link" className="hover:text-white">Offers</Link></li>
                        <li><Link to="/events" data-testid="footer-events-link" className="hover:text-white">Book an Event</Link></li>
                        <li><Link to="/rewards-program" data-testid="footer-rewards-program-link" className="hover:text-white">Rewards Program</Link></li>
                        <li><Link to="/profile" data-testid="footer-profile-link" className="hover:text-white">My Orders</Link></li>
                    </ul>
                </div>

                <div>
                    <h3 className="font-display font-bold mb-4 text-sm uppercase tracking-wider text-brand-yellow">Company</h3>
                    <ul className="space-y-2 text-white/70 text-sm">
                        <li><Link to="/about" data-testid="footer-about-link" className="hover:text-white">About Us</Link></li>
                        <li><Link to="/contact" data-testid="footer-contact-link" className="hover:text-white">Contact</Link></li>
                        <li><Link to="/faq" data-testid="footer-faq-link" className="hover:text-white">FAQ</Link></li>
                        <li><Link to="/delivery" data-testid="footer-delivery-link" className="hover:text-white">Delivery Info</Link></li>
                        <li><Link to="/feedback" data-testid="footer-feedback-link" className="hover:text-white">Leave Feedback</Link></li>
                    </ul>
                </div>

                <div>
                    <h3 className="font-display font-bold mb-4 text-sm uppercase tracking-wider text-brand-yellow">Visit / Call</h3>
                    <ul className="space-y-3 text-white/70 text-sm">
                        <li className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-red" />
                            <span>{address}</span>
                        </li>
                        <li>
                            <a href={`tel:${phone.replace(/\s/g, "")}`} data-testid="footer-phone-link" className="flex items-center gap-2 hover:text-white">
                                <Phone className="w-4 h-4 text-brand-red" /> {phone}
                            </a>
                        </li>
                        <li>
                            <a href={`mailto:${email}`} data-testid="footer-email-link" className="flex items-center gap-2 hover:text-white break-all">
                                <Mail className="w-4 h-4 text-brand-red shrink-0" /> {email}
                            </a>
                        </li>
                        <li className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-brand-red" /> {hours}
                        </li>
                    </ul>

                    <div className="flex gap-3 mt-5">
                        <a href={instagram} target="_blank" rel="noopener noreferrer" data-testid="footer-instagram-link" className="w-10 h-10 rounded-full bg-white/10 hover:bg-brand-red flex items-center justify-center transition-colors" aria-label="Instagram">
                            <Instagram className="w-4 h-4" />
                        </a>
                        <a href={facebook} target="_blank" rel="noopener noreferrer" data-testid="footer-facebook-link" className="w-10 h-10 rounded-full bg-white/10 hover:bg-brand-red flex items-center justify-center transition-colors" aria-label="Facebook">
                            <Facebook className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Payment methods strip — reassurance just before the copyright line. */}
            <div className="border-t border-white/10">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/60">
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap" data-testid="footer-payment-methods">
                        <span className="font-semibold uppercase tracking-wider text-white/40">We accept:</span>
                        <span className="inline-flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1"><Banknote className="w-3.5 h-3.5" /> Cash on Delivery</span>
                        <span className="inline-flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1"><CreditCard className="w-3.5 h-3.5" /> Card</span>
                        <span className="inline-flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1"><Wallet className="w-3.5 h-3.5" /> JazzCash / Easypaisa</span>
                        <span className="inline-flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1"><Smartphone className="w-3.5 h-3.5" /> Bank Transfer</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/50">
                        <Link to="/privacy" data-testid="footer-privacy-link" className="hover:text-white">Privacy</Link>
                        <span>·</span>
                        <Link to="/terms" data-testid="footer-terms-link" className="hover:text-white">Terms</Link>
                        <span>·</span>
                        <Link to="/refunds" data-testid="footer-refunds-link" className="hover:text-white">Refunds</Link>
                        <span>·</span>
                        <Link to="/delivery" data-testid="footer-shipping-link" className="hover:text-white">Delivery</Link>
                        <span>·</span>
                        <Link to="/ownership" data-testid="footer-ownership-link" className="hover:text-white">Ownership</Link>
                    </div>
                </div>
            </div>

            <div className="border-t border-white/10 py-5 text-center text-white/40 text-xs">
                &copy; {new Date().getFullYear()} {info?.name || "Karachi Naseeb Biryani & Murg Pulao"}. All rights reserved.
            </div>
        </footer>
    );
}
