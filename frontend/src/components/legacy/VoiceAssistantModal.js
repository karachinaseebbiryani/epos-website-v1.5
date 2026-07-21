import React, { useState, useRef, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Mic, MicOff, Loader2, Check, X, Volume2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Urdu/Punjabi/English voice assistant — 100% browser-native (free).
 * - STT: Web Speech API (Chrome/Edge/Safari)
 * - Parser: local PHONETIC matcher against the menu names supplied by the parent
 * - TTS: SpeechSynthesis API
 *
 * Why phonetic: with lang=ur-PK the browser transcribes in URDU SCRIPT
 * (چکن بریانی) while menu names are Latin ("Chicken Biryani") — literal string
 * matching can never work. Both sides are therefore reduced to a shared
 * consonant "skeleton": Urdu script is transliterated to Latin, vowels are
 * dropped, spelling quirks collapse. چکن / chikan / chiken / chicken all
 * become "chkn" and match the same menu item. A 1-edit tolerance mops up the
 * rest. We also parse EVERY recognition alternative the browser offers (not
 * just its top guess) and keep whichever parse matched the most items.
 */
export default function VoiceAssistantModal({ open, onClose, onConfirm, currency = "Rs", menuItems = [] }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsed, setParsed] = useState(null); // { items, subtotal, intent, confirmation_text }
  const [supported, setSupported] = useState(true);
  // ur-PK also hears Pakistani Punjabi acceptably (closest acoustic model the
  // browser offers). en-IN handles South-Asian-accented English far better
  // than en-US. The cashier picks before speaking; sticky via localStorage.
  const [lang, setLang] = useState(() => localStorage.getItem("knb_voice_lang") || "ur-PK");
  const recRef = useRef(null);

  // ---------- Phonetic skeleton machinery ----------
  // Urdu/Arabic script → rough Latin transliteration (character map).
  const UR2LAT = useMemo(() => ({
    "ا": "a", "آ": "a", "أ": "a", "ب": "b", "پ": "p", "ت": "t", "ٹ": "t", "ث": "s",
    "ج": "j", "چ": "ch", "ح": "h", "خ": "kh", "د": "d", "ڈ": "d", "ذ": "z", "ر": "r",
    "ڑ": "r", "ز": "z", "ژ": "zh", "س": "s", "ش": "sh", "ص": "s", "ض": "z", "ط": "t",
    "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q", "ک": "k", "ك": "k", "گ": "g",
    "ل": "l", "م": "m", "ن": "n", "ں": "n", "و": "o", "ہ": "h", "ه": "h", "ھ": "h",
    "ء": "", "ی": "y", "ي": "y", "ے": "e", "ئ": "y", "ۂ": "h", "ۃ": "h",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  }), []);

  const transliterate = (s) =>
    Array.from(String(s || "")).map((ch) => (UR2LAT[ch] !== undefined ? UR2LAT[ch] : ch)).join("");

  // Consonant skeleton: transliterate → lowercase → normalise spelling quirks →
  // drop vowels → collapse repeats. Applied IDENTICALLY to menu names and
  // speech, so any consistent reduction works as a match key.
  const skeleton = (word) => {
    let w = transliterate(word).toLowerCase();
    w = w.replace(/[^a-z0-9]/g, "");
    if (/^\d+$/.test(w)) return w;               // numbers survive as-is
    w = w.replace(/ch/g, "6").replace(/sh/g, "5").replace(/kh/g, "4").replace(/gh/g, "g").replace(/ph/g, "f").replace(/th/g, "t").replace(/zh/g, "z");
    w = w.replace(/c/g, "k").replace(/q/g, "k").replace(/x/g, "ks").replace(/w/g, "v");
    w = w.replace(/6/g, "ch").replace(/5/g, "sh").replace(/4/g, "kh");
    w = w.replace(/[aeiou]/g, "");
    w = w.replace(/(.)\1+/g, "$1");
    return w;
  };

  // Levenshtein distance capped at 2 — enough to decide "≤1 edit apart".
  const editDistance = (a, b) => {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 3;
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  };

  const tokensMatch = (a, b) => {
    if (!a || !b) return false;
    if (a === b) return true;
    // Very short skeletons: exact match, or one being the other plus a single
    // extra consonant ("rt" vs "ryt" for رائتہ/Raita). Anything looser would
    // false-match half the menu.
    if (a.length <= 2 || b.length <= 2) {
      const [s, l] = a.length <= b.length ? [a, b] : [b, a];
      return s.length >= 2 && l.length === s.length + 1 &&
        (l.startsWith(s) || l.endsWith(s) || (l[0] === s[0] && l[l.length - 1] === s[s.length - 1]));
    }
    return editDistance(a, b) <= 1;
  };

  // ---------- Menu index (skeleton token arrays) ----------
  // Each item contributes its MENU NAME plus every admin-defined VOICE ALIAS
  // (Menu Management → "Voice names"). Aliases capture what customers actually
  // say — "adhi deg", "sada chawal", Urdu-script spellings — and match with
  // the same phonetic machinery. All spellings resolve to the same item id.
  const nameIndex = useMemo(() => {
    const entries = [];
    for (const it of menuItems || []) {
      const spellings = [String(it.name || ""), ...(Array.isArray(it.voice_aliases) ? it.voice_aliases : [])];
      for (const sp of spellings) {
        const tokens = String(sp || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        const skels = tokens.map(skeleton).filter(Boolean);
        if (!skels.length) continue;
        entries.push({ id: it.id, name: it.name, price: Number(it.price) || 0, tokens, skels });
      }
    }
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItems]);

  // ---------- Number words: Urdu/Punjabi/Hindi (Latin + Urdu script) + English ----------
  const NUM_WORDS = useMemo(() => ({
    "ek": 1, "aik": 1, "ik": 1, "one": 1, "1": 1, "ایک": 1,
    "do": 2, "two": 2, "2": 2, "دو": 2,
    "tin": 3, "teen": 3, "three": 3, "3": 3, "تین": 3,
    "char": 4, "chaar": 4, "four": 4, "4": 4, "چار": 4,
    "paanch": 5, "panch": 5, "panj": 5, "five": 5, "5": 5, "پانچ": 5, "پنج": 5,
    "chha": 6, "chhe": 6, "che": 6, "six": 6, "6": 6, "چھ": 6, "چھے": 6,
    "saat": 7, "sat": 7, "seven": 7, "7": 7, "سات": 7,
    "aath": 8, "ath": 8, "eight": 8, "8": 8, "آٹھ": 8,
    "nau": 9, "nau'": 9, "nine": 9, "9": 9, "نو": 9,
    "dus": 10, "das": 10, "ten": 10, "10": 10, "دس": 10,
  }), []);

  // Connective / filler words in all three languages — skipped entirely so
  // "do PLATE biryani AUR aik cola DENA" parses the same as "do biryani aik cola".
  const FILLERS = useMemo(() => new Set([
    "aur", "or", "and", "with", "sath", "saath", "plus",
    "plate", "plates", "pleat", "portion", "order",
    "dena", "dedo", "dijiye", "dijye", "de", "chahiye", "chaiye", "chahida", "lagao", "lagado", "banao", "bana",
    "wala", "wali", "walay", "vala", "vali",
    "ji", "bhai", "please", "plz", "ok", "theek", "thik",
    "اور", "پلیٹ", "دینا", "دیدو", "چاہیے", "چاہئے", "والا", "والی", "جی", "بھائی", "ساتھ",
  ]), []);

  // ---------- Parser: transcript -> {items, subtotal, score} ----------
  const parseTranscript = (text) => {
    if (!text) return { items: [], subtotal: 0, score: 0 };
    // Normalise Urdu digits early so "۲ بریانی" works, then split on anything
    // that isn't a letter/number (keeps both scripts intact).
    const normalised = transliterate(text).toLowerCase();
    const rawWords = String(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const words = normalised.split(/[^a-z0-9]+/).filter(Boolean);
    // rawWords and words can drift in length if transliteration merges chars;
    // parse on the transliterated stream but check NUM_WORDS on both forms.
    const stream = words.length >= rawWords.length ? words : rawWords;
    const skels = stream.map(skeleton);

    const items = [];
    let pendingQty = null;
    let lastItem = null; // most recent matched item — receives a TRAILING quantity
    let score = 0;
    let i = 0;
    while (i < stream.length) {
      const w = stream[i];
      const rw = rawWords[i];
      // Fillers are transparent — they don't break the qty→item association.
      if (FILLERS.has(w) || (rw !== undefined && FILLERS.has(rw))) { i++; continue; }
      const qty = NUM_WORDS[w] ?? (rw !== undefined ? NUM_WORDS[rw] : undefined);
      if (qty !== undefined) {
        // Urdu/Punjabi word order puts the number AFTER the dish ("biryani do
        // dena"). If a number directly follows a matched item that was added
        // with the default qty 1, treat it as that item's quantity.
        if (lastItem && lastItem.quantity === 1 && lastItem._implicitQty) {
          lastItem.quantity = qty;
          lastItem._implicitQty = false;
        } else {
          pendingQty = qty;
        }
        i++;
        continue;
      }

      // Best-scoring menu item whose skeleton tokens match the upcoming words.
      let best = null;
      for (const it of nameIndex) {
        const n = it.skels.length;
        // Allow the spoken form to skip up to one token of long names
        // ("chicken biryani full" vs menu "chicken biryani (full)").
        const windowLens = n === 1 ? [1] : [n, n + 1];
        for (const wl of windowLens) {
          if (i + 1 > stream.length) break;
          const win = skels.slice(i, i + wl).filter(Boolean);
          if (!win.length) continue;
          let matched = 0;
          const used = new Set();
          for (const tok of it.skels) {
            const hit = win.findIndex((s, idx) => !used.has(idx) && tokensMatch(tok, s));
            if (hit !== -1) { used.add(hit); matched++; }
          }
          const need = n <= 2 ? n : n - 1;   // long names may drop one token
          if (matched >= need) {
            const s = matched / n + n * 0.01; // prefer more-complete, longer names
            if (!best || s > best.s) best = { it, span: Math.min(wl, stream.length - i), s, matched };
          }
        }
      }

      if (best) {
        const implicit = pendingQty === null;
        const q = pendingQty ?? 1;
        const existing = items.find((x) => x.item_id === best.it.id);
        if (existing) {
          existing.quantity += q;
          lastItem = existing;
          lastItem._implicitQty = implicit;
        } else {
          lastItem = { item_id: best.it.id, name: best.it.name, price: best.it.price, quantity: q, _implicitQty: implicit };
          items.push(lastItem);
        }
        score += best.matched;
        pendingQty = null;
        i += best.span;
        continue;
      }
      i++;
    }
    const cleaned = items.map(({ _implicitQty, ...it }) => it);
    const subtotal = cleaned.reduce((s, it) => s + it.price * it.quantity, 0);
    return { items: cleaned, subtotal, score };
  };

  const buildConfirmationText = ({ items, subtotal }) => {
    if (!items.length) return "Sorry, I didn't catch any menu item. Please try again.";
    const parts = items.map((it) => `${it.quantity} ${it.name}`);
    return `Order — ${parts.join(", ")}. Total ${currency} ${subtotal.toFixed(0)}. Confirm?`;
  };

  // ---------- Setup SpeechRecognition once ----------
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    // Ask for several alternatives — the top guess is often the one that
    // mangled the food words; an alternative frequently parses better.
    rec.maxAlternatives = 5;
    rec.onresult = (ev) => {
      const alts = [];
      const res = ev.results?.[0];
      for (let k = 0; k < (res?.length || 0); k++) {
        const t = res[k]?.transcript || "";
        if (t) alts.push(t);
      }
      // Parse every alternative; keep the one that matched the most.
      let bestT = alts[0] || "";
      let bestP = parseTranscript(bestT);
      for (let k = 1; k < alts.length; k++) {
        const p = parseTranscript(alts[k]);
        if (p.items.length > bestP.items.length || (p.items.length === bestP.items.length && p.score > bestP.score)) {
          bestP = p; bestT = alts[k];
        }
      }
      setTranscript(bestT);
      const confirmation_text = buildConfirmationText(bestP);
      setParsed({ intent: bestP.items.length ? "order" : "unknown", ...bestP, confirmation_text });
      try {
        const utter = new SpeechSynthesisUtterance(confirmation_text);
        utter.lang = "en-US"; // numbers + item names read clearly in English voice
        utter.rate = 1.0;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      } catch { /* ignore */ }
      setProcessing(false);
      setRecording(false);
    };
    rec.onerror = (e) => {
      toast.error("Voice error: " + (e.error || "unknown"));
      setProcessing(false);
      setRecording(false);
    };
    rec.onend = () => { setRecording(false); };
    recRef.current = rec;
    return () => { try { rec.abort(); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameIndex.length]); // rebuild listener whenever menu changes

  const reset = () => { setParsed(null); setTranscript(""); setProcessing(false); setRecording(false); };
  const handleClose = () => {
    try { recRef.current?.abort(); } catch { /* ignore */ }
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    reset();
    onClose(false);
  };

  const pickLang = (l) => {
    setLang(l);
    localStorage.setItem("knb_voice_lang", l);
  };

  const startRecording = () => {
    if (!recRef.current || recording || processing) return;
    setParsed(null); setTranscript(""); setProcessing(true); setRecording(true);
    try {
      recRef.current.lang = lang; // applied per-recording so the toggle works live
      recRef.current.start();
    }
    catch (err) { toast.error("Couldn't start mic: " + (err.message || "unknown")); setProcessing(false); setRecording(false); }
  };
  const stopRecording = () => { try { recRef.current?.stop(); } catch { /* ignore */ } };

  const replayAudio = () => {
    if (!parsed?.confirmation_text) return;
    try {
      const utter = new SpeechSynthesisUtterance(parsed.confirmation_text);
      utter.lang = "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch { /* ignore */ }
  };

  const confirmOrder = () => {
    if (!parsed || parsed.intent !== "order" || !parsed.items?.length) { toast.error("Nothing to confirm"); return; }
    onConfirm?.(parsed.items);
    toast.success("Order items added to cart");
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="border-[#E5E2DC] max-w-md" data-testid="voice-assistant-modal">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "Manrope" }}>Voice Assistant</DialogTitle>
          <DialogDescription>
            {supported
              ? 'Press the mic and speak your order — e.g. "Do chicken biryani aur ek cola".'
              : "Voice not supported in this browser. Please use Chrome, Edge or Safari."}
          </DialogDescription>
        </DialogHeader>

        {/* Language toggle — pick BEFORE speaking. ur-PK covers Urdu and gets
            closest to Pakistani Punjabi; en-IN understands desi-accent English
            far better than en-US. */}
        {supported && (
          <div className="flex justify-center gap-2" data-testid="voice-lang-toggle">
            {[
              { code: "ur-PK", label: "اردو / پنجابی" },
              { code: "en-IN", label: "English" },
            ].map((l) => (
              <button key={l.code} type="button" data-testid={`voice-lang-${l.code}`}
                onClick={() => pickLang(l.code)}
                disabled={recording || processing}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${lang === l.code ? "text-white border-transparent" : "border-[#E5E2DC]"}`}
                style={lang === l.code ? { background: "#1E3F20" } : { color: "#5C5F5C" }}>
                {l.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col items-center py-4">
          <button
            data-testid={recording ? "voice-stop-btn" : "voice-record-btn"}
            disabled={processing || !supported}
            onClick={recording ? stopRecording : startRecording}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${recording ? "animate-pulse" : ""}`}
            style={{ background: recording ? "#C05746" : processing ? "#5C5F5C" : (supported ? "#1E3F20" : "#A0A0A0"), color: "white" }}>
            {processing && !recording ? <Loader2 className="w-10 h-10 animate-spin" /> : recording ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
          </button>
          <p className="text-xs mt-3 text-center" style={{ color: "#5C5F5C" }} data-testid="voice-status-text">
            {!supported ? "Voice unavailable" : processing && !recording ? "Processing…" : recording ? "Listening — tap to stop" : "Tap the mic to start"}
          </p>
        </div>

        {parsed && (
          <div className="rounded-lg border border-[#E5E2DC] p-3 space-y-2 bg-[#F9F8F6]" data-testid="voice-result">
            <div>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "#5C5F5C" }}>You said</p>
              <p className="text-sm" style={{ color: "#1A1D1A", direction: "auto" }} data-testid="voice-transcript">{transcript}</p>
            </div>

            {parsed.intent === "order" && parsed.items?.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide mt-2" style={{ color: "#5C5F5C" }}>Parsed order</p>
                <ul className="text-sm space-y-0.5 mt-1" data-testid="voice-parsed-items">
                  {parsed.items.map((it, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{it.quantity}× {it.name}</span>
                      <span className="font-medium" style={{ color: "#1E3F20" }}>{currency} {(it.price * it.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-[#E5E2DC]">
                  <span style={{ color: "#1A1D1A" }}>Subtotal</span>
                  <span style={{ color: "#1E3F20" }}>{currency} {parsed.subtotal?.toFixed(2)}</span>
                </div>
              </div>
            )}

            {parsed.intent === "unknown" && (
              <p className="text-sm" style={{ color: "#C05746" }}>Couldn't match any menu item. Please try again or say the exact item name.</p>
            )}

            <div>
              <p className="text-[11px] uppercase tracking-wide mt-2" style={{ color: "#5C5F5C" }}>Assistant</p>
              <div className="flex items-start gap-2">
                <p className="text-sm flex-1" style={{ color: "#1A1D1A" }} data-testid="voice-confirmation-text">{parsed.confirmation_text}</p>
                <button data-testid="voice-replay-btn" onClick={replayAudio} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#EAF4EB]" style={{ color: "#1E3F20" }}><Volume2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          {parsed && parsed.intent === "order" && parsed.items?.length > 0 && (
            <Button data-testid="voice-confirm-btn" onClick={confirmOrder} className="flex-1 flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}>
              <Check className="w-4 h-4" /> Confirm
            </Button>
          )}
          <Button data-testid="voice-cancel-btn" onClick={handleClose} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]">
            <X className="w-4 h-4" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
