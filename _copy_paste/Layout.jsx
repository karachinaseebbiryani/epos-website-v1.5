import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";
import FloatingCart from "./FloatingCart";
import FloatingWhatsApp from "./FloatingWhatsApp";
import ClosedBanner from "./ClosedBanner";
import ScrollToTop from "./ScrollToTop";
import { useAuth } from "../contexts/AuthContext";
import { ensurePushSubscription } from "../lib/push";

export default function Layout() {
    const { user } = useAuth();
    // Silently keep the customer's push subscription fresh while they're signed in.
    // Only re-asks for permission if they previously granted it (silent=true). The
    // explicit prompt happens via a button on OrdersPage / TrackingPage when they
    // place their first order — that's the moment notifications make sense.
    useEffect(() => {
        if (user) { ensurePushSubscription({ silent: true }); }
    }, [user]);
    return (
        <div className="min-h-screen flex flex-col bg-white">
            <ScrollToTop />
            <Header />
            <ClosedBanner />
            <main className="flex-1">
                <Outlet />
            </main>
            <Footer />
            <FloatingCart />
            <FloatingWhatsApp />
        </div>
    );
}
