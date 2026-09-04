import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, X, Volume2 } from "lucide-react";
import { ensurePushSubscription, getPushStatus } from "../lib/push";
import api from "../lib/api";

const ADMIN_PUSH_FLAG = "knb_admin_push_v1";
const BANNER_DISMISSED_KEY = "knb_admin_notify_banner_dismissed";

/**
 * AdminNotificationBanner — prominent top banner prompting admins to enable push notifications.
 * Shows until notifications are enabled or the banner is dismissed.
 * Includes a test notification button to verify it's working.
 */
export default function AdminNotificationBanner() {
  const [status, setStatus] = useState("unknown"); // unknown | enabled | disabled | denied | unsupported
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(BANNER_DISMISSED_KEY) === "1");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      const pushStatus = await getPushStatus();
      if (pushStatus === "unsupported") return setStatus("unsupported");
      if (pushStatus === "denied") return setStatus("denied");
      if (pushStatus === "granted" && localStorage.getItem(ADMIN_PUSH_FLAG) === "1") {
        // Silently refresh the subscription
        ensurePushSubscription({ silent: true, subscribePath: "/admin/push/subscribe" }).catch(() => {});
        return setStatus("enabled");
      }
      setStatus("disabled");
    })();
  }, []);

  const enableNotifications = async () => {
    const res = await ensurePushSubscription({ silent: false, subscribePath: "/admin/push/subscribe" });
    if (res === "subscribed") {
      localStorage.setItem(ADMIN_PUSH_FLAG, "1");
      setStatus("enabled");
      toast.success("🔔 Order notifications enabled!", {
        description: "You'll now receive alerts even when the browser is closed",
      });
    } else if (res === "denied") {
      setStatus("denied");
      toast.error("Notifications blocked — please allow them in your browser settings");
    } else {
      toast.error("Could not enable notifications — please try again");
    }
  };

  const testNotification = async () => {
    setTesting(true);
    try {
      await api.post("/admin/push/test");
      toast.success("Test notification sent! Check your device.");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send test notification");
    } finally {
      setTesting(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    setDismissed(true);
  };

  // Don't show if enabled, unsupported, or dismissed
  if (status === "enabled" || status === "unsupported" || status === "unknown" || dismissed) {
    return null;
  }

  return (
    <div
      data-testid="admin-notification-banner"
      className="bg-gradient-to-r from-brand-red to-red-600 text-white px-6 py-4 shadow-lg"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex-shrink-0">
            <BellRing className="w-8 h-8 animate-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">
              {status === "denied"
                ? "⚠️ Notifications are blocked"
                : "🔔 Enable Order Notifications"}
            </h3>
            <p className="text-sm text-white/90">
              {status === "denied"
                ? "Go to your browser settings and allow notifications for this site to receive order alerts."
                : "Get instant alerts for new orders even when the browser is in the background or closed. Click 'Enable' and allow notifications when prompted."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {status === "enabled" && (
            <button
              onClick={testNotification}
              disabled={testing}
              data-testid="test-notification-btn"
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Volume2 className="w-4 h-4" />
              {testing ? "Sending..." : "Test"}
            </button>
          )}

          {status === "disabled" && (
            <button
              onClick={enableNotifications}
              data-testid="enable-notifications-btn"
              className="inline-flex items-center gap-2 bg-white text-brand-red hover:bg-white/90 rounded-lg px-6 py-2 text-sm font-bold transition-colors shadow-md"
            >
              <BellRing className="w-4 h-4" />
              Enable Notifications
            </button>
          )}

          <button
            onClick={dismiss}
            data-testid="dismiss-banner-btn"
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
