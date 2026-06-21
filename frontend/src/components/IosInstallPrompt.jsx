import { useEffect, useState } from "react";
import { X, Share, Bell } from "lucide-react";
import { ensurePushSubscription, isPushSupported } from "../lib/push";
import { toast } from "sonner";

const DISMISS_KEY_A2HS = "knb_a2hs_dismissed_v1";

function isIos() {
    const ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/i.test(ua);
}

function isInStandaloneMode() {
    // Apple-specific (navigator.standalone) + modern display-mode media query.
    return (
        (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
        (typeof navigator !== "undefined" && navigator.standalone === true)
    );
}

/**
 * IosInstallPrompt
 * ----------------
 * One-shot teaching banner for iPhone / iPad users running the site in regular
 * Safari. iOS doesn't expose the `beforeinstallprompt` event the way Android Chrome
 * does, so we have to *show* the user the Share-sheet → "Add to Home Screen" steps
 * ourselves. After install, Apple lets the PWA register for Web Push (iOS 16.4+).
 *
 * The banner self-dismisses if:
 *   - User is not on iOS
 *   - User is already running in standalone (already installed)
 *   - User has dismissed before (localStorage flag)
 */
export default function IosInstallPrompt() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!isIos()) return;
        if (isInStandaloneMode()) return;
        if (localStorage.getItem(DISMISS_KEY_A2HS) === "1") return;
        // Small delay so the banner doesn't slam in on first paint.
        const t = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(t);
    }, []);

    if (!visible) return null;
    return (
        <div
            className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm bg-brand-ink text-white rounded-2xl shadow-2xl p-4 z-40 animate-in slide-in-from-bottom-3"
            data-testid="ios-install-prompt"
        >
            <button
                type="button"
                onClick={() => { localStorage.setItem(DISMISS_KEY_A2HS, "1"); setVisible(false); }}
                aria-label="Dismiss"
                data-testid="ios-install-dismiss"
                className="absolute top-2 right-2 w-7 h-7 rounded-full hover:bg-white/10 inline-flex items-center justify-center"
            >
                <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3 pr-6">
                <div className="w-10 h-10 rounded-xl bg-brand-red flex items-center justify-center flex-shrink-0">
                    <Bell className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-sm">Get order alerts on iPhone</div>
                    <p className="text-xs text-white/80 leading-relaxed mt-1">
                        Tap the <Share className="w-3.5 h-3.5 inline -mt-0.5" /> Share icon at the bottom, then choose <span className="font-bold text-white">Add to Home Screen</span>. Open the app from your home screen to enable notifications.
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * IosEnableNotificationsCard
 * --------------------------
 * Visible ONLY for iOS users running the site in standalone (PWA) mode who haven't
 * yet granted push permission. Renders a clear "Enable Notifications" button — iOS
 * absolutely requires a direct user-gesture call to Notification.requestPermission(),
 * otherwise the prompt is silently swallowed.
 *
 * Place this on the Orders page and / or Profile page (high-intent locations).
 */
export function IosEnableNotificationsCard() {
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            if (!isIos()) return;
            if (!isInStandaloneMode()) return;
            if (!(await isPushSupported())) return; // iOS <16.4 fails this check
            if (typeof Notification !== "undefined" && Notification.permission === "granted") return;
            setShow(true);
        })();
    }, []);

    if (!show) return null;
    const enable = async () => {
        setBusy(true);
        try {
            const r = await ensurePushSubscription({ silent: false });
            if (r === "subscribed") {
                toast.success("You'll get a notification when your order status changes.");
                setShow(false);
            } else if (r === "denied") {
                toast.error("Notifications blocked. iOS Settings → Karachi Naseeb → Notifications.");
            } else {
                toast.error("Couldn't enable notifications. Please try again.");
            }
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="bg-gradient-to-br from-brand-red to-brand-red-dark text-white rounded-2xl p-4 sm:p-5 mb-6 flex items-center gap-3" data-testid="ios-enable-notifs-card">
            <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-base leading-tight">Turn on order alerts</div>
                <p className="text-xs text-white/85 mt-0.5">Get a notification the moment your order is accepted, on the way, or delivered.</p>
            </div>
            <button
                type="button"
                onClick={enable}
                disabled={busy}
                data-testid="ios-enable-notifs-button"
                className="bg-white text-brand-ink hover:bg-white/90 disabled:opacity-60 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap"
            >
                {busy ? "..." : "Enable"}
            </button>
        </div>
    );
}
