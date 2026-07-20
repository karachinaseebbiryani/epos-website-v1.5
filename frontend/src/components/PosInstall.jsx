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
    const onPrompt = (e) => {
      e.preventDefault();
      promptRef.current = e;
      setInstallable(true);
    };
    const onInstalled = () => {
      setInstallable(false);
      toast.success("KNB POS installed — find it in your Start menu / taskbar");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
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

  const install = async () => {
    const ev = promptRef.current;
    if (!ev) return;
    ev.prompt();
    try { await ev.userChoice; } catch { /* user dismissed */ }
    promptRef.current = null;
    setInstallable(false);
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

  const showInstall = installable && !standalone;
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
