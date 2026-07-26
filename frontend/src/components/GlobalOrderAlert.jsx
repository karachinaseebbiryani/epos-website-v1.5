import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { Bell, BellOff, Volume2 } from "lucide-react";
import { resolveAlertSrc, useAlertPrefs } from "../lib/alertSound";

const POLL_MS = 4000;

/**
 * GlobalOrderAlert — mounted in AdminLayout, runs on EVERY admin page.
 * - Polls /api/online-orders/pending-count every 4s
 * - Loops the alert sound while there are pending orders
 * - Shows a toast each time a NEW pending order arrives (any change in latest_id)
 * - Goes silent on /admin/orders so we don't double-up with that page's richer
 *   in-page alert (single source of truth on the orders screen).
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
  const prefs = useAlertPrefs();

  const stopSound = useCallback(() => {
    const el = audioRef.current;
    if (el && !el.paused) { el.pause(); el.currentTime = 0; }
  }, []);

  const manageAlertSound = useCallback((count, isMuted) => {
    const el = audioRef.current;
    // Never ring on the orders page — AdminOrders owns the sound there.
    if (!el || onOrdersPage) { stopSound(); return; }
    if (count > 0 && !isMuted) {
      if (el.paused) {
        el.currentTime = 0;
        const p = el.play();
        if (p && typeof p.then === "function") {
          p.then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
        }
      }
    } else {
      stopSound();
    }
  }, [onOrdersPage, stopSound]);

  // Keep the element's volume in sync with the admin's chosen level.
  useEffect(() => {
    const el = audioRef.current;
    if (el) el.volume = prefs.volume;
  }, [prefs.volume]);

  /**
   * BUGFIX: the poll effect below early-returns on /admin/orders, so once the
   * ring had started on some other admin page nothing was left to pause it —
   * navigating to the orders queue and accepting the order stopped AdminOrders'
   * own audio while this one looped forever. Chrome keeps a detached-but-
   * referenced <audio> playing, so unmounting didn't save us either. This
   * effect explicitly silences the element on every route change into the
   * orders page, and on unmount.
   */
  useEffect(() => {
    // Captured, not read inside the cleanup: on a real unmount (logout, or
    // leaving the admin layout for the public site) React has already nulled
    // the ref, which would make stopSound() a silent no-op.
    const el = audioRef.current;
    if (onOrdersPage) stopSound();
    return () => { if (el && !el.paused) { el.pause(); el.currentTime = 0; } };
  }, [onOrdersPage, stopSound]);

  useEffect(() => {
    // The orders page runs its own pending-count poller and owns the alert sound there,
    // so polling here too would just double every pending-count request.
    if (onOrdersPage) return undefined;
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
          toast.info("🔔 New online order", {
            description: "Tap to open the orders queue",
            action: { label: "View", onClick: () => { window.location.href = "/admin/orders"; } },
            duration: 8000,
          });
        }

        manageAlertSound(count, muted);
      } catch {
        /* keep polling silently */
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [muted, onOrdersPage, manageAlertSound]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem("knb_admin_muted", next ? "1" : "0");
    if (next) stopSound(); // silence immediately, don't wait for the next poll
  };

  const enableAudio = () => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = false;
    el.play()
      .then(() => { setAudioBlocked(false); el.pause(); manageAlertSound(pendingCount, muted); })
      .catch(() => {});
  };

  // The <audio> node is rendered in the SAME position regardless of route, so
  // React never unmounts and re-creates it. An orphaned media element is what
  // caused the stuck ring, so keeping one stable node matters.
  const showPill = !onOrdersPage && pendingCount > 0;

  return (
    <>
      <audio
        ref={audioRef}
        src={resolveAlertSrc(prefs.sound)}
        loop
        preload="auto"
        data-testid="global-order-alert-audio"
      />

      {/* Floating top-right pill: visible whenever there are pending orders */}
      {showPill && (
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
      {showPill && audioBlocked && !muted && (
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
