import React, { useState, useRef, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Mic, MicOff, Loader2, Check, X, Volume2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Urdu/Punjabi/English voice assistant — 100% browser-native (free).
 * - STT: Web Speech API (Chrome/Edge/Safari)
 * - Parser: local keyword matcher against the menu names supplied by the parent
 * - TTS: SpeechSynthesis API
 *
 * Props:
 *   open, onClose
 *   onConfirm({ items: [{ item_id, name, price, quantity }] })
 *   onExpense (unused in this free mode; expenses still need an LLM)
 *   currency
 *   menuItems  <-- NEW: full menu items array from the parent (POSPage)
 */
export default function VoiceAssistantModal({ open, onClose, onConfirm, currency = "Rs", menuItems = [] }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsed, setParsed] = useState(null); // { items, subtotal, intent, confirmation_text }
  const [supported, setSupported] = useState(true);
  const recRef = useRef(null);

  // ---------- Build a fast lookup index of menu names ----------
  const nameIndex = useMemo(() => {
    return (menuItems || []).map((it) => ({
      id: it.id,
      name: it.name,
      price: Number(it.price) || 0,
      tokens: String(it.name || "").toLowerCase().split(/\s+/).filter(Boolean),
    }));
  }, [menuItems]);

  // ---------- Urdu/Punjabi/Hindi word numbers + English digits ----------
  const NUM_WORDS = {
    "ek":1, "aik":1, "one":1, "1":1,
    "do":2, "two":2, "2":2,
    "tin":3, "teen":3, "three":3, "3":3,
    "char":4, "chaar":4, "four":4, "4":4,
    "paanch":5, "panch":5, "five":5, "5":5,
    "chha":6, "chhe":6, "six":6, "6":6,
    "saat":7, "seven":7, "7":7,
    "aath":8, "eight":8, "8":8,
    "nau":9, "nine":9, "9":9,
    "dus":10, "das":10, "ten":10, "10":10,
  };

  // ---------- Local parser: turns transcript -> {items, subtotal} ----------
  const parseTranscript = (text) => {
    if (!text) return { items: [], subtotal: 0 };
    const lc = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
    const words = lc.split(/\s+/).filter(Boolean);
    const items = [];
    let lastQty = 1;
    let pendingQty = null;
    // Greedy match: at each position, try the longest item-name substring.
    let i = 0;
    while (i < words.length) {
      const w = words[i];
      if (w in NUM_WORDS) { pendingQty = NUM_WORDS[w]; lastQty = pendingQty; i++; continue; }
      // Try to match an item name starting at i (up to 5-token names)
      let matched = null;
      for (let span = Math.min(5, words.length - i); span >= 1; span--) {
        const phrase = words.slice(i, i + span).join(" ");
        const found = nameIndex.find((it) => it.name.toLowerCase() === phrase);
        if (found) { matched = { ...found, span }; break; }
      }
      if (!matched) {
        // Fuzzy: any item whose every token appears in the next 3 words
        const window3 = words.slice(i, i + 3).join(" ");
        const fuzzy = nameIndex.find((it) =>
          it.tokens.length > 0 && it.tokens.every((t) => window3.includes(t))
        );
        if (fuzzy) matched = { ...fuzzy, span: Math.min(3, words.length - i) };
      }
      if (matched) {
        const qty = pendingQty ?? lastQty ?? 1;
        const existing = items.find((it) => it.item_id === matched.id);
        if (existing) existing.quantity += qty;
        else items.push({ item_id: matched.id, name: matched.name, price: matched.price, quantity: qty });
        pendingQty = null;
        i += matched.span;
        continue;
      }
      i++;
    }
    const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
    return { items, subtotal };
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
    rec.maxAlternatives = 1;
    // Try Urdu first; the browser will fall back to whatever it has best installed.
    rec.lang = "ur-PK";
    rec.onresult = (ev) => {
      const t = ev.results?.[0]?.[0]?.transcript || "";
      setTranscript(t);
      const result = parseTranscript(t);
      const confirmation_text = buildConfirmationText(result);
      setParsed({ intent: result.items.length ? "order" : "unknown", ...result, confirmation_text });
      // Speak confirmation
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

  const startRecording = () => {
    if (!recRef.current || recording || processing) return;
    setParsed(null); setTranscript(""); setProcessing(true); setRecording(true);
    try { recRef.current.start(); }
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