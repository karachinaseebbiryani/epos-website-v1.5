import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { ensurePushSubscription, getPushStatus } from "../lib/push";

const ADMIN_PUSH_FLAG = "knb_admin_push_v1";

/**
 * PosInstall — minimal sidebar shortcut mounted in AdminLayout.
 *
 * Shows ONE thing: the "Enable order alerts" button, and only while alerts are
 * NOT yet enabled on this device. Once enabled it renders nothing — the full
 * management UI (alert status, re-enable, POS desktop install) lives in
 * Admin → Settings via <PosDeviceSetup/>, and the install button is also
 * offered pre-login on /admin/sign-in.
 *
 * Still swaps the manifest to /admin-manifest.json while on admin pages, so a
 * manual browser-menu install from ANY admin page installs the POS app.
 */
export default function PosInstall() {
  const [alerts, setAlerts] = useState("unknown"); // unknown | on | off | denied | unsupported

  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const prev = link?.getAttribute("href");
    link?.setAttribute("href", "/admin-manifest.json");
    return () => { if (prev) link?.setAttribute("href", prev); };
  }, []);

  useEffect(() => {
    (async () => {
      const status = await getPushStatus();
      if (status === "unsupported") return setAlerts("unsupported");
      if (status === "denied") return setAlerts("denied");
      if (status === "granted" && localStorage.getItem(ADMIN_PUSH_FLAG) === "1") {
        // Silently refresh the subscription; render nothing (alerts are on).
        ensurePushSubscription({ silent: true, subscribePath: "/admin/push/subscribe" }).catch(() => {});
        return setAlerts("on");
      }
      setAlerts("off");
    })();
  }, []);

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

  if (alerts !== "off") return null;

  return (
    <div className="mx-3 mb-1 flex-shrink-0" data-testid="pos-install-widget">
      <button
        onClick={enableAlerts}
        data-testid="pos-enable-alerts"
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-yellow/90 text-brand-ink hover:bg-brand-yellow transition-colors"
      >
        <BellRing className="w-4 h-4" /> Enable order alerts
      </button>
    </div>
  );
}
