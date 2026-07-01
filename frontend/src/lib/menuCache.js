import api from "./api";
import axios from "axios";

const TTL_MS = 30_000;
const LS_PREFIX = "knb_mcache_v1:";
const LS_MAX_BYTES = 4_000_000;
const _cache = new Map();

function _lsRead(url) {
    try {
        const raw = localStorage.getItem(LS_PREFIX + url);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.ts !== "number") return null;
        return parsed;
    } catch { return null; }
}
function _lsWrite(url, data) {
    try {
        const payload = JSON.stringify({ ts: Date.now(), data });
        if (payload.length > LS_MAX_BYTES) return;
        localStorage.setItem(LS_PREFIX + url, payload);
    } catch { /* ignore */ }
}
function _lsClear() {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
        }
    } catch { /* ignore */ }
}

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
    if (e && e.data !== undefined && now - e.ts < TTL_MS) return e.data;
    if (e?.inflight) {
        if (allowStale && e.data !== undefined) return e.data;
        return e.inflight;
    }
    const promise = api.get(url)
        .then((r) => {
            _cache.set(url, { ts: Date.now(), data: r.data, inflight: null });
            _lsWrite(url, r.data);
            return r.data;
        })
        .catch((err) => {
            const cur = _cache.get(url);
            if (cur) cur.inflight = null;
            throw err;
        });
    _cache.set(url, { ts: e?.ts || 0, data: e?.data, inflight: promise });
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

if (typeof window !== "undefined") {
    window.__knb_menu_cache_bust = () => { _cache.clear(); _lsClear(); };
}

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