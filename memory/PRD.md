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
