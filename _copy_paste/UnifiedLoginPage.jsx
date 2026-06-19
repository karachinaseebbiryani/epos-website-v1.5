import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { useStaffAuth } from "../contexts/StaffAuthContext";

/**
 * UnifiedLoginPage — single staff/admin sign-in.
 *
 * After successful auth:
 *   • Stores BOTH `staff_auth_token` (used by legacy POS pages) AND
 *     `knb_admin_token` (used by AdminLayout / lib/api online-store flows)
 *     so the user can navigate freely between POS Operations and Online Store
 *     modules without re-entering credentials.
 *   • Redirects based on role + permissions:
 *       - Admin → /admin/pos (operations-first per production priority)
 *       - User with "pos" perm → /admin/pos
 *       - Otherwise to the first permitted module
 *   • Honors `?next=` query param for deep-link returns.
 *
 * Customers continue to use /login (a separate customer-side page).
 */
const PERM_TO_ROUTE = [
  ["pos", "/admin/pos"],
  ["dashboard", "/admin/dashboard-classic"],
  ["online_dashboard", "/admin"],
  ["online_orders", "/admin/orders"],
  ["online_menu", "/admin/menu"],
  ["menu", "/admin/menu-mgmt"],
  ["inventory", "/admin/inventory"],
  ["expenses", "/admin/expenses"],
  ["vendors", "/admin/vendors"],
  ["refunds", "/admin/refunds"],
  ["orders_history", "/admin/old-orders"],
  ["reports_x", "/admin/reports"],
  ["settings", "/admin/settings-full"],
  ["online_settings", "/admin/settings"],
  ["online_offers", "/admin/offers"],
  ["online_events", "/admin/events"],
];

function pickLandingRoute(role, permissions = []) {
  if (role === "admin") return "/admin/pos";
  if (permissions.includes("pos")) return "/admin/pos";
  for (const [perm, route] of PERM_TO_ROUTE) {
    if (permissions.includes(perm)) return route;
  }
  return "/admin/pos";
}

export default function UnifiedLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useStaffAuth();
  const [email, setEmail] = useState("admin@restaurant.com");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Guard: once submit() fires its own hard-redirect we must NOT also let the
  // [user] effect kick off a second (soft) navigation. Two concurrent
  // navigations cancel each other's lazy-chunk downloads and leave the user
  // stuck on the LoadingScreen until they hit refresh.
  const redirectingRef = useRef(false);

  const nextUrl = new URLSearchParams(location.search).get("next");

  // If already signed in when the page first opens, route straight in.
  // We deliberately use window.location.replace (not navigate) so the
  // destination route remounts with both localStorage tokens already in place
  // — the same code path submit() uses below, keeping behaviour consistent.
  useEffect(() => {
    if (redirectingRef.current) return;
    if (user && user !== false) {
      redirectingRef.current = true;
      window.location.replace(nextUrl || pickLandingRoute(user.role, user.permissions || []));
    }
  }, [user, nextUrl]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    redirectingRef.current = true; // suppress the [user] effect's auto-redirect
    try {
      // Use StaffAuthContext's login() so the React user state updates atomically.
      const data = await login(email, password);
      // Mirror token to the online-admin localStorage key so AdminLayout's gate
      // (which checks either knb_admin_token OR staff_auth_token) is satisfied.
      if (data?.token) {
        localStorage.setItem("knb_admin_token", data.token);
      }
      toast.success(`Welcome, ${data.name || data.email}`);
      const target = nextUrl || pickLandingRoute(data.role, data.permissions || []);
      // Single hard redirect — guarantees the destination route remounts fresh
      // with both localStorage tokens already in place and avoids any
      // concurrent-render race with React Router soft navigation.
      window.location.replace(target);
    } catch (err) {
      redirectingRef.current = false; // allow retry
      const msg = err.response?.data?.detail || "Login failed";
      setError(typeof msg === "string" ? msg : "Login failed");
      setLoading(false);
    }
  };

  // `navigate` is intentionally unused — we use window.location.replace
  // everywhere to keep the redirect path uniform. Keep the import so React
  // Router context stays mounted for nested links.
  void navigate;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#1E3F20] via-[#264D27] to-[#1A1D1A]" data-testid="unified-login-page">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-7">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-brand-red text-white flex items-center justify-center font-display font-black text-2xl">K</div>
          <h1 className="font-display font-black text-3xl text-brand-ink">Staff / POS Sign In</h1>
          <p className="text-neutral-500 text-sm mt-1">Karachi Naseeb · Restaurant team only</p>
          <p className="text-[11px] text-neutral-400 mt-2">Customer? <a href="/login" className="text-brand-red font-semibold hover:underline">Use customer sign-in →</a></p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-brand-ink mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="unified-login-email"
              className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-brand-ink mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="unified-login-password"
                className="w-full px-4 py-3 pr-10 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 font-medium" data-testid="unified-login-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            data-testid="unified-login-submit"
            className="w-full bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full py-3.5 font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="text-center text-xs text-neutral-400 mt-5">
          Passsword Reset Option Not Available 
        </p>
        <p className="text-center text-xs text-neutral-400 mt-1">
          Customer ordering? <a href="/login" className="text-brand-red font-semibold">Customer login →</a>
        </p>
      </div>
    </div>
  );
}
