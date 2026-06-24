import api from "./api";

/**
 * Web Push helper — subscribes the current browser to order-status notifications.
 *
 * Idempotent: safe to call on every customer sign-in / page mount. The backend
 * upserts on `endpoint` so duplicate subscriptions don't pile up.
 *
 * Stale-subscription handling:
 *  - When the admin regenerates VAPID keys, the *server* wipes every push_subscriptions
 *    doc but the *browser* still has the old PushSubscription cached. The old endpoint
 *    is signed against the dead applicationServerKey and would never deliver — so we
 *    detect that mismatch here, unsubscribe the stale sub, and create a fresh one.
 *
 * Permission UX:
 *  - First call after sign-in: silent — won't prompt the user.
 *  - Explicit gesture (e.g. "Enable notifications" button) with `silent:false` fires
 *    the OS permission dialog (must be a real user gesture or iOS swallows it).
 *  - If the user has granted previously: we re-subscribe silently on every load to keep
 *    the backend's subscription doc fresh (keys rotate every ~90 days on Android).
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

// Compare two URL-safe base64 strings ignoring padding. Browsers strip the "=" when
// they expose applicationServerKey via subscription.options, so a direct === fails.
function normalizeB64(s) {
    return String(s || "").replace(/=+$/g, "").replace(/-/g, "+").replace(/_/g, "/");
}

function arrayBufferToUrlB64(buf) {
    try {
        const bytes = new Uint8Array(buf);
        let bin = "";
        for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    } catch {
        return "";
    }
}

export async function isPushSupported() {
    return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

/** Returns "granted" | "denied" | "default" | "unsupported". Cheap to call on every render. */
export async function getPushStatus() {
    if (!(await isPushSupported())) return "unsupported";
    return Notification.permission;
}

async function getVapidPublicKey({ forceRefresh = false } = {}) {
    if (!forceRefresh) {
        const cached = localStorage.getItem(VAPID_PUBKEY_CACHE_KEY);
        if (cached) return cached;
    }
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

    // Always re-fetch the current server VAPID public key so we can detect "the server
    // regenerated its keys; this browser's cached sub is now useless" — and fix it.
    let serverPubKey;
    try {
        serverPubKey = await getVapidPublicKey({ forceRefresh: true });
    } catch {
        return "error";
    }

    try {
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
            // Compare the server key the existing subscription was signed against vs.
            // what the server reports today. If they mismatch the sub is stale (admin
            // rotated VAPID keys, or the cached key was wrong) — unsubscribe + redo.
            const optsKey = existing.options?.applicationServerKey;
            const existingKeyB64 = optsKey ? arrayBufferToUrlB64(optsKey) : "";
            const stale = !existingKeyB64 || normalizeB64(existingKeyB64) !== normalizeB64(serverPubKey);
            if (stale) {
                try { await api.post("/push/unsubscribe", { endpoint: existing.endpoint }).catch(() => {}); } catch { /* ignore */ }
                try { await existing.unsubscribe(); } catch { /* ignore */ }
            } else {
                const sub = existing.toJSON();
                await api.post("/push/subscribe", { endpoint: sub.endpoint, keys: sub.keys }).catch(() => {});
                return "subscribed";
            }
        }
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(serverPubKey),
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
