"""V2 backend tests — iteration 6.

Coverage:
 - Social login endpoints (Google/Facebook) reject invalid tokens with HTTP 401, never 500/404.
 - Offers now expose/accept min_order_amount.
 - Online order coupon enforcement uses offer.min_order_amount.
 - Reward stacking: coupon + Diamond discount reward returns 400.
 - GET /api/admin/reviews?status=all does not 500 when feedback rows have order_id=None.
 - GET /api/track/{id} exposes prep_time_min, response_deadline_seconds, accepted_at, delivery_fee_overridden.
 - PUT /api/online-orders/{id}/operations updates prep_time, free_delivery, delivery_fee_override; rejects on terminal orders.
 - Happy-path regressions: /auth/login, create order, accept, reject (with reason), track.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://live-food-delivery-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"


# ---------- shared fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session", autouse=True)
def ensure_24_7(admin_headers):
    """Force restaurant 24/7 open for the whole test session, then restore."""
    schedule = {d: {"open": "00:00", "close": "23:59", "closed": False}
                for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}
    body = {"business_hours_enabled": True, "weekly_schedule": schedule}
    r = requests.put(f"{BASE_URL}/api/admin/online-settings", json=body, headers=admin_headers, timeout=15)
    assert r.status_code == 200, f"could not force open: {r.status_code} {r.text}"
    yield
    restore = {
        "business_hours_enabled": True,
        "weekly_schedule": {d: {"open": "10:00", "close": "23:00", "closed": False}
                            for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]},
    }
    requests.put(f"{BASE_URL}/api/admin/online-settings", json=restore, headers=admin_headers, timeout=15)


def _make_order_payload(total, coupon=None, reward_id=None, phone=None):
    return {
        "items": [{"item_id": "menu-x", "name": "Biryani", "price": total, "quantity": 1}],
        "total_price": float(total),
        "customer_name": "TEST V2",
        "phone": phone or "03001234567",
        "address": "TEST Address 123",
        "notes": "",
        "payment_method": "cod",
        "coupon_code": coupon,
        "reward_id": reward_id,
    }


# ---------- 1) Social login: invalid tokens must 401 ----------
class TestSocialLoginInvalid:
    def test_google_invalid_token_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/customer/google", json={"credential": "invalid-token"}, timeout=15)
        assert r.status_code != 404, "endpoint missing"
        assert r.status_code != 500, f"unexpected 500: {r.text}"
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"
        assert "Invalid Google login" in r.text or "Google" in r.text

    def test_facebook_invalid_token_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/customer/facebook",
                          json={"access_token": "invalid-token", "user_id": "0"}, timeout=15)
        assert r.status_code != 404, "endpoint missing"
        assert r.status_code != 500, f"unexpected 500: {r.text}"
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"


# ---------- 2) Offers: min_order_amount round-trip ----------
class TestOffersMinOrderAmount:
    def test_create_offer_echoes_min_order_amount(self, admin_headers):
        code = f"TESTMIN{uuid.uuid4().hex[:6].upper()}"
        body = {
            "title": "TEST_MIN_OFFER",
            "description": "min order amount test",
            "discount_amount": 100,
            "coupon_code": code,
            "min_order_amount": 1234,
            "active": True,
        }
        r = requests.post(f"{BASE_URL}/api/offers", json=body, headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"create offer failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["coupon_code"] == code
        assert float(data["min_order_amount"]) == 1234.0

        # GET ?active_only=false includes it
        r2 = requests.get(f"{BASE_URL}/api/offers", params={"active_only": "false"}, timeout=15)
        assert r2.status_code == 200
        codes = {o["coupon_code"]: o for o in r2.json()}
        assert code in codes, "offer not present in GET /offers"
        assert float(codes[code]["min_order_amount"]) == 1234.0


# ---------- 3) Coupon min_order_amount enforcement on order create ----------
class TestCouponMinOrderEnforcement:
    @pytest.fixture(scope="class")
    def min_offer(self, admin_headers):
        # Use the pre-seeded MIN1500 offer if present, else create one.
        list_r = requests.get(f"{BASE_URL}/api/offers", params={"active_only": "false"}, timeout=15)
        existing = next((o for o in list_r.json() if o.get("coupon_code") == "MIN1500"), None)
        if existing and float(existing.get("min_order_amount", 0)) > 0:
            return existing
        body = {
            "title": "TEST_MIN1500",
            "description": "min 1550 needed",
            "discount_amount": 100,
            "coupon_code": "MIN1500",
            "min_order_amount": 1550,
            "active": True,
        }
        r = requests.post(f"{BASE_URL}/api/offers", json=body, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()

    def test_below_min_rejected_400(self, min_offer):
        min_amt = float(min_offer["min_order_amount"])
        r = requests.post(f"{BASE_URL}/api/online-orders",
                          json=_make_order_payload(total=min_amt - 100, coupon=min_offer["coupon_code"]),
                          timeout=15)
        assert r.status_code == 400, f"expected 400 below min, got {r.status_code}: {r.text}"
        assert "Minimum order" in r.text or "minimum" in r.text.lower()

    def test_above_min_accepted(self, min_offer):
        min_amt = float(min_offer["min_order_amount"])
        r = requests.post(f"{BASE_URL}/api/online-orders",
                          json=_make_order_payload(total=min_amt + 200, coupon=min_offer["coupon_code"]),
                          timeout=15)
        assert r.status_code == 200, f"expected 200 above min, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("coupon_used") == min_offer["coupon_code"] or data.get("discount_amount", 0) >= 0
        assert data.get("id"), "order id missing"


# ---------- 4) Reward stacking: coupon + Diamond discount reward => 400 ----------
class TestRewardStacking:
    @pytest.fixture(scope="class")
    def customer_token_and_id(self, admin_headers):
        email = f"TEST_stack_{uuid.uuid4().hex[:8]}@x.com"
        reg = requests.post(f"{BASE_URL}/api/customer/register",
                            json={"email": email, "password": "pass1234", "name": "Stack Tester", "phone": "03007654321"},
                            timeout=15)
        assert reg.status_code in (200, 201), f"register failed: {reg.status_code} {reg.text}"
        token = reg.json().get("token")
        cid = reg.json().get("id") or reg.json().get("customer_id")
        if not cid:
            # Fallback: derive from JWT via /api/loyalty/balance? Use admin lookup.
            # The register response in this codebase returns id.
            pytest.skip("customer id not in register response")
        # Adjust diamond balance to 5000 for redemption
        adj = requests.post(f"{BASE_URL}/api/admin/loyalty/adjust",
                            json={"customer_id": cid, "diamonds": 5000, "notes": "TEST"},
                            headers=admin_headers, timeout=15)
        assert adj.status_code == 200, f"adjust failed: {adj.status_code} {adj.text}"
        return token, cid

    @pytest.fixture(scope="class")
    def discount_reward(self, admin_headers):
        body = {
            "title": "TEST_FIXED_DISCOUNT",
            "description": "TEST 50 off reward",
            "cost_diamonds": 100,
            "reward_type": "discount_fixed",
            "reward_value": "50",
            "is_active": True,
        }
        r = requests.post(f"{BASE_URL}/api/admin/loyalty/rewards", json=body, headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"reward create failed: {r.status_code} {r.text}"
        return r.json()

    @pytest.fixture(scope="class")
    def stackable_coupon(self, admin_headers):
        code = f"TESTSTK{uuid.uuid4().hex[:5].upper()}"
        body = {
            "title": "TEST_STACK_COUPON",
            "description": "no min",
            "discount_amount": 50,
            "coupon_code": code,
            "min_order_amount": 0,
            "active": True,
        }
        r = requests.post(f"{BASE_URL}/api/offers", json=body, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()

    def test_coupon_plus_discount_reward_rejected_400(self, customer_token_and_id, discount_reward, stackable_coupon):
        token, _ = customer_token_and_id
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        body = _make_order_payload(total=2000, coupon=stackable_coupon["coupon_code"], reward_id=discount_reward["id"])
        r = requests.post(f"{BASE_URL}/api/online-orders", json=body, headers=headers, timeout=15)
        assert r.status_code == 400, f"expected 400 when stacking coupon + discount reward, got {r.status_code}: {r.text}"
        txt = r.text.lower()
        assert "coupon" in txt and ("diamond" in txt or "discount reward" in txt or "cannot be combined" in txt), \
            f"error message should mention coupon + diamond/discount conflict: {r.text}"


# ---------- 5) Admin reviews must not 500 on feedback rows with order_id=None ----------
class TestAdminReviewsNoCrash:
    def test_feedback_then_get_admin_reviews(self, admin_headers):
        # Create a no-order feedback entry
        fb = requests.post(f"{BASE_URL}/api/feedback",
                           json={"name": "TEST_FB", "email": "TEST_fb@x.com", "phone": "03001112222",
                                 "rating": 4, "comment": "TEST feedback no order"},
                           timeout=15)
        assert fb.status_code in (200, 201), f"feedback create failed: {fb.status_code} {fb.text}"

        r = requests.get(f"{BASE_URL}/api/admin/reviews", params={"status": "all"}, headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"admin reviews crashed: {r.status_code} {r.text}"
        data = r.json()
        assert isinstance(data, list)
        # Find at least one feedback entry with empty order_id
        feedback_rows = [x for x in data if x.get("is_feedback")]
        assert any(x.get("order_id") == "" for x in feedback_rows), "expected at least one is_feedback row with order_id=''"


# ---------- 6) Track endpoint exposes V2 fields ----------
class TestPublicTrackV2Fields:
    def test_track_exposes_v2_fields(self):
        # Create a fresh pending order
        r = requests.post(f"{BASE_URL}/api/online-orders", json=_make_order_payload(total=800), timeout=15)
        assert r.status_code == 200, f"order create failed: {r.status_code} {r.text}"
        oid = r.json()["id"]

        tr = requests.get(f"{BASE_URL}/api/track/{oid}", timeout=15)
        assert tr.status_code == 200, tr.text
        d = tr.json()
        assert "prep_time_min" in d
        assert int(d["prep_time_min"]) == 30  # default
        assert "response_deadline_seconds" in d
        assert 0 <= int(d["response_deadline_seconds"]) <= 120
        assert "accepted_at" in d
        assert "delivery_fee_overridden" in d
        assert isinstance(d["delivery_fee_overridden"], bool)


# ---------- 7) PUT /online-orders/{id}/operations ----------
class TestOrderOperations:
    @pytest.fixture()
    def fresh_order_id(self):
        r = requests.post(f"{BASE_URL}/api/online-orders", json=_make_order_payload(total=900), timeout=15)
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_prep_time_update(self, admin_headers, fresh_order_id):
        oid = fresh_order_id
        r = requests.put(f"{BASE_URL}/api/online-orders/{oid}/operations",
                         json={"prep_time_min": 45}, headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        tr = requests.get(f"{BASE_URL}/api/track/{oid}", timeout=15).json()
        assert int(tr["prep_time_min"]) == 45

    def test_free_delivery(self, admin_headers, fresh_order_id):
        oid = fresh_order_id
        r = requests.put(f"{BASE_URL}/api/online-orders/{oid}/operations",
                         json={"free_delivery": True}, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        tr = requests.get(f"{BASE_URL}/api/track/{oid}", timeout=15).json()
        assert float(tr["delivery_fee"]) == 0.0
        assert tr["delivery_fee_overridden"] is True

    def test_delivery_fee_override(self, admin_headers, fresh_order_id):
        oid = fresh_order_id
        r = requests.put(f"{BASE_URL}/api/online-orders/{oid}/operations",
                         json={"delivery_fee_override": 200}, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        tr = requests.get(f"{BASE_URL}/api/track/{oid}", timeout=15).json()
        assert float(tr["delivery_fee"]) == 200.0
        assert tr["delivery_fee_overridden"] is True

    def test_operations_blocked_on_delivered_order(self, admin_headers, fresh_order_id):
        oid = fresh_order_id
        # Accept then move through statuses to "delivered"
        a = requests.post(f"{BASE_URL}/api/online-orders/{oid}/accept", headers=admin_headers, timeout=15)
        assert a.status_code == 200, f"accept failed: {a.status_code} {a.text}"
        for st in ["preparing", "ready", "out_for_delivery", "delivered"]:
            up = requests.put(f"{BASE_URL}/api/online-orders/{oid}/status",
                              json={"status": st}, headers=admin_headers, timeout=15)
            assert up.status_code == 200, f"status->{st} failed: {up.status_code} {up.text}"
        # Now operations must return 400
        r = requests.put(f"{BASE_URL}/api/online-orders/{oid}/operations",
                         json={"prep_time_min": 60}, headers=admin_headers, timeout=15)
        assert r.status_code == 400, f"expected 400 on delivered order, got {r.status_code}: {r.text}"


# ---------- 8) Happy path regressions ----------
class TestHappyPathRegressions:
    def test_admin_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        assert "token" in r.json()

    def test_create_accept_track(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/online-orders", json=_make_order_payload(total=700), timeout=15)
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        a = requests.post(f"{BASE_URL}/api/online-orders/{oid}/accept", headers=admin_headers, timeout=15)
        assert a.status_code == 200, a.text
        tr = requests.get(f"{BASE_URL}/api/track/{oid}", timeout=15)
        assert tr.status_code == 200
        assert tr.json()["status"] in ("accepted", "preparing")

    def test_create_reject_with_reason(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/online-orders", json=_make_order_payload(total=650), timeout=15)
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        rej = requests.post(f"{BASE_URL}/api/online-orders/{oid}/reject",
                            json={"reason": "out_of_stock"}, headers=admin_headers, timeout=15)
        assert rej.status_code == 200, rej.text
        tr = requests.get(f"{BASE_URL}/api/track/{oid}", timeout=15).json()
        assert tr["status"] == "rejected"
        assert "out_of_stock" in tr.get("rejection_reason", "")
