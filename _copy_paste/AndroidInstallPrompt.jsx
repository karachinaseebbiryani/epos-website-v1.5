import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "knb_a2hs_android_dismissed_until_v2";
const COOLDOWN_DAYS = 14;

function isInStandaloneMode() {
    return (
        (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
        (typeof navigator !== "undefined" && navigator.standalone === true)
    );
}
function dismissedRecently() {
    const until = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
    return Number.isFinite(until) && Date.now() < until;
}
function markDismissed() {
    const until = Date.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
}

/**
 * AndroidInstallPrompt
 * --------------------
 * Android Chrome fires a `beforeinstallprompt` event when the PWA install criteria are
 * met (HTTPS, manifest + icons, service worker, repeat visit). The browser used to show
 * its own banner automatically but stopped in Chrome 76+ — we now have to capture the
 * event and call prompt() from our OWN button so the user gets a 1-tap install.
 *
 * UX:
 *  - Hidden if already installed (standalone display-mode).
 *  - Hidden if the user dismissed previously (localStorage flag).
 *  - Hidden on iOS (handled by IosInstallPrompt — different flow).
 *  - Shows a slim floating banner with a single "Install" button that triggers the
 *    real Chrome install dialog (no second tap inside the browser menu).
 */
export default function AndroidInstallPrompt() {
    const [deferred, setDeferred] = useState(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isInStandaloneMode()) return;
        if (dismissedRecently()) return;
        const handler = (e) => {
            e.preventDefault();
            setDeferred(e);
            setVisible(true);
        };
        window.addEventListener("beforeinstallprompt", handler);
        // Once installed (user accepted), hide forever.
        const installed = () => {
            setVisible(false);
            markDismissed();
        };
        window.addEventListener("appinstalled", installed);
        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
            window.removeEventListener("appinstalled", installed);
        };
    }, []);

    if (!visible || !deferred) return null;

    const install = async () => {
        try {
            deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice?.outcome === "accepted") {
                markDismissed();
            }
        } catch {
            /* swallow — Chrome throws if prompt() is called twice */
        } finally {
            setDeferred(null);
            setVisible(false);
        }
    };

    const dismiss = () => {
        markDismissed();
        setVisible(false);
    };

    return (
        <div
            className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm bg-brand-ink text-white rounded-2xl shadow-2xl p-4 z-40 animate-in slide-in-from-bottom-3"
            data-testid="android-install-prompt"
        >
            <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                data-testid="android-install-dismiss"
                className="absolute top-2 right-2 w-7 h-7 rounded-full hover:bg-white/10 inline-flex items-center justify-center"
            >
                <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3 pr-6">
                <div className="w-11 h-11 rounded-xl bg-brand-red flex items-center justify-center flex-shrink-0">
                    <Download className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-sm">Install Karachi Naseeb</div>
                    <p className="text-xs text-white/80 leading-relaxed mt-1">
                        One tap to add the app to your home screen — order faster and get push alerts when your biryani is on its way.
                    </p>
                    <button
                        type="button"
                        onClick={install}
                        data-testid="android-install-button"
                        className="mt-3 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase tracking-wider rounded-full px-4 py-2"
                    >
                        Install app
                    </button>
                </div>
            </div>
        </div>
    );
}
