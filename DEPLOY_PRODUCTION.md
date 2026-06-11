# Production Deployment — Fly.io (backend) + Vercel (frontend) + MongoDB Atlas

Stack mapping:

| Piece | Host | Artifact |
|---|---|---|
| FastAPI backend | **Fly.io** | `backend/Dockerfile` + `backend/fly.toml` |
| React frontend | **Vercel** | `frontend/` (CRA build) + `frontend/vercel.json` |
| Database | **MongoDB Atlas** | M0 free tier is enough to start |

Follow phases **A → D in order**. Phase A gives you `MONGO_URL`, Phase B gives you the
backend URL needed by Phase C.

---

## Phase A — MongoDB Atlas (~5 min)

1. <https://cloud.mongodb.com> → Build a Database → **M0 Free** → region close to your
   Fly region (e.g. AWS Singapore if Fly region is `sin`).
2. **Database Access** → Add New Database User → username + strong password. Save them.
3. **Network Access** → Add IP Address → `0.0.0.0/0` (Allow from anywhere).
   Fly machines have dynamic egress IPs, so this stays open — the strong password +
   TLS protect you.
4. **Connect → Drivers** → copy the connection string:

   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

   Replace `<password>`. This is your `MONGO_URL`.
5. Choose a DB name: `knb_prod`. This is your `DB_NAME` (collections are auto-created
   on first write; `seed_admin()` creates the admin user on first boot).

### Migrating existing data (optional)
If you have data in the current environment, export it from the running app:
`GET /api/data/export` (admin token) → save the JSON → after deploy, `POST /api/data/import`
on the production backend. IDs are preserved.

---

## Phase B — Backend on Fly.io (~15 min)

Prereqs: install flyctl (<https://fly.io/docs/flyctl/install/>) and `fly auth signup` / `fly auth login`.

All commands run from the **`backend/` directory**.

### 1. Create the app (no deploy yet)

```bash
cd backend
fly launch --no-deploy --copy-config --name knb-backend --region sin
```

- `--copy-config` uses the provided `fly.toml` as-is. If the name `knb-backend` is taken,
  pick another (e.g. `knb-backend-prod`) — flyctl updates `fly.toml` automatically.
- Pick the region closest to the restaurant/customers (`sin` Singapore, `bom` Mumbai...).
  If you change it, keep `fly.toml` `primary_region` in sync.

### 2. Create the uploads volume (payment-proof screenshots)

```bash
fly volumes create knb_uploads --region sin --size 1
```

Must be in the same region as the app. `fly.toml` already mounts it at `/app/uploads`.

### 3. Set secrets (env vars)

```bash
fly secrets set \
  MONGO_URL='mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority' \
  DB_NAME='knb_prod' \
  JWT_SECRET="$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')" \
  ADMIN_EMAIL='admin@restaurant.com' \
  ADMIN_PASSWORD='<CHANGE-ME-strong-password>' \
  CORS_ORIGINS='https://<your-app>.vercel.app' \
  COOKIE_SAMESITE='none' \
  COOKIE_SECURE='true' \
  ORDER_RESPONSE_WINDOW_SEC='120'
```

> **CRITICAL — `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true` + explicit `CORS_ORIGINS`.**
> The legacy POS admin pages authenticate with cookies. Frontend (Vercel domain) and
> backend (fly.dev domain) are different sites, so cookies must be `SameSite=None; Secure`
> and CORS must list the exact frontend origin(s) — never `*`.
> When you later add a custom domain, extend CORS_ORIGINS:
> `CORS_ORIGINS='https://www.karachinaseebbiryani.com,https://karachinaseebbiryani.com,https://<your-app>.vercel.app'`

Optional integrations (set only the ones you use):

```bash
fly secrets set \
  STRIPE_API_KEY='sk_live_...' \
  GOOGLE_CLIENT_ID='...' \
  FACEBOOK_APP_ID='...' FACEBOOK_APP_SECRET='...' \
  TWILIO_ACCOUNT_SID='...' TWILIO_AUTH_TOKEN='...' TWILIO_WHATSAPP_FROM='whatsapp:+1415...' \
  EMERGENT_LLM_KEY='...'
```

### 4. Deploy

```bash
fly deploy
fly scale count 1        # MUST be exactly 1 machine — see note below
```

> **Why exactly 1 machine:** JWTs carry an `INSTANCE_ID` that is unique per process.
> With 2+ machines, logins bounce between instances and randomly 401. Also APScheduler
> would email the daily Z-report once per machine. Keep `count 1` until those are
> reworked. (Tokens also reset on every deploy/restart — by design, staff just re-log-in.)

### 5. Smoke-test

```bash
curl https://knb-backend.fly.dev/api/public/restaurant-info
curl -X POST https://knb-backend.fly.dev/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@restaurant.com","password":"<your-admin-password>"}'
```

Both must return JSON (not 5xx). `fly logs` shows live logs; look for
`seed_admin` and `Application startup complete`.

---

## Phase C — Frontend on Vercel (~10 min)

1. Push the repo to GitHub (use the platform "Save to GitHub" feature).
2. <https://vercel.com> → **Add New → Project** → import the repo.
3. Configure the project:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Create React App (auto-detected)
   - Build command `yarn build`, output `build` (defaults are fine)
4. **Environment Variables** (Production):

   | Key | Value |
   |---|---|
   | `REACT_APP_BACKEND_URL` | `https://knb-backend.fly.dev` (NO trailing slash, NO `/api`) |
   | `GENERATE_SOURCEMAP` | `false` |

   > CRA bakes env vars in at **build time** — if you ever change the backend URL you
   > must re-deploy (Redeploy button), not just edit the var.
5. Deploy. You get `https://<your-app>.vercel.app`.
6. **Close the loop**: put that exact URL into the backend CORS list:

   ```bash
   cd backend && fly secrets set CORS_ORIGINS='https://<your-app>.vercel.app'
   ```

   (`fly secrets set` restarts the app automatically.)

`frontend/vercel.json` is already included — it rewrites all non-static paths to
`index.html` so React Router deep links (`/admin/pos`, `/track/:id`, ...) work on refresh.

---

## Phase D — Custom domain (optional, ~10 min + DNS propagation)

### Frontend (Vercel)
1. Vercel project → Settings → Domains → add `www.karachinaseebbiryani.com` and
   `karachinaseebbiryani.com`.
2. At your registrar (Namecheap): add the DNS records Vercel shows
   (CNAME `www` → `cname.vercel-dns.com`, A/ALIAS for apex → Vercel's IP).
3. After it goes green, update backend CORS to include both domains (Phase B §3 note).

### Backend (optional — keep fly.dev, or use api subdomain)
```bash
fly certs add api.karachinaseebbiryani.com
```
Add the CNAME it prints (`api` → `knb-backend.fly.dev`). Then change Vercel's
`REACT_APP_BACKEND_URL` to `https://api.karachinaseebbiryani.com` and **redeploy** the frontend.

---

## Production checklist

- [ ] Atlas user + `0.0.0.0/0` network access; `MONGO_URL` includes the password
- [ ] `JWT_SECRET` newly generated (never reuse dev secret)
- [ ] `ADMIN_PASSWORD` changed from `admin123`
- [ ] `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` set on Fly
- [ ] `CORS_ORIGINS` = exact frontend origin(s), comma-separated, no `*`
- [ ] Fly volume `knb_uploads` created **before** first deploy
- [ ] `fly scale count 1`
- [ ] Vercel `REACT_APP_BACKEND_URL` = Fly URL (no trailing slash)
- [ ] Smoke tests: homepage loads → menu loads → customer order → `/admin/sign-in`
      login → order appears in `/admin/orders` → POS page loads categories
- [ ] (Optional) Stripe webhook: Stripe Dashboard → Webhooks → endpoint
      `https://knb-backend.fly.dev/api/payments/webhook`
- [ ] (Optional) Google OAuth: add the Vercel/custom domain to Authorized JavaScript
      origins in Google Cloud Console
- [ ] (Optional) Settings → daily Z-report email (SMTP password in /admin/settings-full)

## Costs (as of mid-2026)

- **Atlas M0**: free.
- **Fly.io**: 1× shared-cpu-1x 512MB always-on ≈ $3–5/mo + $0.15/GB volume.
- **Vercel Hobby**: free for this traffic level.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Admin login works but POS pages 401 | `COOKIE_SAMESITE`/`COOKIE_SECURE` not set, or CORS_ORIGINS wrong/has `*`. Check `fly secrets list`. |
| CORS error in browser console | Frontend origin missing from `CORS_ORIGINS` (must match scheme+host exactly, no trailing slash). |
| Random 401s after login | More than 1 Fly machine running → `fly scale count 1`. |
| Frontend calls `localhost:8001` | `REACT_APP_BACKEND_URL` wasn't set at build time → set var, **redeploy** on Vercel. |
| Payment screenshots 404 after redeploy | Volume not mounted — confirm `fly volumes list` shows `knb_uploads` attached. |
| `/admin/pos` blank on refresh | `vercel.json` missing from the deployed root directory (must be `frontend/vercel.json`). |
