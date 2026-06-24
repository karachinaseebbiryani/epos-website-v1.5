# 06 — Technical Setup & Export

## A. Dependency List

### Backend (`/app/backend/requirements.txt` — 128 entries; key ones)

```
fastapi==0.110.1
uvicorn==0.25.0
motor==3.3.1
pymongo==4.5.0
pydantic==2.13.3
python-dotenv
python-multipart
httpx
pytz
bcrypt==4.1.3
pyjwt
APScheduler==3.11.2
twilio
stripe
emergentintegrations==0.1.0     # for Whisper STT, GPT-4o, OpenAI TTS, Gemini Nano Banana
boto3                            # optional, for S3 backups
```

Install all with:
```bash
pip install -r /app/backend/requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

(The extra-index-url is required for `emergentintegrations`.)

### Frontend (`/app/frontend/package.json` — 56 deps + 13 devDeps; key ones)

```
react: ^19.0.0
react-dom: ^19.0.0
react-router-dom: ^7.1.1
react-scripts: 5.0.1
axios: ^1.7.9
sonner: ^1.7.1
lucide-react: ^0.469.0
tailwindcss: ^3.4.17
@radix-ui/react-* (shadcn/ui primitives)
@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
qrcode.react: ^4.2.0
http-proxy-middleware: ^3.0.5
@craco/craco: ^7.1.0
```

Install with:
```bash
cd /app/frontend && yarn install
```

(Use `yarn`, NOT `npm`. Mixing breaks builds.)

## B. Environment Variables

### Backend `/app/backend/.env`

```bash
# Protected by Emergent platform — do NOT change in preview env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"

# Required for auth
JWT_SECRET="<long-random-string>"          # MUST stay constant; rotation logs everyone out
ADMIN_EMAIL="admin@restaurant.com"
ADMIN_PASSWORD="admin123"                   # CHANGE for production; seed_admin uses this on every boot

# CORS (Emergent preview uses *)
CORS_ORIGINS="*"

# Customer-site frontend URL (used for some redirect-back flows)
FRONTEND_URL="http://localhost:3000"

# OPTIONAL — populate to enable integrations
EMERGENT_LLM_KEY=""                         # universal key for OpenAI/Anthropic/Gemini via emergentintegrations
                                            # Get via emergent_integrations_manager tool

TWILIO_ACCOUNT_SID=""                       # for outbound WhatsApp on customer order accept
TWILIO_AUTH_TOKEN=""
WHATSAPP_FROM=""                            # e.g. "whatsapp:+14155238886"

STRIPE_API_KEY=""                           # test key from /app/scripts (if exists) or stripe.com
```

### Frontend `/app/frontend/.env`

```bash
# Protected by Emergent platform — do NOT change in preview env
REACT_APP_BACKEND_URL="https://order-management-139.preview.emergentagent.com"
```

For local dev, set to `http://localhost:8001` instead.

## C. Setup Instructions (fresh clone)

### Prerequisites
- Python 3.11+
- Node.js 20+
- yarn 1.22+
- MongoDB 6+ running on `localhost:27017`

### One-time setup
```bash
# Backend
cd /app/backend
pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/

# Frontend
cd /app/frontend
yarn install
```

### Local development (without supervisor)

```bash
# Terminal 1 — MongoDB
mongod --dbpath /var/lib/mongodb

# Terminal 2 — Backend
cd /app/backend
uvicorn server:app --reload --host 0.0.0.0 --port 8001

# Terminal 3 — Frontend
cd /app/frontend
yarn start
```

Open `http://localhost:3000`. Sign in at `http://localhost:3000/admin/sign-in` with `admin@restaurant.com` / `admin123`.

### Emergent environment (uses supervisor)

Already running. To restart after code changes:
```bash
sudo supervisorctl restart backend         # after backend .env or requirements.txt change
sudo supervisorctl restart frontend        # after package.json change
sudo supervisorctl status                   # to verify
```

Hot-reload covers most code changes — restart not needed.

## D. Build & Deployment Instructions

### Production frontend build
```bash
cd /app/frontend
yarn build
# Output: /app/frontend/build/  — serve with nginx
```

### Production backend
```bash
cd /app/backend
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
# (drop --reload for prod)
```

### Recommended nginx (production)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend static
    location / {
        root /app/frontend/build;
        try_files $uri /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static uploads (if used)
    location /uploads/ {
        alias /app/uploads/;
    }
}
```

### Emergent platform (current)
- Already deployed on the preview URL.
- Click "Deploy to production" inside Emergent UI when ready.
- Custom domains via Emergent's domain settings.

### Windows on-premise (existing)
1. Copy `/app/windows-setup/` to the Windows machine.
2. Install MongoDB Community Edition.
3. Run `1_INSTALL.bat` as administrator (installs Python deps + node deps + builds frontend).
4. Run `2_START_RestoPOS.vbs` (silent launcher; brings up Mongo + uvicorn + frontend + cloudflared).
5. Cashier opens `http://localhost:3000` (LAN: `http://<windows-ip>:3000`).
6. To stop: `STOP_RESTOPOS.bat`.

## E. Database Import / Export

### Exporting current data (admin-only)

```bash
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@restaurant.com","password":"admin123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8001/api/data/export > backup.json

# Inspect
python3 -c "import json;d=json.load(open('backup.json'));print({k: len(v) for k,v in d.items() if isinstance(v, list)})"
```

The export preserves `_id` so cross-collection references stay valid after re-import.

### Importing data (admin-only)

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @backup.json \
  http://localhost:8001/api/data/import
```

This is the canonical migration path: export from old Windows install, import into new merged platform.

### Direct MongoDB backup (alternative)

```bash
# Backup all collections
mongodump --uri="mongodb://localhost:27017" --db=test_database --out=/tmp/mongo-backup

# Restore
mongorestore --uri="mongodb://localhost:27017" --db=test_database /tmp/mongo-backup/test_database
```

### Daily automated backup (recommended for production)
Add to crontab on the host:
```bash
0 3 * * * mongodump --uri="$MONGO_URL" --db=$DB_NAME --gzip --archive=/backups/knb-$(date +\%Y\%m\%d).gz && find /backups -mtime +30 -delete
```

## F. Test Credentials Bootstrap

The backend's `seed_admin()` function (server.py:1852) runs on every startup and:
1. Creates `admin@restaurant.com` if missing.
2. Resets the password to `ADMIN_PASSWORD` env value (only if mismatch).
3. Syncs admin's `permissions` field to the current `ALL_PERMISSIONS` list.
4. Writes `/app/memory/test_credentials.md` with the seeded creds.

To create additional staff:
```bash
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@restaurant.com","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"cashier1@restaurant.com","password":"changeme","name":"Cashier One","role":"cashier","permissions":["pos","reports_x"]}' \
  http://localhost:8001/api/users
```

## G. Health Checks

```bash
# Backend up?
curl -s http://localhost:8001/api/categories | head -c 100

# Frontend up?
curl -s http://localhost:3000 | grep -i "<title>"

# Mongo up?
mongosh --eval "db.runCommand({ping:1})" --quiet

# All services
sudo supervisorctl status
```

Expected output:
```
backend                          RUNNING   pid ...
code-server                      RUNNING   pid ...
frontend                         RUNNING   pid ...
mongodb                          RUNNING   pid ...
```

## H. Logging

Backend logs:
```bash
tail -n 100 /var/log/supervisor/backend.out.log
tail -n 100 /var/log/supervisor/backend.err.log
```

Frontend (CRA) logs:
```bash
tail -n 100 /var/log/supervisor/frontend.out.log
```

In-process Python logging uses `logger.info/warning/error` (configured at top of `server.py`). Important entries to grep for: `"Daily report scheduled"`, `"Admin created"`, `"outsourced hook skipped"` (after roadmap phase 1).
