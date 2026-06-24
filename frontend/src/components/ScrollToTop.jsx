import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls window to top on every route change.
 * Fixes the issue where pages (Cart, Menu after "View Full Menu", etc.)
 * inherit the scroll position of the previous page.
 *
 * Honors `state.preserveScroll` so flows that need to keep position
 * (rare — e.g. modal-style internal navigations) can opt out:
 *   navigate("/somewhere", { state: { preserveScroll: true } })
 */
export default function ScrollToTop() {
    const { pathname, state } = useLocation();

    useEffect(() => {
        if (state && state.preserveScroll) return;
        // `instant` keeps it snappy; some browsers don't support it yet so we
        // fall back to 0,0 set without behavior.
        try {
            window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        } catch (_e) {
            window.scrollTo(0, 0);
        }
    }, [pathname, state]);

    return null;
}
