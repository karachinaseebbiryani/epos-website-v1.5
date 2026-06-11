# PRD — Karachi Naseeb Biryani & Murg Pulao (POS + Online Website)

## Original Problem Statement
Extend the EXISTING Karachi Naseeb POS system without breaking POS printing or the legacy order schema. Add a Smart Order Alert system that ringing-loops on every new online order until staff Accept / Reject / Modify, plus a customer-facing live status experience.

User choices captured (2026-05-06):
- Both apps (epos website + POS staff panel) unified into one repo (the EPOS bundle was the canonical app — already had AdminLayout + customer site).
- Real-time strategy: **Polling every 4 seconds** (chose option B from 3–5s window).
- Customer notifications: In-app live status + WhatsApp via existing Twilio integration (already implemented for status updates).
- Built-in notification sound (a synthesised 1.2-second chime — `/order-alert.wav`, ~52KB).
- Preserve existing UI; only extend with new buttons / modals / banners.

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`) + MongoDB (`online_orders` collection extended with new fields). Single port 8001 via supervisor.
- **Frontend**: React 19 + Tailwind + shadcn/ui + sonner toasts + lucide icons + react-router-dom. Customer site at `/`, admin panel at `/admin`. Polling for both.
- **Integrations (pre-existing, untouched)**: Twilio WhatsApp (env: TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM — left empty in preview, helper silently no-ops), SMTP for reports, optional Emergent LLM key for voice assistant.

## User Personas
- **Restaurant Staff (Admin)**: Receives an audible ring on new online orders, accepts / rejects / modifies them in seconds.
- **Customer**: Places an order from the public site, gets a tracking link, watches live status (pending → accepted → preparing → ready → out_for_delivery → delivered) with WhatsApp updates.

## Core Requirements
1. Continuous looping ringing alert on POS while there are pending orders.
2. Accept / Reject / Modify actions for every pending order.
3. Reject reasons: out_of_stock, closed, other (with free-text note).
4. Modify items: change qty / price, remove items; staff phones the customer, then taps Confirm Modified Order.
5. Customer notified via WhatsApp + tracking page on every state change.
6. **Strict compatibility** with existing `/api/orders` POS endpoint and online-orders schema (no fields removed, only new ones added).

## What's been implemented (2026-05-06)
- **Backend new endpoints**:
  - `GET /api/online-orders/pending-count` — lightweight polling target with `{pending_count, latest_id, latest_at}`.
  - `POST /api/online-orders/{id}/accept` — sets `status='accepted'`, `accepted_at`, `accepted_by`; fires WhatsApp.
  - `POST /api/online-orders/{id}/reject` — body `{reason}`; sets `status='rejected'`, `rejection_reason`, `rejected_at`, `rejected_by`; fires WhatsApp.
  - `PUT /api/online-orders/{id}/modify` — body `{items}`; recomputes subtotal+total preserving discount + delivery fee; sets `modified=true`, `modification_pending=true`. Status stays `pending` until confirmation.
  - `POST /api/online-orders/{id}/confirm-modified` — flips to `accepted`; clears `modification_pending`; fires WhatsApp.
  - `PUT /api/online-orders/{id}/status` valid set extended with `accepted` and `rejected`.
  - `GET /api/track/{id}` (public) now also returns `modified`, `modification_pending`, `rejection_reason`, `accepted_at`.
- **Backend WhatsApp messages** updated in `_format_status_update` for accepted/rejected/modified labels (in English with friendly emoji + tracking link).
- **Admin `/admin/orders` page** (`AdminOrders.jsx`):
  - 4-second polling on `/online-orders/pending-count` + list refresh.
  - Looping `<audio>` element backed by `/order-alert.wav`. Auto-starts on first pending order; stops the moment count returns to 0; mute toggle.
  - Pulsing red ring + "NEW" tag on pending cards; "MODIFIED" amber tag when applicable; Rejection reason banner.
  - Accept (green) / Reject (red) / Modify (amber) action buttons.
  - Reject modal with the three preset reasons + free-text "other" note.
  - Modify modal with qty +/- buttons, qty number input, price input, remove icon, live total recalculation, **Save Changes → Confirm Modified Order** two-step flow.
  - Browser-autoplay-blocked fallback banner ("Tap to allow").
- **Customer `/track/{id}` page** (`TrackingPage.jsx`):
  - 5-second polling.
  - Status banners: `pending` (amber "Waiting for restaurant confirmation…"), `accepted` (emerald), `rejected` (red with reason), `modified` (amber tag on items), `cancelled` (neutral).
  - Step indicator now includes "Accepted" between "Order Placed" and "Preparing".
  - "UPDATED" tag shown next to Order Items list when `modified=true`.

## Prioritized Backlog
- **P1**: Wire real Twilio creds in production env so WhatsApp messages actually send.
- **P2**: Sound profile selector (let staff pick from 2–3 chimes in Settings).
- **P2**: SLA timer per pending order (e.g. red after 2 minutes unaccepted).
- **P3**: Push notification (web) when POS tab is in background.
- **P3**: Optional auto-reject if not actioned within X minutes (config in Settings).
- **P3**: Refactor backend `server.py` (3079 lines) into routers per the testing-agent's code-review note.

## Testing
- 24/24 pytest backend tests pass (`/app/backend/tests/test_smart_alert.py`).
- 25/25 reviewed frontend flows pass (admin login, audio element, ringing indicator, all status filters, accept/reject/modify modals, mute toggle, all four customer tracking states).
- POS printing untouched — `ReceiptPrint` and `/online-orders/{id}/printed` endpoint regression-tested.

## Iteration 6 — Variations + Mobile Density + Visible Mobile Menu CTA (2026-05-07)
**Why:** User reported: (1) need size variations on menu items with separate prices, (2) menu images too big on mobile (only 2 fit per screen), (3) Menu link hidden behind hamburger on mobile.

**What's been added:**
- **Backend** — `MenuItemVariation` Pydantic model. `MenuItemCreate` and `MenuItemUpdate` now accept `variations: List[{name, price}]`. `/api/menu-items` (admin) and `/api/menu` (public) both serialize the field. Saving an empty list `[]` clears variations. Order POST schema unchanged (still `item_id/name/price/quantity`).
- **Customer MenuPage** — density toggle (`compact` / `comfortable`) persisted to `localStorage:knb_menu_density_v1`. Compact view default: 2 cols on mobile (square images), 3 on tablet, 4 on desktop, 5 on xl. Comfortable view: original spacious layout with descriptions. Items with variations show "**N SIZES**" badge + "**From Rs. X**" pricing.
- **VariationPicker** — bottom-sheet on mobile, centered modal on desktop. Radio list of `{name → price}`, quantity stepper, live total in CTA ("Add to Cart · Rs. 350"). Items without variations skip the picker and add directly.
- **CartContext** — items now keyed by `lineKey` = `item_id::variation_name` (or just `item_id` if no variation). Different sizes = separate cart lines, each with their own qty.
- **Header** — prominent red "🍴 Menu" pill (`data-testid='mobile-menu-quick-link'`) visible next to the cart icon on mobile (`md:hidden`). No need to tap the hamburger.
- **AdminMenu** — Edit modal has a "Size variations" repeater (Add row, name + price inputs, remove). Saved variations show as chips on the list card.

**Tests:** Backend 12/12 pytest pass (incl. clearing variations, missing variations defaults to `[]`, regression on existing CRUD). Iteration 5 review/smart-alert regression: 17/17 still pass. Frontend verified by testing subagent on mobile (390×844) and desktop. Cart truncation fix applied (`break-words` + variation label) so customers can read "Chicken Biryani (Half)" without clipping.

**Known remaining items in v3 problem statement (next iterations):**
- F4 (partial) — Add/Edit/Delete categories UI buttons (CRUD endpoints already exist), upload-from-PC vs paste-URL toggle for images.
- F5 — Drag & drop sorting for categories + items (backend endpoints already exist).
- F6 — Item-level + global discount engine (`discount_type`, `discount_value`).
- F7 — "People also buy" upsell on cart/checkout (`related_items`).
- F8 — Free-delivery progress message ("Add Rs X more for free delivery").
- F9 — Smart Offer Engine (combos, time-based, BOGO).
- Frontend polish: bestseller / discount badges, crossed-out original price.

## Iteration 7 — Categories CRUD + Drag-Drop + Discount Engine + Free-Delivery Progress + Bestseller/Discount Polish + Checkout Auth Panel (2026-05-07)
**Why:** User requested F4 (category CRUD + image upload from PC), F5 (drag-drop sort categories + items), F6 (discount engine), F8 (free-delivery progress bar), polish (bestseller/discount badges + crossed-out original price), AND a checkout panel for Sign In / Create Account / Continue as Guest with persistence of guest data across sessions.

**What's been added:**
- **Backend** — MenuItem now has `discount_type` ('percentage'|'fixed'|null) + `discount_value`, `is_bestseller`, `image_type` ('upload'|'url'), and the public `/api/menu` computes the sale price + returns `original_price`/`discount_percent`. OnlineSettings now has `free_delivery_min_subtotal` (default 0 = disabled). `calculate_delivery_fee()` accepts a `subtotal` argument and unlocks free delivery either by free-radius OR threshold (returns `free_delivery_reason`). `POST /api/delivery/quote` accepts `subtotal`. Online-orders create passes the cart subtotal so the right delivery fee is saved.
- **Bug fix** (testing subagent) — `POST /api/menu-items` was leaking a non-serializable `ObjectId` after `motor` mutated the doc. Now excluded from the response spread.
- **Admin Categories** (NEW page `/admin/categories`) — CRUD with @dnd-kit sortable list, color picker, item-count display, Add Category modal. Drag-drop POSTs `/categories/reorder`. Sidebar + bottom mobile nav links added.
- **Admin Menu** — drag handles + badges (BESTSELLER red, POPULAR yellow, "X% OFF" green) on each card. Edit modal extended with: image **URL ↔ Upload-from-PC** toggle (file → JPEG data URI, max 900px width, 0.82 quality, 4 MB cap), Item Discount section with live sale-price preview, Bestseller checkbox.
- **Customer MenuPage** — `Badges` component renders discount + bestseller stacked top-right; `PriceBlock` shows crossed-out `Rs. {original}` next to sale price for items with active discount. Compact + Comfortable cards both updated.
- **Customer CartPage** — `FreeDeliveryProgress` component (only renders when `free_delivery_min_subtotal > 0`): amber "Add Rs. X more for FREE delivery" with animated fill bar that flips emerald with sparkles when threshold met.
- **Customer CheckoutPage** — `AuthChoicePanel` shown to first-time guests with three CTAs: Sign In / Create Account (both deep-link with `?redirect=/checkout`) / Continue as Guest. Guest data persisted to `localStorage:knb_guest_v1` so returning guests skip the panel and get pre-filled name/phone/address. `GuestStrip` banner offers "Create account" + "Clear saved info". Delivery quote re-runs whenever subtotal changes (so threshold flips mid-checkout).
- **LoginPage / RegisterPage** — honour `?redirect=...` query param (used by AuthChoicePanel deep-links).

**Tests:** Backend 15/16 pytest (1 skipped, no real failures) + critical ObjectId-leak fix verified. Frontend admin paths 100% verified by testing subagent (drag handles, badges, form testids, categories CRUD). Visual screenshots confirm every flow. Iterations 4–6 still regression-clean.

**Known remaining items in v3 problem statement:**
- F7 — "People also buy" upsell on cart (deferred earlier, still pending).
- F9 — Smart Offer Engine (combos, time-based, BOGO) — biggest of all, a separate iteration on its own.

## Iteration 8 — F7 "People Also Buy" Upsell (2026-05-07)
**Why:** User asked for F7 + server.py refactor. Refactor was deferred to its own dedicated iteration to avoid breaking a 3326-line file mid-feature.

**What's been added:**
- **Backend** — `MenuItemCreate` / `MenuItemUpdate` accept `related_item_ids: List[str]`. `POST /api/menu/upsell {item_ids, limit}` returns up-to N suggestions ranked: 1) explicit related_item_ids of cart items, 2) bestsellers, 3) popular, 4) most-recent fallback. Stock=0 items excluded. Already-in-cart items never returned. Items use the same sale-price math as `/api/menu` so strikethroughs render.
- **Frontend `PeopleAlsoBuy.jsx`** — horizontally scrolling strip (snap-x) shown on `/cart` (full size) and `/checkout` (compact, title="Add a side?"). Each card has BEST / N% OFF badges, sale + crossed-out original prices, Add button. Items with variations open a dedicated bottom-sheet picker.
- **Admin `/admin/menu` edit modal** — new "Related items" chip picker (multi-select). Self-excluded by id check. Saves via the existing PUT `/menu-items/{id}`.
- **Tests** — 14/14 pytest pass. Frontend 100% — cart strip excludes already-in-cart items, direct-add (no variations) increments cart count, checkout compact strip updates Order Summary live, admin chip toggle persists. **No bugs found.**

**Refactor deferred:** server.py is now **3326 lines**. Doing the refactor mid-feature was too risky. Next iteration will be **dedicated to extracting routers** (reviews → `/routers/reviews.py`, smart-alerts → `/routers/order_alerts.py`, public info → `/routers/public_info.py`, menu → `/routers/menu.py`, etc.) with regression testing as the only deliverable. The testing subagent has flagged this in 5 iterations; iter-9 will be it.

## Next tasks (priority order)
1. **iter-9 — server.py refactor** (urgent, dedicated). Extract a `dependencies.py` (db, helpers, models) and split into 6-7 routers under `/app/backend/routers/`. Run full regression suite.
2. **F9 — Smart Offer Engine** (combos, time-based, BOGO). Largest deferred feature.
3. (LOW) seed at least one variation-bearing item that is also bestseller/popular so the upsell variation-picker has e2e coverage.
4. (LOW) extract a shared `serialize_menu_item_pricing()` helper to dedupe between `/api/menu` and `/api/menu/upsell`.
5. Add real Twilio creds in production env.

## Iteration 5 — Thermal Print Fix + QR Codes + Reviews (2026-05-07)
**Why:** User's 80mm thermal printer was producing broken output. Same iteration delivered Features 1, 2, 3 from the v3 problem statement (printer fix, QR codes, review page).

**What's been added:**
- **Thermal receipt rebuilt** as a portaled `<ThermalReceipt>` component (`frontend/src/components/ThermalReceipt.jsx`) rendered into `document.body` via `createPortal`. Content: centered restaurant name + address + phone, Order # + Date + Customer + Phone + Address + Notes, monospaced item table with QTY/AMOUNT columns, Subtotal / Discount / Delivery / **TOTAL** rows, Payment + status, two QR codes (Find Us → Google Maps, Rate Order → /review/:id), Thank-you footer. Used by `AdminOrders` Print Invoice button.
- **Print stylesheet fixed** in `index.css`: `@page { size: 80mm auto; margin: 0 }`, body width 80mm, `body > *:not(.receipt-print) { display: none !important }` so only the receipt prints. Receipt uses 12px Courier monospace with mm-based widths so columns align cleanly on 80mm paper.
- **QR codes** via `qrcode.react` (added to `package.json`). Two QR images on every printed receipt AND on the OrderSuccessPage (`/order/:id/success`).
- **Public Review page** at `/review/:orderId` — no auth required. Hover-aware 5-star input, name + comment, submits to `POST /api/reviews/public/:orderId`. Shows a thank-you state with the saved rating if a review already exists.
- **Backend additions** (server.py):
  - `GET /api/public/restaurant-info` — serves restaurant name/phone/address/lat/lng/google_maps_url for the receipt + success page (no auth).
  - `GET /api/reviews/order/{order_id}` — returns the order summary + existing review (if any), no auth.
  - `POST /api/reviews/public/{order_id}` — anonymous review submission with rating 1–5, optional comment ≤500 chars and name ≤60 chars; one review per order is enforced regardless of customer.
  - Existing `POST /api/reviews` (authenticated, delivered-only) is preserved.
- **Tests:** 17/17 pytest backend cases pass; all frontend flows verified by testing subagent.

**Known remaining items in v3 problem statement (deferred for next iteration):**
- F4 Menu management — Add/Edit/Delete category buttons (most CRUD already exists, just wire UI), upload image from PC vs paste URL with `image_type` flag.
- F5 Drag & drop sorting for categories + menu items (backend reorder endpoints already exist, just need DnD UI).
- F6 Item-level discount + global discount engine (extend menu items with `discount_type` / `discount_value`, apply at cart time).
- F7 Upselling "people also buy" (`related_items` config + checkout strip).
- F8 Free-delivery progress message ("Add Rs X more for free delivery").
- F9 Smart offer engine (combos, time-based, BOGO).
- Frontend polish: bestseller / discount / popular badges, crossed-out original price.
