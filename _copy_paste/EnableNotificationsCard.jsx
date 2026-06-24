import { useEffect, useState } from "react";
import { Bell, BellOff, X, Loader2 } from "lucide-react";
import { ensurePushSubscription, isPushSupported, getPushStatus } from "../lib/push";
import { toast } from "sonner";

const DISMISS_KEY = "knb_notifs_card_dismissed_until_v1";
const DISMISS_COOLDOWN_DAYS = 3;

function isIos() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}
function isInStandaloneMode() {
    return (
        (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
        (typeof navigator !== "undefined" && navigator.standalone === true)
    );
}
function readDismissTs() {
    const v = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
    return Number.isFinite(v) ? v : 0;
}
function setDismissTs() {
    const until = Date.now() + DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
}

/**
 * EnableNotificationsCard
 * -----------------------
 * Universal "turn on order alerts" prompt. Visible whenever the customer is signed
 * in AND push notifications are supported AND the current permission is NOT granted
 * (or the subscription has gone stale — e.g. admin rotated VAPID keys).
 *
 * Why this exists:
 *  - The previous flow auto-subscribed silently on sign-in (`silent: true`). If the
 *    user never granted permission, nothing ever happened — they just wondered why
 *    they don't get alerts.
 *  - iOS adds a twist: push only works once the PWA is installed to home screen.
 *    We render different copy when iOS-Safari users haven't installed yet, telling
 *    them exactly what to do.
 *
 * Dismiss is a soft 3-day cooldown — re-shown after that so people who tapped X
 * because they were busy still get a friendly nudge next week.
 */
export default function EnableNotificationsCard() {
    const [state, setState] = useState({ status: "loading", visible: false });
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            if (!(await isPushSupported())) {
                // iOS Safari < 16.4 + non-PWA falls here — show the "install first" variant
                // because that's the only path forward for iOS users to get notifications.
                if (alive) setState({ status: "ios-install-required", visible: isIos() && !isInStandaloneMode() && readDismissTs() < Date.now() });
                return;
            }
            const perm = await getPushStatus();
            // Granted: nothing to do unless the underlying subscription is stale —
            // which the silent Layout effect will auto-heal. Hide the card.
            if (perm === "granted") {
                if (alive) setState({ status: "granted", visible: false });
                return;
            }
            // iOS Safari that supports push but isn't in standalone — still requires install.
            if (isIos() && !isInStandaloneMode()) {
                if (alive) setState({ status: "ios-install-required", visible: readDismissTs() < Date.now() });
                return;
            }
            // Default (never asked) or denied — show the card so the user can opt in.
            if (alive) setState({ status: perm, visible: readDismissTs() < Date.now() });
        })();
        return () => { alive = false; };
    }, []);

    const enable = async () => {
        setBusy(true);
        try {
            const r = await ensurePushSubscription({ silent: false });
            if (r === "subscribed") {
                toast.success("You'll get a push when your order status changes.");
                setState((s) => ({ ...s, status: "granted", visible: false }));
            } else if (r === "denied") {
                toast.error("Notifications are blocked. Open browser settings → Site permissions to enable.");
                setState((s) => ({ ...s, status: "denied" }));
            } else {
                toast.error("Couldn't enable notifications. Try again or check your browser settings.");
            }
        } finally {
            setBusy(false);
        }
    };

    const dismiss = () => {
        setDismissTs();
        setState((s) => ({ ...s, visible: false }));
    };

    if (!state.visible) return null;

    // Variant 1: iOS user hasn't installed the app yet → tell them to install first.
    if (state.status === "ios-install-required") {
        return (
            <CardShell onDismiss={dismiss} testid="enable-notifs-ios-install">
                <CardIcon><Bell className="w-5 h-5" /></CardIcon>
                <CardCopy
                    title="Get order alerts on iPhone"
                    body={<>Tap <span className="font-bold text-white">Share</span> → <span className="font-bold text-white">Add to Home Screen</span>. Then open the app from your home screen and we&apos;ll ask to enable alerts.</>}
                />
            </CardShell>
        );
    }

    // Variant 2: permission denied → can't request again from JS; user must change it in settings.
    if (state.status === "denied") {
        return (
            <CardShell onDismiss={dismiss} testid="enable-notifs-denied">
                <CardIcon><BellOff className="w-5 h-5" /></CardIcon>
                <CardCopy
                    title="Notifications are off for this device"
                    body={<>Tap the site lock icon next to the URL → <span className="font-bold text-white">Permissions</span> → set Notifications to <span className="font-bold text-white">Allow</span>. Then refresh.</>}
                />
            </CardShell>
        );
    }

    // Variant 3: default / can prompt → big "Enable" CTA.
    return (
        <CardShell onDismiss={dismiss} testid="enable-notifs-default">
            <CardIcon><Bell className="w-5 h-5" /></CardIcon>
            <CardCopy
                title="Turn on order alerts"
                body="Get a notification the moment your order is accepted, on the way, and delivered."
            />
            <button
                type="button"
                onClick={enable}
                disabled={busy}
                data-testid="enable-notifs-button"
                className="bg-white text-brand-ink hover:bg-white/90 disabled:opacity-60 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap inline-flex items-center gap-2"
            >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {busy ? "Enabling…" : "Enable"}
            </button>
        </CardShell>
    );
}

function CardShell({ children, onDismiss, testid }) {
    return (
        <div className="relative bg-gradient-to-br from-brand-red to-brand-red-dark text-white rounded-2xl p-4 sm:p-5 mb-6 flex items-start sm:items-center gap-3 pr-10" data-testid={testid}>
            {children}
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                data-testid={`${testid}-dismiss`}
                className="absolute top-2 right-2 w-7 h-7 rounded-full hover:bg-white/15 inline-flex items-center justify-center"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

function CardIcon({ children }) {
    return (
        <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            {children}
        </div>
    );
}

function CardCopy({ title, body }) {
    return (
        <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-base leading-tight">{title}</div>
            <p className="text-xs text-white/85 mt-0.5 leading-relaxed">{body}</p>
        </div>
    );
}
