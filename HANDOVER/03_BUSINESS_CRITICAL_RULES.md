# 03 — Business-Critical Rules

> **Read this BEFORE every change. Violations have caused regressions in past iterations.**

## A. What MUST NEVER Be Rewritten

### A1. The 11 legacy operational POS pages (`frontend/src/pages/legacy/`)
These are **byte-for-byte preserved** from the OLD fully-operational system. Cashiers depend on the exact workflows. Specifically:

- `POSPage.js` — cashier punching, FoodPanda overrides, voice assistant, discount/price-edit dialogs.
- `MenuManagement.js` — categories + items CRUD with drag-and-drop reordering and color picker.
- `InventoryPage.js`, `VendorsPage.js`, `ExpensesPage.js`, `RefundsPage.js`, `OldOrdersPage.js`, `ReportsPage.js`.
- `SettingsPage.js` (1,347 lines) — comprehensive operational settings (email/SMTP, WhatsApp, tunnel, scheduling, receipt format).

**Allowed**: minor additions (e.g., the outsourced product UI block in MenuManagement was an additive change, not a rewrite).
**Forbidden**: refactoring imports, restructuring components, changing behavior of existing fields.

### A2. The 71 OLD backend endpoints (server.py)
Every endpoint that existed in the OLD `KARACHINASEEBBIRYANIANDMURGPULAO-devel` is preserved verbatim. Their request/response shapes are part of the cashier-tablet contract. **Adding** optional fields is fine; **changing** existing field semantics is forbidden.

### A3. Database schema (21 collections)
- Existing collections (`users`, `settings`, `categories`, `menu_items`, `orders`, `expenses`, `vendors`, `vendor_transactions`, `vendor_payments`, `refunds`, `z_reports`, `scheduled_runs`, `tunnel`) — DO NOT rename, drop, or change field types.
- New fields (e.g. `is_outsourced`) must be **optional** with sensible defaults.
- `_id` is `ObjectId` (Mongo native). DO NOT switch to `id: str = uuid()`.

### A4. The two AuthContexts (StaffAuthContext + AuthContext)
- They MUST stay separate. Customer JWT (`knb_token`) and staff JWT (`staff_auth_token`) serve different user populations (customers cannot access POS; staff cannot place customer orders).
- DO NOT merge them into a single context.
- The unified login at `/admin/sign-in` is for the STAFF/admin side only. Customers continue at `/login`.

### A5. The on-premise install path (`/app/whatsapp-service/`, `/app/windows-setup/`)
- Restaurants run this on Windows PCs. The scripts launch Mongo, FastAPI, CRA dev server, cloudflared.
- DO NOT delete these folders.
- DO NOT change backend port from 8001 or frontend port from 3000 (the scripts hardcode them).

### A6. The Emergent platform .env contract
- `MONGO_URL`, `DB_NAME` in `backend/.env` — protected, do not change.
- `REACT_APP_BACKEND_URL` in `frontend/.env` — protected, do not change.
- Backend MUST bind to `0.0.0.0:8001`; frontend MUST bind to `0.0.0.0:3000`. Supervisor manages restarts.
- All API calls from frontend MUST be prefixed `/api/...` so the Kubernetes ingress routes them correctly.

## B. Business-Critical Logic (the four crown jewels)

### B1. POS order creation (`server.py:create_order`)
- Decrements `menu_items.stock` per item.
- Inserts into `orders` with `cashier_id`, `cashier_name`, `date` (YYYY-MM-DD), `created_at` (ISO).
- **Auto-creates `vendor_transactions`** for any outsourced item (groups by vendor_id, computes `qty * outsourced_unit_cost`, defaults to selling price if no cost set).
- Returns the order dict with `id` (string).
- **Receipt printing depends on this exact response shape.**

### B2. Refund (`server.py:create_refund`)
- Inserts into `refunds` with `refund_no` (RF-NNNNN format).
- **Auto-creates NEGATIVE `vendor_transactions`** for any outsourced item in `refund.items` (with `auto_source: "refund"`, `source_refund_id`, `source_order_id`).
- This pair (order auto-bills + refund auto-reverses) is the foundation of vendor sales-summary integrity.

### B3. Daily Z-report (`server.py:scheduled job + /reports/z/save`)
- APScheduler runs at 02:15 Asia/Karachi every day.
- Computes total_sales, expenses, refunds, payment-type breakdown.
- Saves to `z_reports` collection.
- Optionally emails the report (if SMTP configured).
- Cashiers also manually trigger via Reports page.
- **Z-report shape is part of the SettingsPage UI contract.**

### B4. Settings document (`settings` collection, single doc with `key="global"`)
- Holds tax_rate, online_tax_rate, foodpanda1_tax_rate, foodpanda2_tax_rate, currency, restaurant_*, receipt_*, schedule_*, smtp_*.
- Read by POS for tax computation, by ReceiptModal for formatting, by AdminLayout for branding.
- Default seeded on first startup (server.py `seed_admin`).
- Changes are PUT-merged (`{"$set": ud}`).

## C. What Old Systems Were Preserved

| OLD asset | Status | Location |
|---|---|---|
| FastAPI backend (1,750 LOC original) | ✅ Preserved verbatim within superset (server.py 3,479 LOC) | `/app/backend/server.py` |
| 11 React POS pages | ✅ Preserved | `/app/frontend/src/pages/legacy/` |
| 3 React POS components (ColorPicker, ReceiptModal, VoiceAssistantModal) | ✅ Preserved | `/app/frontend/src/components/legacy/` |
| Windows install scripts (cloudflared.exe, BAT, VBS) | ✅ Preserved | `/app/windows-setup/` |
| Node WhatsApp Web bridge | ✅ Preserved | `/app/whatsapp-service/` |
| `seed_admin` admin@restaurant.com / admin123 default | ✅ Preserved | `server.py` |
| `data/export` + `data/import` (preserves `_id`) | ✅ Preserved | server.py — used for OLD → NEW migration |

## D. Backward-Compatibility Requirements

1. **Old cashier-tablet bookmarks** — staff might have bookmarked `/admin/staff-login` or `/admin/login`. Both must continue to work (currently redirected to `/admin/sign-in`). DO NOT remove the redirect routes.

2. **Old OS-level scripts** — Windows VBS scripts hit `http://localhost:8001/api/categories` and `http://localhost:3000`. DO NOT change these ports.

3. **Existing customer accounts** — customers registered on old `/api/customer/*` continue to log in at `/login` with their existing email + password.

4. **Existing menu_items in production DB** — they don't have `is_outsourced` field. Backend reads it as `bool(i.get("is_outsourced", False))` — defaults to false. DO NOT introduce required fields.

5. **Existing orders in production DB** — they don't have `outsourced_unit_cost` references. Reports / dashboards must continue to render them.

6. **Receipt printing** — settings.receipt_* fields control formatting. Cashiers have specific paper widths (300px default). DO NOT remove or rename these fields.

## E. APIs / Database Structures That Must Remain Stable

### Stable forever (Tier 1)
- `POST /api/auth/login` — response: `{id, email, name, role, permissions, token}`
- `POST /api/orders` — request: `{items, payment_type, subtotal, tax, total, ...}`; response: `{id, items, payment_type, subtotal, tax, total, discount_amount, cashier_name, created_at}`
- `GET /api/menu-items` — response: array of `{id, name, price, price_fp1, price_fp2, category_id, stock, ...}`
- `GET /api/categories` — response: array of `{id, name, color, sort_order}`
- `GET /api/settings` — single object (the global settings doc)
- `GET /api/reports/x`, `/z` — see SettingsPage to understand the shape
- `GET/POST /api/customer/login` — customer site depends on this exact contract

### Stable while format unchanged (Tier 2)
- `vendor_transactions` document shape (must include `auto_source`, `source_order_id`, `source_refund_id` for new rows; legacy rows without these fields still work).
- `online_orders` status enum: `pending, accepted, preparing, ready, out_for_delivery, delivered, rejected, cancelled`. Adding new statuses requires updating AdminOrders.jsx STATUSES const.
- `ALL_PERMISSIONS` list: only ADD new permissions; never remove existing ones (would break role assignments in production DB).

## F. Forbidden Operations (will break production)

| Action | Why forbidden |
|---|---|
| Removing `whatsapp-service/` or `windows-setup/` | Breaks on-prem deployments. |
| Renaming any `db.*` collection | Production data lives there. |
| Switching from `bcrypt` to another hash | Existing user `password_hash` values would become unverifiable. |
| Changing `JWT_SECRET` after deploy | All in-flight tokens become invalid; all users forcibly logged out. |
| Removing the `/admin/login` and `/admin/staff-login` redirects | Old bookmarks 404. |
| Deleting `pages/legacy/` or `components/legacy/` | Cashiers lose POS. |
| Changing `MONGO_URL` or `DB_NAME` in `.env` | Emergent platform contract. |
| Changing backend port from 8001 / frontend port from 3000 | Kubernetes ingress + Windows scripts break. |
| Adding required fields to existing Pydantic models | Would 422 on existing payloads from cashier tablets. |
| Introducing breaking changes to `POST /api/orders` or `POST /api/refunds` | These auto-create vendor transactions; downstream vendor accounting depends on stability. |
