import { useEffect, useState } from "react";
import api from "./api";

// Shared source of truth for public restaurant info (name, phone, whatsapp, email,
// address, opening hours, social links) edited under Admin → Settings. Backed by
// GET /public/restaurant-info. Footer and the floating WhatsApp button render on every
// page, so we cache the result at module scope and de-dupe the in-flight request —
// the whole app makes at most one call, and admin edits show up after a refresh.
let _cache = null;     // resolved data, kept for the session
let _promise = null;   // in-flight request, shared by all consumers

export function useRestaurantInfo() {
    const [info, setInfo] = useState(_cache);

    useEffect(() => {
        if (_cache) { setInfo(_cache); return; }
        if (!_promise) {
            _promise = api.get("/public/restaurant-info")
                .then((r) => { _cache = r.data; return r.data; })
                .catch(() => { _promise = null; return null; }); // allow a retry on next mount
        }
        let alive = true;
        _promise.then((d) => { if (alive && d) setInfo(d); });
        return () => { alive = false; };
    }, []);

    return info;
}
