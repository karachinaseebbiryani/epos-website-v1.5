# epos-website-v1.5

Restaurant ordering website + POS. FastAPI backend (`backend/server.py`) serving
the built React frontend (`frontend/`) plus a Flutter customer app (`mobile/`).

## Payment Gateways (EasyPaisa / JazzCash / PayFast)

Hosted-redirect wallet gateways are configured from the admin panel at
**`/admin/payment-gateways`** (Enable toggle, Sandbox/Live mode, credentials,
callback URLs). Config is stored in the `payment_gateway_settings` Mongo
collection; env vars act as a per-field fallback so env-driven deploys keep
working:

| Gateway   | Env fallback vars |
|-----------|-------------------|
| JazzCash  | `JAZZCASH_MERCHANT_ID`, `JAZZCASH_PASSWORD`, `JAZZCASH_INTEGRITY_SALT` |
| EasyPaisa | `EASYPAISA_STORE_ID`, `EASYPAISA_HASH_KEY`, optional `EASYPAISA_INQUIRY_USERNAME` / `EASYPAISA_INQUIRY_PASSWORD` |
| PayFast   | `PAYFAST_MERCHANT_ID`, `PAYFAST_SECURED_KEY`, `PAYFAST_ENV` |

Notes:

- **`PUBLIC_API_BASE`** (env) must be set in production to the backend's public
  origin (e.g. `https://knb-backend.fly.dev`) — it builds the gateway
  callback/return URLs. Locally the request host is used automatically.
- **JazzCash**: register the Return URL shown on the admin page (or its prefix)
  in the JazzCash merchant portal before going live. Sandbox self-registration:
  https://sandbox.jazzcash.com.pk
- **EasyPaisa**: without the optional Inquiry API credentials, successful
  payments land in **Pending Verification** (admin approves in Orders — the
  Easypay postback is unsigned). With them, payments are confirmed
  server-to-server and marked paid automatically.
- **PayFast still runs from env vars only.** The admin card saves credentials
  but they are inert — see the migration comments in `backend/server.py`
  ("HOSTED PAYMENT GATEWAYS" section) for the steps to flip it to DB config
  using the same driver/registry framework.
- Going live is config-only: switch the mode to Live and enter live
  credentials on the admin page (plus `PUBLIC_API_BASE` + portal URL
  registration). No code changes.

Tests: `python backend_test_gateways.py [BASE_URL]` (end-to-end against a
local dev server; mutates gateway settings — dev DB only) and
`backend/tests/test_gateway_hashes.py` (offline JazzCash HMAC / EasyPaisa AES
unit vectors).
