import { MessageCircle } from "lucide-react";
import { useLocation } from "react-router-dom";

export default function FloatingWhatsApp() {
    const location = useLocation();
    if (location.pathname.startsWith("/admin")) return null;

    const phone = "923004928411";
    const text = encodeURIComponent("Hello! I'd like to order from Karachi Naseeb Biryani.");
    const url = `https://wa.me/${phone}?text=${text}`;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="floating-whatsapp-button"
            className="fixed bottom-6 right-4 md:right-8 z-30 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg shadow-[#25D366]/40 hover:scale-110 active:scale-95 transition-transform"
            aria-label="Chat on WhatsApp"
        >
            <MessageCircle className="w-6 h-6" fill="currentColor" stroke="white" strokeWidth={1.5} />
        </a>
    );
}
