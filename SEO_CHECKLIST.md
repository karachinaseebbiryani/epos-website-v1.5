# SEO Checklist — Karachi Naseeb Biryani

_Last updated: 2026-07-03_

## ⚠️ Honest reality check

For a **local restaurant in Lahore**, your website code is **NOT** the main thing that
decides whether you rank #1 for "biryani near me" / "biryani delivery Lahore". The
biggest factors are **off-page** and only you can do them:

1. **Google Business Profile** (free) — the single most important thing. This is what
   puts you in the Google Map "pack" and Google Maps. Without it, no amount of code
   ranks you for "near me" searches.
2. **Reviews** — quantity + rating + freshness of Google reviews.
3. **Local citations & backlinks** — being listed on foodpanda, local directories, etc.

The code changes below make your site **technically excellent** so that once the
off-page signals exist, you rank as high as the code allows — and you win the "rich
results" (⭐ ratings, FAQ dropdowns, menu) that make people click you over competitors.

---

## ✅ Done in code (this session)

- **Per-page meta tags** — Home, Menu, Offers, Events now each have a unique title,
  description, canonical URL and Open Graph tags (via `src/lib/seo.js` → `useSeo`).
  - Fixed a real bug: every route previously reported `canonical = homepage`, telling
    Google all pages were duplicates of the homepage.
- **Menu structured data** — `/menu` now emits `Menu` / `MenuItem` JSON-LD built from
  your real dishes + prices → eligible for Google menu rich results.
- **Restaurant schema** — added `areaServed: Lahore`.
- Existing good stuff kept: Restaurant + Organization schema, FAQ schema, sitemap,
  robots.txt (AI-bot friendly), Open Graph / Twitter cards.

**Deploy required:** these live in the frontend — redeploy to Vercel for them to take effect.

---

## ✅ Also done (session 2)

- **Restaurant schema enriched** in `frontend/public/index.html` with:
  - `geo` (31.4520, 74.2680), `openingHoursSpecification` (10:00–23:00, Mon–Sun),
    `sameAs` → your Google Business Profile + Foodpanda.
- **Delivery Areas feature (new, realtime admin)** — manage at **`/admin/delivery-areas`**:
  add/edit/reorder/enable the areas you deliver to. They show on the public **`/delivery`**
  page (which now lists areas + emits `areaServed` schema) → helps rank for
  "biryani delivery in <area>" searches.
- **FAQ realtime admin already existed** at **`/admin/faqs`** — keep it filled with real
  customer questions; the `/faq` page auto-generates FAQ rich-result schema.

### ⚠️ Please VERIFY these values I used (from your backend defaults)
- **Opening hours** = 10:00–23:00 daily. If wrong, fix in `index.html` (and Admin → Settings).
- **Coordinates** = 31.4520, 74.2680. Confirm against your exact shop pin in Google Maps.
- **Rating markup**: I deliberately did **NOT** add `aggregateRating` — only add it if the
  number matches real reviews shown on your site, or Google penalizes it.

### 👉 Your next action in admin
Go to **Admin → Delivery Areas** and add your real areas (e.g. Johar Town, Model Town,
Faisal Town, Iqbal Town, Township, DHA…) with optional notes like "Free delivery · ~35 min".

---

## 📍 Off-page checklist — the real ranking drivers (do these yourself)

### 1. Google Business Profile (HIGHEST PRIORITY — free)
- [ ] Create/claim it: https://business.google.com
- [ ] Category: **Biryani restaurant** (+ "Pakistani restaurant", "Delivery restaurant")
- [ ] Exact business name, address, phone (must MATCH your website exactly — "NAP consistency")
- [ ] Set the pin location precisely on the map
- [ ] Add opening hours (same as the schema above)
- [ ] Add your website URL: https://www.karachinaseebbiryani.com
- [ ] Upload 10+ real photos (food, shop front, packaging) — photos drive clicks
- [ ] Add menu / add "Order online" link pointing to `/menu`
- [ ] Turn on messaging + keep hours updated (Google favors active profiles)

### 2. Reviews
- [ ] Ask every happy customer for a Google review (put a QR code on receipts/packaging)
- [ ] Reply to EVERY review (good and bad) — Google rewards engagement
- [ ] Target: get to 50+ reviews at 4.5★+ (this beats most competitors' code SEO)

### 3. Local listings & backlinks (NAP consistency everywhere)
- [ ] foodpanda / Cheetay / local delivery apps
- [ ] Facebook Page + Instagram (link back to the site)
- [ ] Local Lahore food directories / blogs
- [ ] Ask any food bloggers/influencers you know to link to the site

### 4. Content (helps rank for specific searches)
- [ ] Keep the FAQ page filled with real questions ("Do you deliver to DHA?",
      "Minimum order for free delivery?") — these already generate FAQ rich results
- [ ] Consider adding delivery-area pages (e.g. "Biryani delivery in Johar Town")

---

## 📈 Verify & monitor (free tools)
- [ ] **Google Search Console** (https://search.google.com/search-console) — submit
      `https://www.karachinaseebbiryani.com/sitemap.xml`, watch which keywords you rank for
- [ ] **Rich Results Test** (https://search.google.com/test/rich-results) — paste your
      URL, confirm Restaurant / Menu / FAQ schema all validate
- [ ] **PageSpeed Insights** (https://pagespeed.web.dev) — check mobile Core Web Vitals
- [ ] Google Analytics is already installed (tag `G-5MKTW97QYT`)

---

## Optional next-level code work (ask me)
- **Pre-rendering** (react-snap): serve real static HTML per route so social previews
  and non-Google crawlers see full content instead of an empty React shell.
- **Delivery-area landing pages** for local keyword targeting.
- **Image optimization** (WebP + lazy loading) for faster mobile load = better ranking.
