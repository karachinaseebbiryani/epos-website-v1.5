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
// ---------------------------------------------------------------------------
// Shared SWR-style cache for read-mostly GET endpoints (menu, menu-items,
// categories). Now backed by BOTH in-memory state AND localStorage so the
// POS page can render its grid instantly on a cold browser reload.
//
//   • returns instantly if the same URL was fetched in the last 30 s
//   • de-dupes concurrent requests for the same URL (single in-flight promise)
//   • stale-while-revalidate: a stale entry is returned immediately while a
//     background refresh updates the cache (also persisted to localStorage)
//   • is invalidated by the api.js response interceptor any time an admin
//     edit, create or delete touches /menu-items, /categories or /menu
// ---------------------------------------------------------------------------
import api from "./api";
import axios from "axios";

const TTL_MS = 30_000;
const LS_PREFIX = "knb_mcache_v1:"; // localStorage key namespace
const LS_MAX_BYTES = 4_000_000;     // skip persisting payloads larger than ~4 MB
const _cache = new Map();           // url -> { ts, data, inflight }

// ---------- localStorage helpers (silent on quota/parse errors) ----------
function _lsRead(url) {
    try {
        const raw = localStorage.getItem(LS_PREFIX + url);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.ts !== "number") return null;
        return parsed; // { ts, data }
    } catch { return null; }
}
function _lsWrite(url, data) {
    try {
        const payload = JSON.stringify({ ts: Date.now(), data });
        if (payload.length > LS_MAX_BYTES) return; // never blow up quota
        localStorage.setItem(LS_PREFIX + url, payload);
    } catch { /* quota exceeded or disabled — ignore */ }
}
function _lsClear() {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
        }
    } catch { /* ignore */ }
}

// ---------- hydrate in-memory cache from localStorage on first import ----------
// This is what makes the POS tiles appear instantly on a hard reload.
(function _hydrate() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith(LS_PREFIX)) continue;
            const url = k.slice(LS_PREFIX.length);
            const entry = _lsRead(url);
            if (entry) _cache.set(url, { ts: entry.ts, data: entry.data, inflight: null });
        }
    } catch { /* ignore */ }
})();

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
            _lsWrite(url, r.data); // persist for next hard reload
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
    if (url) {
        _cache.delete(url);
        try { localStorage.removeItem(LS_PREFIX + url); } catch { /* ignore */ }
    } else {
        _cache.clear();
        _lsClear();
    }
}

// Expose a global invalidator that api.js' response interceptor can call after
// any non-GET mutation on /menu-items, /categories or /menu.
if (typeof window !== "undefined") {
    window.__knb_menu_cache_bust = () => { _cache.clear(); _lsClear(); };
}

// Also hook into the GLOBAL axios instance so legacy pages that use `axios`
// directly (instead of the `api` instance) also invalidate the cache after
// they mutate menu data.
try {
    if (axios && axios.interceptors && axios.interceptors.response) {
        axios.interceptors.response.use((res) => {
            try {
                const m = (res?.config?.method || "get").toLowerCase();
                if (m !== "get") {
                    const u = res?.config?.url || "";
                    if (u.includes("/menu-items") || u.includes("/categories") || u.includes("/inventory") || /\/orders(\?|$|\/)/.test(u)) {
                        _cache.clear();
                        _lsClear();
                    }
                }
            } catch (e) { /* never break a real response */ }
            return res;
        });
    }
} catch (e) { /* axios not present — fine */ }