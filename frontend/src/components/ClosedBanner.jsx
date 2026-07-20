import { useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import useBusinessHours from "../hooks/useBusinessHours";
import { syncOpeningHoursSchema } from "../lib/seo";

/**
 * Banner shown across the customer site (and inline on checkout) when the
 * restaurant is currently closed. Reads from /api/public/business-hours.
 *
 * Side duty: this is the one component that polls business hours on every
 * public page, so it also keeps the Restaurant JSON-LD's opening hours in
 * sync with the admin-managed schedule (see syncOpeningHoursSchema).
 */
export default function ClosedBanner({ inline = false }) {
    const bh = useBusinessHours();

    // Keep SEO schema hours in lock-step with the live schedule — runs even
    // while the restaurant is open (when the banner itself renders nothing).
    useEffect(() => {
        if (bh?.weekly_schedule) syncOpeningHoursSchema(bh.weekly_schedule);
    }, [bh]);

    if (!bh || !bh.enabled || bh.is_open) return null;

    const todayOpenAt = bh?.today?.open;
    const todayClosed = bh?.today?.closed;
    const nextOpenLabel = (() => {
        if (todayClosed) {
            // next_open_at is an ISO string in this case
            try {
                const d = new Date(bh.next_open_at);
                if (!Number.isNaN(d.getTime())) {
                    return `${d.toLocaleDateString(undefined, { weekday: "long" })} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                }
            } catch { /* */ }
            return "next open day";
        }
        const display = bh.next_open_display || todayOpenAt || bh.next_open_at;
        return `today at ${display || "opening time"}`;
    })();

    if (inline) {
        return (
            <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 md:p-5 flex items-start gap-3" data-testid="closed-banner-inline">
                <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                    <div className="font-bold text-amber-900">We're currently closed</div>
                    <div className="text-sm text-amber-800 mt-0.5">
                        Online ordering reopens {nextOpenLabel}. Timezone: {bh.timezone || "Asia/Karachi"}.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-amber-100 border-b border-amber-200 text-amber-900" data-testid="closed-banner">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-2.5 flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold">We're closed.</span>
                <span className="hidden sm:inline">Online ordering reopens {nextOpenLabel}.</span>
            </div>
        </div>
    );
}
