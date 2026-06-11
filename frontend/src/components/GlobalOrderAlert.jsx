import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { Bell, BellOff, Volume2 } from "lucide-react";

const POLL_MS = 4000;
const ALERT_AUDIO_SRC = "/order-alert.wav";

/**
 * GlobalOrderAlert — mounted in AdminLayout, runs on EVERY admin page.
 * - Polls /api/online-orders/pending-count every 4s
 * - Loops the alert sound while there are pending orders
 * - Shows a toast each time a NEW pending order arrives (any change in latest_id)
 * - Hides itself entirely on /admin/orders so we don't double-up with that page's
 *   richer in-page alert (single source of truth on the orders screen).
 */
export default function GlobalOrderAlert() {
  const location = useLocation();
  const onOrdersPage = location.pathname === "/admin/orders";

  const audioRef = useRef(null);
  const lastIdRef = useRef(null);
  const seededRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [muted, setMuted] = useState(() => localStorage.getItem("knb_admin_muted") === "1");
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const { data } = await api.get("/online-orders/pending-count");
        if (cancelled) return;
        const count = data.pending_count || 0;
        setPendingCount(count);

        // First tick seeds the baseline silently so we don't shout about
        // already-pending orders the moment admin opens the page.
        if (!seededRef.current) {
          lastIdRef.current = data.latest_id || null;
          seededRef.current = true;
        } else if (data.latest_id && data.latest_id !== lastIdRef.current) {
          lastIdRef.current = data.latest_id;
          if (!onOrdersPage) {
            toast.info("🔔 New online order", {
              description: "Tap to open the orders queue",
              action: { label: "View", onClick: () => { window.location.href = "/admin/orders"; } },
              duration: 8000,
            });
          }
        }

        manageAlertSound(count, muted);
      } catch {
        /* keep polling silently */
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, onOrdersPage]);

  const manageAlertSound = (count, isMuted) => {
    const el = audioRef.current;
    if (!el || onOrdersPage) {
      if (el && !el.paused) { el.pause(); el.currentTime = 0; }
      return;
    }
    if (count > 0 && !isMuted) {
      if (el.paused) {
        el.currentTime = 0;
        const p = el.play();
        if (p && typeof p.then === "function") {
          p.then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
        }
      }
    } else if (!el.paused) {
      el.pause();
      el.currentTime = 0;
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem("knb_admin_muted", next ? "1" : "0");
  };

  const enableAudio = () => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = false;
    el.play().then(() => { setAudioBlocked(false); el.pause(); manageAlertSound(pendingCount, muted); }).catch(() => {});
  };

  // On the orders page itself, only render the floating mute toggle (no banner)
  // so we don't fight with that page's own UI.
  if (onOrdersPage) {
    return <audio ref={audioRef} src={ALERT_AUDIO_SRC} loop preload="auto" data-testid="global-order-alert-audio" />;
  }

  return (
    <>
      <audio ref={audioRef} src={ALERT_AUDIO_SRC} loop preload="auto" data-testid="global-order-alert-audio" />

      {/* Floating top-right pill: visible whenever there are pending orders */}
      {pendingCount > 0 && (
        <div
          data-testid="global-pending-pill"
          className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full bg-brand-red text-white px-4 py-2 shadow-lg animate-pulse"
        >
          <Bell className="w-4 h-4" />
          <span className="text-sm font-bold">{pendingCount} pending</span>
          <Link to="/admin/orders" className="text-xs underline ml-1" data-testid="global-pending-view">View</Link>
          <button
            onClick={toggleMute}
            className="ml-1 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
            data-testid="global-mute-toggle"
            title={muted ? "Unmute alerts" : "Mute alerts"}
          >
            {muted ? <BellOff className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>
        </div>
      )}

      {/* If browser blocked audio autoplay, surface a click-to-enable banner */}
      {audioBlocked && pendingCount > 0 && !muted && (
        <button
          onClick={enableAudio}
          data-testid="global-enable-audio"
          className="fixed top-16 right-4 z-50 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-4 py-2 text-xs font-semibold shadow hover:bg-amber-100"
        >
          🔊 Click to enable order sound
        </button>
      )}
    </>
  );
}
