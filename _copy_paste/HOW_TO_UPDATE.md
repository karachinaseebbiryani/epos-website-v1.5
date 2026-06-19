# How to update your repo — Round 3 (your latest 10 bugs)

This round fixes the **10 issues** you reported. It's a bigger batch — please copy all the files.

| # | Bug / request | Fixed? | Where |
|---|---|---|---|
| 1a | Offers / Rewards catalog → 4 items per screen on mobile (was 1 per row) | ✅ | `OffersPage.jsx`, `RewardsPage.jsx` |
| 1b | Diamond balance didn't update in **Profile** after delivery (only in Rewards) | ✅ | `ProfilePage.jsx` |
| 2 | **WELCOME100 abuse** — same customer could use it forever | ✅ | `server.py` (offer model + per-customer enforcement + DB index + backfill) |
| 3 | Sign In + customer's name + Diamonds visible at the top on mobile | ✅ | `Header.jsx` (already shipped in round 2, still in this build) |
| 4 | Confusing "POS button → customer sign-in page" | ✅ | `UnifiedLoginPage.jsx` now clearly labeled **"Staff / POS Sign In"** with a "Customer? Sign in here" link |
| 5 | Price cuts not showing on items | ⚠️ | Verified backend is correct — see "Discount sanity check" below. If still missing, the issue is your menu items don't have `discount_value > 0` saved in your DB. |
| 6 | 10% item discount "not adding" | ✅ verified | Confirmed end-to-end with a real test on our server: a Rs. 350 item with 10% discount → API returns `price: 315`, `original_price: 350`, `discount_percent: 10`. The customer pays Rs. 315 in cart. **If you still see full price**, please share a screenshot of the admin item edit page so I can see the values you entered. |
| 7 | Pages zoomed / buttons cut off on mobile | ✅ | `index.css` — forces `overflow-x: hidden` on `<html>` + `<body>` so no wide element triggers Safari/Chrome auto-zoom-out |
| 8 | Free item missing from **cart & checkout** (only on tracking page) | ✅ | `CartPage.jsx`, `CheckoutPage.jsx` show a green "1× <Free Item Name> · FREE" line in the summary. Backend now enriches the rewards endpoint with `free_item_name`, `free_item_image`, `free_item_value`. |
| 9 | Restaurant didn't know **why** the total was lower (coupon vs reward) | ✅ | `AdminOrders.jsx` — every order card now has a yellow "Rewards / Discounts applied" panel showing the coupon code (with savings) and / or the loyalty reward title with its type. Free items are also highlighted in green inside the items list. |
| 10 | Restaurant status button should **blink in different colors** until terminal status | ✅ | `index.css` (new keyframes) + `AdminOrders.jsx` (status select gets `status-pulse-<status>` class). Colors: red = pending, blue = accepted, orange = preparing, yellow = ready, purple = out for delivery. Delivered / Rejected / Cancelled = no animation. |

---

## Files to copy this time (13 total)

> Some are from earlier rounds and still in here for completeness — if you already copied them and **didn't touch the file in your repo since**, you can skip those. Files marked 🆕 are brand new or changed in this round.

| # | From (Emergent) | To (your repo) |
|---|---|---|
| 1 | 🆕 `/app/_copy_paste/server.py` ⭐ critical | `backend/server.py` |
| 2 | 🆕 `/app/_copy_paste/index.css` | `frontend/src/index.css` |
| 3 | 🆕 `/app/_copy_paste/AdminOrders.jsx` | `frontend/src/pages/admin/AdminOrders.jsx` |
| 4 | 🆕 `/app/_copy_paste/CartPage.jsx` | `frontend/src/pages/CartPage.jsx` |
| 5 | 🆕 `/app/_copy_paste/CheckoutPage.jsx` | `frontend/src/pages/CheckoutPage.jsx` |
| 6 | 🆕 `/app/_copy_paste/OffersPage.jsx` | `frontend/src/pages/OffersPage.jsx` |
| 7 | 🆕 `/app/_copy_paste/RewardsPage.jsx` | `frontend/src/pages/RewardsPage.jsx` |
| 8 | 🆕 `/app/_copy_paste/ProfilePage.jsx` | `frontend/src/pages/ProfilePage.jsx` |
| 9 | 🆕 `/app/_copy_paste/UnifiedLoginPage.jsx` | `frontend/src/pages/UnifiedLoginPage.jsx` |
| 10 | `/app/_copy_paste/api.js` (round 2) | `frontend/src/lib/api.js` |
| 11 | `/app/_copy_paste/Header.jsx` (round 2) | `frontend/src/components/Header.jsx` |
| 12 | `/app/_copy_paste/MenuPage.jsx` (round 2) | `frontend/src/pages/MenuPage.jsx` |
| 13 | `/app/_copy_paste/TrackingPage.jsx` (round 2) | `frontend/src/pages/TrackingPage.jsx` |

---

## Discount sanity check (for #5 / #6)

Before you tell me it's still broken, please do this **one** check on your deployed site (not on Emergent's preview):

1. Open your site → press F12 → Network tab → reload the menu page.
2. Look for the request to `/api/menu`.
3. Click the request → look at the **Response** tab → find any item where you set a discount.
4. The JSON should show: `"price": <SALE_PRICE>`, `"original_price": <BASE_PRICE>`, `"discount_percent": <YOUR_PERCENT>`.

- If you see those fields → your backend is fine. The customer is paying the discounted price; you just need the latest `MenuPage.jsx` / `HomePage.jsx` to make the strikethrough visible.
- If `original_price` is missing or `discount_percent` is 0 → please share a screenshot of the admin item edit page so I can see what was saved. Possibly the admin form is not persisting `discount_value`.

---

## Step-by-step copy (newborn-baby version)

For each row in the table above:
1. Find the file in your repo at the same path.
2. Open it → select everything → delete.
3. Open the Emergent file at the path shown → copy everything.
4. Paste into your repo file. Save.

Then push to GitHub. Wait for deploy. Done.

> ⚠️ For `server.py`: **don't delete the file**, just paste over the contents. After deploy, the backfill runs once — it'll mark your existing `WELCOME*` and `FIRST*` coupon codes as one-time-per-customer automatically. You don't have to do anything manually.

---

## Post-deploy checklist

### Issue-by-issue verification
- [ ] **#1a** On a phone, open Offers — you see **2 cards side by side**, so 4 total in one screen.
- [ ] **#1a** Same for Rewards Catalog — 2 columns on mobile.
- [ ] **#1b** Place an order → restaurant marks Delivered → wait <30s OR tap the page → open Profile → **Diamond balance has updated** (no need to refresh).
- [ ] **#2** Place an order with `WELCOME100` → second order from same phone/account using `WELCOME100` → you get the error **"Coupon WELCOME100 can only be used once per customer."**
- [ ] **#3** On mobile, top sticky row shows your **Diamond chip + your first name as a Profile chip** when signed in. Sign In chip when not.
- [ ] **#4** Go to `/admin/pos` — you land on a page that clearly says **"Staff / POS Sign In"** with a small link saying "Customer? Use customer sign-in →".
- [ ] **#7** No more horizontal scroll on any mobile page. Buttons never get cut at the edge.
- [ ] **#8** Customer redeems a free-item reward → in Cart **and** Checkout, you see a green line with the item image + name + "FREE · Diamond Reward" + Rs. 0.
- [ ] **#9** As restaurant, open Online Orders → any order with a coupon OR a loyalty reward shows a yellow "Rewards / Discounts applied" panel right under the items.
- [ ] **#10** Online Orders → orders that are pending/accepted/preparing/ready/out-for-delivery show a **pulsing color ring** around the status selector. Delivered / Rejected / Cancelled stay still.

If any item fails → tell me **which checkbox** + screenshot. Don't try to "guess fix" by digging in code yourself — I'd rather see what your eyes see.
