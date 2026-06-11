import { useEffect, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Polls /api/public/business-hours so the customer site can show
 * an "open/closed" banner and block checkout outside open hours.
 * Refreshes every 60s and on window focus.
 */
export default function useBusinessHours() {
    const [bh, setBh] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const load = () => {
            axios.get(`${API}/public/business-hours`)
                .then(({ data }) => { if (!cancelled) setBh(data); })
                .catch(() => { /* keep prior value */ });
        };
        load();
        const interval = setInterval(load, 60000);
        const onFocus = () => load();
        window.addEventListener("focus", onFocus);
        return () => {
            cancelled = true;
            clearInterval(interval);
            window.removeEventListener("focus", onFocus);
        };
    }, []);

    return bh;
}
