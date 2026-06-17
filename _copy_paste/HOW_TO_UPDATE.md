# How to update your repo — step-by-step (super simple)

Phases done in Emergent so far:
- Phase A: mobile banner shrink, sticky mobile nav, scroll-to-top, best-seller discount display, opening-hours fix
- Phase B: sectioned menu with sticky category bar, auto-switching category on scroll, header auto-hide on scroll, loading skeletons

You need to copy **7 files** from Emergent into your GitHub repo. That's it.

---

## What you'll do, in plain words

1. Open your GitHub repo on your computer.
2. For each of the 7 files below:
   - Find the **same file** in your repo at the path shown.
   - Open it.
   - **Delete everything in it.**
   - Copy the matching file from Emergent (`/app/_copy_paste/<filename>`).
   - Paste it in. Save.
3. Push to GitHub like you normally do.
4. Wait for your deploy. Done.

> ⚠️ Two of these are **new files** — they won't exist in your repo yet. Just create them at the path shown.

---

## The 7 files (in copy order)

### File 1 — `MenuPage.jsx`  ⭐ MOST IMPORTANT
- **From (Emergent):** `/app/_copy_paste/MenuPage.jsx`
- **To (your repo):** `frontend/src/pages/MenuPage.jsx`
- **Why:** This is the big one. Adds sectioned categories, sticky tab bar, auto-switching on scroll, skeletons. Also exports `PriceBlock` and `Badges` that HomePage needs — without this file updated, Best Seller discount price won't show.

### File 2 — `HomePage.jsx`
- **From:** `/app/_copy_paste/HomePage.jsx`
- **To:** `frontend/src/pages/HomePage.jsx`
- **Why:** Smaller mobile hero banner + Best Seller cards now show original price (strikethrough) + % OFF badge + "Choose size" variation picker.

### File 3 — `Header.jsx`
- **From:** `/app/_copy_paste/Header.jsx`
- **To:** `frontend/src/components/Header.jsx`
- **Why:** Sticky mobile nav (Menu / Offers / Events / Feedback chips) + the header now auto-hides when you scroll down and slides back when you scroll up.

### File 4 — `Layout.jsx`
- **From:** `/app/_copy_paste/Layout.jsx`
- **To:** `frontend/src/components/Layout.jsx`
- **Why:** Wires in the new `ScrollToTop` helper so every page opens at the top.

### File 5 — `ScrollToTop.jsx`  🆕 **NEW FILE**
- **From:** `/app/_copy_paste/ScrollToTop.jsx`
- **To (create new):** `frontend/src/components/ScrollToTop.jsx`
- **Why:** Forces "View Full Menu" / Cart / any page change to start at the top of the page.

### File 6 — `ClosedBanner.jsx`
- **From:** `/app/_copy_paste/ClosedBanner.jsx`
- **To:** `frontend/src/components/ClosedBanner.jsx`
- **Why:** Reads the fixed Opening Hours endpoint so the "We're closed" banner is accurate.

### File 7 — `server.py`  (backend)
- **From:** `/app/_copy_paste/server.py`
- **To:** `backend/server.py`
- **Why:** Fixes the **critical** Opening Hours bug — customers can now place orders during open hours. (Hardened time parsing + overnight wrap support.)

---

## After you push & deploy — quick check

Open your deployed site on your phone and verify:

- [ ] Banner on home is shorter on mobile (no huge empty space).
- [ ] Below the header you see chips: **Home / Menu / Offers / Events / Feedback** — and they're sticky.
- [ ] Scrolling **down** on any page → the top header hides. Scrolling **up** → it comes back.
- [ ] Tap **View Full Menu** — the menu page opens at the **top** (not in the middle).
- [ ] On the **menu page**, all categories are shown one after another. The category tab bar is pinned at the top.
- [ ] **Scroll down the menu** — the active category chip in the bar changes automatically as new sections come into view.
- [ ] Tap a category chip — it scrolls smoothly to that category.
- [ ] On a Best Seller item with a discount → you'll see crossed-out original price + green **"X% OFF"** badge on the image.
- [ ] Tap **+** on a Best Seller with sizes → the **Choose your size** popup opens.
- [ ] Place a test order during your opening hours → order goes through (no "we're closed" block).

---

## Anything not working?

Tell me which checkbox failed. Don't troubleshoot blindly — just tell me which item from the checklist didn't work and I'll fix exactly that.
