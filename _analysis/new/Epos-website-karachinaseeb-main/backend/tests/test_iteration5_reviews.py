"""
Iteration 5 — Public review system + restaurant info + thermal receipt
Backend regression: existing /api/reviews (auth) + Smart-Order-Alert endpoints.
"""
import os
import time
import pytest
import requests
from bson import ObjectId

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://project-handoff-12.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@restaurant.com", "password": "admin123"})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    body = r.json()
    return body.get("token") or body.get("access_token")


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def fresh_order(admin_headers):
    """Create a fresh online order for review testing."""
    payload = {
        "items": [{"item_id": "test_item_1", "name": "TEST_Biryani", "price": 500, "quantity": 1}],
        "total_price": 500,
        "customer_name": "TEST_ReviewerOne",
        "phone": "03001234567",
        "address": "TEST address 1",
        "payment_method": "cod",
        "notes": "iteration5-review-test",
    }
    r = requests.post(f"{API}/online-orders", json=payload)
    assert r.status_code in (200, 201), f"create online order failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def second_fresh_order():
    payload = {
        "items": [{"item_id": "test_item_2", "name": "TEST_Pulao", "price": 400, "quantity": 2}],
        "total_price": 800,
        "customer_name": "TEST_ReviewerTwo",
        "phone": "03007654321",
        "address": "TEST address 2",
        "payment_method": "cod",
        "notes": "iteration5-second-review-test",
    }
    r = requests.post(f"{API}/online-orders", json=payload)
    assert r.status_code in (200, 201)
    return r.json()


# ---------- /api/public/restaurant-info ----------
class TestPublicRestaurantInfo:
    def test_returns_required_fields_no_auth(self):
        r = requests.get(f"{API}/public/restaurant-info")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["name", "phone", "address", "currency", "lat", "lng", "google_maps_url"]:
            assert k in data, f"missing key: {k}"
        assert isinstance(data["lat"], (int, float))
        assert isinstance(data["lng"], (int, float))
        assert data["google_maps_url"].startswith("https://www.google.com/maps")
        # exact lat/lng must be inside the maps URL
        assert f"{data['lat']},{data['lng']}" in data["google_maps_url"]

    def test_no_auth_required(self):
        # explicitly send no headers
        r = requests.get(f"{API}/public/restaurant-info", headers={})
        assert r.status_code == 200


# ---------- GET /api/reviews/order/{id} ----------
class TestGetReviewByOrder:
    def test_invalid_id_returns_404(self):
        r = requests.get(f"{API}/reviews/order/notanid")
        assert r.status_code == 404

    def test_nonexistent_objectid_returns_404(self):
        fake = str(ObjectId())
        r = requests.get(f"{API}/reviews/order/{fake}")
        assert r.status_code == 404

    def test_valid_order_returns_order_and_null_review(self, fresh_order):
        oid = fresh_order["id"]
        r = requests.get(f"{API}/reviews/order/{oid}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "order" in d and "review" in d
        assert d["order"]["id"] == oid
        for k in ["receipt_no", "customer_name", "items", "total_price", "status", "created_at"]:
            assert k in d["order"]
        assert d["order"]["receipt_no"] == oid[-6:].upper()
        assert d["review"] is None  # no review yet


# ---------- POST /api/reviews/public/{id} ----------
class TestPublicReviewCreate:
    def test_invalid_rating_returns_400(self, fresh_order):
        oid = fresh_order["id"]
        r = requests.post(f"{API}/reviews/public/{oid}", json={"rating": 0, "comment": "bad", "customer_name": "x"})
        assert r.status_code == 400
        r2 = requests.post(f"{API}/reviews/public/{oid}", json={"rating": 6, "comment": "bad", "customer_name": "x"})
        assert r2.status_code == 400

    def test_nonexistent_order_returns_404(self):
        fake = str(ObjectId())
        r = requests.post(f"{API}/reviews/public/{fake}", json={"rating": 5, "comment": "ok", "customer_name": "x"})
        assert r.status_code == 404

    def test_create_and_persist_review(self, second_fresh_order):
        oid = second_fresh_order["id"]
        payload = {"rating": 4, "comment": "TEST_great_food", "customer_name": "TEST_PublicCustomer"}
        r = requests.post(f"{API}/reviews/public/{oid}", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["rating"] == 4
        assert d["comment"] == "TEST_great_food"
        assert d["customer_name"] == "TEST_PublicCustomer"
        assert "id" in d and "created_at" in d

        # GET-verify it persisted
        r2 = requests.get(f"{API}/reviews/order/{oid}")
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["review"] is not None
        assert d2["review"]["rating"] == 4
        assert d2["review"]["comment"] == "TEST_great_food"

    def test_second_review_rejected(self, second_fresh_order):
        oid = second_fresh_order["id"]
        # this order already has a review from previous test
        r = requests.post(
            f"{API}/reviews/public/{oid}",
            json={"rating": 5, "comment": "second_attempt", "customer_name": "TEST_X"},
        )
        assert r.status_code == 400
        assert "already" in r.json().get("detail", "").lower()


# ---------- Regression: existing POST /api/reviews (authenticated) ----------
class TestAuthReviewRegression:
    def test_unauth_review_returns_401(self):
        r = requests.post(f"{API}/reviews", json={"order_id": str(ObjectId()), "rating": 5, "comment": "x"})
        assert r.status_code in (401, 403)

    def test_review_for_non_delivered_order_returns_400(self, admin_headers, fresh_order):
        """We don't have customer auth but the endpoint requires get_current_customer.
        So this test asserts the customer-auth gate is still in place (401)."""
        r = requests.post(
            f"{API}/reviews",
            json={"order_id": fresh_order["id"], "rating": 5, "comment": "x"},
            headers=admin_headers,  # admin token != customer token
        )
        assert r.status_code in (401, 403)


# ---------- Regression: Smart Order Alert endpoints ----------
class TestSmartAlertRegression:
    def test_pending_count_requires_admin(self):
        r = requests.get(f"{API}/online-orders/pending-count")
        assert r.status_code in (401, 403)

    def test_pending_count_admin_ok(self, admin_headers):
        r = requests.get(f"{API}/online-orders/pending-count", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert "pending_count" in d and isinstance(d["pending_count"], int)

    def test_accept_endpoint_exists(self, admin_headers, fresh_order):
        oid = fresh_order["id"]
        r = requests.post(f"{API}/online-orders/{oid}/accept", headers=admin_headers)
        assert r.status_code in (200, 400)  # 200 first time, 400 if already accepted

    def test_accept_unauth(self, fresh_order):
        oid = fresh_order["id"]
        r = requests.post(f"{API}/online-orders/{oid}/accept")
        assert r.status_code in (401, 403)

    def test_reject_unauth(self):
        r = requests.post(f"{API}/online-orders/{ObjectId()}/reject", json={"reason": "x"})
        assert r.status_code in (401, 403)


# ---------- /api/track/{id} extended fields ----------
class TestPublicTrackExtendedFields:
    def test_track_returns_extended_fields(self, fresh_order):
        oid = fresh_order["id"]
        r = requests.get(f"{API}/track/{oid}")
        assert r.status_code == 200
        d = r.json()
        for k in ["modified", "modification_pending", "rejection_reason", "accepted_at"]:
            assert k in d, f"missing extended field: {k}"
        assert isinstance(d["modified"], bool)
        assert isinstance(d["modification_pending"], bool)


# ---------- Cleanup: optional, leave TEST_ reviews/orders for inspection ----------
