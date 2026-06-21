# Karachi Naseeb Biryani — PRD

## Original Problem Statement
Unified restaurant platform (online ordering + POS + admin). User submitted a 12-point improvement list:

1. Reduce mobile landing banner height
2. Embed menu ("Pick Your Favourites") on homepage  → **DEFERRED on user request**
3. Sticky mobile nav buttons (Menu, Offers, Events, Feedback)
4. "View Full Menu" opens at top of page
5. Improve online menu loading speed
6. Active-category tracking while scrolling menu + sticky top category bar
7. Cart page opens at top when adding from homepage
8. Best Sellers: original price, discounted price, % off
9. PWA Home Screen Shortcut prompt
10. Admin Notifications page to send promotional alerts to subscribers
11. Sync "Online Store Settings" in Admin Portal with the live website
12. (CRITICAL) Fix Opening Hours bug — customers couldn't order even when open

## Architecture
- Frontend: React + Tailwind (CRA, port 3000) in `/app/frontend`
- Backend: FastAPI (port 8001) in `/app/backend/server.py`
- DB: MongoDB
- Workflow: User does NOT use Save-to-Github; they manually copy files from Emergent into their repo (`/app/_copy_paste/` is the staging folder).

## Implementation Log

### 2026-06-21 — Round 10: Stale push auto-recovery + Universal notif prompt + 14-day install cooldowns

Fixes user-reported regression after iteration 9 VAPID rotation.

- **`frontend/src/lib/push.js`** rewritten: `ensurePushSubscription` now `forceRefresh`es `/api/push/vapid-public-key`, compares (`normalizeB64` + `arrayBufferToUrlB64`) against `existing.options.applicationServerKey`, and on mismatch calls `existing.unsubscribe()` + `/push/unsubscribe` + `pushManager.subscribe()` with the *new* key. The Layout's silent auto-resubscribe effect now auto-heals stale subs on every customer sign-in. Also exports `getPushStatus()` for the new EnableNotificationsCard.
- **`components/EnableNotificationsCard.jsx`** (NEW, 182 lines): Universal "turn on alerts" prompt mounted on `/orders` and `/profile`. Three variants — `default` (Enable CTA), `denied` (browser settings instructions), `ios-install-required` (Share → Add to Home Screen). 3-day dismiss cooldown (DISMISS_COOLDOWN_DAYS=3).
- **`components/IosInstallPrompt.jsx`** + **`components/AndroidInstallPrompt.jsx`**: Dismiss flag migrated from permanent `'1'` flag to timestamp-based 14-day cooldown (`dismissedRecently()` / `markDismissed()`). localStorage keys bumped to `_until_v2`.
- **`pages/OrdersPage.jsx`**: imports + renders `<EnableNotificationsCard />` above filter tabs.
- **`pages/ProfilePage.jsx`**: replaces `IosEnableNotificationsCard` with universal `EnableNotificationsCard`.

**Testing**: `/app/backend/tests/test_iteration8_stale_push.py` (8 tests, all PASS): vapid-public-key returns value, admin vapid status healthy + requires auth, subscribe with customer auth, subscribe idempotent, unsubscribe accepts endpoint, unsubscribe unknown endpoint safe (never 500), subscribe requires auth. Frontend Playwright checks confirm both EnableNotificationsCard variants render, 3-day dismiss writes correct future timestamp, AdminNotifications regression clean.

### 2026-06-21 — Round 9: Push hardening + Image banners + Android 1-tap install + SEO

**Push notification reliability**
- `backend/server.py`:
  - `_send_web_push()` now returns `(ok, error_message)` so the exact `WebPushException` text (malformed VAPID, expired endpoint, etc.) bubbles up to the admin UI instead of a silent "1 failed" counter.
  - New `_vapid_key_health()` does a live `cryptography.serialization.load_pem_private_key()` round-trip on the configured key and reports parsable / parse_error / source.
  - New `_generate_vapid_keys()` helper used by the regenerate endpoint.
  - **`GET /api/admin/push/vapid/status`** — admin-only diagnostic returning `{public_key_set, private_key_set, public_key_preview, private_key_is_pem, private_key_has_newlines, source, parsable, parse_error}`.
  - **`POST /api/admin/push/vapid/regenerate`** — rotates the VAPID keypair, persists to `vapid_keys.json`, wipes every `push_subscriptions` doc (the old subs were signed against the dead key), returns the new public + private key strings so the operator can paste them into hosting env vars.

**Broadcast banner images**
- **`POST /api/admin/notifications/upload-image`** (multipart) — JPG/PNG/WebP ≤2MB. Uses the existing object-storage helper (`_put_object`) with a dedicated namespace `karachi-naseeb/broadcast-banners/`. Returns absolute `image_url` built from `X-Forwarded-Host` + `X-Forwarded-Proto` so the push service (FCM / Mozilla / Apple) can actually reach it.
- **`GET /api/public/broadcast-image/{path}`** — no-auth public fetch, hard-prefixes the allowed namespace so a craft request like `/karachi-naseeb/payments/foo.png` returns 404 (path traversal guard).
- `_send_web_push()` now embeds `image` into the push payload; `sw.js` maps `data.image → options.image` for Android & macOS hero banners.
- `AdminBroadcastIn` model gained `image: Optional[str]`. Broadcasts persist `image` in `notification_broadcasts` doc + history endpoint returns it.

**Android 1-tap install**
- `frontend/src/components/AndroidInstallPrompt.jsx` (new) — captures `beforeinstallprompt`, renders a floating bottom-right banner with an Install button that calls the saved `prompt()`. Hidden in standalone mode, after dismiss, or once `appinstalled` fires.
- Wired into `components/Layout.jsx` alongside the existing iOS prompt.

**SEO logo / favicon / Open Graph / JSON-LD**
- **`GET /api/public/icon`** — streams the configured `restaurant_logo_url` (handles data: URLs, http(s):// proxying with 10s timeout, transparent-PNG fallback). Cache-Control 1h for real logos, 5min for the fallback.
- **`GET /api/public/branding`** — returns `{name, logo_url, phone, whatsapp, email, address, opening_hours, lat, lng, social URLs}` from `online_settings` for SEO/SSR consumers.
- `frontend/public/index.html` — added favicon + apple-touch-icon links (all pointing at `/api/public/icon`), Open Graph (`og:image`, `og:type=restaurant`, etc.), Twitter Card meta, and JSON-LD `@type=Restaurant` schema with address + cuisine + telephone.
- `frontend/public/manifest.json` — proper 192/512 PNG icons (`any` + `maskable` purposes), `scope`, `categories`, and three home-screen shortcuts (Order Now → /menu, Track → /orders, Offers → /offers).

**Admin Notifications UI rewrite**
- `pages/admin/AdminNotifications.jsx`:
  - VAPID health card (green/red) with one-click "Regenerate keys" button.
  - File-picker banner upload (no URL paste required), with live preview + remove.
  - Send-test / Send-to-all now surface `errors_sample[0]` in toast.error/warning when failures occur.
  - History entries show banner thumbnails and a collapsible error-details panel when `failed>0`.
  - After regenerate, a one-time reveal panel shows the new public/private keys with copy buttons (so the operator can paste them into env vars).

**Testing**
- `/app/backend/tests/test_iteration7_push.py` (17 tests, all PASS): VAPID status/regen, broadcast image upload (MIME + size + X-Forwarded-Host), public broadcast image (with path traversal guard), broadcast persistence of `image`, public branding/icon. Frontend smoke checks (admin UI, SEO tags, manifest, sw.js, AndroidInstallPrompt) all PASS.

### 2026-06-21 — Round 8: Admin Notifications UI + iOS A2HS

**Admin Notifications broadcast (Marketing → Notifications)**
- `backend/server.py`: 3 new admin endpoints (auth via existing `get_current_user` + role==admin check):
  - `POST /api/admin/notifications/broadcast` — accepts `{title, body, url, test_only}`. With `test_only=true`, sends only to subscriptions tied to the admin's email-linked customer doc (preview-on-your-phone before blasting). With `test_only=false`, fans out to every doc in `push_subscriptions`. Records each broadcast in `notification_broadcasts` (sent / failed / audience_size / sent_by / created_at).
  - `GET  /api/admin/notifications/history` — last 50 broadcast logs.
  - `GET  /api/admin/notifications/stats` — `{subscriber_count, last_broadcast}` summary card.
- `frontend/src/pages/admin/AdminNotifications.jsx` (new) — Marketing-style composer: title (60 char limit), message (140 char limit with live counter), optional deep-link URL, "Send test (to me)" yellow button, "Send to all" red button with confirm dialog. Subscriber/history stat cards + recent-broadcast list with sent/failed counts and deep-link annotation.
- `components/AdminLayout.jsx` — added `Bell` icon nav entry under Online section, between Rewards and Settings.
- `App.js` — wired `/admin/notifications` route.
- **VAPID keys are NOT regenerated** — the broadcast endpoint reuses `_send_web_push` and the existing global `VAPID_*` env vars. The production keys configured today stay valid.

**iOS Add-to-Home-Screen + iOS PWA notification opt-in**
- `frontend/src/components/IosInstallPrompt.jsx` (new):
  - `<IosInstallPrompt />` — one-shot bottom-right teaching banner visible ONLY on iPhone / iPad Safari, NOT in standalone mode, NOT previously dismissed. Explains "Tap Share → Add to Home Screen". Dismiss state persisted in localStorage (`knb_a2hs_dismissed_v1`).
  - `<IosEnableNotificationsCard />` — red gradient card with "Enable" button. Renders ONLY for iOS users running the site in standalone (PWA) mode whose push permission is not yet granted. Calls `ensurePushSubscription({silent:false})` from a real user-gesture (required by iOS) and toasts a clear success / "blocked, open iOS Settings" / "couldn't enable" outcome.
- `components/Layout.jsx` — mounts `<IosInstallPrompt />` (only shows on iOS-Safari non-PWA).
- `pages/ProfilePage.jsx` — mounts `<IosEnableNotificationsCard />` above the Diamond-balance card.

### 2026-06-19 — Round 7: Rider handoff view + Web Push notifications

**Backend (`server.py`)**:
- Added `pywebpush` dep. VAPID keypair auto-generated on first boot (persisted to `backend/vapid_keys.json` or env-overrideable via `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`).
- New endpoints:
  - `GET  /api/push/vapid-public-key` → publishes the public key for the client.
  - `POST /api/push/subscribe` → upserts a `push_subscriptions` doc keyed by `endpoint` and tied to the signed-in customer.
  - `POST /api/push/unsubscribe` → deletes a subscription by endpoint (called on logout).
  - `GET  /api/rider/orders/{order_id}?token=...` → public, token-protected single-order view for delivery staff.
  - `POST /api/rider/orders/{order_id}/delivered?token=...` → one-tap delivery confirmation that also fires a push to the customer.
- `PUT /api/online-orders/{order_id}/status`:
  - Auto-mints `rider_token` (via `secrets.token_urlsafe(16)`) when status transitions to `out_for_delivery`. Token persists for the life of the order so the link stays valid until delivery.
  - Calls `_notify_customer_order_status` on every status change. Maps each non-terminal status to a friendly title + body and deep-links the customer to `/track/{order_id}`. Failed sends (404/410) auto-drop the subscription.

**Frontend**:
- New `public/sw.js` — minimal service worker: `push` event displays the OS notification; `notificationclick` focuses the existing tab or opens `/track/{id}`.
- New `public/manifest.json` — turns the site into an installable PWA (Add to Home Screen) which is also a prerequisite for iOS Web Push support.
- New `src/lib/push.js` — `ensurePushSubscription({silent})` and `unsubscribePush()` helpers. Caches the VAPID public key in localStorage. Idempotent: safe to call on every Layout mount.
- `components/Layout.jsx` — calls `ensurePushSubscription({silent:true})` whenever a customer is signed in, so subscriptions refresh silently. Explicit prompt is triggered from `OrderSuccessPage` via a yellow "Enable order alerts" button (the natural opt-in moment).
- New `src/pages/RiderViewPage.jsx` — mobile-first one-screen rider UI: customer name, status, drop address + GPS shared badge, blue "Navigate in Google Maps" button, tap-to-call phone, items list (free items in green), amount to collect, customer note, sticky bottom **MARK DELIVERED** button. Auto-polls every 5s.
- `App.js` — registered `/rider/:orderId` route OUTSIDE the customer `Layout` so riders don't see the header / cart chrome.
- `admin/AdminOrders.jsx` — added a green WhatsApp-styled "Send rider link" button on every non-terminal order with a `rider_token`. Copies link to clipboard AND opens WhatsApp share with the order number prefilled.
- `OrderSuccessPage.jsx` — added "Enable order alerts" yellow chip next to Track Order CTA. Fires the OS permission prompt; hides itself once granted/denied.

### 2026-06-19 — Round 6: Variation discounts + Customer location update
- **`backend/server.py` `/api/menu`**: For items with `discount_type` + `discount_value`, the discount is now applied to EACH variation's price too (Half/Medium/Full all get the % or fixed cut). Each variation in the response now carries `original_price` when discounted so the frontend can render the strikethrough. Root cause of the user's reported "discount badge shows but price doesn't change on variations item" — the variations were sent as raw, un-discounted prices.
- **`frontend/src/pages/MenuPage.jsx` `PriceBlock`**: When item has variations AND any variation has `original_price > price`, shows "From Rs. {sale_min}" with strikethrough "Rs. {orig_min}". Was previously showing "From Rs. {min}" with no strikethrough for variations items.
- **`frontend/src/pages/MenuPage.jsx` `VariationPicker`**: Each size's row now shows the sale price + strikethrough original (e.g. `Half Rs. 182 ~~Rs. 200~~`).
- **`backend/server.py`**: New `POST /api/online-orders/{order_id}/customer-location` endpoint. Customer-initiated. Verifies ownership for signed-in orders (rejects 403 if mismatch). Appends `{lat, lng, address, note, updated_at}` to `customer_location_history` array on the order. Updates `customer_lat`, `customer_lng`, `customer_address_updated` to the latest values.
- **`frontend/src/pages/TrackingPage.jsx`**: Added "Share my live location" / "Update my location again" button (visible only while order is in a non-terminal status). Uses `navigator.geolocation.getCurrentPosition` and a best-effort OSM Nominatim reverse-geocode. Shows the customer's "Shared N times" confirmation. Also surfaces `customer_address_updated` as the displayed address when present.
- **`frontend/src/pages/admin/AdminOrders.jsx`**: New blue panel "📍 Customer-shared location (N updates)" with a one-tap Google Maps deep link to the latest pin, plus a collapsible `<details>` of older updates. Each entry timestamped.

### 2026-06-19 — Round 5: 5 more user-reported issues
- **`frontend/src/components/Header.jsx`**: mobile top-right now ALWAYS shows two chips when signed in (yellow Diamond balance + black Profile button) and a red "Sign In" pill when not. Visible without opening the hamburger or scrolling.
- **`frontend/src/pages/CheckoutPage.jsx`**: When a Diamond reward of type `discount_percent` or `discount_fixed` is selected, the order summary now previews the discount BEFORE the order is placed (line item "Diamond discount (10%): − Rs. X") and the displayed total `totalAfterReward` reflects it. Was previously only visible on the tracking page.
- **`frontend/src/pages/CheckoutPage.jsx`** + **`frontend/src/pages/OffersPage.jsx`**: Tap-to-apply offer flow. When a signed-in customer taps a coupon code on Offers, the code is stored in `localStorage.pending_coupon_code` and the Checkout `useEffect` consumes + auto-applies it (highest priority, then falls back to personal coupons). Toast: "Coupon X auto-applied · saved Rs. Y". Eliminates the "I tapped the code but had to type it manually" confusion.
- **`backend/server.py`**: Server-side gate — any order with a `coupon_code` from an unauthenticated request is rejected with 401 "Please sign in to use a coupon." Closes the guest-bypass by manual typing (the front-end popup alone wasn't enough).
- **`frontend/src/pages/admin/AdminOrders.jsx`**: Added a prominent emerald-green **"MARK DELIVERED"** quick-action button on every non-terminal, non-rejected order card (with shadow + uppercase typography). Designed so any restaurant staff can press it without navigating a dropdown. Hides itself once the order reaches a terminal state.

### 2026-06-19 — Round 4: Second-order bonus + Guest gate
- **`backend/server.py`**: new `personal_coupons` collection. On `PUT /online-orders/{id}/status` with `status=delivered`, if this is the customer's 1st-ever delivered order AND they don't already have a `second_order_bonus` coupon, mint one (`WELCOME2-<6 hex>`, Rs. 50 off, 30-day expiry, single-use, tied to `customer_id`).
- **`backend/server.py`**: new `GET /api/personal-coupons/me` (auth required) returns active (unused + unexpired) personal coupons for the signed-in customer.
- **`backend/server.py`**: order-place `coupon_code` validation now checks `personal_coupons` first — verifies ownership (must match `customer_id`), expiry, not-used. Marks as used after order insert.
- **`backend/server.py`**: indexes added: `personal_coupons.code` (unique) and `(customer_id, used)`.
- **`frontend/src/components/GuestGateSheet.jsx`** (new): reusable bottom-sheet / modal asking guests to sign in with optional "Continue as guest" escape hatch. `data-testid` attributes cover gate, signin, continue-guest, close.
- **`frontend/src/pages/OffersPage.jsx`**: For signed-in users, shows red "Just for you" panel with their personal coupons (tap to copy). For guests, shows a teaser banner that opens the gate. Tapping any public coupon code also opens the gate (with "Continue as guest" fallback that just copies the code).
- **`frontend/src/pages/RewardsPage.jsx`**: Removed forced guest redirect. Catalog now public. Balance card swaps to "Sign in to see your balance" CTA when not signed in. "Use" button on each reward opens the gate for guests. Card opacity dimming only applies to signed-in users with insufficient balance.
- **`frontend/src/pages/ProfilePage.jsx`**: "Just for you" panel listing the customer's personal coupons under the Diamond balance card. Refreshes alongside diamond balance/orders.
- **`frontend/src/pages/CheckoutPage.jsx`**: `applyCoupon()` now checks personal coupons before falling back to public offers. Added auto-apply effect: on mount (if signed in and no coupon already set), fetches `/personal-coupons/me` and auto-fills + applies the top coupon. Toast: "Your personal coupon X was auto-applied".

### 2026-06-19 — Round 3: 10-issue batch
- **`backend/server.py`** (issue #2 — coupon abuse): Added `one_time_per_customer` boolean to `OfferCreate`/`OfferUpdate` models. Enforce server-side: if a coupon is flagged one-time, reject when an order already exists with that `coupon_code` + same `customer_id` (signed-in) or same `phone` (guest). Added a startup backfill that flips any `WELCOME*` / `FIRST*` codes to `one_time_per_customer=True`. Added composite indexes `(coupon_code, customer_id)` and `(coupon_code, phone)` so the lookup is O(log n) at scale.
- **`backend/server.py`** (issue #8 — free item visible pre-order): `/loyalty/rewards` now enriches `free_item` rewards with the linked menu item's `name`, `image_url`, `price` so the client can render a proper "1× Salad · FREE · Diamond Reward · Rs. 0" line in cart/checkout summary.
- **`frontend/src/pages/CartPage.jsx`** + **`CheckoutPage.jsx`** (issue #8): Show a green free-item line item in the order summary when the customer's selected reward is a free_item — uses the new `free_item_name`/`free_item_image` from the backend.
- **`frontend/src/pages/admin/AdminOrders.jsx`** (issue #9 — restaurant context): Added a yellow "Rewards / Discounts applied" panel under each order's items list. Shows coupon code + savings, and the loyalty reward title + reward_type detail (% off, Rs off, free item). Free items in the items list are highlighted in emerald with "FREE" instead of the price.
- **`frontend/src/pages/admin/AdminOrders.jsx`** + **`frontend/src/index.css`** (issue #10 — blinking status): Added 5 keyframe animations (`pulse-ring`, `pulse-ring-blue`, `-orange`, `-yellow`, `-purple`) and matching `status-pulse-<status>` classes. The status `<select>` is wrapped in a div with that class, so non-terminal statuses get a colored pulsing ring. Terminal states (delivered/rejected/cancelled) have no matching class → no animation.
- **`frontend/src/index.css`** (issue #7 — mobile zoom-out): Added `overflow-x: hidden` to both `<html>` and `<body>` so a wide element doesn't push the viewport sideways and trigger mobile browsers to auto-zoom-out.
- **`frontend/src/pages/OffersPage.jsx`** + **`RewardsPage.jsx`** (issue #1a — 4 per screen mobile): Changed mobile grid from `grid-cols-1` → `grid-cols-2` with compacted padding, smaller fonts and shorter line-clamps so two columns x two rows = 4 cards visible on a phone.
- **`frontend/src/pages/ProfilePage.jsx`** (issue #1b — diamond balance sync): Added a Diamond balance card at the top of the Profile page that polls `/loyalty/balance` every 30s, refreshes on window focus, and refreshes on the `diamondsUpdated` event. Same listener also re-fetches orders so order statuses stay current.
- **`frontend/src/pages/UnifiedLoginPage.jsx`** (issue #4): Re-titled to **"Staff / POS Sign In"** with a small "Customer? Use customer sign-in →" link, so when a logged-in customer accidentally hits `/admin/pos` they understand this isn't the customer page.

### 2026-06-17 — P0 Bug Fixes (Round 2)
- **`frontend/src/lib/api.js`** (issue #4 — mobile Google sign-in order linkage): split the `/online-orders` routing — `POST /online-orders` is now always treated as customer-facing (uses `knb_token`, never `knb_admin_token`). Was previously misrouted as an admin call when both tokens existed in localStorage, causing customer orders placed after Google sign-in to be created with `customer_id: null` and never appear in Order History.
- **`backend/server.py`** (issue #5 — free-item Diamond reward): replaced the `pass` stub at the `reward_type == "free_item"` branch. Now resolves the menu item via `reward_value`, appends an `OnlineOrderItem` with `price=0.0, quantity=1` and `name="<item name> (FREE — Diamond Reward)"`. The free item appears both in the customer order summary and the restaurant's kitchen ticket. Diamonds are still deducted, but no longer silently — the customer actually receives the freebie.
- **`frontend/src/pages/TrackingPage.jsx`** (issue #2 — review CTA after delivery): added a prominent green "Delivered! How was it?" banner linking to `/review/{id}` that surfaces immediately when `order.status === "delivered"`.
- **`frontend/src/components/Header.jsx`** (issue #4 — profile/diamonds discoverability on mobile): mobile sticky chip row now shows a yellow Diamond-balance chip + a black profile chip (first name) when the user is signed in, and a red Sign In chip when not. No more burrowing into the hamburger to find diamonds/profile.
- **`frontend/src/pages/MenuPage.jsx`** (issue #6 — item descriptions invisible): added a 2-line description below the item name on `CompactCard`. Was previously only shown on the comfortable view.

### 2026-06-17 — Phase A (done, user verifying)
- `frontend/src/components/ScrollToTop.jsx` (new): scroll-to-top on route change.
- `frontend/src/components/Layout.jsx`: mount ScrollToTop.
- `frontend/src/pages/HomePage.jsx`: shorter mobile hero (`py-10 sm:py-16 md:py-28 lg:py-36`), Best Seller cards now use `PriceBlock` + `Badges` (strikethrough original price + % OFF badge + variation picker on add).
- `frontend/src/components/Header.jsx`: sticky mobile inline-nav chips (Menu/Offers/Events/Feedback).
- `backend/server.py`: hardened `_parse_hhmm` (accepts "9:00", "09:00", "9", trims whitespace) + overnight wrap-around support in opening-hours evaluator.
- `frontend/src/components/ClosedBanner.jsx`: uses backend's evaluated open/close state.

Covers items 1, 3, 4, 7, 8 (display), 12.

### 2026-06-17 — Phase B Task 2 + 3 (done, agent-tested)
- `frontend/src/pages/MenuPage.jsx`:
  - Sectioned layout (all categories rendered, no client-side filter).
  - Sticky category bar at `top-0 z-30` (pinned to viewport top — sits where header was when header auto-hides).
  - IntersectionObserver (`rootMargin: "-25% 0px -60% 0px"`) auto-updates `activeCat` as user scrolls.
  - Click on category chip → smooth scroll to that section (with 90px offset).
  - Active chip auto-scrolls horizontally into view in the tab bar.
  - Loading skeleton grid while `/api/menu` resolves.
  - Search now filters by name + description across all sections.
- `frontend/src/components/Header.jsx`:
  - Auto-hide on scroll-down (>120px scrollY, >6px delta), reveal on scroll-up.
  - Disabled while mobile hamburger panel is open.

Covers items 5 (perceived perf via skeletons), 6.

## Phase B Task 1 — DEFERRED
User explicitly said "leave 1 i dont need it anymore" — homepage menu embed is NOT being built.

## Roadmap (P0 → P2)
- **P1**: Item 9 — PWA install prompt (manifest, service worker, beforeinstallprompt UI).
- **P2**: Item 11 — Sync Admin "Online Store Settings" to the live website (name/logo/identity).
- **P2**: Item 10 — Admin Notifications UI (web push or in-app banner — decision pending).

## Known Issues / Notes
- User's preview is on their own deploy, not Emergent's. They manually copy files from `/app/_copy_paste/` into their GitHub repo.
- Pre-existing lint warnings (`react-hooks/set-state-in-effect`) in Header.jsx exist in baseline and are unrelated to this work.
- Seed data in Emergent preview has items split as "Chicken Biryani (Half)" / "(Full)" instead of one item with variations — so the variation picker doesn't fire in Emergent's preview, but it WILL fire in the user's prod DB which has true variation arrays.

## 3rd Party Integrations
- WhatsApp (existing, notifications)
- OpenAI Whisper (existing, voice)

## Files of Reference (current)
- `/app/_copy_paste/HOW_TO_UPDATE.md` — step-by-step guide for the user
- `/app/_copy_paste/*.jsx`, `*.py` — staged copies ready to paste
- `/app/frontend/src/pages/MenuPage.jsx`
- `/app/frontend/src/pages/HomePage.jsx`
- `/app/frontend/src/components/Header.jsx`
- `/app/frontend/src/components/Layout.jsx`
- `/app/frontend/src/components/ScrollToTop.jsx`
- `/app/frontend/src/components/ClosedBanner.jsx`
- `/app/backend/server.py`
