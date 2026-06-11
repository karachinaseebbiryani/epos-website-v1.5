import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("knb_token");
    const adminToken = localStorage.getItem("knb_admin_token");
    // Use admin token for admin routes, customer token elsewhere
    const isAdminCall =
        config.url?.startsWith("/admin/") ||
        config.url?.startsWith("/files/") ||
        (config.url?.startsWith("/online-orders") && !config.url?.startsWith("/online-orders/me") && !config.url?.match(/^\/online-orders\/[^/]+$/) && !config.url?.match(/^\/online-orders\/[^/]+\/bank-payment$/) && !config.url?.match(/^\/online-orders\/[^/]+\/payment-screenshot$/)) ||
        config.url?.startsWith("/event-bookings") && config.method !== "post" ||
        config.url?.startsWith("/users") ||
        (config.url?.startsWith("/offers") && config.method !== "get") ||
        (config.url?.startsWith("/menu-items") && config.method !== "get") ||
        (config.url?.startsWith("/categories") && config.method !== "get") ||
        config.url?.startsWith("/auth/me");
    if (isAdminCall && adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
    } else if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else if (adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
    }
    return config;
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
