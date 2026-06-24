# 01 — Complete Project Summary

## 1. Current Architecture (high-level)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Public customer site (/, /menu, /cart, ...)         │
│         AuthContext (customer JWT, "knb_token") · CartContext           │
└──────────────────┬──────────────────────────────────────────────────────┘
                   │
                   ↓ same React app, react-router
┌─────────────────────────────────────────────────────────────────────────┐
│  Unified admin shell (/admin/*) — AdminLayout                          │
│  ┌──────────────────────────┐  ┌─────────────────────────────────────┐ │
│  │ POS Operations (FIRST)   │  │ Online Store (SECOND)               │ │
│  │  - /admin/pos            │  │  - /admin (Dashboard)               │ │
│  │  - /admin/menu-mgmt      │  │  - /admin/orders                    │ │
│  │  - /admin/inventory      │  │  - /admin/menu                      │ │
│  │  - /admin/vendors        │  │  - /admin/categories                │ │
│  │  - /admin/expenses       │  │  - /admin/offers                    │ │
│  │  - /admin/refunds        │  │  - /admin/events                    │ │
│  │  - /admin/old-orders     │  │  - /admin/settings                  │ │
│  │  - /admin/reports        │  │                                     │ │
│  │  - /admin/settings-full  │  │  GlobalOrderAlert (top-right pill   │ │
│  │  - /admin/dashboard-cl.. │  │   + loop sound + toast everywhere)  │ │
│  └──────────────────────────┘  └─────────────────────────────────────┘ │
│  StaffAuthContext (staff JWT, "staff_auth_token") guards POS Ops       │
└──────────────────┬──────────────────────────────────────────────────────┘
                   │ /api/* (single FastAPI app, 113 endpoints)
                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  FastAPI backend (server.py, 3,479 lines) — single file by design       │
│   ├─ Auth (/auth/*, /customer/*) · JWT cookies + Authorization headers  │
│   ├─ POS  (/orders, /menu-items, /categories, /refunds, /reports/x|z)   │
│   ├─ Inventory, Expenses, Vendors (with outsourced auto-billing hooks)  │
│   ├─ Online (/online-orders, /reviews, /events, /offers, /public/*)     │
│   ├─ Voice (Whisper STT → GPT-4o parser → TTS) — uses EMERGENT_LLM_KEY  │
│   ├─ Settings, Email/SMTP, Twilio WhatsApp, Cloudflare tunnel           │
│   ├─ APScheduler (daily Z-report email)                                 │
│   └─ Data export/import (preserves _ids for backup/migration)           │
└──────────────────┬──────────────────────────────────────────────────────┘
                   ↓
              MongoDB (single DB) — 21 collections
```

## 2. Backend Structure

**File**: `/app/backend/server.py` (3,479 lines, single file by design — see § Tech debt before splitting)

**Sections** (in order):
1. Imports + JWT helpers (`create_access_token`, `verify_password`, `get_current_user`)
2. `ALL_PERMISSIONS` (19 entries: 13 POS + 6 online_*) and `ADMIN_PERMISSIONS`
3. **Pydantic models** (~25 models): MenuItem, Order, Refund, Vendor, Expense, Settings, Customer, OnlineOrder, Review, Event, Offer, etc. **Outsourced fields** are on `MenuItemCreate` / `MenuItemUpdate`: `is_outsourced`, `outsourced_vendor_id`, `outsourced_unit_cost`.
4. **Auth endpoints**: `/auth/login`, `/auth/register`, `/auth/me`, `/auth/logout`, `/auth/refresh`, plus customer mirror at `/customer/*`.
5. **POS endpoints**: categories, menu-items (CRUD + reorder + stock update), orders (create with **auto-vendor-payable hook**), today/history/search.
6. **Voice assistant** (uses `emergentintegrations` if `EMERGENT_LLM_KEY` set; else 503).
7. **Refunds** (with **auto-reverse vendor-payable hook**).
8. **Expenses** (today/summary/CRUD).
9. **Vendors** (CRUD), **transactions**, **payments**, **`/sales-summary`** endpoint (aggregates outsourced auto-billed vs reversed vs paid).
10. **Reports** X/Z (today, history, monthly, CSV/PDF export).
11. **Inventory** stock updates.
12. **Settings** (single doc, key="global").
13. **Online orders** (create, list, accept/reject/modify/print, pending-count, customer auth).
14. **Public** endpoints (homepage menu, restaurant info, offers, events).
15. **Reviews** (post-delivery customer reviews).
16. **Events / Event-bookings**.
17. **Offers / Discount engine**.
18. **Payments** (Stripe + bank-payment proof upload).
19. **WhatsApp** (Twilio + local Node service status).
20. **Cloudflare tunnel** (start/stop/status — Windows on-prem only).
21. **APScheduler daily Z-report**.
22. **Data export/import**.
23. **`seed_admin()`** — runs on every startup, syncs admin user perms to current `ALL_PERMISSIONS`.

**Single-file rationale**: deliberate. Splitting was deferred (5+ iterations) because tests are pinned to import paths and refactor risk is high. See `02_IMPLEMENTATION_STATUS.md` § Tech Debt.

## 3. Frontend Structure

**Stack**: CRA-based, React 19, yarn, Tailwind, shadcn/ui (`components/ui/`), react-router v7, sonner, lucide-react.

```
/app/frontend/src/
├── App.js                        # Single router root, wraps providers
├── index.js / index.css / App.css
├── lib/api.js                    # axios.create instance for online routes (knb_token / knb_admin_token interceptor)
├── contexts/
│   ├── AuthContext.js            # Customer JWT — /api/customer/*, key "knb_token"
│   ├── StaffAuthContext.js       # Staff JWT — /api/auth/*, key "staff_auth_token", dedicated staffAxios instance
│   └── CartContext.js            # Customer cart state
├── components/
│   ├── AdminLayout.jsx           # Unified admin shell (POS Ops first, Online Store second)
│   ├── GlobalOrderAlert.jsx      # NEW — polls /online-orders/pending-count every 4s, rings on every admin page
│   ├── Layout.jsx                # Customer-side layout
│   ├── Header.jsx, Footer.jsx, FloatingCart.jsx, FloatingWhatsApp.jsx
│   ├── ThermalReceipt.jsx        # Online-order receipt (NOT yet unified with POS — see roadmap #10)
│   ├── PeopleAlsoBuy.jsx
│   ├── ui/                       # shadcn/ui primitives (button, dialog, input, select, etc.)
│   └── legacy/                   # Components ported from OLD POS
│       ├── ColorPicker.js
│       ├── ReceiptModal.js       # POS-style printable receipt (CANONICAL invoice template)
│       └── VoiceAssistantModal.js
├── pages/                        # Customer-facing site (NEW)
│   ├── HomePage.jsx, MenuPage.jsx, CartPage.jsx, CheckoutPage.jsx
│   ├── LoginPage.jsx (customer), RegisterPage.jsx, ProfilePage.jsx
│   ├── OffersPage.jsx, EventsPage.jsx, ReviewPage.jsx
│   ├── OrderSuccessPage.jsx, BankPaymentPage.jsx, PaymentResultPage.jsx
│   ├── TrackingPage.jsx
│   └── UnifiedLoginPage.jsx      # ★ Unified staff/admin sign-in (/admin/sign-in)
├── pages/admin/                  # Online-store admin (NEW; uses lib/api.js + knb_admin_token)
│   ├── AdminDashboard.jsx, AdminOrders.jsx, AdminMenu.jsx
│   ├── AdminCategories.jsx, AdminOffers.jsx, AdminEvents.jsx
│   ├── AdminSettings.jsx
│   └── AdminLoginPage.jsx        # Legacy login page (now hidden at /admin/legacy-login; do NOT delete — back-compat)
└── pages/legacy/                 # 11 OLD operational POS pages (preserved verbatim from old fully-operational repo)
    ├── POSPage.js                # Cashier punching screen — uses staffAxios via withCredentials cookie
    ├── MenuManagement.js         # Categories + items CRUD; HAS outsourced product UI block
    ├── InventoryPage.js, VendorsPage.js, ExpensesPage.js
    ├── RefundsPage.js, OldOrdersPage.js, ReportsPage.js
    ├── SettingsPage.js           # Massive (1,347 lines) — full operational settings (email/SMTP, WhatsApp, Cloudflare, scheduling, receipt formatting)
    ├── DashboardPage.js          # Classic dashboard
    └── StaffLoginPage.js         # Old staff login (now hidden; /admin/staff-login redirects to /admin/sign-in)
```

## 4. Database Structure (single MongoDB DB)

**21 collections** (do NOT rename or drop):

| Collection | Owner system | Notes |
|---|---|---|
| `users` | OLD POS | Staff users; JWT auth source. **`permissions: List[str]`** (synced to ALL_PERMISSIONS for admin on every startup). |
| `customers` | NEW | Customer accounts; separate auth at `/api/customer/*`. |
| `categories` | OLD | Menu categories. Has `sort_order`, `color`. |
| `menu_items` | OLD (extended) | Menu items. Extended with: `variations`, `discount_type`, `discount_value`, `is_bestseller`, `is_popular`, `image_url`, `image_type`, `description`, `related_item_ids`, **`is_outsourced`, `outsourced_vendor_id`, `outsourced_unit_cost`**. |
| `orders` | OLD | POS orders. Items: `[{item_id, name, price, original_price, quantity}]`. **Outsourced items auto-spawn `vendor_transactions` rows.** |
| `online_orders` | NEW | Customer-website orders. Statuses: `pending, accepted, preparing, ready, out_for_delivery, delivered, rejected, cancelled`. |
| `expenses` | OLD | Daily expenses. `date` (YYYY-MM-DD) + `amount` + `category`. |
| `vendors` | OLD | Vendor master. Used for outsourcing. |
| `vendor_transactions` | OLD | Per-vendor billed lines. **Auto-fields**: `auto_source` ∈ `"order"` / `"refund"` / `null` (manual), `source_order_id`, `source_refund_id`. **Refund reversals stored as NEGATIVE total**. |
| `vendor_payments` | OLD | Per-vendor payment records. |
| `refunds` | OLD | Refund records with `items: [{item_id, name, price, quantity}]`. **Outsourced items auto-create reversal in vendor_transactions.** |
| `z_reports` | OLD | End-of-day Z reports (manual + scheduled). |
| `settings` | OLD (extended) | Single doc with `key="global"`. Holds tax rates, restaurant info, FoodPanda commission, receipt formatting, schedule, SMTP, WhatsApp config. |
| `online_settings` | NEW | Online-store-specific settings (delivery fee, free-delivery threshold, payment methods, etc.). |
| `reviews` | NEW | Customer reviews after delivery. |
| `events` | NEW | Restaurant events (catering / private bookings). |
| `event_bookings` | NEW | Customer bookings of events. |
| `offers` | NEW | Promotional offers (banner + discount rules). |
| `payment_transactions` | NEW | Stripe + bank-transfer payment records. |
| `uploaded_files` | NEW | Bank-payment proof images, etc. |
| `scheduled_runs` | OLD | APScheduler bookkeeping. |
| `tunnel` | OLD | Cloudflare tunnel state (URL, last started_at). |

**ID convention**: backend converts MongoDB `_id` (`ObjectId`) → `id` (string) on every read. NEVER expose `_id` in JSON responses (always `pop("_id")` or use `{"_id": 0}` projection).

**Date convention**: `date` field is `YYYY-MM-DD` string for date-range queries; `created_at` is ISO 8601 with `+00:00`.

## 5. Auth Flow

**Three coexisting auths** — DO NOT merge them:

### A. Customer (`/api/customer/*`)
- localStorage key: `knb_token`
- Used by: customer site (`/`, `/menu`, `/cart`, `/checkout`, `/login`, `/profile`, etc.)
- Implementation: `frontend/src/contexts/AuthContext.js` + `frontend/src/lib/api.js` (axios.create instance with interceptor)
- Endpoints: `POST /customer/login`, `POST /customer/register`, `GET /customer/me`, `POST /customer/logout`

### B. Staff / POS (`/api/auth/*`)
- localStorage key: `staff_auth_token`
- Used by: all `/admin/pos`, `/admin/menu-mgmt`, etc. (legacy POS pages)
- Implementation: `frontend/src/contexts/StaffAuthContext.js` (dedicated `staffAxios` instance + interceptor)
- Endpoints: `POST /auth/login`, `POST /auth/register`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/refresh`
- **Backend**: cookies (`access_token`, `refresh_token`, HttpOnly) + Authorization header — both supported
- **Login response** includes `permissions: List[str]` (synced to `ALL_PERMISSIONS` for admin)

### C. Online-store admin token
- localStorage key: `knb_admin_token`
- Used by: `pages/admin/*` (online-store admin) — same backend `/auth/login` but stored under different key for historical reasons
- Implementation: `frontend/src/lib/api.js` (interceptor checks knb_admin_token then falls through to knb_token)

### D. Unified login at `/admin/sign-in`
- Single form, calls `staffAuth.login()`, then **mirrors the token to BOTH** `staff_auth_token` AND `knb_admin_token`.
- After success: `window.location.replace(target)` — hard redirect. Target chosen by `pickLandingRoute(role, permissions)` (admin → `/admin/pos`).
- `/admin/login` and `/admin/staff-login` redirect to `/admin/sign-in` (back-compat).
- File: `frontend/src/pages/UnifiedLoginPage.jsx`.

### E. Permission gating
- Backend: each protected endpoint calls `get_current_user(request)` then checks `user.get("role") == "admin" or perm in user.permissions`.
- Frontend: `<StaffGate perm="...">` in App.js wraps each operational route. AdminLayout sidebar filters items by `user.permissions`.
- Available permissions (`ALL_PERMISSIONS`): `dashboard, pos, menu, menu_edit, inventory, reports_x, reports_z, orders_history, settings, expenses, vendors, reprint_invoices, refunds, online_dashboard, online_orders, online_menu, online_offers, online_events, online_settings`.

## 6. Offline Sync Architecture

**Important**: this is NOT browser-side offline (no service worker, no IndexedDB sync). It is **on-premise local-server architecture**:

- Restaurant runs MongoDB + Python + Node frontend on a local Windows PC.
- `/app/windows-setup/` contains: `1_INSTALL.bat`, `2_START_RestoPOS.vbs`, `STOP_RESTOPOS.bat`, `cloudflared.exe`, `README.txt`.
- Cashier's tablet/laptop opens the LAN URL (or the Cloudflared tunnel URL when remote).
- All transactions go straight to local Mongo — instant, no cloud round-trip.
- When internet drops, POS still works (it never required internet for sales).
- Cloudflared tunnel is OPTIONAL — for remote owner dashboard access. Backend has `/api/tunnel/*` endpoints to start/stop/status.
- Settings page (`/admin/settings-full`) UI for tunnel + email + WhatsApp.

**For Emergent cloud deploy**: the offline part doesn't apply (cloud is always-online). The Windows scripts are preserved for restaurants that want to run on-prem.

## 7. Permissions System

19 permissions in `ALL_PERMISSIONS` (server.py:65-73). Admin always has all 19 (synced on every startup). Cashiers default to `["pos", "reports_x"]`.

**How to add a new permission**:
1. Add string to `ALL_PERMISSIONS` in server.py.
2. On next backend restart, `seed_admin()` automatically grants it to admin.
3. Add to `OPS_NAV` or `ONLINE_NAV` in `AdminLayout.jsx` with the `perm` field.
4. Add `<Op perm="new_perm">` wrapper in `App.js` for any new route.
5. On endpoint, check: `if user.get("role") != "admin" and "new_perm" not in user.get("permissions", []): raise 403`.

## 8. Notification System

`<GlobalOrderAlert/>` mounted at the top of `AdminLayout`. Every 4 seconds it polls `GET /api/online-orders/pending-count` and:

- If `pending_count > 0` and not on `/admin/orders`: shows top-right red pill (`data-testid="global-pending-pill"`) + plays loop audio (`/order-alert.wav`).
- On a NEW order (different `latest_id` than previous tick): shows toast with "View" action.
- Mute toggle persists in `localStorage["knb_admin_muted"]`.
- Auto-silences on `/admin/orders` (that page has its own richer alerting via `pages/admin/AdminOrders.jsx`).
- Audio autoplay-blocked browsers: shows a "Click to enable order sound" banner.

**File**: `frontend/src/components/GlobalOrderAlert.jsx` (140 lines).

## 9. Vendor Automation Logic (outsourced products)

**Use case**: e.g. "Pepsi 500ml" sold from "Khokha" vendor — every sale auto-creates a payable.

**Flow** (server.py:`create_order`, `create_refund`):

```
ORDER CREATED with item where is_outsourced=true
  ↓
For each outsourced item, group by vendor_id
  ↓
INSERT into vendor_transactions:
  { vendor_id, items: [{name, quantity, unit_price, menu_item_id}],
    total: qty * unit_cost, auto_source: "order",
    source_order_id, notes: "Auto: order #ABC123" }

REFUND CREATED with same item
  ↓
For each outsourced item in refund.items, look up menu_items
  ↓
INSERT into vendor_transactions (NEGATIVE total):
  { ..., total: -qty*unit_cost, auto_source: "refund", source_refund_id }
```

**Sales summary endpoint** (`GET /api/vendors/{vid}/sales-summary?start_date=&end_date=`):

```json
{
  "vendor_id": "...",
  "auto_billed_from_orders": 240.0,    // sum of auto_source="order"
  "auto_reversed_from_refunds": -80.0, // sum of auto_source="refund" (negative)
  "manual_billed": 0.0,                 // sum of auto_source=null/missing
  "total_billed": 160.0,                // net
  "total_paid": 0,
  "balance": 160.0,
  "products": [{"name": "Pepsi 500ml", "quantity": 2, "total": 160}],
  "transactions_count": 2,
  "payments_count": 0
}
```

**UI**: `MenuManagement.js` Item Dialog has an "Outsourced product" checkbox + vendor select + cost input.

## 10. Invoice System (NOT yet unified — see roadmap #10)

Currently TWO templates:

| Used by | File | Notes |
|---|---|---|
| **POS terminal** (`/admin/pos`) | `components/legacy/ReceiptModal.js` | **CANONICAL** template. Uses `settings.receipt_*` formatting (font, sizes, paper width, header/footer), prints via hidden iframe. Sticky Print/Close buttons (iter 2). |
| **Online orders** (`/admin/orders` Print Invoice) | `components/ThermalReceipt.jsx` | Different template, no settings integration. Should be replaced by ReceiptModal-based template. |

**Plan for unification** (roadmap #10):
- Generalize `ReceiptModal` to accept either a POS order or an online order shape.
- Add fields: customer name/phone/address, delivery fee, channel (FP1/FP2/web).
- Replace `ThermalReceipt` usage in `AdminOrders.jsx`.
- Single source of truth for "what an invoice looks like".

## 11. Deployment Structure

### Emergent platform (current)
- Backend on `0.0.0.0:8001` (supervisor-managed)
- Frontend on `0.0.0.0:3000` (CRA dev server, supervisor-managed)
- MongoDB local at `mongodb://localhost:27017` / `DB_NAME=test_database`
- Public preview URL: `https://order-management-139.preview.emergentagent.com`
- Kubernetes ingress routes `/api/*` → backend, everything else → frontend
- `REACT_APP_BACKEND_URL` is the public preview URL (used by frontend at runtime)
- DO NOT change ports/URLs/keys in `.env` — protected by platform contract

### Windows on-prem (legacy, still working)
- `/app/windows-setup/1_INSTALL.bat` installs MongoDB Community + Python deps + node deps
- `/app/windows-setup/2_START_RestoPOS.vbs` launches Mongo + uvicorn + CRA dev server + cloudflared
- `/app/whatsapp-service/` runs `node index.js` for WhatsApp Web QR-based sending
- Cashiers point browser at `http://<windows-ip>:3000`
