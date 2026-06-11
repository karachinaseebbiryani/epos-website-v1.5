/**
 * RestoPOS WhatsApp Service
 * - Runs on port 3030 (configurable via PORT env var)
 * - Endpoints:
 *    GET  /status   -> { ready: bool, phone: string|null, qr_available: bool }
 *    GET  /qr       -> { qr: "<dataURL>" }  (when not ready)
 *    POST /send     -> { to: "+923004928411", message: "..." }
 *    POST /reset    -> clears auth so a new QR is generated
 *
 * Sessions persist in ./.wwebjs_auth/ — user scans QR only once.
 */
const express = require("express");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const PORT = parseInt(process.env.WHATSAPP_PORT || "3030", 10);
const app = express();
app.use(express.json({ limit: "1mb" }));

let state = {
  ready: false,
  phone: null,
  lastQr: null,
  lastQrAt: null,
  initializing: false,
  error: null,
};

let client = null;

function buildClient() {
  const puppeteerOpts = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--single-process",
      "--no-zygote",
    ],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  return new Client({
    authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
    puppeteer: puppeteerOpts,
  });
}

function attachHandlers(c) {
  c.on("qr", async (qr) => {
    try {
      state.lastQr = await QRCode.toDataURL(qr);
      state.lastQrAt = new Date().toISOString();
      state.ready = false;
      console.log("[whatsapp] QR generated; waiting for scan");
    } catch (e) {
      console.error("[whatsapp] QR encode error", e);
    }
  });

  c.on("ready", () => {
    state.ready = true;
    state.lastQr = null;
    state.error = null;
    try {
      const me = c.info && c.info.wid && c.info.wid.user ? c.info.wid.user : null;
      state.phone = me ? `+${me}` : null;
    } catch {}
    console.log("[whatsapp] ready as", state.phone);
  });

  c.on("authenticated", () => {
    console.log("[whatsapp] authenticated");
  });

  c.on("auth_failure", (msg) => {
    console.error("[whatsapp] auth failure", msg);
    state.error = `Auth failure: ${msg}`;
    state.ready = false;
  });

  c.on("disconnected", (reason) => {
    console.warn("[whatsapp] disconnected:", reason);
    state.ready = false;
    state.phone = null;
    // Try to re-init
    setTimeout(() => initClient().catch(console.error), 5000);
  });
}

async function initClient() {
  if (state.initializing) return;
  state.initializing = true;
  state.error = null;
  try {
    if (client) {
      try { await client.destroy(); } catch {}
    }
    client = buildClient();
    attachHandlers(client);
    await client.initialize();
  } catch (e) {
    console.error("[whatsapp] initialize failed", e);
    state.error = String(e.message || e);
  } finally {
    state.initializing = false;
  }
}

function normalizePhone(num) {
  // Strip everything except digits; whatsapp expects digits with country code, no '+'
  const digits = String(num || "").replace(/\D/g, "");
  return digits;
}

app.get("/status", (req, res) => {
  res.json({
    ready: state.ready,
    phone: state.phone,
    qr_available: !!state.lastQr,
    initializing: state.initializing,
    error: state.error,
  });
});

app.get("/qr", (req, res) => {
  if (state.ready) return res.json({ qr: null, ready: true });
  if (!state.lastQr) return res.status(404).json({ error: "No QR yet. Wait a moment then retry." });
  res.json({ qr: state.lastQr, ready: false, generated_at: state.lastQrAt });
});

app.post("/send", async (req, res) => {
  if (!state.ready || !client) return res.status(503).json({ error: "WhatsApp not connected. Scan QR first." });
  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ error: "to and message required" });
  const phone = normalizePhone(to);
  if (!phone) return res.status(400).json({ error: "Invalid phone" });
  try {
    const chatId = `${phone}@c.us`;
    // Validate the number is registered on WhatsApp
    const isRegistered = await client.isRegisteredUser(chatId);
    if (!isRegistered) return res.status(400).json({ error: `${to} is not on WhatsApp` });
    const sent = await client.sendMessage(chatId, message);
    res.json({ ok: true, id: sent.id ? sent.id.id : null });
  } catch (e) {
    console.error("[whatsapp] send failed", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/reset", async (req, res) => {
  console.log("[whatsapp] reset requested");
  state.ready = false;
  state.phone = null;
  state.lastQr = null;
  try {
    if (client) await client.logout().catch(() => {});
  } catch {}
  // Remove auth
  const fs = require("fs");
  const path = require("path");
  const authDir = path.join(__dirname, ".wwebjs_auth");
  try {
    fs.rmSync(authDir, { recursive: true, force: true });
  } catch (e) {
    console.error("[whatsapp] reset rm failed", e);
  }
  initClient().catch(console.error);
  res.json({ ok: true, message: "Reset; new QR will be generated shortly." });
});

app.get("/", (req, res) => res.json({ service: "RestoPOS WhatsApp", port: PORT, status: state.ready ? "ready" : "initializing" }));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[whatsapp] service listening on http://127.0.0.1:${PORT}`);
  initClient().catch(console.error);
});
