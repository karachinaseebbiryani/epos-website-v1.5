import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, UtensilsCrossed, Package, FileBarChart, LogOut, ChevronRight, Settings, Receipt, Truck, RotateCcw, History } from "lucide-react";
import { ScrollArea } from "../components/ui/scroll-area";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" },
  { path: "/pos", label: "POS / Sales", icon: ShoppingCart, perm: "pos" },
  { path: "/menu", label: "Menu Management", icon: UtensilsCrossed, perm: "menu" },
  { path: "/inventory", label: "Inventory", icon: Package, perm: "inventory" },
  { path: "/vendors", label: "Vendors", icon: Truck, perm: "vendors" },
  { path: "/expenses", label: "Expenses", icon: Receipt, perm: "expenses" },
  { path: "/refunds", label: "Refunds", icon: RotateCcw, perm: "refunds" },
  { path: "/old-orders", label: "Old Orders", icon: History, perm: "orders_history" },
  { path: "/reports", label: "Reports", icon: FileBarChart, perm: "reports_x" },
  { path: "/settings", label: "Settings", icon: Settings, perm: "settings" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const perms = user?.permissions || [];
  const [brand, setBrand] = useState({ name: "KARACHI NASEEB BIRYANI", sub: "AND MURG PULAO", logo: "" });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/settings`, { withCredentials: true });
        const full = (data.restaurant_name || "").trim();
        let name = full, sub = "";
        // Split long names at " AND " for a nice 2-line header
        const idx = full.toUpperCase().indexOf(" AND ");
        if (idx > 0) { name = full.slice(0, idx); sub = full.slice(idx + 1); }
        setBrand({ name: name || "RestoPOS", sub, logo: data.restaurant_logo || "" });
      } catch { /* ignore */ }
    })();
  }, []);

  const filteredNav = NAV_ITEMS.filter((item) => {
    if (user?.role === "admin") return true;
    return perms.includes(item.perm);
  });

  return (
    <div data-testid="sidebar" className="w-64 min-h-screen flex flex-col flex-shrink-0" style={{ background: "#1E3F20" }}>
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        {brand.logo ? (
          <img data-testid="sidebar-logo" src={brand.logo} alt="logo" className="w-10 h-10 rounded-md object-cover flex-shrink-0 bg-white/10" />
        ) : null}
        <h1 data-testid="app-logo" className="text-sm font-bold text-white tracking-tight leading-tight" style={{ fontFamily: "Manrope, sans-serif" }}>
          {brand.name}{brand.sub && (<><br/><span className="text-[10px] font-medium text-white/70">{brand.sub}</span></>)}
        </h1>
      </div>
      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {filteredNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button key={item.path} data-testid={`nav-${item.label.toLowerCase().replace(/[\s\/]/g, "-")}`}
                onClick={() => navigate(item.path)}
                className={`sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${active ? "bg-[#2E5C31] text-white" : "text-white/70 hover:text-white hover:bg-white/10"}`}>
                <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <ChevronRight className="w-4 h-4 opacity-60" />}
              </button>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#2E5C31", color: "#fff" }}>
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{user?.name || "User"}</p>
            <p className="text-xs text-white/50 capitalize">{user?.role || "cashier"}</p>
          </div>
        </div>
        <button data-testid="logout-btn" onClick={logout}
          className="sidebar-item w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10">
          <LogOut className="w-4 h-4" /><span>Logout</span>
        </button>
      </div>
    </div>
  );
}
