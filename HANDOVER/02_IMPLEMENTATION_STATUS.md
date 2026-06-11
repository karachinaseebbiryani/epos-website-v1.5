# 02 — Full Implementation Status

> Status as of end of Iteration 2 (production-readiness pass). Last verified: 45/45 backend pytest, 100% frontend regression.

## A. Completed Features

### Iteration 1 — Merge

- ✅ Backend: NEW server.py adopted as merged superset; verified all 71 OLD endpoints intact + 42 new endpoints (113 total).
- ✅ Frontend: 11 OLD operational POS pages restored under `pages/legacy/`, all imports rewired.
- ✅ Frontend: 14 NEW customer pages + 8 NEW admin pages preserved.
- ✅ Auth: `StaffAuthContext.js` created; coexists cleanly with customer `AuthContext.js`.
- ✅ Routing: `App.js` merged — customer routes + online admin + 11 legacy operational routes under one shell.
- ✅ `AdminLayout.jsx` rebuilt with two nav sections.
- ✅ Restored `/app/whatsapp-service/` and `/app/windows-setup/`.
- ✅ Deps: `qrcode.react`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `http-proxy-middleware` added; backend deps installed (motor, bcrypt, APScheduler, twilio, stripe, emergentintegrations).
- ✅ Single MongoDB DB; OLD schema 100% backward-compatible.

### Iteration 2 — Production-readiness

| # | Item | Status | File(s) |
|---|---|---|---|
| 1 | POS sticky checkout | ✅ | `pages/legacy/POSPage.js` (`h-[calc(100vh-...)]`, `flex-shrink-0` footer, `min-h-0` ScrollArea) |
| 2 | Receipt modal scrollable body + sticky Print/Close | ✅ | `components/legacy/ReceiptModal.js` (`max-h-[90vh] flex flex-col p-0`, scroll body, border-top action row) |
| 3 | Vendor-linked outsourced products + auto-billing + refund reversal + summary endpoint | ✅ | `backend/server.py` (MenuItem fields, `create_order`, `create_refund`, `/vendors/{id}/sales-summary`); `pages/legacy/MenuManagement.js` (UI block) |
| 4 | Sidebar reorder POS-first | ✅ | `components/AdminLayout.jsx` |
| 5 | Permissions for online modules (6 new perms) + admin auto-sync | ✅ | `backend/server.py` (`ALL_PERMISSIONS`, `seed_admin`); `components/AdminLayout.jsx` (perm filter) |
| 6 | Mobile-app readiness (API-first) | ✅ | already API-first; no code change needed |
| 7 | Unified login at `/admin/sign-in` | ✅ | `pages/UnifiedLoginPage.jsx`, `App.js` redirects |
| 8 | Online order auto-refresh every 4s | ✅ | `pages/admin/AdminOrders.jsx` (already implemented) |
| 9 | Global new-order notifications on every admin page | ✅ | `components/GlobalOrderAlert.jsx` (NEW) |

## B. Partially Completed Features

| Feature | What works | What's missing |
|---|---|---|
| Voice assistant | STT (Whisper) + GPT-4o intent parser + TTS pipeline complete | Requires `EMERGENT_LLM_KEY` env (currently empty → 503). UI floating mic button only on `/admin/pos`; not yet on online admin. |
| Twilio WhatsApp | Backend endpoints + settings UI fully wired | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `WHATSAPP_FROM` env vars empty in production. Local Node `whatsapp-service/` works on Windows install. |
| Stripe | Backend `/payments/checkout` + `/payments/webhook` endpoints exist | `STRIPE_API_KEY` env empty; user must wire test/live keys. |
| Email / SMTP | Backend supports SMTP send for daily Z-report | Requires `restaurant_email_password` in settings (set via `/admin/settings-full`). |
| Cloudflare tunnel | Endpoints + UI present | Only works on Windows on-prem (needs `cloudflared.exe`); cloud preview no-ops gracefully. |

## C. Deferred Features (in priority order)

1. **#10 Unified Invoice template** — POS uses `ReceiptModal`, online uses `ThermalReceipt`. Need to merge into one canonical template (use `ReceiptModal` as base; extend for online-order shape: customer name/phone/address, delivery fee, channel). Replace usage in `AdminOrders.jsx`.
2. **server.py refactor into routers** — currently 3,479 lines monolithic. Should split: `routers/auth.py`, `routers/pos.py`, `routers/online.py`, `routers/vendors.py`, `routers/reports.py`, `routers/settings.py`, `routers/public.py`. Deferred 5+ iterations because tests are pinned.
3. **Token consolidation** — currently `staff_auth_token` and `knb_admin_token` are both stored. Should converge to one source of truth (likely `staff_auth_token`, with `lib/api.js` reading from it directly).
4. **One-click "Old → New data import" wizard** at `/admin/settings-full` (uses existing `/api/data/import` endpoint).
5. **Vendor Dashboard widget** on `/admin/vendors` showing live billed-vs-paid balance + 7-day sparkline (uses new `/sales-summary` endpoint).
6. **Lift GlobalOrderAlert polling state up** so AdminOrders.jsx subscribes to it instead of duplicating fetches (currently ~2× requests/sec on `/admin/orders`).

## D. Known Issues

| Issue | Severity | Where | Mitigation/Next |
|---|---|---|---|
| `OldOrdersPage.js:60` eslint warning: missing `fetchOrders` dep in useEffect | LOW | `pages/legacy/OldOrdersPage.js` | Cosmetic only. Add `// eslint-disable-next-line` or wrap in useCallback. |
| Refund reversal silently swallows `ObjectId(mid)` failures (server.py `create_refund`) | LOW | `backend/server.py` outsourced refund hook | If frontend ever sends a non-Mongo `item_id` (e.g. UUID) the reversal is skipped without log. **Add logger.warning in the except block.** |
| Two parallel admin tokens (`staff_auth_token` + `knb_admin_token`) can drift if one is cleared but not the other | LOW | `pages/UnifiedLoginPage.jsx`, `components/AdminLayout.jsx` logout | Logout clears both; only edge case is manual localStorage tampering. |
| `vendor_sales_summary` `by_product.quantity` is multiplied by `sign(amount)`; a hypothetical zero-total transaction would default to +1 | LOW | `backend/server.py` `vendor_sales_summary` | Production flow always has total>0; cosmetic edge case. |
| `GlobalOrderAlert` + `AdminOrders` both poll `/online-orders/pending-count` every 4s on the orders page → ~2× requests/sec | LOW | `components/GlobalOrderAlert.jsx`, `pages/admin/AdminOrders.jsx` | GlobalOrderAlert auto-mutes audio on /admin/orders to avoid double sound, but the network call is duplicated. Lift state up in a future iteration. |
| Voice assistant requires `EMERGENT_LLM_KEY` env (empty by default → 503) | LOW | `backend/server.py` `_voice_ready()` | User must add the universal key to `.env` (instructions in 06_TECHNICAL_SETUP.md). |

## E. Technical Debt

1. **server.py monolith** — 3,479 lines. Split into routers when test suite can be migrated atomically.
2. **Bare `except: pass`** in 6+ places (server.py outsourced hooks, voice pipeline). Should be `except Exception as e: logger.warning(...)`.
3. **Duplicate axios instances** — `lib/api.js` (online), `staffAxios` in StaffAuthContext, raw `axios` in legacy pages with `withCredentials: true`. Three patterns coexist; legacy pages rely on cookies, new pages on Authorization header.
4. **Hardcoded `/order-alert.wav` path** in two places (GlobalOrderAlert.jsx, AdminOrders.jsx). Extract to constant.
5. **No frontend tests** — only backend pytest. CRA test setup exists but unused.
6. **No error boundary** — a thrown render error in any admin page crashes the whole shell. Add `<ErrorBoundary>` in App.js.
7. **APScheduler runs in-process** — fine for single-instance, breaks if backend is scaled to N replicas. Not a near-term concern.
8. **No structured logging** — uses `logger.info(...)` strings. Migrate to JSON logging if shipping to a log aggregator.

## F. Pending Refactors (DO NOT do these without explicit user request)

- ❌ **Splitting server.py** — high risk, low immediate value. Skip until user asks.
- ❌ **Merging ReceiptModal + ThermalReceipt** — this IS roadmap #10 but only when scoped explicitly.
- ❌ **Replacing legacy axios with `lib/api.js`** — would require updating ALL 11 legacy pages. High regression risk.
- ❌ **Migrating from CRA to Vite** — out of scope; preview env is CRA-pinned.
- ❌ **Switching customer auth + staff auth to a single context** — they are intentionally separate (see `03_BUSINESS_CRITICAL_RULES.md`).

## G. Active Routes / Endpoints

### Backend — 113 endpoints (`/api/*`)

**Auth & Users**:
```
POST   /api/auth/login
POST   /api/auth/register
GET    /api/auth/me
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/users
POST   /api/users
PUT    /api/users/{user_id}
DELETE /api/users/{user_id}
```

**Categories & Menu (POS)**:
```
GET    /api/categories
POST   /api/categories
PUT    /api/categories/{id}
DELETE /api/categories/{id}
POST   /api/categories/reorder
GET    /api/menu-items
POST   /api/menu-items                 ← accepts is_outsourced/outsourced_vendor_id/outsourced_unit_cost
PUT    /api/menu-items/{id}            ← same
DELETE /api/menu-items/{id}
POST   /api/menu-items/reorder
PUT    /api/menu-items/{id}/stock
```

**Orders (POS)**:
```
POST   /api/orders                     ← AUTO-CREATES vendor_transactions for outsourced items
GET    /api/orders/today
GET    /api/orders/history
GET    /api/orders/search/{receipt_id}
```

**Refunds**:
```
POST   /api/refunds                    ← AUTO-REVERSES outsourced vendor payables
GET    /api/refunds/today
GET    /api/refunds/summary
```

**Vendors**:
```
GET    /api/vendors
POST   /api/vendors
PUT    /api/vendors/{vendor_id}
DELETE /api/vendors/{vendor_id}
GET    /api/vendors/{vendor_id}/products
POST   /api/vendors/{vendor_id}/products
DELETE /api/vendors/{vendor_id}/products/{product_name}
GET    /api/vendors/{vendor_id}/transactions
POST   /api/vendors/{vendor_id}/transactions
GET    /api/vendors/{vendor_id}/payments
POST   /api/vendors/{vendor_id}/payments
GET    /api/vendors/{vendor_id}/today
GET    /api/vendors/{vendor_id}/sales-summary    ← NEW (iter 2)
```

**Expenses**: `GET POST /api/expenses`, `DELETE /api/expenses/{id}`, `GET /api/expenses/summary`.

**Reports**: `GET /api/reports/x`, `/api/reports/z`, `/api/reports/z/today`, `/api/reports/z/save`, `/api/reports/history`, `/api/reports/export.csv`, `/api/reports/export.pdf`, `/api/reports/monthly`.

**Settings**: `GET /api/settings`, `PUT /api/settings`.

**Voice (admin)**: `POST /api/voice/transcribe`, `POST /api/voice/intent`.

**Online (customer site + admin)**:
```
GET    /api/public/menu
GET    /api/public/restaurant-info
GET    /api/public/offers
GET    /api/public/events
POST   /api/customer/login
POST   /api/customer/register
GET    /api/customer/me
POST   /api/customer/logout
GET    /api/online-orders
POST   /api/online-orders               ← customer-placed orders
PUT    /api/online-orders/{id}/status   ← admin: accept/reject/preparing/ready/...
PUT    /api/online-orders/{id}/modify
PUT    /api/online-orders/{id}/printed
GET    /api/online-orders/pending-count ← polled by GlobalOrderAlert every 4s
GET    /api/online-orders/{id}
GET    /api/track/{id}
POST   /api/reviews
GET    /api/reviews/{order_id}
GET    /api/events
POST   /api/events                       ← admin
PUT    /api/events/{id}                  ← admin
DELETE /api/events/{id}                  ← admin
POST   /api/event-bookings
GET    /api/offers                       ← admin
POST   /api/offers                       ← admin
PUT    /api/offers/{id}                  ← admin
DELETE /api/offers/{id}                  ← admin
GET    /api/online-settings
PUT    /api/online-settings              ← admin
```

**Payments**: `POST /api/payments/checkout`, `POST /api/payments/webhook`, `POST /api/payments/bank-proof`.

**WhatsApp / SMS**: `GET /api/whatsapp/status`, `POST /api/whatsapp/test`.

**Tunnel (Cloudflared)**: `GET /api/tunnel/status`, `POST /api/tunnel/start`, `POST /api/tunnel/stop`.

**Schedule**: `GET /api/schedule/status`, `POST /api/schedule/run-now`.

**Data import/export**: `GET /api/data/export`, `POST /api/data/import`. **CRITICAL — preserves `_id` for backup migration.**

### Frontend Routes (App.js)

| Path | Component | Auth |
|---|---|---|
| `/` | HomePage | public |
| `/menu`, `/cart`, `/checkout`, `/offers`, `/events` | NEW customer pages | public |
| `/login`, `/register`, `/profile` | Customer auth pages | public/customer |
| `/order/:id/success`, `/order/:id/bank-payment`, `/payment/success`, `/payment/cancel` | Order completion | public |
| `/track/:id`, `/review/:orderId` | Tracking & review | public |
| **`/admin/sign-in`** | UnifiedLoginPage | public (no auth required to view) |
| `/admin/login` | → redirect to `/admin/sign-in` | — |
| `/admin/staff-login` | → redirect to `/admin/sign-in` | — |
| `/admin/legacy-login` | AdminLoginPage (kept for back-compat tests) | — |
| `/admin`, `/admin/dashboard` | AdminDashboard | admin/online_dashboard |
| `/admin/orders` | AdminOrders | admin/online_orders |
| `/admin/menu` | AdminMenu | admin/online_menu |
| `/admin/categories` | AdminCategories | admin/online_menu |
| `/admin/offers` | AdminOffers | admin/online_offers |
| `/admin/events` | AdminEvents | admin/online_events |
| `/admin/settings` | AdminSettings | admin/online_settings |
| `/admin/pos` | POSPage (legacy) | StaffGate perm="pos" |
| `/admin/dashboard-classic` | DashboardPage (legacy) | StaffGate perm="dashboard" |
| `/admin/menu-mgmt` | MenuManagement (legacy) | StaffGate perm="menu" |
| `/admin/inventory` | InventoryPage (legacy) | StaffGate perm="inventory" |
| `/admin/expenses` | ExpensesPage (legacy) | StaffGate perm="expenses" |
| `/admin/vendors` | VendorsPage (legacy) | StaffGate perm="vendors" |
| `/admin/refunds` | RefundsPage (legacy) | StaffGate perm="refunds" |
| `/admin/old-orders` | OldOrdersPage (legacy) | StaffGate perm="orders_history" |
| `/admin/reports` | ReportsPage (legacy) | StaffGate perm="reports_x" |
| `/admin/settings-full` | SettingsPage (legacy) | StaffGate perm="settings" |

## H. Important Files / Modules (top-priority reading)

- `backend/server.py` (lines 65-73 = ALL_PERMISSIONS; 88-130 = MenuItem models with outsourced fields; 492-545 = `create_order` with outsourced hook; 712-790 = `create_refund` with reversal hook; 980-1030 = `/vendors/{id}/sales-summary`; 1852-1880 = `seed_admin`).
- `frontend/src/App.js` — single source of truth for routing.
- `frontend/src/components/AdminLayout.jsx` — sidebar, perm-gating.
- `frontend/src/components/GlobalOrderAlert.jsx` — global notifications.
- `frontend/src/contexts/StaffAuthContext.js` — staff auth, dedicated axios.
- `frontend/src/pages/UnifiedLoginPage.jsx` — single sign-in entry.
- `frontend/src/pages/legacy/POSPage.js` — cashier punching screen.
- `frontend/src/pages/legacy/MenuManagement.js` — has the outsourced product UI.
- `frontend/src/components/legacy/ReceiptModal.js` — canonical invoice template.
