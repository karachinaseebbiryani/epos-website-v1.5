# Restaurant POS App - PRD

## Original Problem Statement
BUILD AN OFFLINE RESTAURANT APP WHICH HAVE MULTIPLE BUTTON CREATION OPTIONS WHICH COUNTS OUR DAILY SALE AND ITS TOTALLY OFFLINE ALL DATA SHOULD BE SAVED IN COMPUTER AND X SALE REPORTS AND Z SALE REPORTS WHICH CAN HOLD DATA FOR UPTO TWO MONTHS I NEED INVENTORY SYSTEM IN IT AND SALE SYSTEM LIKE POS

## Personas
- **Admin** (owner) — full access, including remote dashboard from UK
- **Cashier** — POS + X reports

## Architecture
- **Backend**: FastAPI + MongoDB + APScheduler + httpx
- **Frontend**: React + Tailwind + Shadcn (react-scripts; conditional setupProxy.js for local Windows install)
- **WhatsApp Service**: Node + whatsapp-web.js + LocalAuth + chromium (port 3030)
- **Cloudflare Tunnel**: cloudflared.exe (port 3000 → free *.trycloudflare.com URL)

## Implemented (latest iter7 — 2026-04-25)

- [x] **Cloudflare Tunnel for remote access**
  - Backend `tunnel_watcher_loop()` polls `cloudflared.log` every 15s
  - On URL change → updates DB + auto-emails + auto-WhatsApps the new URL to recipients
  - New endpoints: `GET /api/tunnel/status`, `POST /api/tunnel/refresh`
  - Settings → "Remote Access" tab: ONLINE banner with URL + Copy/Open buttons + "auto-notify" toggle + how-it-works guide
  - Windows installer auto-downloads `cloudflared-windows-amd64.exe` from GitHub releases
  - Launcher VBS auto-starts `cloudflared tunnel --url http://localhost:3000 --logfile cloudflared.log`
  - STOP script kills `cloudflared.exe`
  - **CRA `setupProxy.js`** — conditionally proxies `/api` to localhost:8001 when REACT_APP_BACKEND_URL is empty (only on local Windows install). Bypassed entirely on Emergent preview to avoid host-header conflicts.

## Earlier (iter6) — 2026-04-25
- Daily auto-send scheduler (APScheduler, editable HH:MM + IANA tz, default 02:15 Asia/Karachi)
- Free WhatsApp via whatsapp-web.js (Node service + QR scan)
- Email reports per-recipient X/Z toggles, send-test, auto-on-Z-close

## Earlier (iter5) — 2026-04-25
- Windows compile fix (relative paths, react-scripts only)
- POS button colors (Categories + Items, ColorPicker)
- Email reports (SMTP + recipients)

## Earlier (pre-iter5)
- POS, Menu, Inventory, Vendors, Expenses, Refunds
- X/Z reports + 2-month history + CSV/PDF export
- JWT auth + role-based access
- Windows offline install scripts

## Windows Installer Files (clean — only 4)
- `1_INSTALL.bat` — one-time setup; checks Python/Node/Mongo, installs deps, downloads cloudflared, creates desktop shortcut
- `2_START_RestoPOS.vbs` — silent daily launcher (no CMD windows); starts backend + frontend + WhatsApp + cloudflared all hidden
- `STOP_RESTOPOS.bat` — kills all services
- `README.txt` — quick-start + troubleshooting

## Test Reports
- iter7: `/app/test_reports/iteration_7.json` (6/6 tunnel tests + frontend) + `/app/backend/tests/test_iter7_tunnel.py`
- iter6: schedule + WhatsApp (18/18 backend)
- iter5: colors + email (16/16 backend)

## Recurring Lesson
- **TDZ pattern**: bootstrap `useEffect` reading `useCallback` declared further down. Caught in iter6 (fetchScheduleStatus) and iter7 (fetchTunnelStatus). Mitigation: always declare useCallbacks BEFORE any useEffect that depends on them.

## Backlog
- Extract `useSettingsBootstrap()` custom hook to permanently kill the TDZ recurrence
- Server-side HH:MM/timezone validation
- "Yellow Initializing…" state on WhatsApp status card
- Implement legacy `GET /api/inventory/low_stock` endpoint
- Multi-cashier shift tracking, KDS, multi-language receipts
- Optional: Cloudflare named tunnel (persistent URL) when user adds a custom domain

## Test Credentials
admin@restaurant.com / admin123 (also in `/app/memory/test_credentials.md`)
