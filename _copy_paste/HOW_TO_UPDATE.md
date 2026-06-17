# How to update your repo — Round 2 (P0 bug fixes)

This update fixes the **3 critical bugs** you reported:

1. ✅ Discount/rewards: Diamond **free-item** reward now actually adds the free item to the order (customer sees it, restaurant sees it on the ticket).
2. ✅ Google sign-in on mobile: orders are now correctly linked to the customer account (will show in Order History).
3. ✅ Review CTA after delivery: when status flips to **Delivered** on the Tracking page, a big green "Delivered! How was it?" banner appears.
4. ✅ Mobile profile + Diamonds always visible: when signed in, the sticky chip bar on mobile now shows your Diamond balance + Profile name without opening the hamburger.
5. ✅ Menu item descriptions are now visible on every menu card.

> Discount display issue (#3): I verified the discount math is correct end-to-end. If you're still seeing a wrong total after this update, please send me a screenshot of the checkout page + the coupon you applied — I'll trace it from there.

---

## What to copy this time

You'll overwrite **5 files** in your repo. (`HomePage.jsx`, `Layout.jsx`, `ScrollToTop.jsx`, `ClosedBanner.jsx` from the previous round don't need to change again — leave them as you copied them last time.)

| # | From (Emergent) | To (your repo) | What changed |
|---|----|----|----|
| 1 | `/app/_copy_paste/api.js` ⭐ **critical** | `frontend/src/lib/api.js` | Fix Google-sign-in mobile orders not being linked. |
| 2 | `/app/_copy_paste/server.py` ⭐ **critical** | `backend/server.py` | Free-item Diamond reward now actually adds the item to the order. |
| 3 | `/app/_copy_paste/Header.jsx` | `frontend/src/components/Header.jsx` | Mobile chip row now shows Diamonds balance + Profile name when signed in. |
| 4 | `/app/_copy_paste/MenuPage.jsx` | `frontend/src/pages/MenuPage.jsx` | Item descriptions now visible on every menu card. |
| 5 | `/app/_copy_paste/TrackingPage.jsx` | `frontend/src/pages/TrackingPage.jsx` | "Delivered → Leave a Review" big green banner. |

---

## How to do it (step-by-step, plain words)

For each file in the table:
1. Find the same file in your repo (e.g. `frontend/src/lib/api.js`).
2. Open it. Select all. Delete.
3. Open the Emergent file at the same name in `/app/_copy_paste/`. Copy everything.
4. Paste into your repo file. Save.

Then push to GitHub like usual and redeploy.

---

## After deploy — quick check

### Bug fixes
- [ ] Sign in with Google on your phone → place an order → open Orders page → **your order is there**.
- [ ] Sign in → open Header on mobile → you can **see your Diamond balance** and your first name as a chip in the sticky row.
- [ ] Customer redeems a Diamond reward where the reward is a **free menu item** → go to checkout → the free item appears in the order summary with `Rs. 0` next to it → restaurant's order ticket also shows the same line tagged "(FREE — Diamond Reward)".
- [ ] Customer redeems a Diamond reward that's a **discount** (e.g. 10%) → final total drops by the right amount, diamonds get deducted, no double-charging.
- [ ] After the restaurant marks order as **Delivered**, the customer on the Tracking page sees a big green "Delivered! How was it?" panel → tapping it opens the review page.

### Phase B (carried over)
- [ ] Each menu card now has a 1-2 line description under the name (was missing before).
- [ ] Scrolling the menu still auto-switches the category chip.
- [ ] Top header still slides away on scroll-down, comes back on scroll-up.

---

## Anything still off?

Reply with the **exact step that failed** + a screenshot if visual. I'll fix the root cause, not work around it.
