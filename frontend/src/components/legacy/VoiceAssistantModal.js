import React, { useState, useRef } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Mic, MicOff, Loader2, Check, X, Volume2 } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Urdu/Punjabi voice assistant.
 * Press & hold (or click Start/Stop) to record, sends to /api/voice/parse, shows parsed order,
 * plays TTS Urdu confirmation, lets user confirm → calls onConfirm(items) OR onExpense({description, amount}).
 */
export default function VoiceAssistantModal({ open, onClose, onConfirm, onExpense, currency = "Rs" }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null); // { transcript, items, subtotal, intent, confirmation_text, audio_base64, expense }
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioRef = useRef(null);

  const reset = () => { setResult(null); setRecording(false); setProcessing(false); };

  const handleClose = () => {
    try { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    try { if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } } catch { /* ignore */ }
    reset();
    onClose(false);
  };

  const startRecording = async () => {
    if (recording || processing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 500) { toast.error("Recording too short — try again"); setRecording(false); return; }
        await sendAudio(blob, mime);
      };
      mr.start();
      setRecording(true);
      setResult(null);
    } catch (err) {
      toast.error("Microphone access denied: " + (err.message || "unknown"));
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    setRecording(false);
  };

  const sendAudio = async (blob, mime) => {
    setProcessing(true);
    try {
      const ext = mime.includes("webm") ? "webm" : mime.includes("mp4") ? "mp4" : "wav";
      const fd = new FormData();
      fd.append("audio", blob, `voice.${ext}`);
      fd.append("language", "ur");
      const { data } = await axios.post(`${API}/voice/parse`, fd, { withCredentials: true, headers: { "Content-Type": "multipart/form-data" } });
      setResult(data);
      // Play TTS
      if (data.audio_base64) {
        try {
          const bytes = Uint8Array.from(atob(data.audio_base64), (c) => c.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
          const a = new Audio(url);
          audioRef.current = a;
          a.play().catch(() => { /* autoplay may fail silently */ });
        } catch { /* ignore */ }
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Voice parsing failed");
    } finally { setProcessing(false); }
  };

  const replayAudio = () => {
    if (!result?.audio_base64) return;
    const bytes = Uint8Array.from(atob(result.audio_base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
    new Audio(url).play().catch(() => { /* ignore */ });
  };

  const confirmOrder = () => {
    if (!result) return;
    if (result.intent === "order" && result.items?.length) {
      onConfirm?.(result.items);
      toast.success("Order items added to cart");
      handleClose();
    } else if (result.intent === "expense" && result.expense && onExpense) {
      onExpense(result.expense);
      toast.success("Expense saved");
      handleClose();
    } else {
      toast.error("Nothing to confirm");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="border-[#E5E2DC] max-w-md" data-testid="voice-assistant-modal">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "Manrope" }}>Voice Assistant (Urdu / Punjabi)</DialogTitle>
          <DialogDescription>Press the mic and speak your order — e.g. "Do chicken biryani aur ek cola".</DialogDescription>
        </DialogHeader>

        {/* Mic button */}
        <div className="flex flex-col items-center py-4">
          <button
            data-testid={recording ? "voice-stop-btn" : "voice-record-btn"}
            disabled={processing}
            onClick={recording ? stopRecording : startRecording}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${recording ? "animate-pulse" : ""}`}
            style={{ background: recording ? "#C05746" : processing ? "#5C5F5C" : "#1E3F20", color: "white" }}>
            {processing ? <Loader2 className="w-10 h-10 animate-spin" /> : recording ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
          </button>
          <p className="text-xs mt-3 text-center" style={{ color: "#5C5F5C" }} data-testid="voice-status-text">
            {processing ? "Transcribing & parsing…" : recording ? "Listening — tap to stop" : "Tap the mic to start"}
          </p>
        </div>

        {/* Result */}
        {result && (
          <div className="rounded-lg border border-[#E5E2DC] p-3 space-y-2 bg-[#F9F8F6]" data-testid="voice-result">
            <div>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "#5C5F5C" }}>You said</p>
              <p className="text-sm" style={{ color: "#1A1D1A", direction: "auto" }} data-testid="voice-transcript">{result.transcript}</p>
            </div>

            {result.intent === "order" && result.items?.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide mt-2" style={{ color: "#5C5F5C" }}>Parsed order</p>
                <ul className="text-sm space-y-0.5 mt-1" data-testid="voice-parsed-items">
                  {result.items.map((it, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{it.quantity}× {it.name}</span>
                      <span className="font-medium" style={{ color: "#1E3F20" }}>{currency} {(it.price * it.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-[#E5E2DC]">
                  <span style={{ color: "#1A1D1A" }}>Subtotal</span>
                  <span style={{ color: "#1E3F20" }}>{currency} {result.subtotal?.toFixed(2)}</span>
                </div>
              </div>
            )}

            {result.intent === "expense" && result.expense && (
              <div>
                <p className="text-[11px] uppercase tracking-wide mt-2" style={{ color: "#5C5F5C" }}>Parsed expense</p>
                <p className="text-sm" style={{ color: "#1A1D1A" }}>{result.expense.description} — <span className="font-bold" style={{ color: "#C05746" }}>{currency} {result.expense.amount}</span></p>
              </div>
            )}

            {result.intent === "unknown" && (
              <p className="text-sm" style={{ color: "#C05746" }}>Couldn't understand the order. Please try again.</p>
            )}

            <div>
              <p className="text-[11px] uppercase tracking-wide mt-2" style={{ color: "#5C5F5C" }}>Assistant</p>
              <div className="flex items-start gap-2">
                <p className="text-sm flex-1" style={{ color: "#1A1D1A", direction: "rtl" }} data-testid="voice-confirmation-text">{result.confirmation_text}</p>
                {result.audio_base64 && (
                  <button data-testid="voice-replay-btn" onClick={replayAudio} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#EAF4EB]" style={{ color: "#1E3F20" }}><Volume2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          {result && (result.intent === "order" && result.items?.length > 0 || result.intent === "expense" && result.expense && onExpense) && (
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
