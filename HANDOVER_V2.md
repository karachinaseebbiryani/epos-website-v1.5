# HANDOVER — Karachi Naseeb Biryani (KNB) — V2 In Progress

> **Read this first.** This document is the source of truth for the next AI agent / developer
> picking up the project. Pair it with `/app/memory/PRD.md` (feature-level tracker) and
> `/app/memory/test_credentials.md` (auth & test accounts).

Last updated: 11 June 2026 — by previous agent (E1)

---

## 1. Project at a Glance

A LIVE restaurant ordering platform for **Karachi Naseeb Biryani & Murg Pulao**, Lahore.

- **Stack:** FastAPI (single-file `backend/server.py`) + React 19 (craco + Tailwind) +
  MongoDB (motor). Stripe payments, Twilio WhatsApp, APScheduler, Gmail SMTP, Google + Facebook OAuth.
- **Two surfaces:**
  - **Customer site** — `/`, `/menu`, `/cart`, `/checkout`, `/track/:id`, `/rewards`, `/orders`, `/login`, `/register`, etc.
  - **Staff admin portal** — `/admin/sign-in` → `/admin/orders`, `/admin/menu`, `/admin/offers`, `/admin/reviews`, `/admin/loyalty-settings`, `/admin/rewards`, `/admin/settings`, plus legacy POS at `/admin/pos`, `/admin/reports`, etc.
- **Auth model:** Two independent JWT systems:
  - Customer JWT at `localStorage.knb_token` (issued by `/api/customer/login`, `/customer/google`, `/customer/facebook`, `/customer/register`).
  - Staff/POS JWT at `localStorage.knb_admin_token` (issued by `/api/auth/login`).
  - `src/lib/api.js` auto-selects the correct token based on URL prefix.
- **Owner / Production domain (target):** `https://www.karachinaseebbiryani.com` (purchased on Namecheap, not yet pointed).

---

## 2. Repo Layout

```
/app
├── backend/
│   ├── server.py          # ALL backend code (~4500 lines, single file by design)
│   ├── requirements.txt
│   ├── .env               # Mongo, JWT, OAuth client IDs, SMTP — see §6
│   ├── tests/             # backend_test.py + iteration_*.py (mostly v1)
│   └── uploads/           # local file uploads (payment screenshots, logos)
├── frontend/
│   ├── package.json       # React 19, @react-oauth/google, sonner, tailwind, qrcode.react
│   ├── .env               # REACT_APP_BACKEND_URL, REACT_APP_GOOGLE_CLIENT_ID, REACT_APP_FACEBOOK_APP_ID
│   ├── craco.config.js
│   └── src/
│       ├── App.js
│       ├── contexts/      # AuthContext (customer), StaffAuthContext (admin), CartContext
│       ├── lib/api.js     # axios instance w/ auth interceptor
│       ├── pages/         # customer pages
│       ├── pages/admin/   # admin portal pages
│       ├── pages/legacy/  # OLD POS pages (still used at /admin/pos etc.)
│       └── components/    # shared UI + UI primitives in components/ui
├── memory/
│   ├── PRD.md             # feature tracker, V2 progress
│   └── test_credentials.md
├── test_reports/
│   └── iteration_6.json   # latest testing-agent report (V2 backend, 15/15 PASS)
├── whatsapp-service/      # NOT used in cloud; legacy Twilio relay for Windows install
├── windows-setup/         # legacy local-Windows installer (ignore for Vercel)
├── HANDOVER_V2.md         # ← this file
└── DEPLOY_VERCEL.md       # step-by-step Vercel + Namecheap DNS guide (see §11)
```

---

## 3. Latest Iteration — V2 (11 Jun 2026)

### ✅ Shipped & verified

| Area | Change | Where |
|---|---|---|
| **Google Sign-In** | `POST /api/customer/google` verifies ID token via `google.oauth2.id_token.verify_oauth2_token`; find-or-creates customer; returns standard customer JWT. | `server.py` ~line 2240; `src/components/SocialLoginButtons.jsx`; wired in `LoginPage.jsx` and `RegisterPage.jsx`. |
| **Facebook Sign-In** | `POST /api/customer/facebook` re-verifies access_token via Graph API `debug_token`, then `/me?fields=id,name,email`. | `server.py` ~line 2280; Facebook JS SDK lazy-loaded in `SocialLoginButtons.jsx`. |
| **"Failed to load reviews" bug** | Backend no longer crashes when feedback rows have `order_id=None`. Frontend rewritten to use authenticated `api` instance (was using raw axios+cookies). Added "Order Reviews" / "Private Feedback" tabs with mailto/tel CTAs. | `server.py` `/api/admin/reviews` ~line 4185; `pages/admin/ReviewManagement.jsx` (full rewrite). |
| **Diamond reward auto-restore** | `CartContext` clears `localStorage.selected_reward` whenever cart empties (clear() OR removing last item). New `rewardSelectionChanged` event keeps UI in sync. Reward chip with remove button on Cart + Checkout. | `contexts/CartContext.js`; `pages/CartPage.jsx`; `pages/CheckoutPage.jsx`. |
| **Reward stacking rule** | Backend rejects 400 when `discount_percent`/`discount_fixed` reward combined with a coupon. Free-item rewards still stack. Frontend `applyCoupon` mirrors the rule client-side. | `server.py` ~line 2520; `pages/CheckoutPage.jsx applyCoupon()`. |
| **Offer `min_order_amount`** | New field on `OfferCreate`/`OfferUpdate`. Backend rejects 400 on coupon use when subtotal < min. Frontend admin form + card display + client-side hint. | `server.py` (OfferCreate model + coupon path in `create_online_order`); `pages/admin/AdminOffers.jsx`. |
| **2-min response countdown** | Server returns `response_deadline_seconds` (120s window from `created_at`) on `/api/track/{id}`. Customer sees big countdown on OrderSuccessPage; staff sees `ResponseCountdown` chip on each pending order card (turns red + "RESPOND NOW" when 0). | `server.py` `_response_deadline_seconds()` ~line 4135; `pages/OrderSuccessPage.jsx` (full rewrite); `pages/admin/AdminOrders.jsx`. |
| **Auto-redirect to /track on accept** | OrderSuccessPage polls `/api/track/{id}` every 3s; the moment status leaves "pending", router navigates to `/track/{id}`. | `pages/OrderSuccessPage.jsx`. |
| **Live prep time + delivery override** | `PUT /api/online-orders/{id}/operations` accepts `prep_time_min` (1..240), `delivery_fee_override` (≥0), `free_delivery` (bool). Recomputes total. `/track` now exposes `prep_time_min` (default 30), `delivery_fee_overridden`, `accepted_at`. New `OperationsPanel` component on every accepted/in-flight order card. Customer sees the change within 5s on TrackingPage. | `server.py` ~line 2700; `pages/admin/AdminOrders.jsx OperationsPanel`; `pages/TrackingPage.jsx`. |
| **Accept/Reject/Modify confirmation** | RejectModal copy strengthened to "Are you sure you want to reject this order?" with explicit "No, keep order" / "Yes, reject order" buttons. | `pages/admin/AdminOrders.jsx RejectModal`. |
| **Invoice QR print fix** | `ReceiptModal` print iframe now serializes the rendered `<QRCodeSVG>` nodes from the on-screen preview (via `data-print-qr` attrs + `XMLSerializer`). The Find-Us and Rate-Order QR codes now appear correctly on paper/PDF prints. | `components/legacy/ReceiptModal.js`. |

### ✅ Test coverage status

- **Backend:** `/app/test_reports/iteration_6.json` — **15/15 PASS**. New test file at
  `backend/tests/test_iteration6_v2.py` covers all V2 endpoints.
- **Frontend:** Smoke-verified by screenshot — both social buttons render, login page works,
  homepage works. No automated E2E yet for V2 UI surfaces.

---

## 4. Outstanding V2 Items (P0 → P2)

These are the feedback items from the original V2 brief that are **not yet implemented**:

### P1 — High value, ready to pick up
1. **Push notifications fix (#15 in original brief).** Customers grant permission but never receive notifications. Recommended path: Web Push with VAPID keys + a Service Worker + a `subscriptions` Mongo collection. Backend pushes on order status change. NO third-party service needed.
2. **Contact Us page (#13).** Static page with restaurant phone/email/address/map embed + a "send enquiry" form posting to a new `POST /api/contact` (stores in Mongo + emails to `FEEDBACK_RECIPIENT_EMAIL`). The .env already has SMTP.
3. **Diamond History page (#14).** `/api/loyalty/transactions` already exists. Just build a `/diamonds` route that calls it and renders earned/redeemed/reward-usage with a running balance.
4. **Location permission prompt (#17).** The "Use My Location" button already requests geolocation. We need a friendlier explainer banner ("Used only to calculate delivery — we still deliver to the address you type") and an "Ordering for someone else?" toggle that adds a note to the order.
5. **"Estimated Diamonds to earn" at checkout (#12).** Read `loyalty_settings.earning_rate` and `min_order_for_points` and show "You'll earn ~X Diamonds on this order" before checkout. Also show the minimum-order requirement if any.
6. **Private-feedback email send (#10).** `POST /api/feedback` already stores the row. Hook it to send to `FEEDBACK_RECIPIENT_EMAIL` (env var present) via the existing `_send_email_sync` helper in `server.py`.
7. **Review display-order admin setting (#8).** Add a select in AdminSettings (`newest_first` / `highest_first` / `lowest_first`). Apply in `GET /api/reviews`.

### P2 — Nice to have
8. Frontend automated E2E tests for the V2 UI: social login flow (mock the Google verify on backend so a fake credential succeeds), OperationsPanel, ResponseCountdown, reward chip add/remove, AdminOffers min-order behaviour, ReviewManagement tabs.
9. Refactor `server.py` (4500+ lines, single file) into modules — `auth.py`, `orders.py`, `loyalty.py`, `payments.py`, `reviews.py`, `settings.py`. Out of scope for now per the "no big refactors" rule, but flag this whenever you touch a related area.
10. Replace the JWT `INSTANCE_ID` rotation on restart with a stable secret read from env. Right now every backend restart invalidates ALL outstanding customer + admin tokens, which is unfriendly for production. The `JWT_SECRET` env var is already plumbed (see `.env`); just remove the `iid` check.

---

## 5. Deployment — Vercel + Namecheap (USER WILL DO THIS)

> The user owns `www.karachinaseebbiryani.com` via Namecheap and wants to deploy on Vercel.
> **Read `/app/DEPLOY_VERCEL.md` — it is a step-by-step playbook.**

Short version:
- The **frontend** is Vercel-friendly: static React build via `yarn build` in `frontend/`.
- The **backend** is a Python FastAPI app — Vercel can host it as a Python serverless function,
  but it's heavy (motor, APScheduler, Stripe SDK). Recommended path: deploy the React build on
  Vercel and host the FastAPI backend on **Railway, Render, or Fly.io** (any persistent
  Python host). Then set `REACT_APP_BACKEND_URL` in Vercel to that backend URL.
- The MongoDB needs to move from `mongodb://localhost:27017` to **MongoDB Atlas** (free M0
  tier). Just change `MONGO_URL` in the backend host's env vars.
- Update Google Cloud Console + Facebook Developer Console with the production domain in
  Authorized JavaScript Origins and OAuth Redirect URIs.

---

## 6. Environment Variables

### `/app/backend/.env`
```
MONGO_URL="mongodb://localhost:27017"     # → swap to Atlas URI in production
DB_NAME="test_database"                   # → rename in production, e.g. "knb_prod"
CORS_ORIGINS="*"                          # → tighten to https://www.karachinaseebbiryani.com,https://karachinaseebbiryani.com
JWT_SECRET="..."                          # CHANGE in production
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
FACEBOOK_APP_ID="..."
FACEBOOK_APP_SECRET="..."
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="karachinaseebbiryani599@gmail.com"
SMTP_PASSWORD="<Gmail app password>"
SMTP_FROM="karachinaseebbiryani599@gmail.com"
FEEDBACK_RECIPIENT_EMAIL="karachinaseebbiryani599@gmail.com"
# Optional:
ORDER_RESPONSE_WINDOW_SEC="120"           # 2-minute restaurant response countdown
STRIPE_API_KEY="..."                      # already present in earlier env if needed
TWILIO_WHATSAPP_FROM="whatsapp:+14155238886"
```

### `/app/frontend/.env`
```
REACT_APP_BACKEND_URL=https://<backend-host>     # production backend URL
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
REACT_APP_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
REACT_APP_FACEBOOK_APP_ID=...
```

**Important rules:**
- Backend `MONGO_URL` and `DB_NAME` are protected; never hardcode them.
- Frontend MUST use `process.env.REACT_APP_BACKEND_URL` — every API call goes through
  `src/lib/api.js` which prepends `/api`.
- DO NOT add comments inside `.env` files (parser limitation).

---

## 7. Local Dev Quick-Start

```bash
# Backend deps already installed via pip; if you reset the venv:
pip install -r /app/backend/requirements.txt

# Frontend deps:
cd /app/frontend && yarn install

# All services run under supervisor:
sudo supervisorctl status               # backend, frontend, mongodb
sudo supervisorctl restart backend      # after .env changes only
sudo supervisorctl restart frontend     # after .env changes only

# Logs:
tail -n 100 /var/log/supervisor/backend.err.log
tail -n 100 /var/log/supervisor/frontend.out.log

# Admin login: admin@restaurant.com / admin123 (auto-seeded on first run)
```

---

## 8. Architectural Notes & Gotchas

1. **JWT `INSTANCE_ID` rotation.** Every backend restart generates a new `INSTANCE_ID`, which
   invalidates all outstanding JWTs (see `server.py` line ~33 and the `iid` check). This is
   safe for local dev but annoying in prod. Move `INSTANCE_ID` to a stable env var before
   going live.

2. **POS legacy code lives at `/admin/pos`, `/admin/inventory`, etc.** Don't delete it — the
   restaurant still uses it for in-store sales. The unified admin layout is in
   `components/AdminLayout.jsx` and switches between "online store" and "POS" sections.

3. **WhatsApp service.** The `whatsapp-service/` folder is a Twilio relay used only by the
   Windows local install. In the cloud, `server.py send_whatsapp()` calls Twilio's REST API
   directly when credentials are configured.

4. **Stripe converts PKR → USD at 280:1.** See `create_stripe_session` in `server.py`. For
   true PKR support the restaurant needs a Stripe Atlas account with PKR currency enabled.

5. **No `_id` leakage.** All Mongo reads pass through `_serialize_online_order()` or similar
   helpers that convert `_id` → `id`. When adding new endpoints, follow the same pattern.

6. **CORS.** Currently `*`. Tighten to the production domain before going live.

7. **Single-file backend.** `server.py` is 4500+ lines. Use `grep -n` to navigate. Major
   landmarks (approximate line numbers — confirm with grep before editing):
   - 1-300: imports, helpers, auth
   - 300-2000: POS operations (menu, categories, orders, reports, vendors, etc.)
   - 2000-2200: customer auth + social login
   - 2200-2850: online orders flow (create / accept / reject / modify / operations / track)
   - 2850-3000: reviews + feedback
   - 3000-3500: offers + online settings + delivery + Stripe
   - 3500-3950: file uploads + WhatsApp + restaurant-info + public track
   - 3950-4250: admin reviews + LOYALTY system

8. **Reward redemption flow.** Diamond debit happens ONLY in `create_online_order` when a
   `reward_id` is sent. Removing the reward client-side never debits Diamonds. The
   `selected_reward` localStorage entry is purely UI state.

---

## 9. Test Credentials & OAuth Console Reminders

See `/app/memory/test_credentials.md` for the full list.

- **Admin:** `admin@restaurant.com / admin123` (seeded on startup).
- **Customer:** create via `/register` UI or social login.
- **Google Cloud Console** — must add the following to **Authorized JavaScript Origins** AND
  **Authorized redirect URIs** before going live:
  - `https://www.karachinaseebbiryani.com`
  - `https://karachinaseebbiryani.com`
  - (Plus your Emergent preview URL until cutover)
- **Facebook Developer Console** — same additions in **Valid OAuth Redirect URIs** under
  Facebook Login → Settings.

---

## 10. Code Conventions Used Throughout

- **Test IDs.** Every interactive element has `data-testid="kebab-case-name"`. New code MUST
  follow this. The testing agent depends on it.
- **Tailwind classes** — preferred for styling. Brand colors are `brand-red`, `brand-red-dark`,
  `brand-yellow`, `brand-yellow-dark`, `brand-ink`. Defined in `tailwind.config.js`.
- **Toasts** — `import { toast } from "sonner"` and use `toast.success`, `toast.error`.
- **Errors** — backend raises `HTTPException(status_code=..., detail="...")`; frontend
  surfaces with `formatApiError(err.response?.data?.detail)` from `src/lib/api.js`.
- **Dates** — backend stores ISO strings (`datetime.now(timezone.utc).isoformat()`), NEVER
  `datetime.utcnow()`.

---

## 11. What I'd Tell Future-Me Picking This Up

1. **Read `/app/memory/PRD.md` first**, then this file, then `test_reports/iteration_6.json`
   to see exactly what was verified.
2. **Don't refactor `server.py` proactively.** It's huge but stable — only touch what your
   ticket actually requires.
3. **When implementing P1 items, follow the existing patterns.** For Web Push: register a
   service worker, store subscription objects in a new `push_subscriptions` collection
   indexed by `customer_id`, push on `update_online_order_status` exactly where the WhatsApp
   call lives.
4. **Always test via `testing_agent_v3` after a feature, not just curl.** The previous
   testing agent caught bugs that curl would have missed (e.g. the `ObjectId(None)` crash on
   feedback rows would not have surfaced without seeding a feedback row first).
5. **Before deployment, change:** `JWT_SECRET`, `CORS_ORIGINS`, `MONGO_URL` (→ Atlas),
   `DB_NAME`, and remove the `INSTANCE_ID` JWT rotation in `server.py`.

Good luck — this is a polished product. The owner cares deeply about it.
