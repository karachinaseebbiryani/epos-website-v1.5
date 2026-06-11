"""
Backend regression tests for iteration 4 — P0..P4 patches.

Covers:
- Public business hours endpoint
- Admin online settings business-hours fields (GET + PUT persistence)
- Online order BLOCK when restaurant closed via weekly_schedule
- Phone validation (>=11 digits) on /customer/register and /online-orders
- Reviews now expose admin_reply, replied_by, replied_at, is_feedback
- Public /feedback endpoint (no auth)
- Admin /admin/reviews/{id}/reply -> stores admin_reply and returns email_sent flag
- Loyalty: delivered status increments diamond_balance once (idempotent)
- /loyalty/balance returns balance with customer JWT
- POS regression: /auth/login, /orders, /categories, /menu-items, /settings
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # fallback for pytest invocation when only frontend/.env is loaded
    try:
        with open("/app/frontend/.env", "r") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass
BASE_URL = (BASE_URL or "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASS = "admin123"

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


# ---------- shared fixtures ----------

@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no admin token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def default_schedule():
    return {d: {"open": "10:00", "close": "23:00", "closed": False} for d in DAY_KEYS}


@pytest.fixture(scope="session", autouse=True)
def restore_business_hours_after_session(s, admin_headers, default_schedule):
    """Ensure we don't leave the store closed after the test session."""
    yield
    try:
        s.put(
            f"{API}/admin/online-settings",
            headers=admin_headers,
            json={
                "business_hours_enabled": True,
                "business_hours_timezone": "Asia/Karachi",
                "weekly_schedule": default_schedule,
            },
            timeout=20,
        )
    except Exception:
        pass


# ---------- POS regression smoke tests ----------

class TestPOSRegression:
    def test_admin_login(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("token") or body.get("access_token")

    def test_get_settings(self, s):
        r = s.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200, r.text

    def test_get_categories(self, s):
        r = s.get(f"{API}/categories", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_menu_items(self, s):
        r = s.get(f"{API}/menu-items", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_orders_today(self, s, admin_headers):
        # /api/orders is POST-only; the public listing endpoints are /orders/today and /orders/history
        r = s.get(f"{API}/orders/today", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)


# ---------- P2: Business hours ----------

class TestBusinessHours:
    def test_public_business_hours_shape(self, s):
        r = s.get(f"{API}/public/business-hours", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("is_open", "enabled", "timezone", "weekly_schedule", "today", "next_open_at"):
            assert k in data, f"missing key {k} in business-hours response: {data}"
        assert data["timezone"] == "Asia/Karachi" or isinstance(data["timezone"], str)
        assert isinstance(data["weekly_schedule"], dict)
        assert "day" in data["today"]

    def test_admin_online_settings_includes_business_hours_fields(self, s, admin_headers):
        r = s.get(f"{API}/admin/online-settings", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "business_hours_enabled" in body
        assert "business_hours_timezone" in body
        assert "weekly_schedule" in body
        assert isinstance(body["weekly_schedule"], dict)
        for d in DAY_KEYS:
            assert d in body["weekly_schedule"], f"missing day {d}"

    def test_put_online_settings_persists_weekly_schedule(self, s, admin_headers, default_schedule):
        # Set Monday close to 22:30 just to verify persistence; then restore.
        custom = {d: dict(default_schedule[d]) for d in DAY_KEYS}
        custom["mon"]["close"] = "22:30"
        r = s.put(
            f"{API}/admin/online-settings",
            headers=admin_headers,
            json={
                "business_hours_enabled": True,
                "business_hours_timezone": "Asia/Karachi",
                "weekly_schedule": custom,
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("business_hours_enabled") is True
        assert body["weekly_schedule"]["mon"]["close"] == "22:30"
        # Restore default for safety
        s.put(
            f"{API}/admin/online-settings",
            headers=admin_headers,
            json={"weekly_schedule": default_schedule},
            timeout=20,
        )


# ---------- P3 + P2: Online order block & phone validation ----------

class TestOnlineOrderBlockAndPhone:
    def _valid_payload(self):
        return {
            "items": [{"item_id": "x", "name": "Test Item", "price": 100, "quantity": 1}],
            "total_price": 100,
            "customer_name": "TEST_Customer",
            "phone": "03001234567",
            "address": "TEST_Address 1",
            "payment_method": "cod",
        }

    def test_phone_too_short_register_rejected(self, s):
        r = s.post(
            f"{API}/customer/register",
            json={
                "email": f"TEST_short_{uuid.uuid4().hex[:6]}@x.com",
                "password": "secret123",
                "name": "TEST_short",
                "phone": "12345",
            },
            timeout=15,
        )
        assert r.status_code == 422, f"expected 422 got {r.status_code} {r.text}"
        assert "11 digits" in r.text or "phone" in r.text.lower()

    def test_phone_too_short_online_order_rejected(self, s):
        payload = self._valid_payload()
        payload["phone"] = "12345"
        r = s.post(f"{API}/online-orders", json=payload, timeout=20)
        assert r.status_code == 422, f"expected 422 got {r.status_code} {r.text}"
        assert "11 digits" in r.text

    def test_online_order_blocked_when_closed(self, s, admin_headers, default_schedule):
        # Force-close every day (BH look-ahead caps at 7 days).
        closed_schedule = {d: {"open": "10:00", "close": "23:00", "closed": True} for d in DAY_KEYS}
        r = s.put(
            f"{API}/admin/online-settings",
            headers=admin_headers,
            json={
                "business_hours_enabled": True,
                "business_hours_timezone": "Asia/Karachi",
                "weekly_schedule": closed_schedule,
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text

        # Verify public endpoint reflects closed
        bh = s.get(f"{API}/public/business-hours", timeout=15).json()
        assert bh.get("is_open") is False, f"expected closed, got {bh}"

        # Attempt an order -> should 400
        r2 = s.post(f"{API}/online-orders", json=self._valid_payload(), timeout=20)
        assert r2.status_code == 400, f"expected 400 closed, got {r2.status_code} {r2.text}"
        assert "closed" in r2.text.lower()

        # Restore
        r3 = s.put(
            f"{API}/admin/online-settings",
            headers=admin_headers,
            json={"weekly_schedule": default_schedule},
            timeout=20,
        )
        assert r3.status_code == 200

    def test_online_order_accepts_valid_phone_when_open(self, s, admin_headers, default_schedule):
        # Force-open (24/7) so the test is deterministic regardless of Karachi local time
        open_24x7 = {d: {"open": "00:00", "close": "23:59", "closed": False} for d in DAY_KEYS}
        s.put(
            f"{API}/admin/online-settings",
            headers=admin_headers,
            json={
                "business_hours_enabled": True,
                "weekly_schedule": open_24x7,
            },
            timeout=20,
        )
        bh = s.get(f"{API}/public/business-hours", timeout=15).json()
        assert bh.get("is_open") is True, f"expected open, got {bh}"
        r = s.post(f"{API}/online-orders", json=self._valid_payload(), timeout=20)
        # Restore defaults regardless of result
        s.put(
            f"{API}/admin/online-settings",
            headers=admin_headers,
            json={"weekly_schedule": default_schedule},
            timeout=20,
        )
        assert r.status_code in (200, 201), f"got {r.status_code} {r.text}"
        body = r.json()
        assert isinstance(body, dict)


# ---------- P4: Reviews / Feedback / Admin reply ----------

class TestFeedbackAndReviewReply:
    def test_public_feedback_creates_review(self, s):
        rid_payload = {
            "rating": 5,
            "comment": f"TEST_feedback {uuid.uuid4().hex[:6]}",
            "customer_name": "TEST_Anon",
            "email": "test_anon@x.com",
            "phone": "03001234567",
        }
        r = s.post(f"{API}/feedback", json=rid_payload, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "id" in body and body["id"]

    def test_get_reviews_includes_new_fields(self, s):
        # Ensure at least one review exists by creating feedback
        s.post(f"{API}/feedback", json={
            "rating": 4, "comment": f"TEST_listfields {uuid.uuid4().hex[:6]}",
            "customer_name": "TEST_X", "email": "x@x.com", "phone": "03001234567",
        }, timeout=15)
        r = s.get(f"{API}/reviews?limit=5", timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        sample = items[0]
        for k in ("admin_reply", "replied_by", "replied_at", "is_feedback"):
            assert k in sample, f"missing {k} in review item: {sample}"

    def test_admin_reply_to_review(self, s, admin_headers):
        # Create a feedback to reply to
        c = s.post(f"{API}/feedback", json={
            "rating": 3, "comment": f"TEST_reply {uuid.uuid4().hex[:6]}",
            "customer_name": "TEST_R", "email": "r@x.com", "phone": "03001234567",
        }, timeout=15)
        assert c.status_code == 200
        rid = c.json()["id"]
        rep = s.post(
            f"{API}/admin/reviews/{rid}/reply",
            headers=admin_headers,
            json={"reply": "Thanks for your TEST_feedback!"},
            timeout=20,
        )
        assert rep.status_code == 200, rep.text
        body = rep.json()
        assert body.get("ok") is True
        assert "email_sent" in body  # presence is required, value depends on SMTP
        # Confirm reply persisted
        r = s.get(f"{API}/reviews?limit=50", timeout=15).json()
        match = next((x for x in r if x.get("id") == rid), None)
        assert match is not None, "reply review not found in list"
        assert match.get("admin_reply") == "Thanks for your TEST_feedback!"
        assert match.get("replied_by")  # non-empty
        assert match.get("replied_at")


# ---------- P1: Loyalty diamonds on delivery ----------

class TestLoyaltyOnDelivery:
    @pytest.fixture(scope="class")
    def fresh_customer(self, s):
        email = f"TEST_loyal_{uuid.uuid4().hex[:8]}@x.com"
        r = s.post(
            f"{API}/customer/register",
            json={
                "email": email,
                "password": "secret123",
                "name": "TEST_Loyal",
                "phone": "03001234567",
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        return {"id": body["id"], "email": email, "token": body["token"]}

    def test_loyalty_balance_endpoint(self, s, fresh_customer):
        h = {"Authorization": f"Bearer {fresh_customer['token']}"}
        r = s.get(f"{API}/loyalty/balance", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "diamond_balance" in body
        assert isinstance(body["diamond_balance"], (int, float))

    def test_diamonds_credited_on_delivery_idempotent(self, s, admin_headers, fresh_customer, default_schedule):
        # Force-open (24/7) so this test is deterministic regardless of Karachi local time
        open_24x7 = {d: {"open": "00:00", "close": "23:59", "closed": False} for d in DAY_KEYS}
        s.put(
            f"{API}/admin/online-settings",
            headers=admin_headers,
            json={"business_hours_enabled": True, "weekly_schedule": open_24x7},
            timeout=20,
        )
        bh = s.get(f"{API}/public/business-hours", timeout=15).json()
        assert bh.get("is_open") is True, f"expected open, got {bh}"

        cust_h = {
            "Authorization": f"Bearer {fresh_customer['token']}",
            "Content-Type": "application/json",
        }

        # Create an authenticated online order so customer_id is recorded
        order_payload = {
            "items": [{"item_id": "x", "name": "Test Item", "price": 500, "quantity": 1}],
            "total_price": 500,
            "customer_name": "TEST_Loyal",
            "phone": "03001234567",
            "address": "TEST_Address 1",
            "payment_method": "cod",
        }
        r = s.post(f"{API}/online-orders", headers=cust_h, json=order_payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        order = r.json()
        order_id = order.get("id") or order.get("order_id") or order.get("_id")
        assert order_id, f"no order id in response: {order}"
        diamonds_earned = order.get("diamonds_earned", 0)

        # Read balance before delivery
        before = s.get(f"{API}/loyalty/balance", headers=cust_h, timeout=15).json()["diamond_balance"]

        # First delivery -> awards diamonds
        u1 = s.put(
            f"{API}/online-orders/{order_id}/status",
            headers=admin_headers,
            json={"status": "delivered"},
            timeout=20,
        )
        assert u1.status_code == 200, u1.text
        time.sleep(0.5)
        after1 = s.get(f"{API}/loyalty/balance", headers=cust_h, timeout=15).json()["diamond_balance"]
        assert after1 == before + int(diamonds_earned), (
            f"expected balance {before + int(diamonds_earned)} got {after1} (earned={diamonds_earned})"
        )

        # Second delivery -> idempotent (no extra credit)
        u2 = s.put(
            f"{API}/online-orders/{order_id}/status",
            headers=admin_headers,
            json={"status": "delivered"},
            timeout=20,
        )
        assert u2.status_code == 200, u2.text
        time.sleep(0.3)
        after2 = s.get(f"{API}/loyalty/balance", headers=cust_h, timeout=15).json()["diamond_balance"]
        assert after2 == after1, f"loyalty not idempotent: {after1} -> {after2}"



# ---------- P1: Reward redemption deduction (regression for ObjectId fix) ----------

class TestRewardRedemptionDeduction:
    """Regression: applying a reward at order creation must deduct cost_diamonds
    from customer.diamond_balance. Previously failed because cust['_id'] was a str
    and update_one against db.customers._id (ObjectId) matched 0 docs."""

    @pytest.fixture(scope="class")
    def open_24x7_fixture(self, s, admin_headers, default_schedule):
        open_24x7 = {d: {"open": "00:00", "close": "23:59", "closed": False} for d in DAY_KEYS}
        s.put(
            f"{API}/admin/online-settings",
            headers=admin_headers,
            json={"business_hours_enabled": True, "weekly_schedule": open_24x7},
            timeout=20,
        )
        yield
        # restore in session-scoped autouse fixture as well, but be defensive
        s.put(
            f"{API}/admin/online-settings",
            headers=admin_headers,
            json={"weekly_schedule": default_schedule},
            timeout=20,
        )

    @pytest.fixture(scope="class")
    def reward_id(self, s, admin_headers):
        # Create a small fixed-discount reward so we can apply it cheaply
        payload = {
            "title": f"TEST_reward_{uuid.uuid4().hex[:6]}",
            "description": "TEST regression reward",
            "cost_diamonds": 20,
            "reward_type": "discount_fixed",
            "reward_value": "50",
            "is_active": True,
        }
        r = s.post(f"{API}/admin/loyalty/rewards", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        rid = r.json().get("id")
        assert rid, f"no reward id in response: {r.json()}"
        yield rid
        # cleanup
        try:
            s.delete(f"{API}/admin/loyalty/rewards/{rid}", headers=admin_headers, timeout=15)
        except Exception:
            pass

    @pytest.fixture(scope="class")
    def funded_customer(self, s, admin_headers):
        email = f"TEST_redeem_{uuid.uuid4().hex[:8]}@x.com"
        r = s.post(
            f"{API}/customer/register",
            json={"email": email, "password": "secret123", "name": "TEST_Redeem", "phone": "03001234567"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        cid = body["id"]
        token = body["token"]
        # Top up via admin/loyalty/adjust so balance >= reward cost
        adj = s.post(
            f"{API}/admin/loyalty/adjust",
            headers=admin_headers,
            json={"customer_id": cid, "diamonds": 100, "notes": "TEST_seed"},
            timeout=15,
        )
        assert adj.status_code == 200, adj.text
        assert adj.json().get("new_balance") == 100
        return {"id": cid, "email": email, "token": token}

    def test_reward_redemption_deducts_balance(self, s, admin_headers, funded_customer, reward_id, open_24x7_fixture):
        cust_h = {"Authorization": f"Bearer {funded_customer['token']}", "Content-Type": "application/json"}

        # Confirm starting balance is 100
        before = s.get(f"{API}/loyalty/balance", headers=cust_h, timeout=15).json()["diamond_balance"]
        assert before == 100, f"expected 100, got {before}"

        # Place authenticated online order WITH reward_id
        order_payload = {
            "items": [{"item_id": "x", "name": "Test Item", "price": 500, "quantity": 1}],
            "total_price": 500,
            "customer_name": "TEST_Redeem",
            "phone": "03001234567",
            "address": "TEST_Address 1",
            "payment_method": "cod",
            "reward_id": reward_id,
        }
        r = s.post(f"{API}/online-orders", headers=cust_h, json=order_payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        order = r.json()
        # The order should reflect that a reward was applied
        applied = order.get("reward_applied")
        assert applied, f"expected reward_applied on order, got: {order}"
        assert applied.get("diamonds_spent") == 20
        assert applied.get("reward_id") == reward_id

        # Balance must have decreased by 20 (cost_diamonds)
        time.sleep(0.3)
        after = s.get(f"{API}/loyalty/balance", headers=cust_h, timeout=15).json()["diamond_balance"]
        assert after == before - 20, f"expected {before - 20}, got {after} (reward redemption did NOT deduct)"
