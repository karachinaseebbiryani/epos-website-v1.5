# 📦 Karachi Naseeb — Master Update Guide (Phase A → Round 4, all-in-one)

You haven't copied any previous round? **Good news — you don't have to do each round separately**. The files in `/app/_copy_paste/` are the **latest cumulative version** of every file that was changed across all rounds. Copy them once and you're caught up with everything.

---

## 🟢 OPTION 1 (easiest) — Use the GitHub button

If your Emergent chat input shows a **"Save to GitHub"** option, just click it. Emergent will push the entire codebase from this workspace to your GitHub repo in one go. **No copy-paste needed.** That's the recommended path.

If you don't see that option, or you'd rather copy manually, use Option 2 below.

---

## 🟡 OPTION 2 — Manual copy-paste (18 files total)

### Step-by-step for each file
1. Find the file in your GitHub repo at the path shown in the **"To"** column.
2. Open it → select all → delete everything inside.
3. Open the matching file in `/app/_copy_paste/` here in Emergent → copy all its content.
4. Paste into your repo file. Save.

If the file is marked **🆕 NEW** below, your repo doesn't have it yet — just create the file at the path shown.

### 📋 Complete file list (18 files)

#### Backend (1 file)
| # | From (Emergent) | To (your repo) |
|---|---|---|
| 1 | `/app/_copy_paste/server.py` ⭐ critical | `backend/server.py` |

#### Frontend — public/ root (3 files)
| # | From (Emergent) | To (your repo) |
|---|---|---|
| 1a | `/app/_copy_paste/sw.js` ⭐ critical | `frontend/public/sw.js` |
| 1b | `/app/_copy_paste/manifest.json` ⭐ critical | `frontend/public/manifest.json` |
| 1c | `/app/_copy_paste/index.html` ⭐ critical | `frontend/public/index.html` |

#### Frontend — pages (10 files)
| # | From (Emergent) | To (your repo) |
|---|---|---|
| 2 | `/app/_copy_paste/HomePage.jsx` | `frontend/src/pages/HomePage.jsx` |
| 3 | `/app/_copy_paste/MenuPage.jsx` ⭐ critical | `frontend/src/pages/MenuPage.jsx` |
| 4 | `/app/_copy_paste/CartPage.jsx` | `frontend/src/pages/CartPage.jsx` |
| 5 | `/app/_copy_paste/CheckoutPage.jsx` | `frontend/src/pages/CheckoutPage.jsx` |
| 6 | `/app/_copy_paste/TrackingPage.jsx` | `frontend/src/pages/TrackingPage.jsx` |
| 7 | `/app/_copy_paste/OffersPage.jsx` | `frontend/src/pages/OffersPage.jsx` |
| 8 | `/app/_copy_paste/RewardsPage.jsx` | `frontend/src/pages/RewardsPage.jsx` |
| 9 | `/app/_copy_paste/ProfilePage.jsx` | `frontend/src/pages/ProfilePage.jsx` |
| 10 | `/app/_copy_paste/UnifiedLoginPage.jsx` | `frontend/src/pages/UnifiedLoginPage.jsx` |
| 11 | `/app/_copy_paste/AdminOrders.jsx` | `frontend/src/pages/admin/AdminOrders.jsx` |
| 11b | `/app/_copy_paste/AdminNotifications.jsx` ⭐ critical | `frontend/src/pages/admin/AdminNotifications.jsx` |

#### Frontend — components (5 files)
| # | From (Emergent) | To (your repo) |
|---|---|---|
| 12 | `/app/_copy_paste/Header.jsx` | `frontend/src/components/Header.jsx` |
| 13 | `/app/_copy_paste/Layout.jsx` ⭐ critical | `frontend/src/components/Layout.jsx` |
| 14 | 🆕 `/app/_copy_paste/ScrollToTop.jsx` NEW | `frontend/src/components/ScrollToTop.jsx` |
| 15 | `/app/_copy_paste/ClosedBanner.jsx` | `frontend/src/components/ClosedBanner.jsx` |
| 16 | 🆕 `/app/_copy_paste/GuestGateSheet.jsx` NEW | `frontend/src/components/GuestGateSheet.jsx` |
| 16b | 🆕 `/app/_copy_paste/IosInstallPrompt.jsx` NEW | `frontend/src/components/IosInstallPrompt.jsx` |
| 16c | 🆕 `/app/_copy_paste/AndroidInstallPrompt.jsx` NEW | `frontend/src/components/AndroidInstallPrompt.jsx` |

#### Frontend — other (2 files)
| # | From (Emergent) | To (your repo) |
|---|---|---|
| 17 | `/app/_copy_paste/api.js` | `frontend/src/lib/api.js` |
| 18 | `/app/_copy_paste/index.css` | `frontend/src/index.css` |

> Files marked **🆕 NEW** — these did **not** exist in your repo before. Create the file at the path shown.

---

## 🆕 Round 11 (June 21, 2026) — VAPID PEM auto-repair (FIXES "ValueError: Could not deserialize key data")

**The bug you reported**: `Send to All` failed with
> send error: ValueError: Could not deserialize key data… ASN.1 parsing error: invalid length

**The root cause**: Your `VAPID_PRIVATE_KEY` env var on Fly.io contained literal `\n` two-character sequences (backslash + n) instead of real newlines. The cryptography library found the PEM headers but the base64 body was polluted with those `\n` chars → garbage DER bytes.

**The fix** (`backend/server.py` → new `_normalize_vapid_pem` function):
- Auto-repairs **5 corruption patterns** at send-time:
  1. Literal `\n` / `\r` sequences → real newlines.
  2. PEM with all newlines stripped → re-wraps to 64-char lines.
  3. Value wrapped in single or double quotes → strips them.
  4. CRLF endings → LF.
  5. Random leading/trailing whitespace.
- Idempotent — clean PEMs pass through unchanged.
- 11 pytest cases lock the behaviour (`backend/tests/test_vapid_pem_normalize.py`).

**Admin UI** (`pages/admin/AdminNotifications.jsx`):
- The health badge now reads **"Push keys healthy (auto-repaired)"** when corruption was detected and fixed automatically.
- A dedicated red banner appears when literal backslash-n is detected, telling the operator exactly what's wrong.

### ⚠️ After deploying this batch
1. Open `/admin/notifications` — the badge should now show green even if your Fly.io env var is still corrupted (auto-repair kicks in).
2. Send a test broadcast — it should deliver successfully.
3. (Optional cleanup) Re-paste the PEM into Fly.io env vars *with real newlines* to remove the auto-repair warning. The easiest way: run `flyctl secrets set VAPID_PRIVATE_KEY="$(cat your-key.pem)"` (the `$(cat …)` preserves newlines correctly).

### Files in this batch
- `backend/server.py` ⭐ critical
- `frontend/src/pages/admin/AdminNotifications.jsx` ⭐
- `backend/tests/test_vapid_pem_normalize.py` 🆕 NEW (pytest only — optional)

---

## 🆕 Round 10 (June 21, 2026) — Stale push recovery + Universal notif prompt + 14-day install cooldowns

Fixes the 3 issues you reported after deploying iteration 7 with new VAPID keys on Fly.io.

### 🔁 Push subscriptions auto-heal after key rotation
**Problem**: You regenerated VAPID keys → admin showed 0 subscribers → you signed in on your phone but still 0. The browser had cached the *old* PushSubscription object, and `push.js` was just re-posting it (uselessly) to the backend.

**Fix in `frontend/src/lib/push.js`**:
- On every sign-in, `ensurePushSubscription` now **force-refreshes** `/api/push/vapid-public-key` and compares it against the existing subscription's `applicationServerKey`.
- If they don't match, the stale subscription is unsubscribed locally + on the backend, and a **fresh** subscription is created with the current key.
- Result: any signed-in customer auto-recovers within seconds of opening the site after a key rotation.

### 🔔 Universal "Enable notifications" card
**Problem**: Only iOS users saw a "turn on alerts" card. Android users with permission denied/default saw nothing.

**Fix — new `components/EnableNotificationsCard.jsx`** mounted on `/orders` and `/profile`:
- **Default state** (never asked) → red card with **Enable** button → fires the OS permission dialog.
- **Denied state** → instructions to unblock via the site lock icon.
- **iOS not in standalone** → tells the user to Add to Home Screen first.
- 3-day cooldown on dismiss (re-shows next week if they tap X).

### 🔁 Install prompts re-show after 14 days
**Problem**: New account on the same browser never saw the install prompt because the dismiss was permanent (`localStorage['…dismissed'] = '1'`).

**Fix in `IosInstallPrompt.jsx` + `AndroidInstallPrompt.jsx`**:
- Dismiss now stores a future timestamp (14 days out), not a permanent flag.
- After 14 days the prompt re-appears.
- Successful `appinstalled` event still permanently silences it (you can't install twice).
- localStorage keys bumped to `…_until_v2` so existing permanent dismissers see the prompt next time.

### ⚠️ After deploying these files
Sign in on your phone — push.js's force-refresh will heal your subscription and `subscriber_count` will jump back to ≥1 within seconds. Then send a "Send test (to me)" broadcast to confirm delivery on iOS *and* Android.

### Files in this batch
- `frontend/src/lib/push.js` ⭐ critical
- `frontend/src/components/EnableNotificationsCard.jsx` 🆕 NEW
- `frontend/src/components/IosInstallPrompt.jsx` ⭐
- `frontend/src/components/AndroidInstallPrompt.jsx` ⭐
- `frontend/src/pages/OrdersPage.jsx` ⭐
- `frontend/src/pages/ProfilePage.jsx` ⭐

---

## 🆕 Round 9 (June 21, 2026) — Push hardening + Banners + Auto-install + SEO

Every fix below is **already in the latest `/app/_copy_paste/` files** — just re-copy them.

### 🔔 Push notifications now report WHY they fail
- Admin Notifications page shows a green/red **health badge** with the exact `parse_error` when keys are malformed.
- One-tap **"Regenerate keys"** button rotates the VAPID keypair and prints the new public + private key with copy buttons. After regenerate, **set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` env vars on Fly.io** (otherwise the next redeploy will lose the new pair).
- Broadcasts now include the *real* error text (first failure surfaced via toast).

### 📸 Image banners on push notifications
- Upload from device (JPG/PNG/WebP ≤2MB) — preview renders inline, X removes it.
- Android shows the banner as a large hero above the body text. macOS/iOS show it in the expanded notification card. Older OSes silently skip it.

### 📲 Android 1-tap install
- New `AndroidInstallPrompt.jsx` captures Chrome's `beforeinstallprompt` event and shows a floating Install button — no more digging through the browser menu.
- iOS users still see the existing `IosInstallPrompt` (Apple doesn't expose the same event).

### 🌐 Logo in Google search results + browser tabs
- `frontend/public/index.html` now has `<link rel="icon">`, `<link rel="apple-touch-icon">`, Open Graph (`og:image`), Twitter Card, and JSON-LD `@type=Restaurant` schema — all pointing at `/api/public/icon` so the favicon auto-updates whenever you change the restaurant logo in Admin → Online Store Settings.
- `frontend/public/manifest.json` exposes 192/512 PNG icons + 3 home-screen shortcuts (Order Now / Track / Offers).
- Backend serves `/api/public/icon` (proxies your configured logo) and `/api/public/branding` (name + address + social URLs for SSR/crawlers).

### ⚠️ After deploying these files
1. Open `https://yoursite/admin/notifications` and look at the green "Push keys healthy" badge.
   - If it's red, click **Regenerate keys** → copy the new `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` → set them on Fly.io → redeploy.
2. Send a "Send test (to me)" broadcast from your own subscribed phone to confirm.
3. Ask Google to re-crawl your site at https://search.google.com/search-console — the logo will appear within a few days.

---

## ✅ Everything that's been fixed / added (Phase A through Round 9)

Here's the full cumulative list so you know exactly what to test after deploy.

### 🐛 Critical bugs fixed
- ✅ **Opening Hours bug** — customers can now place orders during open hours (hardened time parsing + overnight wrap-around support).
- ✅ **Discount math** end-to-end verified — coupon, item-level %, fixed-amount discounts all correctly subtract from order total.
- ✅ **WELCOME100 abuse** — same customer can no longer use one-time coupons repeatedly. Backend rejects with clear error message.
- ✅ **Google sign-in (mobile) orders not linked** — customer-facing `POST /online-orders` always uses the customer token now, never the admin token.
- ✅ **Free-item Diamond reward** was a `pass` stub — now actually adds the free menu item to the order with `Rs. 0` price and "(FREE — Diamond Reward)" tag on the kitchen ticket.

### 🎨 UI / UX improvements
- ✅ Mobile hero banner is shorter (no more wasted scroll).
- ✅ Sticky mobile inline-nav chips: Menu / Offers / Events / Feedback / Diamonds / Profile / Sign In — all reachable without opening the hamburger.
- ✅ Site header **auto-hides on scroll-down**, slides back on scroll-up. Disabled while hamburger panel is open.
- ✅ Pages now open at the **top** ("View Full Menu", Cart, all navigation).
- ✅ Mobile viewport zoom-out / button cut-off fixed — added `overflow-x: hidden` on html + body.

### 🍽 Menu
- ✅ Sectioned categories on `/menu` (all categories rendered, no client-side filter).
- ✅ Sticky category chip bar pinned to viewport top.
- ✅ Auto-switching active category as you scroll (IntersectionObserver).
- ✅ Click a chip → smooth scroll to that section.
- ✅ Loading skeletons while menu fetches.
- ✅ **Item descriptions now visible on every card** (compact view too).
- ✅ Best-seller cards show original price (strikethrough) + `% OFF` badge + variation picker on add.

### 🎁 Offers + Rewards
- ✅ Both lists are now **2-column on mobile** (4 cards visible per screen).
- ✅ Item descriptions / coupon codes properly line-clamped, no overflow.
- ✅ Guests can **browse** offers + rewards (great for FOMO), but tapping a code or "Use" opens a small sign-in popup with a **"Continue as guest"** escape hatch.
- ✅ Rewards balance card flips to "Sign in to see your balance" CTA for guests.

### 💎 Loyalty
- ✅ Diamond balance card on Profile page (auto-refreshes every 30s + on window focus + on `diamondsUpdated` event — no more stale balance after a delivery).
- ✅ Free-item Diamond reward shows the **actual item name + image** in Cart and Checkout summary (green line: "1× Salad · FREE · Rs. 0") — not just on the tracking page.
- ✅ Restaurant order ticket shows the FREE item in green with "FREE" tag.
- ✅ Restaurant order ticket shows a yellow "Rewards / Discounts applied" panel with coupon code, savings amount, and loyalty reward type used.

### 🪙 NEW — Second-order bonus
- ✅ When a customer's 1st order is marked **Delivered**, backend auto-mints a unique single-use coupon: `WELCOME2-XXXXXX`, Rs. 50 off, 30-day expiry, tied to that customer.
- ✅ Shown on Profile + Offers as a red "Just for you" panel.
- ✅ **Auto-applied** at the next checkout (no copy-paste).
- ✅ Backend rejects if used twice or used on a different account.

### 🔁 Order tracking
- ✅ Big green "Delivered! How was it?" CTA on Tracking page when status flips to delivered → links to review page.
- ✅ Customer's Order History reliably shows all orders (was missing Google sign-in mobile orders).

### 🛎 Restaurant (Admin Online Orders)
- ✅ Per-order Rewards/Discounts breakdown panel (coupon code + savings, loyalty reward title + type + diamonds spent).
- ✅ Free-item lines highlighted in green.
- ✅ **Pulsing color ring** around the status selector — pending=red, accepted=blue, preparing=orange, ready=yellow, out-for-delivery=purple. Delivered / Rejected / Cancelled stay still.

### 🔐 Auth
- ✅ POS / Staff sign-in page (`/admin/sign-in`) is now clearly labeled **"Staff / POS Sign In"** with a small "Customer? Use customer sign-in →" link.

---

## 🧪 Post-deploy verification checklist

Tick these off on your live site:

### Phase A — basics
- [ ] Shorter mobile hero banner.
- [ ] Mobile sticky chip row: Menu / Offers / Events / Feedback / Sign In (and Diamonds + first-name when signed in).
- [ ] Header auto-hides on scroll-down, reveals on scroll-up.
- [ ] "View Full Menu" + Cart open at the top.
- [ ] During open hours, customers can place orders (no false "we're closed" block).

### Menu UX
- [ ] All categories shown as sections.
- [ ] Category chip bar pinned at top.
- [ ] Active chip changes as you scroll between categories.
- [ ] Click a chip → smooth scroll to that section.
- [ ] Loading skeletons appear briefly before items load.
- [ ] **Item descriptions are visible** on every card.
- [ ] Items with a discount show: discounted price + strikethrough original + green "X% OFF" badge.

### Offers / Rewards
- [ ] On a phone, **2 cards side by side** on `/offers` and `/rewards`.
- [ ] As guest → "Just for you / Sign in to unlock" teaser on `/offers`.
- [ ] As guest → tapping a coupon code opens the sign-in popup with "Continue as guest".
- [ ] As guest → `/rewards` shows "Sign in to see your balance".
- [ ] As guest → tapping "Use" on a reward opens the sign-in popup.

### Cart + Checkout
- [ ] Free-item reward shows a **green line with item image + name + Rs. 0** in cart and checkout summary.
- [ ] Coupon `FAMILY15` deducts 15% correctly (verify on a Rs. 1000+ order).
- [ ] Coupon `WELCOME100` works on first use, gets **rejected on second attempt** by same phone/account.

### Second-order bonus
- [ ] After first order is marked **Delivered**, open Profile → red "Just for you" panel shows a `WELCOME2-XXXXXX` code. Tap it → copies to clipboard.
- [ ] Place a 2nd order → coupon field is **auto-filled** with the code → discount line shows `-Rs. 50`.
- [ ] Place a 3rd order with the same code → backend rejects: "Coupon … has already been used."

### Loyalty
- [ ] Diamond balance card on Profile shows current balance.
- [ ] After restaurant marks an order Delivered, Profile balance updates within 30s without a hard refresh.
- [ ] Free-item reward redemption: customer sees the free item in cart/checkout (Rs. 0). Restaurant sees it in green with "FREE" tag on the order ticket.

### Restaurant (Admin)
- [ ] Online Orders → each order with a coupon/reward shows the yellow "Rewards / Discounts applied" panel.
- [ ] Free-item lines render in green with "FREE".
- [ ] Non-terminal status selects pulse in their color (red/blue/orange/yellow/purple). Delivered/Rejected/Cancelled stay still.

### Auth
- [ ] Navigating to `/admin/pos` while signed out lands on a page clearly titled **"Staff / POS Sign In"** with a "Customer? ..." link.
- [ ] Google sign-in on mobile → place order → order appears in your Order History.

### Mobile
- [ ] No horizontal scroll on any page. Buttons never cut at the edge. No more zooming-out by the browser.

---

## ❓ If something doesn't work

Reply with **the exact checkbox that failed** + a screenshot (especially for visual issues). Don't try to "guess-fix" by editing code yourself — let me trace the root cause from your symptom.

---

## 🎯 What's still on the roadmap

These are next on the list (not in this batch):

- **Mobile push notifications** for order status (Out for Delivery / Delivered) → needs PWA setup.
- **PWA Home-Screen Shortcut** prompt (manifest + service worker + install UI).
- **Sync Admin "Online Store Settings"** with the live website identity (name / logo / contact).
- **Admin Notifications UI** to broadcast promos to subscribers.
- **UberEats-style menu polish** (Top Picks row, bigger images on mobile single-column option).
- **Win-back Wednesday** — auto-mint a `COMEBACK-XXXXXX` coupon for customers who haven't ordered in 21+ days + WhatsApp them.

Reply with which one you want next.
