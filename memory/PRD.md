# PRD — Karachi Naseeb Biryani Online Store (KNB)

## Original Problem Statement
The user shipped V1 of a full-stack restaurant ordering platform (FastAPI + React + MongoDB) for Karachi Naseeb Biryani & Murg Pulao. The system is LIVE in production at the restaurant. V2 feedback was provided as 18+ items spanning:
- Social login (Google + Facebook)
- Order operations (Accept/Reject/Modify color-coded buttons, 2-min response countdown, call-restaurant CTA, prep time control, delivery discount control)
- Diamond rewards UX bugs (auto-restore on cart empty / item remove)
- Offer Management min-order-amount
- Review/Feedback separation
- Reward stacking rules (Diamond OR coupon, not both for discounts; free-item rewards CAN stack)
- Push notifications, contact us page, Diamond history page, location prompt
- Vercel deployment readiness for karachinaseebbiryani.com
- Invoice QR print fix, "Failed to load reviews" fix
- Auto-redirect to live tracking on order acceptance

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) — single file, MongoDB via motor, JWT (cookies + Bearer), Stripe payments, Twilio WhatsApp, APScheduler, SMTP for emails.
- Frontend: React 19 + craco + Tailwind. Three contexts — `AuthContext` (customer), `StaffAuthContext` (POS staff), `CartContext`. React Router v7. axios via `src/lib/api.js` (auto-selects customer/admin token by URL).
- DB collections: `users`, `customers`, `menu_items`, `categories`, `online_orders`, `offers`, `reviews`, `loyalty_settings`, `loyalty_rewards`, `loyalty_transactions`, `online_settings`, `event_bookings`, `payment_transactions`.

## V2 — What's been implemented (Iteration 1, 11 Jun 2026)
### Backend (`server.py`)
- ✅ Google OAuth: `POST /api/customer/google` — verifies ID token via `google.oauth2.id_token.verify_oauth2_token`, find-or-create customer, issues normal customer JWT.
- ✅ Facebook OAuth: `POST /api/customer/facebook` — re-verifies access_token via Graph API `debug_token`, same JWT shape.
- ✅ Offer model: added `min_order_amount` (Pydantic + Mongo + GET/POST/PUT). Enforced in `create_online_order` coupon validation (400 if subtotal below min).
- ✅ Reward stacking rule: HTTPException 400 when a `discount_percent`/`discount_fixed` reward is combined with a coupon code. Free-item rewards still stack.
- ✅ Live operations on accepted orders: `PUT /api/online-orders/{id}/operations` accepts `prep_time_min` (1..240), `delivery_fee_override` (≥0), `free_delivery` (bool). Total is recomputed when fee changes.
- ✅ Public tracking `/api/track/{id}` now exposes `prep_time_min` (default 30), `response_deadline_seconds` (2-min window for pending orders, computed per-request), `accepted_at`, `delivery_fee_overridden`.
- ✅ Admin Reviews crash fix: `/api/admin/reviews` no longer crashes when feedback rows have `order_id=None`. Returns `order_id="", is_feedback=true` for feedback entries. Also surfaces `customer_email`, `customer_phone` on feedback.

### Frontend
- ✅ `<GoogleOAuthProvider>` wrapped around the app in `App.js`.
- ✅ New `SocialLoginButtons` component (Google credential flow + Facebook JS SDK with `public_profile,email` scope) wired into both `LoginPage` and `RegisterPage`.
- ✅ `AuthContext.socialLogin(provider, payload)` calls the corresponding backend endpoint and stores the same `knb_token` in localStorage.
- ✅ `AdminOrders.jsx`: kept existing Accept/Reject/Modify color-coded buttons (green/red/amber). Strengthened RejectModal copy to "Are you sure you want to reject this order?". Added a live `ResponseCountdown` chip on pending orders (counts down from 2:00). Added `OperationsPanel` (prep time +/- 5 min, delivery fee input, "Make Free" button) on accepted/preparing/ready/out_for_delivery orders.
- ✅ `OrderSuccessPage.jsx`: rewritten to poll `/api/track/{id}` every 3s and auto-redirect to `/track/{id}` when status leaves "pending". Shows live 2-min countdown driven by server `response_deadline_seconds` plus a prominent **Call Restaurant** button.
- ✅ `TrackingPage.jsx`: pending banner now shows the same 2-min countdown. After acceptance, surfaces live `prep_time_min` and current `delivery_fee` (with FREE / by restaurant tag when overridden). Phone number for the Call Restaurant button is sourced from `/api/public/restaurant-info` (no more hardcoded fallback).
- ✅ Diamond reward UX: `CartContext` clears `localStorage.selected_reward` whenever the cart becomes empty (via `clear()` or removing last item). New event `rewardSelectionChanged` keeps the reward chip in sync across pages.
- ✅ `CartPage` + `CheckoutPage`: reward chip with a remove button. Removing the reward does NOT debit Diamonds (debit only happens server-side on order create).
- ✅ `CheckoutPage.applyCoupon`: enforces offer `min_order_amount` on the client AND prevents stacking a coupon with a discount-Diamond reward (tells user which to remove).
- ✅ `AdminOffers.jsx`: new `min_order_amount` field on the form; displayed on the card when > 0.
- ✅ `ReviewManagement.jsx`: rewritten to use the authenticated `api` axios instance (was using raw `axios` + cookie, which is why "Failed to load reviews" showed). Added separate "Order Reviews" / "Private Feedback" tabs, with mailto/tel actions on private feedback.
- ✅ `ReceiptModal.js` (legacy POS receipt): print iframe now serializes the rendered `<QRCodeSVG/>` nodes from the preview (via `data-print-qr="find-us"|"review"` attrs and `XMLSerializer`) so the Find-Us and Rate-Order QR codes actually appear on paper/PDF prints.

## What's deferred to a follow-up iteration (P1/P2 backlog)
1. Web Push notifications (VAPID + Service Worker + permission UX). Defer — needs ~half a session on its own.
2. Contact Us page (#13) — straightforward static + form.
3. Diamond History page (#14) — exists partially via `/api/loyalty/transactions`; needs a dedicated `/diamonds` route.
4. Vercel deployment guide (#2) — produce a step-by-step `DEPLOY_VERCEL.md` and a sample `vercel.json` for the React build; backend stays on Emergent or moves to Railway. Document DNS for karachinaseebbiryani.com.
5. Review display order control (admin setting: newest / highest / lowest first).
6. Location permission prompt with stronger copy (#17). The existing `detectLocation` button already requests geolocation; we need a banner that explains *why* and an explicit "I'm ordering for someone else" toggle for the address field.
7. Loyalty: display "Estimated Diamonds to be earned" on Checkout (#12) — use `loyalty_settings.earning_rate` and `min_order_for_points`.
8. Admin private feedback emailing (#10) — wire SMTP send on `POST /api/feedback` to `FEEDBACK_RECIPIENT_EMAIL` env var (already in .env).
9. Push notifications fix (#15).

## Test Coverage Status
- Backend iteration 6 (V2): **15/15 PASS** — see `/app/test_reports/iteration_6.json` and `/app/backend/tests/test_iteration6_v2.py`. Covers: social login negative paths, offer min_order, coupon+reward stacking, admin reviews crash fix, /track v2 fields, operations endpoint (prep + delivery override + free + 400 guard), happy-path regressions.
- Frontend V2 not yet covered by automated tests — visual verification only (login page renders both social buttons correctly).

## Next Action Items
1. Frontend automated tests for: social login UI, order success auto-redirect, AdminOrders OperationsPanel, AdminOffers min-order, ReviewManagement reviews/feedback tabs, reward chip add/remove.
2. Implement P1 items above.
3. Provide Vercel deployment guide.
