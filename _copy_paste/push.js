import api from "./api";

/**
 * Web Push helper — subscribes the current browser to order-status notifications.
 *
 * Idempotent: safe to call on every customer sign-in / page mount. The backend
 * upserts on `endpoint` so duplicate subscriptions don't pile up.
 *
 * Permission UX:
 *  - First call after sign-in: prompts the OS permission dialog.
 *  - If the user has previously denied: this is a no-op (we don't badger them).
 *  - If the user has granted: we subscribe silently on every load to keep the
 *    backend's subscription doc fresh (keys rotate every ~90 days on Android).
 */

const VAPID_PUBKEY_CACHE_KEY = "knb_vapid_pub_v1";

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
    return out;
}

export async function isPushSupported() {
    return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

async function getVapidPublicKey() {
    const cached = localStorage.getItem(VAPID_PUBKEY_CACHE_KEY);
    if (cached) return cached;
    const { data } = await api.get("/push/vapid-public-key");
    if (data?.public_key) {
        localStorage.setItem(VAPID_PUBKEY_CACHE_KEY, data.public_key);
        return data.public_key;
    }
    throw new Error("No VAPID key");
}

/**
 * Register the service worker and subscribe to push if the user grants permission.
 * Returns "subscribed" | "denied" | "unsupported" | "default" | "error".
 *
 * @param {object} opts
 *   - silent (default true): don't auto-prompt. Pass false to fire the permission
 *     dialog (must be called from a user-gesture handler — e.g. a button click).
 */
export async function ensurePushSubscription({ silent = true } = {}) {
    if (!(await isPushSupported())) return "unsupported";
    let reg;
    try {
        reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
    } catch (e) {
        return "error";
    }
    let perm = Notification.permission;
    if (perm === "default" && !silent) {
        try { perm = await Notification.requestPermission(); }
        catch { perm = Notification.permission; }
    }
    if (perm !== "granted") return perm; // "denied" or "default"
    try {
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
            // Re-send to backend so the subscription doc stays attached to the current
            // signed-in customer (handles "logged in on this browser as user A, now as B").
            const sub = existing.toJSON();
            await api.post("/push/subscribe", { endpoint: sub.endpoint, keys: sub.keys }).catch(() => {});
            return "subscribed";
        }
        const pubKey = await getVapidPublicKey();
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(pubKey),
        });
        const j = sub.toJSON();
        await api.post("/push/subscribe", { endpoint: j.endpoint, keys: j.keys });
        return "subscribed";
    } catch (e) {
        return "error";
    }
}

/** Best-effort unsubscribe — called on logout. Failure is silent. */
export async function unsubscribePush() {
    try {
        if (!(await isPushSupported())) return;
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg && (await reg.pushManager.getSubscription());
        if (sub) {
            await api.post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
            await sub.unsubscribe();
        }
    } catch { /* */ }
}
