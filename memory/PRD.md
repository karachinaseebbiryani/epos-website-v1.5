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
