import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, ShoppingBag, ChefHat, Tag, CalendarDays, LogOut,
  Settings, FolderTree, ShoppingCart, Package, Receipt, Truck, RotateCcw,
  History, FileBarChart, SlidersHorizontal, Diamond, Gift, MessageSquare, Bell,
  HelpCircle, CreditCard,
} from "lucide-react";
import GlobalOrderAlert from "./GlobalOrderAlert";
import { useStaffAuth } from "../contexts/StaffAuthContext";

// Operational POS pages preserved from the old fully-operational system.
// Listed FIRST per production workflow priority.
const OPS_NAV = [
  { to: "/admin/pos",               label: "POS / Sales",      icon: ShoppingCart, perm: "pos" },
  { to: "/admin/dashboard-classic", label: "Classic Dashboard",icon: LayoutDashboard, perm: "dashboard" },
  { to: "/admin/menu-mgmt",         label: "Menu Management",  icon: ChefHat, perm: "menu" },
  { to: "/admin/inventory",         label: "Inventory",        icon: Package, perm: "inventory" },
  { to: "/admin/vendors",           label: "Vendors",          icon: Truck, perm: "vendors" },
  { to: "/admin/expenses",          label: "Expenses",         icon: Receipt, perm: "expenses" },
  { to: "/admin/refunds",           label: "Refunds",          icon: RotateCcw, perm: "refunds" },
  { to: "/admin/old-orders",        label: "Order History",    icon: History, perm: "orders_history" },
  { to: "/admin/reports",           label: "X / Z Reports",    icon: FileBarChart, perm: "reports_x" },
  { to: "/admin/settings-full",     label: "Full Settings",    icon: SlidersHorizontal, perm: "settings" },
];

// Online-store admin (online ordering website management).
// Each entry now requires its own permission so admin can grant/revoke per-module.
const ONLINE_NAV = [
  { to: "/admin",            label: "Dashboard",     icon: LayoutDashboard, end: true, perm: "online_dashboard" },
  { to: "/admin/orders",     label: "Online Orders", icon: ShoppingBag, perm: "online_orders" },
  { to: "/admin/menu",       label: "Menu",          icon: ChefHat, perm: "online_menu" },
  { to: "/admin/categories", label: "Categories",    icon: FolderTree, perm: "online_menu" },
  { to: "/admin/offers",     label: "Offers",        icon: Tag, perm: "online_offers" },
  { to: "/admin/events",     label: "Events",        icon: CalendarDays, perm: "online_events" },
  { to: "/admin/reviews",    label: "Reviews",       icon: MessageSquare, perm: "online_settings" },
  { to: "/admin/faqs",       label: "FAQs",          icon: HelpCircle, perm: "online_settings" },
  { to: "/admin/delivery-areas", label: "Delivery Areas", icon: Truck, perm: "online_settings" },
  { to: "/admin/loyalty-settings", label: "Loyalty Settings", icon: Diamond, perm: "online_settings" },
  { to: "/admin/rewards",    label: "Rewards",       icon: Gift, perm: "online_settings" },
  { to: "/admin/notifications", label: "Notifications", icon: Bell, perm: "online_settings" },
  { to: "/admin/payment-gateways", label: "Payment Gateways", icon: CreditCard, perm: "online_settings" },
  { to: "/admin/settings",   label: "Settings",      icon: Settings, perm: "online_settings" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user } = useStaffAuth();
  const [adminTokenOk, setAdminTokenOk] = useState(false);

  // Allow access if EITHER the online admin token (set by /admin/login)
  // OR the staff JWT (set by /admin/staff-login or /admin/sign-in) is present.
  useEffect(() => {
    const hasAdmin = !!localStorage.getItem("knb_admin_token");
    const hasStaff = !!localStorage.getItem("staff_auth_token");
    if (!hasAdmin && !hasStaff) {
      navigate("/admin/sign-in", { replace: true });
      return;
    }
    setAdminTokenOk(true);
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("knb_admin_token");
    localStorage.removeItem("staff_auth_token");
    navigate("/admin/sign-in");
  };

  // Filter nav items by the staff user's role/permissions.
  // Users that came in via /admin/login (online-only token) get full visibility — they
  // were already verified as `role==admin` at that endpoint, so we trust them here.
  const visibleOps = useMemo(() => filterByPerm(OPS_NAV, user), [user]);
  const visibleOnline = useMemo(() => filterByPerm(ONLINE_NAV, user), [user]);

  if (!adminTokenOk) return null; // wait for redirect to fire

  return (
    <div className="h-screen bg-neutral-50 flex overflow-hidden" data-testid="admin-layout">
      {/* Global notification ringer — works on every admin page */}
      <GlobalOrderAlert />

      <aside className="hidden md:flex w-64 bg-brand-ink text-white flex-col h-screen">
        <Link to="/admin/pos" className="px-6 py-6 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-brand-red flex items-center justify-center font-display font-black">K</div>
          <div>
            <div className="font-display font-bold">Karachi Naseeb</div>
            <div className="text-xs text-brand-yellow">Unified Admin</div>
          </div>
        </Link>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto min-h-0">
          {/* POS Operations FIRST per production priority */}
          {visibleOps.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                POS Operations
              </div>
              {visibleOps.map((n) => (
                <NavItem key={n.to} item={n} testidPrefix="admin-nav" />
              ))}
            </>
          )}

          {visibleOnline.length > 0 && (
            <>
              <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                Online Store
              </div>
              {visibleOnline.map((n) => (
                <NavItem key={n.to} item={n} testidPrefix="admin-nav" />
              ))}
            </>
          )}
        </nav>

        <button
          onClick={logout}
          data-testid="admin-logout"
          className="m-3 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </aside>

      {/* Mobile bottom nav — most-used items, biased toward POS now */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-brand-ink text-white border-t border-white/10">
        <div className="flex justify-around overflow-x-auto">
          {[
            visibleOps[0], visibleOnline[1], visibleOps[8], visibleOnline[0], visibleOps[9],
          ].filter(Boolean).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={`admin-mobile-nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
              className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-3 ${isActive ? "text-brand-red" : "text-white/60"}`}
            >
              <n.icon className="w-4 h-4" />
              <span className="text-[10px] font-semibold">{n.label.split(" ")[0]}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ item, testidPrefix }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      data-testid={`${testidPrefix}-${item.label.toLowerCase().replace(/[\s/]/g, "-")}`}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          isActive ? "bg-brand-red text-white" : "text-white/70 hover:text-white hover:bg-white/5"
        }`
      }
    >
      <item.icon className="w-4 h-4" /> {item.label}
    </NavLink>
  );
}

// Permission filter: admins see everything; staff users see only entries whose `perm`
// they hold. Users with knb_admin_token but no staff JWT are treated as admins (they
// already passed the admin-only login at /admin/login).
function filterByPerm(items, user) {
  const hasOnlineAdminToken = typeof window !== "undefined" && !!localStorage.getItem("knb_admin_token");
  if (hasOnlineAdminToken && (!user || user === false)) {
    return items;
  }
  if (!user || user === false) return items;
  if (user.role === "admin") return items;
  const perms = user.permissions || [];
  return items.filter((it) => !it.perm || perms.includes(it.perm));
}
