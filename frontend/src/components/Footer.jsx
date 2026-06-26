import { Link } from "react-router-dom";
import { Phone, MapPin, Mail, Instagram, Facebook } from "lucide-react";

export default function Footer() {
    return (
        <footer className="bg-brand-ink text-white mt-20" data-testid="site-footer">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
                <div className="md:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-brand-red flex items-center justify-center font-display font-black text-xl">K</div>
                        <div>
                            <div className="font-display font-bold text-lg">Karachi Naseeb</div>
                            <div className="text-brand-yellow text-sm font-semibold">Biryani &amp; Murg Pulao</div>
                        </div>
                    </div>
                    <p className="text-white/60 max-w-md text-sm leading-relaxed">
                        Authentic Karachi-style biryani and Murg Pulao, freshly cooked with traditional recipes.
                        Family-owned, flavor-driven.
                    </p>
                </div>

                <div>
                    <h3 className="font-display font-bold mb-4 text-sm uppercase tracking-wider text-brand-yellow">Quick Links</h3>
                    <ul className="space-y-2 text-white/70 text-sm">
                        <li><Link to="/menu" data-testid="footer-menu-link" className="hover:text-white">Menu</Link></li>
                        <li><Link to="/offers" data-testid="footer-offers-link" className="hover:text-white">Offers</Link></li>
                        <li><Link to="/events" data-testid="footer-events-link" className="hover:text-white">Book an Event</Link></li>
                        <li><Link to="/faq" data-testid="footer-faq-link" className="hover:text-white">FAQ</Link></li>
                        <li><Link to="/profile" data-testid="footer-profile-link" className="hover:text-white">My Orders</Link></li>
                    </ul>
                </div>

                <div>
                    <h3 className="font-display font-bold mb-4 text-sm uppercase tracking-wider text-brand-yellow">Visit / Call</h3>
                    <ul className="space-y-3 text-white/70 text-sm">
                        <li className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-red" />
                            <span>68 Chatri Chowk, Punjab Small Industry, D Block, Lahore</span>
                        </li>
                        <li>
                            <a href="tel:+923004928411" data-testid="footer-phone-link" className="flex items-center gap-2 hover:text-white">
                                <Phone className="w-4 h-4 text-brand-red" /> +92 300 4928411
                            </a>
                        </li>
                        <li>
                            <a href="mailto:karachinaseebbiryani599@gmail.com" data-testid="footer-email-link" className="flex items-center gap-2 hover:text-white">
                                <Mail className="w-4 h-4 text-brand-red" /> karachinaseebbiryani599@gmail.com
                            </a>
                        </li>
                    </ul>

                    <div className="flex gap-3 mt-5">
                        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" data-testid="footer-instagram-link" className="w-10 h-10 rounded-full bg-white/10 hover:bg-brand-red flex items-center justify-center transition-colors" aria-label="Instagram">
                            <Instagram className="w-4 h-4" />
                        </a>
                        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" data-testid="footer-facebook-link" className="w-10 h-10 rounded-full bg-white/10 hover:bg-brand-red flex items-center justify-center transition-colors" aria-label="Facebook">
                            <Facebook className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>
            <div className="border-t border-white/10 py-6 text-center text-white/40 text-xs">
                &copy; {new Date().getFullYear()} Karachi Naseeb Biryani &amp; Murg Pulao. All rights reserved.
            </div>
        </footer>
    );
}
