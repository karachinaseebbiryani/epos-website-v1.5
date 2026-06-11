import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { LayoutDashboard, ShoppingBag, ChefHat, Tag, CalendarDays, LogOut, Settings, FolderTree } from "lucide-react";

const NAV = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/orders", label: "Online Orders", icon: ShoppingBag },
    { to: "/admin/menu", label: "Menu", icon: ChefHat },
    { to: "/admin/categories", label: "Categories", icon: FolderTree },
    { to: "/admin/offers", label: "Offers", icon: Tag },
    { to: "/admin/events", label: "Events", icon: CalendarDays },
    { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout() {
    const navigate = useNavigate();
    useEffect(() => {
        if (!localStorage.getItem("knb_admin_token")) navigate("/admin/login");
    }, [navigate]);

    const logout = () => {
        localStorage.removeItem("knb_admin_token");
        navigate("/admin/login");
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex" data-testid="admin-layout">
            <aside className="hidden md:flex w-64 bg-brand-ink text-white flex-col">
                <Link to="/admin" className="px-6 py-6 border-b border-white/10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-red flex items-center justify-center font-display font-black">K</div>
                    <div>
                        <div className="font-display font-bold">Karachi Naseeb</div>
                        <div className="text-xs text-brand-yellow">Admin Panel</div>
                    </div>
                </Link>
                <nav className="flex-1 p-3 space-y-1">
                    {NAV.map((n) => (
                        <NavLink key={n.to} to={n.to} end={n.end}
                            data-testid={`admin-nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
                            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${isActive ? "bg-brand-red text-white" : "text-white/70 hover:text-white hover:bg-white/5"}`}>
                            <n.icon className="w-4 h-4" /> {n.label}
                        </NavLink>
                    ))}
                </nav>
                <button onClick={logout} data-testid="admin-logout"
                    className="m-3 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                    <LogOut className="w-4 h-4" /> Sign out
                </button>
            </aside>

            {/* Mobile top nav */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-brand-ink text-white border-t border-white/10">
                <div className="flex justify-around">
                    {NAV.map((n) => (
                        <NavLink key={n.to} to={n.to} end={n.end}
                            data-testid={`admin-mobile-nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
                            className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-3 ${isActive ? "text-brand-red" : "text-white/60"}`}>
                            <n.icon className="w-4 h-4" />
                            <span className="text-[10px] font-semibold">{n.label.split(" ")[0]}</span>
                        </NavLink>
                    ))}
                </div>
            </div>

            <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-x-hidden">
                <Outlet />
            </main>
        </div>
    );
}
