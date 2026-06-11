# Vercel Deployment + Namecheap DNS Guide

This guide is for deploying **Karachi Naseeb Biryani** to production.

- Frontend → **Vercel** (React static build)
- Backend → **Railway / Render / Fly.io** (FastAPI needs a long-running Python host; Vercel
  serverless functions can technically run FastAPI but it's a poor fit for this app because
  of APScheduler, Stripe SDK, Motor connection pooling, and the 4500-line single-file
  layout).
- Database → **MongoDB Atlas** (free M0 tier is enough to start).
- Domain → **`www.karachinaseebbiryani.com`** purchased on Namecheap.

You will follow Phases A → E in order.

---

## Phase A — MongoDB Atlas (5 min)

1. Go to <https://cloud.mongodb.com>, sign up / log in.
2. Build a Database → **M0 Free Tier** → choose Region close to your backend host (e.g.
   AWS Mumbai or AWS Singapore).
3. Create a database user (Database Access → Add New Database User) — username + strong
   password. Save these.
4. Network Access → Add IP Address → **Allow Access from Anywhere (0.0.0.0/0)** for now.
   (Tighten to your backend host IP later.)
5. Connect → Drivers → copy the connection string. It looks like:

   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

6. Append `&appName=knb-prod` and replace `<password>`. Save this string as `MONGO_URL`.
7. Decide a DB name — `knb_prod`. Save as `DB_NAME`.

---

## Phase B — Backend Host (Railway recommended, 10 min)

> Pick ONE backend host. Steps below are for **Railway** because it's the cheapest +
> easiest for FastAPI with persistent process. Render and Fly.io work identically.

1. Push the repo to GitHub (you said you'll do this).
2. Go to <https://railway.app> → New Project → Deploy from GitHub repo → pick your KNB repo.
3. Railway will auto-detect Python; if it doesn't, set the **Root Directory** to `backend/`.
4. Add a **Start Command** in the service Settings:

   ```bash
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```

5. Add a `requirements.txt` reference (it's already at `backend/requirements.txt`).
6. **Environment Variables** — add ALL of these (copy from your local `backend/.env`, then
   update the marked ones):

   | Key | Value |
   |---|---|
   | `MONGO_URL` | The Atlas URI from Phase A (`mongodb+srv://...`) |
   | `DB_NAME` | `knb_prod` |
   | `CORS_ORIGINS` | `https://www.karachinaseebbiryani.com,https://karachinaseebbiryani.com` |
   | `JWT_SECRET` | **Generate a new one!** `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
   | `GOOGLE_CLIENT_ID` | (same as local) |
   | `GOOGLE_CLIENT_SECRET` | (same as local) |
   | `FACEBOOK_APP_ID` | (same as local) |
   | `FACEBOOK_APP_SECRET` | (same as local) |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | `karachinaseebbiryani599@gmail.com` |
   | `SMTP_PASSWORD` | Gmail app password |
   | `SMTP_FROM` | `karachinaseebbiryani599@gmail.com` |
   | `FEEDBACK_RECIPIENT_EMAIL` | `karachinaseebbiryani599@gmail.com` |
   | `ORDER_RESPONSE_WINDOW_SEC` | `120` |
   | `STRIPE_API_KEY` | Your Stripe live key (or leave unset to disable card payments) |

7. Railway will deploy and give you a public URL like
   `https://knb-backend-production.up.railway.app`. **Save this URL** — you need it in Phase C.
8. Smoke-test the backend:

   ```bash
   curl https://<railway-url>/api/menu
   ```

   Should return the seeded menu JSON. If you get 500, check Railway logs.

---

## Phase C — Vercel Frontend Deploy (5 min)

1. Go to <https://vercel.com> → New Project → Import from GitHub → pick the same repo.
2. Configure:
   - **Root Directory:** `frontend/`
   - **Framework Preset:** `Create React App`
   - **Build Command:** `yarn build` (default — Vercel auto-detects from `package.json`)
   - **Output Directory:** `build`
   - **Install Command:** `yarn install`
3. **Environment Variables** (Vercel → Project Settings → Environment Variables):

   | Key | Value | Environments |
   |---|---|---|
   | `REACT_APP_BACKEND_URL` | The Railway URL from Phase B (no trailing slash) | Production, Preview, Development |
   | `REACT_APP_GOOGLE_CLIENT_ID` | Your Google client ID | All |
   | `REACT_APP_FACEBOOK_APP_ID` | Your Facebook app ID | All |
   | `WDS_SOCKET_PORT` | `443` | All |
   | `ENABLE_HEALTH_CHECK` | `false` | All |

4. Deploy. Vercel gives you a URL like `https://knb-xxx.vercel.app`. Open it — the
   homepage should load. If you get a blank page, open DevTools → Console; usually means
   `REACT_APP_BACKEND_URL` is wrong.

---

## Phase D — Custom Domain (Vercel + Namecheap, 15 min + DNS propagation)

### D.1 — Add the domain in Vercel

1. In Vercel → Project → Settings → **Domains** → Add Domain.
2. Type `www.karachinaseebbiryani.com` → Add.
3. Vercel will ask you to set a DNS record. It will show ONE of two options — note which:
   - **CNAME** record: `www → cname.vercel-dns.com`  ← most common
   - or **A** record: `www → 76.76.21.21`
4. Also add the apex (root) domain: Add Domain → `karachinaseebbiryani.com`. Vercel will
   set up a redirect from apex → www automatically. It will require an **A** record:
   - `@ → 76.76.21.21`

### D.2 — Update DNS in Namecheap

1. Log in to Namecheap → Domain List → **Manage** next to `karachinaseebbiryani.com`.
2. Click **Advanced DNS** tab.
3. **Delete** any default "Parking" CNAME and URL Redirect records that Namecheap creates.
4. **Add these records** (use exactly what Vercel showed you in step D.1.3):

   | Type | Host | Value | TTL |
   |---|---|---|---|
   | CNAME Record | `www` | `cname.vercel-dns.com.` | Automatic |
   | A Record | `@` | `76.76.21.21` | Automatic |

   If Vercel asked for a different value (e.g. `76.76.21.93`), use what Vercel showed —
   they sometimes change.

5. Save. DNS propagation usually takes 5-15 minutes (occasionally up to 24 hours).
6. Check propagation: <https://dnschecker.org/#A/karachinaseebbiryani.com>
7. Back in Vercel → Domains, you'll see "Valid Configuration" green checkmarks next to both
   domains once DNS is live. Vercel auto-issues an SSL certificate within ~5 minutes.

### D.3 — Verify

Open `https://www.karachinaseebbiryani.com` — the homepage should load with a green padlock.
Open `https://karachinaseebbiryani.com` (without www) — it should redirect to www.

---

## Phase E — OAuth Console Updates (CRITICAL)

Without this, Google and Facebook login will fail on the production domain.

### E.1 — Google Cloud Console

1. <https://console.cloud.google.com> → APIs & Services → Credentials.
2. Click your OAuth 2.0 Client ID (the one ending in `apps.googleusercontent.com`).
3. **Authorized JavaScript origins** — add:
   - `https://www.karachinaseebbiryani.com`
   - `https://karachinaseebbiryani.com`
4. **Authorized redirect URIs** — add:
   - `https://www.karachinaseebbiryani.com`
   - `https://karachinaseebbiryani.com`
   - (You can leave the preview URLs in place — they don't conflict.)
5. Save. Changes take ~5 minutes to propagate.

### E.2 — Facebook Developer Console

1. <https://developers.facebook.com/apps> → pick your app (id starts with 2866...).
2. **Facebook Login** → **Settings** → **Valid OAuth Redirect URIs** — add:
   - `https://www.karachinaseebbiryani.com/`
   - `https://karachinaseebbiryani.com/`
3. **App Domains** (Settings → Basic) — add:
   - `www.karachinaseebbiryani.com`
   - `karachinaseebbiryani.com`
4. **App Mode** → switch from "Development" to **Live** if you haven't already (top of
   the dashboard). Facebook will require you to add a Privacy Policy URL and a Data
   Deletion URL; you can use simple Google Sites pages or add them on your site.

---

## Phase F — Final Checks

1. Open `https://www.karachinaseebbiryani.com` in an incognito window.
2. Sign in with Google → should succeed and land on `/profile`.
3. Sign in with Facebook → same.
4. Place a test order (use a real phone number to receive the WhatsApp).
5. Log in to admin (`/admin/sign-in` with `admin@restaurant.com` / `admin123`) and accept
   the order. The customer's success page should auto-redirect to live tracking.
6. **Change the admin password!** Profile → settings, or via `/api/users/{id}` PUT.

---

## Operational Tips

- **Logs:** Railway → Deployments → click the running deployment → Logs tab.
  Vercel → Deployments → click the deployment → Logs tab.
- **Rolling back:** Both Railway and Vercel let you roll back to any previous deployment
  in one click. Use this if something breaks.
- **Backups:** MongoDB Atlas → Backups → enable Cloud Backups (free with M0 has snapshot
  retention; consider upgrading to M2 once revenue justifies it).
- **Monitoring:** Set up Vercel Speed Insights (free) and Railway's built-in metrics.

---

## Cost Estimate (USD, monthly)

| Service | Tier | Cost |
|---|---|---|
| Vercel (frontend) | Hobby (free) | $0 |
| Railway (backend) | Starter | ~$5 |
| MongoDB Atlas | M0 | $0 |
| Namecheap (.com) | annual | ~$1/mo |
| **Total** | | **~$6/month** |

Plenty of headroom to scale. Move to Vercel Pro ($20) and Atlas M2 ($9) when you cross
1000+ daily orders.
