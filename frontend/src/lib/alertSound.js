import { useEffect, useState } from "react";
import api from "./api";

/**
 * Order-alert ring tone, shared by GlobalOrderAlert (every admin page) and
 * AdminOrders (the orders queue). Both must agree on the tone/volume, so the
 * choice lives on the existing global settings doc rather than localStorage —
 * that way it follows the restaurant, not the individual browser.
 *
 * GET /settings is readable by ANY signed-in staff user; PUT is admin-only.
 * That's exactly the permission split we want: the owner picks the tune, every
 * till plays it.
 */

export const ALERT_SOUNDS = [
  { key: "classic", label: "Classic",  hint: "The original alert",        src: "/order-alert.wav" },
  { key: "chime",   label: "Chime",    hint: "Soft descending doorbell",  src: "/sounds/chime.wav" },
  { key: "bell",    label: "Bell",     hint: "Bright triple ding",        src: "/sounds/bell.wav" },
  { key: "beep",    label: "Beep",     hint: "Clean electronic beep",     src: "/sounds/beep.wav" },
  { key: "urgent",  label: "Urgent",   hint: "Fast four-pulse alarm",     src: "/sounds/urgent.wav" },
  { key: "siren",   label: "Siren",    hint: "Rising sweep — hardest to ignore", src: "/sounds/siren.wav" },
];

export const DEFAULT_ALERT = { sound: "classic", volume: 1 };

/** Preset key → file. Falls back to the classic tone for unknown values so a
 *  bad/removed setting can never leave the POS silent. */
export function resolveAlertSrc(value) {
  const preset = ALERT_SOUNDS.find((s) => s.key === value);
  if (preset) return preset.src;
  if (typeof value === "string" && /^(https?:\/\/|\/)/.test(value)) return value;
  return ALERT_SOUNDS[0].src;
}

export function clampVolume(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

// Module-level cache: both alert components mount together on most admin pages
// and neither should trigger its own /settings round-trip on every navigation.
let cached = null;

export function loadAlertPrefs() {
  if (!cached) {
    cached = api
      .get("/settings")
      .then(({ data }) => ({
        sound: data?.order_alert_sound || DEFAULT_ALERT.sound,
        volume: clampVolume(data?.order_alert_volume ?? DEFAULT_ALERT.volume),
      }))
      .catch(() => ({ ...DEFAULT_ALERT })); // never block ringing on a failed fetch
  }
  return cached;
}

/** Call after saving settings so open tabs pick the new tone up on next mount. */
export function invalidateAlertPrefs() {
  cached = null;
}

export function useAlertPrefs() {
  const [prefs, setPrefs] = useState(DEFAULT_ALERT);
  useEffect(() => {
    let alive = true;
    loadAlertPrefs().then((p) => { if (alive) setPrefs(p); });
    return () => { alive = false; };
  }, []);
  return prefs;
}
