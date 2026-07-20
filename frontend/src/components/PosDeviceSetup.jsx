import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MonitorDown, BellRing, CheckCircle2, BellOff } from "lucide-react";
import { ensurePushSubscription, getPushStatus } from "../lib/push";

const ADMIN_PUSH_FLAG = "knb_admin_push_v1";

/**
 * PosDeviceSetup — the full "set this computer up for the restaurant" card.
 *
 * Used in two places:
 *  - /admin/sign-in (showAlerts=false): staff can install the POS desktop app
 *    BEFORE logging in. Installing grants no access — the installed app still
 *    opens on this sign-in screen until they authenticate.
 *  - Admin → Settings (showAlerts=true): install + order-alert management in
 *    one place, so the state is always inspectable and re-enableable even
 *    though the sidebar hides its shortcut once alerts are on.
 *
 * Swaps the page manifest to /admin-manifest.json while mounted so the browser
 * installs "KNB POS" (scope /admin, opens the orders queue) — never the
 * customer app. Install uses the early-captured beforeinstallprompt event
 * (window.__knb_bip, stashed by index.html) with a manual-steps fallback.
 */
export default function PosDeviceSetup({ showAlerts = true }) {
  const promptRef = useRef(null);
  const [installable, setInstallable] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [alerts, setAlerts] = useState("unknown"); // unknown | on | off | denied | unsupported

  // Advertise the POS app while this card is on screen.
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const prev = link?.getAttribute("href");
    link?.setAttribute("href", "/admin-manifest.json");
    return () => { if (prev) link?.setAttribute("href", prev); };
  }, []);

  useEffect(() => {
    setStandalone(window.matchMedia?.("(display-mode: standalone)")?.matches || false);
    if (window.__knb_bip) { promptRef.current = window.__knb_bip; setInstallable(true); }
    const onPrompt = (e) => { if (e?.preventDefault) e.preventDefault(); promptRef.current = window.__knb_bip || e; setInstallable(true); };
    const onStashed = () => { promptRef.current = window.__knb_bip; setInstallable(true); };
    const onInstalled = () => {
      setInstallable(false);
      setInstalled(true);
      toast.success("KNB POS installed — find it in your Start menu, then pin it to the taskbar");
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

  useEffect(() => {
    if (!showAlerts) return;
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
  }, [showAlerts]);

  const install = async () => {
    const ev = promptRef.current || window.__knb_bip;
    if (ev) {
      try { ev.prompt(); await ev.userChoice; } catch { /* dismissed / already used */ }
      promptRef.current = null;
      window.__knb_bip = null;
      setInstallable(false);
      return;
    }
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
      toast.error("Notifications are blocked for this site — allow them in browser settings and retry");
    } else {
      toast.error("Could not enable alerts — try again");
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-4" data-testid="pos-device-setup">
      <div>
        <h3 className="font-display font-bold text-base text-brand-ink flex items-center gap-2">
          <MonitorDown className="w-4 h-4 text-brand-red" /> POS Desktop App
        </h3>
        {standalone || installed ? (
          <p className="mt-2 text-sm text-emerald-700 flex items-center gap-1.5" data-testid="pos-setup-installed">
            <CheckCircle2 className="w-4 h-4" /> {standalone ? "You're using the installed POS app." : "Installed — open it from the Start menu and pin it to the taskbar."}
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-neutral-500">
              One click on the taskbar opens the restaurant side directly — no typing the address.
            </p>
            <button onClick={install} data-testid="pos-setup-install"
              className="mt-3 inline-flex items-center gap-2 bg-brand-red text-white rounded-full px-5 py-2.5 text-sm font-bold">
              <MonitorDown className="w-4 h-4" /> Install POS on this computer
            </button>
            {showHowTo && !installable && (
              <div className="mt-3 text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-xl p-3 space-y-1.5" data-testid="pos-setup-howto">
                <p className="font-bold">Install from the browser menu:</p>
                <p><strong>Chrome:</strong> install icon at the right end of the address bar — or menu ⋮ → Cast, save and share → <em>Install page as app…</em></p>
                <p><strong>Edge:</strong> menu ⋯ → Apps → <em>Install this site as an app</em></p>
              </div>
            )}
            <p className="mt-2 text-[11px] text-neutral-400">
              Tip: after installing, right-click the KNB POS icon → “Start app when you sign in” so orders ring from the moment the computer starts.
            </p>
          </>
        )}
      </div>

      {showAlerts && (
        <div className="pt-4 border-t border-neutral-100">
          <h3 className="font-display font-bold text-base text-brand-ink flex items-center gap-2">
            <BellRing className="w-4 h-4 text-brand-red" /> Order Alerts (this device)
          </h3>
          {alerts === "on" && (
            <p className="mt-2 text-sm text-emerald-700 flex items-center gap-1.5" data-testid="pos-setup-alerts-on">
              <CheckCircle2 className="w-4 h-4" /> Enabled — new orders notify this device even when the browser is closed
              <span className="text-neutral-400 font-normal">(Chrome needs “background apps” allowed in chrome://settings/system)</span>
            </p>
          )}
          {alerts === "off" && (
            <button onClick={enableAlerts} data-testid="pos-setup-enable-alerts"
              className="mt-3 inline-flex items-center gap-2 bg-brand-ink text-white rounded-full px-5 py-2.5 text-sm font-bold">
              <BellRing className="w-4 h-4" /> Enable order alerts
            </button>
          )}
          {alerts === "denied" && (
            <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
              <BellOff className="w-4 h-4" /> Blocked — click the lock icon next to the address → allow Notifications, then reload.
            </p>
          )}
          {alerts === "unsupported" && (
            <p className="mt-2 text-sm text-neutral-500">This browser doesn&apos;t support push notifications.</p>
          )}
        </div>
      )}
    </div>
  );
}
