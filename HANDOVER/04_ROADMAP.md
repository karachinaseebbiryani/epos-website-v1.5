# 04 — Current Roadmap (Prioritized)

> Order is intentional. Earlier items unblock later items. **Do NOT skip ahead.**

## Phase 1 — Production Stabilization (immediate, ~1 iteration)

**Goal**: harden what already works before adding anything new.

- [ ] **Add structured logging** to the bare `except: pass` blocks in `server.py` (especially in `create_order` and `create_refund` outsourced hooks). Use `logger.warning("outsourced hook skipped: %s", e)`. Without this, vendor-payable misses are invisible.
- [ ] **Add error boundary** in `App.js` (wrap the whole `<BrowserRouter>` in `<ErrorBoundary>`). Currently a single render error crashes the entire admin shell.
- [ ] **Fix OldOrdersPage eslint warning** (`pages/legacy/OldOrdersPage.js:60`) — wrap `fetchOrders` in `useCallback` and add to deps.
- [ ] **Verify Z-report scheduler** runs on Emergent (it should — APScheduler with Asia/Karachi tz). Manually trigger via `POST /api/schedule/run-now` and inspect `z_reports` collection.
- [ ] **Add `/api/health`** GET endpoint returning `{status, db, scheduler, version}` for monitoring.
- [ ] **Smoke-test outsourced flow** with real production-like data: create vendor → mark item outsourced → place 5 mixed orders (some outsourced, some not) → place 2 refunds → verify `/sales-summary` numbers match a hand calculation.

**Acceptance**: 45/45 backend tests still pass + new health endpoint + zero `except: pass` in vendor hooks.

## Phase 2 — Unified Invoice System (1 iteration)

**Goal**: a single canonical invoice template used by both POS and online orders.

- [ ] Generalize `components/legacy/ReceiptModal.js` to accept an order shape with optional online fields:
  ```ts
  type CanonicalOrder = {
    id, items, subtotal, tax, total, discount_amount, payment_type,
    cashier_name, created_at,
    // Online-only optional:
    customer_name?, customer_phone?, delivery_address?, delivery_fee?,
    channel?: "pos"|"foodpanda1"|"foodpanda2"|"web", order_no?
  }
  ```
- [ ] Add a `mode: "pos" | "online"` prop that toggles which fields are rendered.
- [ ] Replace `ThermalReceipt.jsx` usage in `pages/admin/AdminOrders.jsx` with `<ReceiptModal>`.
- [ ] Keep `ThermalReceipt.jsx` file as a thin wrapper that re-exports `ReceiptModal` for backward-compat with any direct imports.
- [ ] **DO NOT break existing POS receipt formatting.** All `settings.receipt_*` fields must continue to drive the POS layout exactly as before.

**Acceptance**: cashier prints POS receipt = pixel-identical to before; admin prints online order = uses same template, with delivery/customer info shown.

## Phase 3 — Safe Modularization (1-2 iterations, OPTIONAL)

**Goal**: split `server.py` (3,479 lines) into routers without breaking tests.

- [ ] Create `/app/backend/routers/` with one file per domain:
  - `auth.py` — login/register/me/logout/refresh + customer mirror
  - `pos.py` — categories, menu-items, orders, refunds, inventory
  - `vendors.py` — vendors + transactions + payments + sales-summary
  - `reports.py` — X/Z + history + export
  - `expenses.py`
  - `settings.py`
  - `online.py` — online-orders, customer-public, customer-profile
  - `payments.py` — Stripe, bank-proof
  - `voice.py` — Whisper + GPT-4o + TTS
  - `whatsapp.py`, `tunnel.py`, `schedule.py`, `data.py`
- [ ] Move helpers (`get_current_user`, `hash_password`, `verify_password`, `create_access_token`) into `/app/backend/deps.py`.
- [ ] Move Pydantic models into `/app/backend/models.py`.
- [ ] Each router: `from fastapi import APIRouter; router = APIRouter(prefix="/...", tags=["..."])`.
- [ ] In `server.py` (now ~50 lines), import all routers and `app.include_router(...)`.
- [ ] Run full pytest suite after EACH file split. Must be green at every step.

**Acceptance**: server.py < 200 lines; routers/ folder; 45/45 tests still pass; zero behavior change.

**WARNING**: this is high-risk. Skip if user hasn't asked. The monolithic file works fine.

## Phase 4 — Offline Reliability Testing (1 iteration)

**Goal**: prove the on-premise install still works end-to-end after the iter 1+2 changes.

- [ ] Spin up a Windows test VM (or WSL) and run `windows-setup/1_INSTALL.bat`.
- [ ] Verify: Mongo starts, backend on 8001, frontend on 3000, cloudflared tunnel optional.
- [ ] Cashier flow: open `http://localhost:3000/admin/sign-in`, sign in, place 10 orders, run X-report.
- [ ] Disable internet on the VM mid-shift; verify POS continues working.
- [ ] Re-enable internet; verify online-order polling resumes (GlobalOrderAlert should reconnect).
- [ ] Verify `whatsapp-service/index.js` boots and shows QR code for WhatsApp Web pairing.

**Acceptance**: end-to-end Windows install runbook published to `/app/windows-setup/RUNBOOK.md`.

## Phase 5 — Vendor Dashboard Enhancements (1 iteration)

**Goal**: surface vendor sales-summary insights to operators.

- [ ] Add a "Live Balance" card on `/admin/vendors` per vendor row:
  - Auto-billed (orders) | Reversed (refunds) | Manual | Paid | **Outstanding balance**
  - 7-day mini sparkline of daily transactions
  - Uses `GET /api/vendors/{id}/sales-summary?start_date=&end_date=`
- [ ] Add filter chips: "All", "With outstanding payable", "Outsourced suppliers only".
- [ ] Add a "Settle now" button next to outstanding rows that opens the existing `POST /api/vendors/{id}/payments` form pre-filled with the balance amount.
- [ ] Add `/admin/reports` X/Z report a new section: "Outsourced sales by vendor today".

**Acceptance**: an owner can see at-a-glance "I owe Khokha Rs160" without clicking into a vendor.

## Phase 6 — Deployment Preparation (1 iteration)

**Goal**: ready the codebase for cloud production beyond the Emergent preview.

- [ ] Externalize all SECRET env vars (JWT_SECRET, ADMIN_PASSWORD, EMERGENT_LLM_KEY, TWILIO, STRIPE) into a vault or platform secrets manager.
- [ ] Add Docker compose file for self-hosted cloud (FastAPI + Mongo + frontend nginx).
- [ ] Add Mongo backup cron (mongodump → S3 daily).
- [ ] Switch CRA dev server → production build (`yarn build` + nginx serve).
- [ ] Add CORS allowlist (currently `"*"`).
- [ ] Switch JWT cookies to `secure=True` once on HTTPS.
- [ ] Rate limit auth endpoints (5/min/IP) and order creation (50/min/cashier) using slowapi.

**Acceptance**: same app deployable on a fresh VPS with one `docker compose up`.

## Phase 7 — Mobile-App Readiness (1-2 iterations)

**Goal**: prepare the API for a future React Native or Flutter cashier app.

- [ ] Audit endpoints for mobile-friendliness:
  - Image upload size limits (currently inline base64 — wasteful on mobile)
  - Pagination on `/orders/history`, `/online-orders`
  - Versioning header (`X-API-Version: 1`)
- [ ] Add an `/api/v1/` mount alongside `/api/` (no breaking changes; v0 stays).
- [ ] Document API in OpenAPI spec (FastAPI auto-generates `/docs` and `/openapi.json`).
- [ ] Add a "Mobile App QR" page in `/admin/settings-full` that shows the API base URL as QR for quick install.
- [ ] Add JWT refresh-token rotation (currently 7-day fixed).

**Acceptance**: an external developer can `curl /openapi.json` and start building a mobile cashier client.

---

## Cross-cutting items (do whenever convenient)

- [ ] One-click **"Old → New data import wizard"** at `/admin/settings-full`.
- [ ] Lift `GlobalOrderAlert` polling state into a context so `AdminOrders.jsx` subscribes (eliminates duplicate fetch).
- [ ] Token consolidation (`staff_auth_token` becomes the single source of truth; `lib/api.js` reads from it).
- [ ] Frontend tests: at least smoke tests for sign-in, POS order creation, refund.
- [ ] Replace bare `except: pass` with structured warnings (project-wide).
