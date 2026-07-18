#!/usr/bin/env python3
"""
Payment Gateways (EasyPaisa / JazzCash) test suite.

Covers:
- Admin GET/PUT /api/admin/payment-gateways: masking, blank-keeps-secret,
  validation 400s (bad mode, enable without creds, 16-char hash key)
- /api/public/settings gateway flags flip with enable+creds
- POST /api/payments/{gateway}/create-session: 404 unknown, 503 unconfigured,
  field assertions (paisa amount, secure hash, easypay hashed req)
- Return flow: correctly-signed JazzCash success -> paid; replay idempotent;
  tampered hash -> pending_verification; failure code -> failed
- EasyPaisa phase-1 HTML (Confirm.jsf form) + phase-2 without inquiry creds
  -> pending_verification
- Literal-route non-shadowing: /payments/payfast/* still served by its own
  handler (503 "PayFast not configured", never 404 "Unknown gateway")

Run against a LOCAL dev server (default http://localhost:8001/api):
    python backend_test_gateways.py [BASE_URL]

NOTE: mutates the payment_gateway_settings doc of the target DB — run
against a local/dev database only.
"""

import hashlib
import hmac
import sys

import requests

BASE_URL = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8001/api"

ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"

# Sandbox-shaped dummy credentials used for the whole suite.
JC_MERCHANT = "MC99999"
JC_PASSWORD = "testpw123"
JC_SALT = "testsalt99"
EP_STORE = "99999"
EP_HASHKEY = "0123456789abcdef"  # exactly 16 chars

test_results = []


def log_test(test_name: str, passed: bool, details: str):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status} - {test_name}")
    print(f"Details: {details}")
    test_results.append({"test": test_name, "passed": passed, "details": details})


def admin_login():
    try:
        r = requests.post(f"{BASE_URL}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                          timeout=10)
        if r.status_code == 200:
            token = r.json().get("access_token") or r.json().get("token")
            print(f"✓ Admin login OK, token: {token[:20]}...")
            return token
        print(f"✗ Admin login failed: {r.status_code} - {r.text[:200]}")
        return None
    except Exception as e:
        print(f"✗ Admin login error: {e}")
        return None


def jazzcash_secure_hash(fields: dict, salt: str) -> str:
    """Mirror of server-side _jazzcash_secure_hash."""
    vals = [str(v) for k, v in sorted(fields.items())
            if k.lower().startswith("pp") and k != "pp_SecureHash"
            and str(v).strip() != ""]
    msg = salt + "&" + "&".join(vals)
    return hmac.new(salt.encode(), msg.encode(), hashlib.sha256).hexdigest().upper()


def place_order(payment_method: str):
    """Create a real online order (server re-prices authoritatively) and
    return its id."""
    menu = requests.get(f"{BASE_URL}/menu", timeout=15).json()
    items = menu if isinstance(menu, list) else menu.get("items", [])
    item = next((i for i in items if float(i.get("price", 0)) > 0), None)
    if not item:
        return None, "no menu item with price > 0"
    price = float(item["price"])
    payload = {
        "customer_name": "Gateway Test",
        "phone": "03001234567",
        "address": "Test Street 1, Lahore",
        "items": [{
            "item_id": item.get("id") or item.get("_id"),
            "name": item.get("name", "Item"),
            "price": price,
            "quantity": 1,
        }],
        "total_price": price,
        "order_type": "pickup",  # skip delivery geo/fee logic
        "payment_method": payment_method,
    }
    r = requests.post(f"{BASE_URL}/online-orders", json=payload, timeout=15)
    if r.status_code != 200:
        return None, f"order create failed {r.status_code}: {r.text[:200]}"
    return r.json().get("id"), None


def main():
    token = admin_login()
    if not token:
        print("Cannot continue without admin login")
        sys.exit(1)
    H = {"Authorization": f"Bearer {token}"}

    # ---------- 1. Admin GET: masked defaults ----------
    r = requests.get(f"{BASE_URL}/admin/payment-gateways", headers=H, timeout=10)
    ok = r.status_code == 200
    body = r.json() if ok else {}
    ok = ok and set(body.keys()) >= {"easypaisa", "jazzcash", "payfast"}
    ok = ok and "hash_key" not in body.get("easypaisa", {})  # raw secret never returned
    ok = ok and "hash_key_set" in body.get("easypaisa", {})
    ok = ok and "callback_url" in body.get("jazzcash", {})
    ok = ok and "note" in body.get("payfast", {})
    log_test("Admin GET masked shape", ok, f"{r.status_code}: keys={list(body.keys())}")

    # ---------- 2. Validation 400s ----------
    r = requests.put(f"{BASE_URL}/admin/payment-gateways", headers=H,
                     json={"jazzcash": {"mode": "bogus"}}, timeout=10)
    log_test("PUT bad mode -> 400", r.status_code == 400, f"{r.status_code}: {r.text[:120]}")

    r = requests.put(f"{BASE_URL}/admin/payment-gateways", headers=H,
                     json={"jazzcash": {"enabled": True, "merchant_id": "",
                                        "password": "", "integrity_salt": ""}}, timeout=10)
    log_test("PUT enable without creds -> 400", r.status_code == 400,
             f"{r.status_code}: {r.text[:120]}")

    r = requests.put(f"{BASE_URL}/admin/payment-gateways", headers=H,
                     json={"easypaisa": {"hash_key": "tooshort"}}, timeout=10)
    log_test("PUT short easypaisa hash key -> 400", r.status_code == 400,
             f"{r.status_code}: {r.text[:120]}")

    # ---------- 3. Public flags off while disabled ----------
    pub = requests.get(f"{BASE_URL}/public/settings", timeout=10).json()
    ok = pub.get("easypaisa_gateway_enabled") is False and pub.get("jazzcash_gateway_enabled") is False
    log_test("Public flags false while disabled", ok,
             f"ep={pub.get('easypaisa_gateway_enabled')} jc={pub.get('jazzcash_gateway_enabled')}")

    # ---------- 4. Configure both gateways (sandbox) ----------
    r = requests.put(f"{BASE_URL}/admin/payment-gateways", headers=H, json={
        "jazzcash": {"enabled": True, "mode": "sandbox", "merchant_id": JC_MERCHANT,
                     "password": JC_PASSWORD, "integrity_salt": JC_SALT},
        "easypaisa": {"enabled": True, "mode": "sandbox", "store_id": EP_STORE,
                      "hash_key": EP_HASHKEY},
    }, timeout=10)
    body = r.json() if r.status_code == 200 else {}
    ok = (r.status_code == 200
          and body.get("jazzcash", {}).get("integrity_salt_set") is True
          and body.get("jazzcash", {}).get("integrity_salt_last4") == JC_SALT[-4:]
          and body.get("easypaisa", {}).get("hash_key_set") is True)
    log_test("PUT creds -> masked echo", ok, f"{r.status_code}: jc={body.get('jazzcash')}")

    # Blank secret keeps stored value
    r = requests.put(f"{BASE_URL}/admin/payment-gateways", headers=H,
                     json={"jazzcash": {"password": ""}}, timeout=10)
    ok = r.status_code == 200 and r.json().get("jazzcash", {}).get("password_set") is True
    log_test("Blank secret keeps stored value", ok, f"{r.status_code}")

    pub = requests.get(f"{BASE_URL}/public/settings", timeout=10).json()
    ok = pub.get("easypaisa_gateway_enabled") is True and pub.get("jazzcash_gateway_enabled") is True
    log_test("Public flags true after enable", ok,
             f"ep={pub.get('easypaisa_gateway_enabled')} jc={pub.get('jazzcash_gateway_enabled')}")

    # ---------- 5. create-session guards ----------
    r = requests.post(f"{BASE_URL}/payments/nosuchgw/create-session",
                      json={"order_id": "x", "origin_url": "http://localhost:8001"}, timeout=10)
    log_test("Unknown gateway -> 404", r.status_code == 404, f"{r.status_code}: {r.text[:120]}")

    # Literal-route non-shadowing: payfast must hit ITS OWN handler.
    r = requests.post(f"{BASE_URL}/payments/payfast/create-session",
                      json={"order_id": "x", "origin_url": "http://localhost:8001"}, timeout=10)
    ok = r.status_code in (503, 404) and "Unknown gateway" not in r.text
    log_test("PayFast literal route not shadowed", ok, f"{r.status_code}: {r.text[:120]}")

    # ---------- 6. JazzCash create-session field assertions ----------
    order_id, err = place_order("jazzcash")
    if not order_id:
        log_test("Place order (jazzcash)", False, err)
        summary(); return
    r = requests.post(f"{BASE_URL}/payments/jazzcash/create-session",
                      json={"order_id": order_id, "origin_url": "http://localhost:8001"},
                      timeout=15)
    ok = r.status_code == 200
    sess = r.json() if ok else {}
    f = sess.get("fields", {})
    ref = sess.get("ref", "")
    ok = ok and sess.get("action_url", "").startswith("https://sandbox.jazzcash.com.pk")
    ok = ok and f.get("pp_Amount", "").isdigit()  # integer paisa
    ok = ok and len(f.get("pp_SecureHash", "")) == 64
    ok = ok and f.get("pp_SecureHash") == jazzcash_secure_hash(f, JC_SALT)  # signed correctly
    ok = ok and len(ref) <= 20 and f.get("pp_TxnRefNo") == ref
    log_test("JazzCash create-session fields", ok,
             f"{r.status_code}: ref={ref} amount={f.get('pp_Amount')}")

    # ---------- 7. JazzCash signed success -> paid ----------
    resp_fields = {
        "pp_ResponseCode": "000",
        "pp_ResponseMessage": "Success",
        "pp_TxnRefNo": ref,
        "pp_Amount": f.get("pp_Amount"),
        "pp_RetreivalReferenceNo": "RRN123456",
    }
    resp_fields["pp_SecureHash"] = jazzcash_secure_hash(resp_fields, JC_SALT)
    r = requests.post(f"{BASE_URL}/payments/jazzcash/return", data=resp_fields,
                      timeout=10, allow_redirects=False)
    st = requests.get(f"{BASE_URL}/payments/jazzcash/status/{ref}", timeout=10).json()
    ok = r.status_code == 303 and "/payment/success" in r.headers.get("location", "")
    ok = ok and st.get("payment_status") == "paid"
    log_test("Signed success -> 303 + paid", ok,
             f"{r.status_code} loc={r.headers.get('location','')[:80]} status={st.get('payment_status')}")

    # Replay idempotency: same POST again, still paid.
    r = requests.post(f"{BASE_URL}/payments/jazzcash/return", data=resp_fields,
                      timeout=10, allow_redirects=False)
    st = requests.get(f"{BASE_URL}/payments/jazzcash/status/{ref}", timeout=10).json()
    log_test("Replay stays paid (idempotent)", st.get("payment_status") == "paid",
             f"status={st.get('payment_status')}")

    # ---------- 8. Tampered success -> pending_verification ----------
    order_id2, err = place_order("jazzcash")
    r = requests.post(f"{BASE_URL}/payments/jazzcash/create-session",
                      json={"order_id": order_id2, "origin_url": "http://localhost:8001"},
                      timeout=15)
    ref2 = r.json().get("ref")
    bad = {"pp_ResponseCode": "000", "pp_TxnRefNo": ref2,
           "pp_Amount": r.json()["fields"]["pp_Amount"],
           "pp_SecureHash": "0" * 64}
    r = requests.post(f"{BASE_URL}/payments/jazzcash/return", data=bad,
                      timeout=10, allow_redirects=False)
    st = requests.get(f"{BASE_URL}/payments/jazzcash/status/{ref2}", timeout=10).json()
    log_test("Tampered hash -> pending_verification",
             st.get("payment_status") == "pending_verification",
             f"status={st.get('payment_status')}")

    # ---------- 9. Failure code -> failed ----------
    order_id3, err = place_order("jazzcash")
    r = requests.post(f"{BASE_URL}/payments/jazzcash/create-session",
                      json={"order_id": order_id3, "origin_url": "http://localhost:8001"},
                      timeout=15)
    ref3 = r.json().get("ref")
    fail = {"pp_ResponseCode": "999", "pp_ResponseMessage": "Declined", "pp_TxnRefNo": ref3}
    r = requests.post(f"{BASE_URL}/payments/jazzcash/return", data=fail,
                      timeout=10, allow_redirects=False)
    st = requests.get(f"{BASE_URL}/payments/jazzcash/status/{ref3}", timeout=10).json()
    ok = r.status_code == 303 and "/payment/cancel" in r.headers.get("location", "")
    ok = ok and st.get("payment_status") == "failed"
    log_test("Failure code -> failed + cancel redirect", ok,
             f"{r.status_code} status={st.get('payment_status')}")

    # ---------- 10. EasyPaisa create-session + two-phase return ----------
    order_id4, err = place_order("easypaisa")
    r = requests.post(f"{BASE_URL}/payments/easypaisa/create-session",
                      json={"order_id": order_id4, "origin_url": "http://localhost:8001"},
                      timeout=15)
    ok = r.status_code == 200
    sess = r.json() if ok else {}
    epf = sess.get("fields", {})
    epref = sess.get("ref", "")
    ok = ok and sess.get("action_url", "").endswith("/easypay/Index.jsf")
    ok = ok and "easypaystg" in sess.get("action_url", "")  # sandbox host
    ok = ok and epf.get("merchantHashedReq") and epf.get("orderRefNum") == epref
    ok = ok and epref in epf.get("postBackURL", "")
    log_test("EasyPaisa create-session fields", ok,
             f"{r.status_code}: ref={epref} amount={epf.get('amount')}")

    # Phase 1: auth_token postback -> auto-submit Confirm.jsf HTML
    r = requests.get(f"{BASE_URL}/payments/easypaisa/return",
                     params={"ref": epref, "auth_token": "TESTTOKEN123"}, timeout=10)
    ok = r.status_code == 200 and "Confirm.jsf" in r.text and "TESTTOKEN123" in r.text
    log_test("EasyPaisa phase-1 Confirm.jsf HTML", ok, f"{r.status_code}: {r.text[:80]}")

    # Phase 2: unsigned success, no inquiry creds -> pending_verification
    r = requests.get(f"{BASE_URL}/payments/easypaisa/return",
                     params={"ref": epref, "status": "0000", "orderRefNumber": epref,
                             "desc": "SUCCESS"},
                     timeout=10, allow_redirects=False)
    st = requests.get(f"{BASE_URL}/payments/easypaisa/status/{epref}", timeout=10).json()
    ok = r.status_code == 303 and "/payment/success" in r.headers.get("location", "")
    ok = ok and st.get("payment_status") == "pending_verification"
    log_test("EasyPaisa unsigned success -> pending_verification", ok,
             f"{r.status_code} status={st.get('payment_status')}")

    # ---------- 11. Cleanup: disable both so local checkout isn't affected ----------
    requests.put(f"{BASE_URL}/admin/payment-gateways", headers=H,
                 json={"jazzcash": {"enabled": False}, "easypaisa": {"enabled": False}},
                 timeout=10)

    summary()


def summary():
    passed = sum(1 for t in test_results if t["passed"])
    print("\n" + "=" * 60)
    print(f"RESULTS: {passed}/{len(test_results)} passed")
    for t in test_results:
        mark = "✅" if t["passed"] else "❌"
        print(f"  {mark} {t['test']}")
    print("=" * 60)
    sys.exit(0 if passed == len(test_results) else 1)


if __name__ == "__main__":
    main()
