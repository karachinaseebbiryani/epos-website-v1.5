// ---------------------------------------------------------------------------
// Shared SWR-style cache for read-mostly GET endpoints (menu, menu-items,
// categories). The POS, the customer Home page and the customer Menu page
// all request the same large JSON payload on every mount, and every tab
// navigation used to re-fetch the entire menu from scratch.
//
// This tiny cache:
//   • returns instantly if the same URL was fetched in the last 30 s
//   • de-dupes concurrent requests for the same URL (single in-flight promise)
//   • implements stale-while-revalidate: a slightly-stale entry is returned
//     immediately while a background refresh updates the cache
//   • is invalidated by the api.js response interceptor any time an admin
//     edit, create or delete touches /menu-items, /categories or /menu so the
//     admin never sees their own change as stale
//
// Functionality is unchanged: every call still hits the same endpoint, the
// returned shape is identical, the existing axios instance + auth headers
// are still used.
// ---------------------------------------------------------------------------
import api from "./api";
import axios from "axios";

const TTL_MS = 30_000;
const _cache = new Map(); // url -> { ts, data, inflight }

export function getCached(url) {
    const e = _cache.get(url);
    if (!e || e.data === undefined) return null;
    return { data: e.data, fresh: Date.now() - e.ts < TTL_MS };
}

export async function fetchCached(url, { allowStale = true } = {}) {
    const now = Date.now();
    const e = _cache.get(url);
    // Fresh hit — return immediately without touching the network.
    if (e && e.data !== undefined && now - e.ts < TTL_MS) return e.data;
    // De-dupe: if a request is already in flight, share it.
    if (e?.inflight) {
        if (allowStale && e.data !== undefined) return e.data;
        return e.inflight;
    }
    const promise = api.get(url)
        .then((r) => {
            _cache.set(url, { ts: Date.now(), data: r.data, inflight: null });
            return r.data;
        })
        .catch((err) => {
            const cur = _cache.get(url);
            if (cur) cur.inflight = null;
            throw err;
        });
    _cache.set(url, { ts: e?.ts || 0, data: e?.data, inflight: promise });
    // If we have stale data and the caller is OK with it, hand it back NOW
    // and let the refresh continue in the background.
    if (allowStale && e?.data !== undefined) return e.data;
    return promise;
}

export function invalidate(url) {
    if (url) _cache.delete(url);
    else _cache.clear();
}

// Expose a global invalidator that api.js' response interceptor can call after
// any non-GET mutation on /menu-items, /categories or /menu. We use a window
// hook (instead of a direct import) to avoid a circular dependency between
// api.js and menuCache.js.
if (typeof window !== "undefined") {
    window.__knb_menu_cache_bust = () => _cache.clear();
}

// Also hook into the GLOBAL axios instance so legacy pages that use `axios`
// directly (instead of the `api` instance) — e.g. POSPage, MenuManagement —
// also invalidate the cache after they mutate menu data.
try {
    if (axios && axios.interceptors && axios.interceptors.response) {
        axios.interceptors.response.use((res) => {
            try {
                const m = (res?.config?.method || "get").toLowerCase();
                if (m !== "get") {
                    const u = res?.config?.url || "";
                    if (u.includes("/menu-items") || u.includes("/categories") || u.includes("/inventory") || /\/orders(\?|$|\/)/.test(u)) {
                        _cache.clear();
                    }
                }
            } catch (e) { /* never break a real response */ }
            return res;
        });
    }
} catch (e) { /* axios not present — fine */ }
