import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bell, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ensurePushSubscription, isPushSupported, getPushStatus } from "../lib/push";

// Shared with EnableNotificationsCard — dismissing either hides both for 3 days,
// so a visitor is never nagged twice by two different surfaces.
const DISMISS_KEY = "knb_notifs_card_dismissed_until_v1";
const DISMISS_COOLDOWN_DAYS = 3;
// Engagement delay before the soft-ask appears. Chrome's permission-UX policy
// (and plain courtesy) says never confront a brand-new visitor instantly —
// prompts fired on load get auto-suppressed into the quiet UI and tank the
// site's notification reputation. 15s of actual browsing signals intent.
const SHOW_AFTER_MS = 15000;

// Pages that already render the inline EnableNotificationsCard — the floating
// banner stays away so the two never stack.
const INLINE_CARD_PATHS = [/^\/orders/, /^\/profile/, /^\/track\//, /^\/order\//];

function isIos() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}
function isStandalone() {
    return (
        (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
        navigator.standalone === true
    );
}

/**
 * NotificationOptInBanner — site-wide visitor opt-in (guests included).
 *
 * Google-policy-compliant soft ask: this custom banner appears first (after a
 * 15s engagement delay); the NATIVE browser permission prompt only fires when
 * the visitor clicks "Turn on" — a real user gesture. We never auto-prompt.
 *
 * Shown only when permission is "default" (never asked). Denied users are left
 * alone — pestering them violates the spirit of the policy and they can't be
 * re-prompted from JS anyway. Granted-but-unsubscribed guests (e.g. permission
 * given before guest subscriptions were supported) are silently healed.
 */
export default function NotificationOptInBanner() {
    const location = useLocation();
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);

    const onInlineCardPage = INLINE_CARD_PATHS.some((re) => re.test(location.pathname));

    useEffect(() => {
        if (onInlineCardPage) { setVisible(false); return; }
        let alive = true;
        let timer;
        (async () => {
            if (!(await isPushSupported())) return;          // iOS Safari non-PWA etc.
            if (isIos() && !isStandalone()) return;          // needs Add to Home Screen first — IosInstallPrompt owns that
            const perm = await getPushStatus();
            if (perm === "granted") {
                // Permission exists but this (possibly guest) browser may have no
                // backend subscription yet — register it quietly, show nothing.
                ensurePushSubscription({ silent: true }).catch(() => {});
                return;
            }
            if (perm !== "default") return;                  // denied → leave them alone
            const dismissedUntil = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10) || 0;
            if (dismissedUntil > Date.now()) return;
            timer = setTimeout(() => { if (alive) setVisible(true); }, SHOW_AFTER_MS);
        })();
        return () => { alive = false; clearTimeout(timer); };
    }, [location.pathname, onInlineCardPage]);

    const enable = async () => {
        setBusy(true);
        try {
            const r = await ensurePushSubscription({ silent: false });
            if (r === "subscribed") {
                toast.success("You're in! Deals and order updates will land right here.");
                setVisible(false);
            } else if (r === "denied") {
                setVisible(false); // respect the choice — no follow-up lecture
            } else {
                toast.error("Couldn't enable notifications — please try again.");
            }
        } finally {
            setBusy(false);
        }
    };

    const dismiss = () => {
        const until = Date.now() + DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
        localStorage.setItem(DISMISS_KEY, String(until));
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-40 bg-brand-ink text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3"
            data-testid="notif-optin-banner"
            role="dialog"
            aria-label="Enable notifications"
        >
            <div className="w-10 h-10 rounded-full bg-brand-red flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-sm leading-tight">Don&apos;t miss our deals</div>
                <p className="text-xs text-white/70 mt-0.5">Exclusive offers &amp; order updates — right on your device.</p>
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button
                    type="button"
                    onClick={enable}
                    disabled={busy}
                    data-testid="notif-optin-enable"
                    className="bg-brand-yellow text-brand-ink rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Turn on
                </button>
                <button
                    type="button"
                    onClick={dismiss}
                    data-testid="notif-optin-dismiss"
                    className="text-[11px] text-white/50 hover:text-white/80 font-semibold"
                >
                    Not now
                </button>
            </div>
            <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white text-brand-ink shadow inline-flex items-center justify-center"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
