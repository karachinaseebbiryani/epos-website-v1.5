# How to update your repo — Round 4 (Second-order bonus + Guest gate)

What this round does:

1. **Second-order bonus** — when a customer's **first** order is marked **Delivered**, the backend automatically mints a unique single-use coupon worth **Rs. 50 off**, valid for **30 days**. The code is shown on Profile + Offers pages **and auto-applied** at checkout, so the customer can't miss it.
2. **Guest gate on Offers + Rewards** — guests can still browse the lists (great for FOMO), but when they tap a coupon code or "Use" a reward, a small bottom-sheet pops up: **"Sign in"** primary button + **"Continue as guest"** secondary button.

---

## Files to copy this round (6 files)

| # | From (Emergent) | To (your repo) | Why |
|---|---|---|---|
| 1 | 🆕 `/app/_copy_paste/GuestGateSheet.jsx` **NEW FILE** | `frontend/src/components/GuestGateSheet.jsx` | The popup that asks guests to sign in (with "Continue as guest" escape hatch). |
| 2 | 🆕 `/app/_copy_paste/server.py` ⭐ | `backend/server.py` | Issues the personal coupon on first-delivered, new `/api/personal-coupons/me` endpoint, accepts personal codes at checkout. |
| 3 | 🆕 `/app/_copy_paste/OffersPage.jsx` | `frontend/src/pages/OffersPage.jsx` | Personal coupons banner + guest gate when tapping a code. |
| 4 | 🆕 `/app/_copy_paste/RewardsPage.jsx` | `frontend/src/pages/RewardsPage.jsx` | Guests can browse but "Use" opens the gate. Balance card shows "Sign in to see your balance" for guests. |
| 5 | 🆕 `/app/_copy_paste/ProfilePage.jsx` | `frontend/src/pages/ProfilePage.jsx` | "Just for you" panel with your personal codes (tap to copy). |
| 6 | 🆕 `/app/_copy_paste/CheckoutPage.jsx` | `frontend/src/pages/CheckoutPage.jsx` | Auto-applies the customer's personal coupon on load. Also accepts the code if they type it manually. |

---

## How it works (plain words)

1. Customer signs up → places their first order → restaurant marks it **Delivered**.
2. Backend instantly creates a row in a new `personal_coupons` collection: e.g. `WELCOME2-7A3F2D`, Rs. 50 off, expires in 30 days, single-use, tied to that customer's account.
3. Next time the customer opens **Profile**, **Offers**, or **Checkout**:
   - Profile + Offers show a red "Just for you" panel with the code.
   - Checkout **auto-fills** the code into the coupon field and applies the discount.
4. When they place the next order, the backend marks the coupon as `used: true`. They can never use the same code again.
5. If they try to give the code to a friend, the backend rejects it: "This coupon belongs to a different account."

### What guests see now
- Offers page: full list visible. "Just for you" banner shows "Sign in to unlock your personal codes" → opens the gate. Tapping a public coupon code also opens the gate (with "Continue as guest" available).
- Rewards page: full catalog visible. Balance card says "Sign in to see your balance". Tapping "Use" on any reward opens the gate.

---

## Step-by-step copy (newborn-baby version)

For each of the 6 files in the table:
1. Find the same file in your repo.
2. Open → select everything → delete.
3. Open the Emergent file at the path shown → copy everything.
4. Paste into your repo file → save.

⚠️ Note: `GuestGateSheet.jsx` is **brand new** — your repo doesn't have this file yet. Create it at `frontend/src/components/GuestGateSheet.jsx`.

Push to GitHub → wait for deploy → done.

> The backend automatically creates the `personal_coupons` collection and its indexes on first startup — you don't need to run any DB migration.

---

## Post-deploy verification

- [ ] As a **guest**, open `/offers` → top banner says **"Sign in to unlock your personal codes"**. Tapping it opens a bottom-sheet with **"Sign in"** + **"Continue as guest"**.
- [ ] As a **guest**, tap any **dashed coupon code** (e.g. WELCOME100) → same bottom-sheet appears. Pick "Continue as guest" → the code is copied to clipboard as a fallback.
- [ ] As a **guest**, open `/rewards` → catalog is visible but the balance card says **"Sign in to see your balance"**. Tapping "Use" / "Sign in" opens the gate.
- [ ] As a **signed-in** customer with **zero** delivered orders → no personal coupon visible anywhere (expected).
- [ ] Place an order → mark it **Delivered** from the admin → check Profile → a red **"Just for you"** panel appears with a `WELCOME2-XXXXXX` code. Tap it → copied to clipboard.
- [ ] On the same customer, go to **Checkout** for a new order → coupon field is **auto-filled** with the code and the discount line shows **-Rs. 50**.
- [ ] Place the 2nd order → personal code is now marked used. Try to apply it on a 3rd order → backend rejects with **"Coupon … has already been used."**

---

If anything breaks, tell me which checkbox failed and I'll target-fix.
