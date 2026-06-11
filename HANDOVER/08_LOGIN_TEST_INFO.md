# 08 — Login + Test Information

## A. Test Credentials

### Admin (works at all admin entry points)
- **Email**: `admin@restaurant.com`
- **Password**: `admin123`
- **Role**: `admin`
- **Permissions**: 19 (full set; auto-synced to `ALL_PERMISSIONS` on every backend startup)
- **Login URL**: `/admin/sign-in` (canonical)
- **Legacy URLs that redirect here**: `/admin/login`, `/admin/staff-login`
- **Seeded automatically** by `seed_admin()` in `server.py:1852` on every backend boot. Sourced from `backend/.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).

### Customer
- **No pre-seeded customer accounts.** Self-register at `/register` (customer page) or via `POST /api/customer/register`.
- Customer login URL: `/login` (NOT `/admin/sign-in`).

## B. Important Routes

### Public URLs

| URL | Purpose |
|---|---|
| `/` | Customer homepage |
| `/menu` | Customer menu browser |
| `/cart` | Customer cart |
| `/checkout` | Place order |
| `/track/:id` | Track an online order |
| `/order/:id/success` | Post-payment success page |
| `/order/:id/bank-payment` | Bank-transfer flow with proof upload |
| `/review/:orderId` | Post-delivery review form |
| `/login` | Customer login |
| `/register` | Customer signup |
| `/profile` | Customer profile + order history |
| `/offers` | Public offers page |
| `/events` | Public events page |

### Admin URLs (require auth)

| URL | Purpose | Permission required |
|---|---|---|
| `/admin/sign-in` | **★ Unified login (canonical)** | none (public entry) |
| `/admin/login` | Redirects to `/admin/sign-in` | — |
| `/admin/staff-login` | Redirects to `/admin/sign-in` | — |
| `/admin/legacy-login` | Old login page (kept for backward-compat tests) | — |

#### POS Operations section (legacy POS, sidebar appears FIRST)
| URL | Purpose | Permission |
|---|---|---|
| `/admin/pos` | Cashier punching screen | `pos` |
| `/admin/dashboard-classic` | Classic operational dashboard | `dashboard` |
| `/admin/menu-mgmt` | Menu CRUD + outsourced product config | `menu` (or `menu_edit` to save) |
| `/admin/inventory` | Stock management | `inventory` |
| `/admin/vendors` | Vendor master + transactions + payments | `vendors` |
| `/admin/expenses` | Daily expense tracking | `expenses` |
| `/admin/refunds` | Refund processing | `refunds` |
| `/admin/old-orders` | Order history with date filter | `orders_history` |
| `/admin/reports` | X / Z reports + export | `reports_x` (also `reports_z` for Z) |
| `/admin/settings-full` | Comprehensive operational settings | `settings` |

#### Online Store section (sidebar appears SECOND)
| URL | Purpose | Permission |
|---|---|---|
| `/admin` or `/admin/dashboard` | Online dashboard | `online_dashboard` |
| `/admin/orders` | Online orders queue + alerts | `online_orders` |
| `/admin/menu` | Online menu (with variations) | `online_menu` |
| `/admin/categories` | Online categories | `online_menu` |
| `/admin/offers` | Promotional offers | `online_offers` |
| `/admin/events` | Events admin | `online_events` |
| `/admin/settings` | Online-store settings | `online_settings` |

## C. Backend URLs

- **Preview (Emergent)**: `https://project-handoff-12.preview.emergentagent.com`
- **Local**: `http://localhost:8001`
- **All API endpoints prefixed**: `/api/...` (e.g. `/api/auth/login`, `/api/orders`)
- **API docs**: `/docs` (FastAPI auto-generated Swagger UI) and `/openapi.json`

## D. Quick Smoke Tests

### Backend health
```bash
API="http://localhost:8001/api"   # or replace with the Emergent preview URL

# 1) Login
TOKEN=$(curl -s -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@restaurant.com","password":"admin123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "Token: ${#TOKEN} chars"

# 2) Permissions count (should be 19)
curl -s $API/auth/me -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('Perms:', len(d['permissions']))"

# 3) Categories
curl -s $API/categories | python3 -c "import sys,json;print('Cats:', len(json.load(sys.stdin)))"

# 4) Menu items
curl -s $API/menu-items -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('Items:', len(d), '| Outsourced:', sum(1 for i in d if i.get('is_outsourced')))"

# 5) Online orders pending count (used by GlobalOrderAlert)
curl -s $API/online-orders/pending-count -H "Authorization: Bearer $TOKEN"
```

### Outsourced product end-to-end test
```bash
# Pick first category
CAT=$(curl -s $API/categories | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")

# Create vendor
VID=$(curl -s -X POST $API/vendors \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Test Khokha"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

# Create outsourced item
MID=$(curl -s -X POST $API/menu-items \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Pepsi\",\"price\":120,\"category_id\":\"$CAT\",\"stock\":50,\"is_outsourced\":true,\"outsourced_vendor_id\":\"$VID\",\"outsourced_unit_cost\":80}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

# Place order with 3 units
curl -s -X POST $API/orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"items\":[{\"item_id\":\"$MID\",\"name\":\"Test Pepsi\",\"price\":120,\"quantity\":3}],\"payment_type\":\"cash\",\"subtotal\":360,\"tax\":18,\"total\":378}"

# Check vendor sales summary (expected: auto_billed_from_orders=240, balance=240)
curl -s "$API/vendors/$VID/sales-summary" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Cleanup
curl -s -X DELETE "$API/menu-items/$MID" -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE "$API/vendors/$VID" -H "Authorization: Bearer $TOKEN"
```

### Frontend smoke test
1. Open `https://project-handoff-12.preview.emergentagent.com/admin/sign-in`
2. Click Sign In (defaults pre-filled: admin@restaurant.com / admin123)
3. Should redirect to `/admin/pos` within ~1 second
4. Verify left sidebar shows "POS Operations" section first, then "Online Store"
5. Add 2-3 items to cart, verify checkout footer stays pinned
6. Click Cash payment, verify Receipt modal opens with sticky Print/Close buttons
7. Open Menu Management → "+ New Item" → scroll the dialog → verify "This product is outsourced" checkbox appears

## E. Running Backend Tests

```bash
cd /app
# All iter 2 tests
pytest backend/tests/test_iteration2_outsourced.py -v

# All iter 1 regression
pytest backend/tests/test_merged_iteration.py -v

# Both at once
pytest backend/tests/ -v
```

Expected: 45/45 pass.

## F. Calling the testing agent (for new features)

The testing agent is the canonical way to verify changes. Format:

```python
testing_agent_v3({
  "original_problem_statement_and_user_choices_inputs": "...",
  "features_or_bugs_to_test": ["...", "..."],
  "files_of_reference": ["/app/backend/server.py — ...", ...],
  "required_credentials": ["admin@restaurant.com / admin123"],
  "testing_type": "both" | "backend only(skip frontend)" | "frontend only(skip backend)",
  "agent_to_agent_context_note": "context for the testing agent",
  "prev_test_files_and_folder": ["/app/test_reports/iteration_2.json", ...],
  "mocked_api": {"value": {"has_mocked_apis": false, "mocked_apis_list": []}},
  "other_misc_info": "..."
})
```

The agent writes its result to `/app/test_reports/iteration_{N}.json`. Read it before declaring success.

## G. Test Data Notes

- The seeded admin user is created on every backend boot.
- Default seeded data: 4 categories (Biryani, Murg Pulao, BBQ & Grill, Sides & Drinks), 12 menu items, 3 offers, 2 events.
- POS orders accumulate over time. To reset for testing: `db.orders.deleteMany({date: "YYYY-MM-DD"})` in mongosh.
- Vendor transactions accumulate from outsourced sales. To inspect: `db.vendor_transactions.find({auto_source: "order"}).sort({created_at:-1}).limit(5)`.

## H. Production Deploy Pre-flight

Before deploying to a real domain:

1. Change `ADMIN_PASSWORD` in `backend/.env` from `admin123` to a strong password.
2. Generate a fresh `JWT_SECRET` (`python -c "import secrets;print(secrets.token_hex(32))"`).
3. Set `STRIPE_API_KEY` to live key (not test key).
4. Set `TWILIO_*` to production credentials.
5. Set `EMERGENT_LLM_KEY` for voice + AI features.
6. Switch JWT cookie config from `secure=False` to `secure=True` once on HTTPS.
7. Tighten `CORS_ORIGINS` from `"*"` to your actual domain.
8. Add rate limiting on `/api/auth/login` (5/min/IP).
9. Add Mongo backup cron.
10. Verify the Emergent platform's "Deploy to production" button (or your nginx config) is correctly proxying `/api/*` to backend port 8001.
