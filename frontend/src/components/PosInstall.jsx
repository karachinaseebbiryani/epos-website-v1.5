import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MonitorDown, BellRing, CheckCircle2 } from "lucide-react";
import { ensurePushSubscription, getPushStatus } from "../lib/push";

const ADMIN_PUSH_FLAG = "knb_admin_push_v1";

/**
 * PosInstall — sidebar widget mounted in AdminLayout.
 *
 * 1. Swaps the page manifest to /admin-manifest.json while on admin pages, so the
 *    browser offers to install the "KNB POS" app (scope /admin, opens straight in
 *    the orders queue as a standalone window). Restores the customer manifest on
 *    unmount — the public site's PWA is untouched.
 * 2. Captures `beforeinstallprompt` and turns it into a real one-click
 *    "Install POS on Desktop" button (Chrome/Edge desktop + Android).
 * 3. "Enable order alerts" subscribes this browser to admin web push
 *    (/admin/push/subscribe) so new-order notifications arrive even when the
 *    browser window is closed (the 2-min pending reminder keeps nagging too).
 *
 * For the full ringing experience when nobody remembers to open the POS:
 * install the app, then right-click its icon → "Start app when you sign in".
 */
export default function PosInstall() {
  const promptRef = useRef(null);
  const [installable, setInstallable] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [alerts, setAlerts] = useState("unknown"); // unknown | on | off | denied | unsupported

  // Manifest swap: admin pages advertise the POS app, not the customer app.
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const prev = link?.getAttribute("href");
    link?.setAttribute("href", "/admin-manifest.json");
    return () => { if (prev) link?.setAttribute("href", prev); };
  }, []);

  useEffect(() => {
    setStandalone(window.matchMedia?.("(display-mode: standalone)")?.matches || false);
    // The event may have fired long before this component mounted — index.html
    // stashes it in window.__knb_bip and re-dispatches "knb-bip" for us.
    if (window.__knb_bip) {
      promptRef.current = window.__knb_bip;
      setInstallable(true);
    }
    const onPrompt = (e) => {
      if (e?.preventDefault) e.preventDefault();
      promptRef.current = e?.detail || window.__knb_bip || e;
      setInstallable(true);
    };
    const onStashed = () => {
      promptRef.current = window.__knb_bip;
      setInstallable(true);
    };
    const onInstalled = () => {
      setInstallable(false);
      toast.success("KNB POS installed — find it in your Start menu / taskbar");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("knb-bip", onStashed);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("knb-bip", onStashed);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Reflect current alert state; silently refresh the subscription if this
  // device opted in before (keeps the push keys fresh, mirrors customer flow).
  useEffect(() => {
    (async () => {
      const status = await getPushStatus();
      if (status === "unsupported") return setAlerts("unsupported");
      if (status === "denied") return setAlerts("denied");
      if (status === "granted" && localStorage.getItem(ADMIN_PUSH_FLAG) === "1") {
        ensurePushSubscription({ silent: true, subscribePath: "/admin/push/subscribe" }).catch(() => {});
        return setAlerts("on");
      }
      setAlerts("off");
    })();
  }, []);

  const [showHowTo, setShowHowTo] = useState(false);

  const install = async () => {
    const ev = promptRef.current || window.__knb_bip;
    if (ev) {
      try {
        ev.prompt();
        await ev.userChoice;
      } catch { /* user dismissed / event already used */ }
      promptRef.current = null;
      window.__knb_bip = null;
      setInstallable(false);
      return;
    }
    // No captured event (older Chrome / heuristics not met yet) — show the
    // manual path, which always works because this page links admin-manifest.
    setShowHowTo((v) => !v);
  };

  const enableAlerts = async () => {
    const res = await ensurePushSubscription({ silent: false, subscribePath: "/admin/push/subscribe" });
    if (res === "subscribed") {
      localStorage.setItem(ADMIN_PUSH_FLAG, "1");
      setAlerts("on");
      toast.success("Order alerts enabled on this device");
    } else if (res === "denied") {
      setAlerts("denied");
      toast.error("Notifications are blocked for this site — allow them in browser settings");
    } else {
      toast.error("Could not enable alerts — try again");
    }
  };

  // Always offer install when not already running as the installed app — the
  // one-click browser prompt when we captured the event, manual steps otherwise.
  const showInstall = !standalone;
  const showAlerts = alerts === "off" || alerts === "on";
  if (!showInstall && !showAlerts) return null;

  return (
    <div className="mx-3 mb-1 space-y-1 flex-shrink-0" data-testid="pos-install-widget">
      {showInstall && (
        <button
          onClick={install}
          data-testid="pos-install-button"
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-yellow/90 text-brand-ink hover:bg-brand-yellow transition-colors"
        >
          <MonitorDown className="w-4 h-4" /> Install POS on Desktop
        </button>
      )}
      {showInstall && showHowTo && !installable && (
        <div className="px-4 py-3 rounded-xl bg-white/10 text-white/80 text-[11px] leading-relaxed space-y-1.5" data-testid="pos-install-howto">
          <p className="font-bold text-white/90">Install from the browser menu:</p>
          <p><span className="font-semibold text-white/90">Chrome:</span> look for the install icon at the right end of the address bar — or menu ⋮ → Cast, save and share → <em>Install page as app…</em></p>
          <p><span className="font-semibold text-white/90">Edge:</span> menu ⋯ → Apps → <em>Install this site as an app</em></p>
          <p>Stay on this admin page while installing so it installs the POS app (not the customer site).</p>
        </div>
      )}
      {alerts === "off" && (
        <button
          onClick={enableAlerts}
          data-testid="pos-enable-alerts"
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors"
        >
          <BellRing className="w-4 h-4" /> Enable order alerts
        </button>
      )}
      {alerts === "on" && (
        <div className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold text-emerald-400/90" data-testid="pos-alerts-on">
          <CheckCircle2 className="w-4 h-4" /> Order alerts on
        </div>
      )}
      {showInstall && (
        <p className="px-4 text-[10px] leading-snug text-white/35">
          Tip: after installing, right-click the KNB POS icon and enable
          “Start app when you sign in” so orders ring automatically.
        </p>
      )}
    </div>
  );
}
