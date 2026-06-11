"""Backend tests for Smart Order Alert extension.

Covers:
- Admin login (admin@restaurant.com / admin123)
- POST /api/online-orders (public) creates a pending order
- GET /api/online-orders/pending-count (admin only)
- POST /api/online-orders/{id}/accept
- POST /api/online-orders/{id}/reject (with various reasons)
- PUT /api/online-orders/{id}/modify (recalculation, validation)
- POST /api/online-orders/{id}/confirm-modified
- PUT /api/online-orders/{id}/status with new statuses (accepted/rejected) and unknown status
- GET /api/track/{id} returns extended fields
- Regression: GET /api/menu, GET /api/online-orders, PUT /printed, GET /orders/today, POST /orders
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"


class NoCookieSession(requests.Session):
    def send(self, request, **kwargs):
        resp = super().send(request, **kwargs)
        self.cookies.clear()
        return resp


@pytest.fixture(scope="session")
def http():
    s = NoCookieSession()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(http):
    r = http.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    data = r.json()
    assert data.get("token")
    assert data.get("role") == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def _create_order(http, suffix="A", qty=2, price=350.0):
    payload = {
        "items": [
            {"item_id": "test-bir-1", "name": f"TEST_Biryani_{suffix}", "price": price, "quantity": qty},
            {"item_id": "test-rai-1", "name": "TEST_Raita", "price": 50.0, "quantity": 1},
        ],
        "total_price": price * qty + 50.0,
        "customer_name": f"TEST_Customer_{uuid.uuid4().hex[:6]}",
        "phone": "+923001234567",
        "address": "TEST Plot 1, Karachi",
        "notes": "smart-alert-test",
        "payment_method": "cod",
    }
    r = http.post(f"{API}/online-orders", json=payload)
    assert r.status_code == 200, f"create order failed: {r.status_code} {r.text}"
    return r.json()


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self, http):
        r = http.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "admin"
        assert isinstance(data["token"], str) and len(data["token"]) > 10


# ---------- Public order creation ----------
class TestCreateOrder:
    def test_public_create_order_pending(self, http):
        order = _create_order(http, "Create")
        assert order["status"] == "pending"
        assert "id" in order
        assert order["total_price"] == 750.0
        # GET /track to verify persisted
        t = http.get(f"{API}/track/{order['id']}")
        assert t.status_code == 200
        td = t.json()
        assert td["status"] == "pending"
        assert td["modified"] is False
        assert td["modification_pending"] is False
        assert "rejection_reason" in td
        assert "accepted_at" in td


# ---------- Pending count ----------
class TestPendingCount:
    def test_pending_count_admin_only(self, http):
        r = http.get(f"{API}/online-orders/pending-count")
        assert r.status_code in (401, 403), f"Expected 401/403 unauth, got {r.status_code}"

    def test_pending_count_returns_shape(self, http, admin_headers):
        # Create one to ensure >0
        order = _create_order(http, "PC")
        r = http.get(f"{API}/online-orders/pending-count", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "pending_count" in data
        assert "latest_id" in data
        assert "latest_at" in data
        assert isinstance(data["pending_count"], int)
        assert data["pending_count"] >= 1


# ---------- Accept ----------
class TestAccept:
    def test_accept_pending_order(self, http, admin_headers):
        order = _create_order(http, "Accept")
        oid = order["id"]
        # pre-count
        pre = http.get(f"{API}/online-orders/pending-count", headers=admin_headers).json()["pending_count"]

        r = http.post(f"{API}/online-orders/{oid}/accept", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "accepted"
        assert d.get("accepted_at")
        # pending count decremented
        post = http.get(f"{API}/online-orders/pending-count", headers=admin_headers).json()["pending_count"]
        assert post == pre - 1, f"pending count should drop by 1; pre={pre} post={post}"

        # GET track confirms status
        t = http.get(f"{API}/track/{oid}").json()
        assert t["status"] == "accepted"
        assert t["accepted_at"]

    def test_cannot_accept_rejected_order(self, http, admin_headers):
        order = _create_order(http, "AccRej")
        oid = order["id"]
        rj = http.post(f"{API}/online-orders/{oid}/reject", json={"reason": "closed"}, headers=admin_headers)
        assert rj.status_code == 200
        # Now try accept
        r = http.post(f"{API}/online-orders/{oid}/accept", headers=admin_headers)
        assert r.status_code == 400


# ---------- Reject ----------
class TestReject:
    @pytest.mark.parametrize("reason", ["out_of_stock", "closed", "other", "free-form custom reason"])
    def test_reject_with_reason(self, http, admin_headers, reason):
        order = _create_order(http, f"Rej_{reason[:5]}")
        oid = order["id"]
        r = http.post(f"{API}/online-orders/{oid}/reject", json={"reason": reason}, headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "rejected"
        assert d["rejection_reason"] == reason
        assert d.get("rejected_at")
        # GET track
        t = http.get(f"{API}/track/{oid}").json()
        assert t["status"] == "rejected"
        assert t["rejection_reason"] == reason


# ---------- Modify + confirm-modified ----------
class TestModifyAndConfirm:
    def test_modify_recomputes_total_preserves_discount_and_delivery(self, http, admin_headers):
        order = _create_order(http, "Mod")
        oid = order["id"]
        original_discount = order.get("discount_amount", 0)
        original_delivery = order.get("delivery_fee", 0)
        # Modify: keep one item with new qty=3 @ 400, remove second by qty=0
        new_items = [
            {"item_id": "test-bir-1", "name": "TEST_Biryani_Mod", "price": 400.0, "quantity": 3},
            {"item_id": "test-rai-1", "name": "TEST_Raita", "price": 50.0, "quantity": 0},
        ]
        r = http.put(f"{API}/online-orders/{oid}/modify", json={"items": new_items, "notes": "qty bumped"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["modified"] is True
        assert d["modification_pending"] is True
        assert d["status"] == "pending", "status should remain pending after modify"
        assert len(d["items"]) == 1
        # subtotal = 3*400 = 1200; total = max(0, 1200 - discount) + delivery
        expected_total = max(0.0, 1200.0 - float(original_discount)) + float(original_delivery)
        assert abs(d["total_price"] - expected_total) < 0.01

    def test_modify_rejects_empty_items(self, http, admin_headers):
        order = _create_order(http, "ModE")
        oid = order["id"]
        r = http.put(f"{API}/online-orders/{oid}/modify", json={"items": []}, headers=admin_headers)
        assert r.status_code == 400

    def test_modify_rejects_all_zero_qty(self, http, admin_headers):
        order = _create_order(http, "ModZ")
        oid = order["id"]
        r = http.put(
            f"{API}/online-orders/{oid}/modify",
            json={"items": [{"item_id": "x", "name": "TEST_x", "price": 1.0, "quantity": 0}]},
            headers=admin_headers,
        )
        assert r.status_code == 400

    def test_confirm_modified_requires_modified_flag(self, http, admin_headers):
        order = _create_order(http, "ConfNo")
        oid = order["id"]
        r = http.post(f"{API}/online-orders/{oid}/confirm-modified", headers=admin_headers)
        assert r.status_code == 400  # not modified yet

    def test_full_modify_then_confirm_flow(self, http, admin_headers):
        order = _create_order(http, "ModFlow")
        oid = order["id"]
        # Modify
        m = http.put(
            f"{API}/online-orders/{oid}/modify",
            json={"items": [{"item_id": "test-bir-1", "name": "TEST_Biryani_X", "price": 500.0, "quantity": 1}]},
            headers=admin_headers,
        )
        assert m.status_code == 200
        # Confirm
        c = http.post(f"{API}/online-orders/{oid}/confirm-modified", headers=admin_headers)
        assert c.status_code == 200, c.text
        d = c.json()
        assert d["status"] == "accepted"
        assert d["modification_pending"] is False
        assert d.get("accepted_at")
        assert d.get("modification_confirmed_at")
        # GET /track shows modified=true and status accepted
        t = http.get(f"{API}/track/{oid}").json()
        assert t["status"] == "accepted"
        assert t["modified"] is True
        assert t["modification_pending"] is False


# ---------- Status update (PUT /status) extended ----------
class TestStatusUpdate:
    def test_legacy_status_preparing_still_works(self, http, admin_headers):
        # Need an accepted order (or any non-pending)
        order = _create_order(http, "StPrep")
        oid = order["id"]
        http.post(f"{API}/online-orders/{oid}/accept", headers=admin_headers)
        r = http.put(f"{API}/online-orders/{oid}/status", json={"status": "preparing"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "preparing"

    def test_status_accepted_via_put(self, http, admin_headers):
        order = _create_order(http, "StAcc")
        oid = order["id"]
        r = http.put(f"{API}/online-orders/{oid}/status", json={"status": "accepted"}, headers=admin_headers)
        assert r.status_code == 200
        # Verify accepted_at set
        t = http.get(f"{API}/track/{oid}").json()
        assert t["status"] == "accepted"
        assert t["accepted_at"]

    def test_status_rejected_via_put(self, http, admin_headers):
        order = _create_order(http, "StRej")
        oid = order["id"]
        r = http.put(f"{API}/online-orders/{oid}/status", json={"status": "rejected"}, headers=admin_headers)
        assert r.status_code == 200

    def test_status_invalid_returns_400(self, http, admin_headers):
        order = _create_order(http, "StInv")
        oid = order["id"]
        r = http.put(f"{API}/online-orders/{oid}/status", json={"status": "frobnicated"}, headers=admin_headers)
        assert r.status_code == 400


# ---------- Regression ----------
class TestRegression:
    def test_get_menu_public(self, http):
        r = http.get(f"{API}/menu")
        assert r.status_code == 200
        data = r.json()
        # API returns {categories:[], items:[]}
        assert "categories" in data
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_admin_list_online_orders(self, http, admin_headers):
        r = http.get(f"{API}/online-orders", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_orders_today(self, http, admin_headers):
        r = http.get(f"{API}/orders/today", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_pos_create_in_store_order(self, http, admin_headers):
        payload = {
            "items": [{"item_id": "pos-1", "name": "TEST_POS_Biryani", "price": 300, "quantity": 1}],
            "subtotal": 300,
            "tax": 0,
            "total": 300,
            "total_price": 300,
            "payment_type": "cash",
            "payment_method": "cash",
            "customer_name": "TEST_Walk-in",
        }
        r = http.post(f"{API}/orders", json=payload, headers=admin_headers)
        assert r.status_code in (200, 201), f"POS order create failed: {r.status_code} {r.text}"

    def test_mark_printed(self, http, admin_headers):
        order = _create_order(http, "Print")
        oid = order["id"]
        r = http.put(f"{API}/online-orders/{oid}/printed", headers=admin_headers)
        assert r.status_code == 200
