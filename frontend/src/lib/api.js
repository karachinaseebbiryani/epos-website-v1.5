import axios from "axios";
import { refreshStaffToken } from "../contexts/StaffAuthContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
// Resolves a possibly-relative image URL coming from the backend
// (e.g. "/api/uploads/menu/abc.jpg") to an absolute URL on the Fly backend,
// so that <img src> works when the SPA is hosted on a different origin
// (Vercel) than the API (Fly). Idempotent: absolute URLs and data: URLs
// are returned unchanged. Empty / null values return "" so React renders
// nothing instead of triggering a broken-image request.
export function resolveImageUrl(u) {
    if (!u || typeof u !== "string") return "";
    if (u.startsWith("data:") || u.startsWith("blob:")) return u;
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith("/api/")) return `${BACKEND_URL}${u}`;
    return u;
}
const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("knb_token");
    const adminToken = localStorage.getItem("knb_admin_token");
    const staffToken = localStorage.getItem("staff_auth_token");
    const method = (config.method || "get").toLowerCase();
    // POST /online-orders is the customer-facing "place my order" call. It must ALWAYS go
    // out with the customer token (never the admin token) so the backend can link the order
    // to the signed-in customer — otherwise the order shows up as a guest order even though
    // the user is logged in. (Was the root cause of Google-sign-in orders disappearing from
    // a customer's order history on mobile.)
    const isCustomerPlaceOrder = method === "post" && config.url?.startsWith("/online-orders") && !config.url?.match(/^\/online-orders\/[^/]+\//);
    // Use admin token for admin routes, customer token elsewhere
    const isAdminCall = !isCustomerPlaceOrder && (
        config.url?.startsWith("/admin/") ||
        config.url?.startsWith("/files/") ||
        (config.url?.startsWith("/online-orders") && !config.url?.startsWith("/online-orders/me") && !config.url?.match(/^\/online-orders\/[^/]+$/) && !config.url?.match(/^\/online-orders\/[^/]+\/bank-payment$/) && !config.url?.match(/^\/online-orders\/[^/]+\/payment-screenshot$/)) ||
        config.url?.startsWith("/event-bookings") && config.method !== "post" ||
        config.url?.startsWith("/users") ||
        (config.url?.startsWith("/offers") && config.method !== "get") ||
        (config.url?.startsWith("/menu-items") && config.method !== "get") ||
        (config.url?.startsWith("/categories") && config.method !== "get") ||
        config.url?.startsWith("/auth/me")
    );
    if (isAdminCall && adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
    } else if (isAdminCall && staffToken) {
        config.headers.Authorization = `Bearer ${staffToken}`;
    } else if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else if (adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
    }
    return config;
});

// Bust the shared menu cache whenever an admin mutates the menu, a category
// or stock. Done on the RESPONSE so we only invalidate after a confirmed
// success. The hook is registered on `window` by menuCache.js to avoid a
// circular import between this file and menuCache.js.
api.interceptors.response.use((res) => {
    try {
        const m = (res.config?.method || "get").toLowerCase();
        if (m !== "get") {
            const u = res.config?.url || "";
            if (u.startsWith("/menu-items") || u.startsWith("/categories") || u.startsWith("/inventory") || u === "/menu") {
                if (typeof window !== "undefined" && typeof window.__knb_menu_cache_bust === "function") {
                    window.__knb_menu_cache_bust();
                }
            }
        }
    } catch (e) { /* never fail a real response because of cache plumbing */ }
    return res;
}, async (error) => {
    const config = error.config || {};
    const staffToken = localStorage.getItem("staff_auth_token");
    const adminToken = localStorage.getItem("knb_admin_token");
    const authorization = config.headers?.Authorization;
    const isStaffRequest = authorization === `Bearer ${staffToken}` || authorization === `Bearer ${adminToken}`;
    if (error.response?.status !== 401 || config._adminRetried || config._staffRetried || !isStaffRequest) {
        return Promise.reject(error);
    }
    // Try to refresh the admin token first (online store orders)
    if (adminToken) {
        config._adminRetried = true;
        try {
            const { data } = await axios.post(`${API}/auth/admin/refresh`, {}, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            if (data.token) {
                localStorage.setItem("knb_admin_token", data.token);
                config.headers = config.headers || {};
                config.headers.Authorization = `Bearer ${data.token}`;
                return api(config);
            }
        } catch (refreshError) {
            // Admin refresh failed; fall through to staff refresh below
        }
    }
    // If no admin token or admin refresh failed, try staff token refresh
    if (staffToken) {
        config._staffRetried = true;
        try {
            const token = await refreshStaffToken();
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
            return api(config);
        } catch (refreshError) {
            // Both failed; clear and redirect
        }
    }
    // Both refresh attempts failed; clear tokens and redirect to login
    localStorage.removeItem("staff_auth_token");
    localStorage.removeItem("knb_admin_token");
    window.location.href = "/admin/sign-in";
    return Promise.reject(error);
});

export function formatApiError(detail) {
    if (detail == null) return "Something went wrong. Please try again.";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail))
        return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
    if (detail && typeof detail.msg === "string") return detail.msg;
    return String(detail);
}

export default api;
