"""Backend API tests for Karachi Naseeb Biryani online ordering system.

Covers public menu/offers/reviews, customer auth, online orders flow,
event bookings, admin auth + admin-only endpoints, coupon discounts,
and review-after-delivery flow.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://alert-delivery-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@karachinaseeb.com"
ADMIN_PASSWORD = "admin123"


# ---------- Fixtures ----------
class NoCookieSession(requests.Session):
    """Session that does NOT persist cookies between requests.

    This prevents auth cookies (access_token / customer_token) set by login/register
    endpoints from contaminating subsequent unauthenticated test calls.
    """
    def send(self, request, **kwargs):
        # Discard any cookies the server tries to set
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
    assert data.get("role") == "admin", f"Expected admin role, got {data.get('role')}"
    assert data.get("token")
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def customer_creds():
    suffix = uuid.uuid4().hex[:8]
    return {
        "email": f"TEST_cust_{suffix}@example.com",
        "password": "test1234",
        "name": "TEST Customer",
        "phone": "03001234567",
    }


@pytest.fixture(scope="session")
def customer_token(http, customer_creds):
    r = http.post(f"{API}/customer/register", json=customer_creds)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("token")
    assert data.get("email", "").lower() == customer_creds["email"].lower()
    return data["token"]


@pytest.fixture(scope="session")
def customer_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def menu_data(http):
    r = http.get(f"{API}/menu")
    assert r.status_code == 200
    return r.json()


# ---------- Public endpoints ----------
class TestPublicEndpoints:
    def test_get_menu(self, menu_data):
        assert "categories" in menu_data and "items" in menu_data
        assert isinstance(menu_data["categories"], list) and len(menu_data["categories"]) >= 1
        assert isinstance(menu_data["items"], list) and len(menu_data["items"]) >= 1
        first = menu_data["items"][0]
        for k in ("id", "name", "price", "category_id"):
            assert k in first

    def test_get_offers_active(self, http):
        r = http.get(f"{API}/offers")
        assert r.status_code == 200
        offers = r.json()
        assert isinstance(offers, list)
        codes = {o.get("coupon_code") for o in offers}
        assert "FAMILY15" in codes, f"Expected FAMILY15 offer seeded, got: {codes}"
        assert "WELCOME100" in codes, f"Expected WELCOME100 offer seeded, got: {codes}"

    def test_get_reviews(self, http):
        r = http.get(f"{API}/reviews")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Customer Auth ----------
class TestCustomerAuth:
    def test_register_creates_token(self, http):
        suffix = uuid.uuid4().hex[:8]
        payload = {
            "email": f"TEST_reg_{suffix}@example.com",
            "password": "test1234",
            "name": "TEST Reg",
            "phone": "03000000000",
        }
        r = http.post(f"{API}/customer/register", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["token"] and d["email"].lower() == payload["email"].lower() and d["id"]

    def test_register_duplicate_email_fails(self, http, customer_creds, customer_token):
        # customer_token fixture ensures customer_creds is already registered
        r = http.post(f"{API}/customer/register", json=customer_creds)
        assert r.status_code == 400

    def test_login_success(self, http, customer_creds):
        r = http.post(f"{API}/customer/login", json={
            "email": customer_creds["email"],
            "password": customer_creds["password"],
        })
        assert r.status_code == 200
        assert r.json().get("token")

    def test_login_invalid_password(self, http, customer_creds):
        r = http.post(f"{API}/customer/login", json={
            "email": customer_creds["email"],
            "password": "wrongpass",
        })
        assert r.status_code == 401

    def test_customer_me(self, http, customer_headers, customer_creds):
        r = http.get(f"{API}/customer/me", headers=customer_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["email"].lower() == customer_creds["email"].lower()
        assert d["name"] == customer_creds["name"]

    def test_customer_me_unauthorized(self, http):
        r = http.get(f"{API}/customer/me")
        assert r.status_code == 401


# ---------- Online Orders ----------
class TestOnlineOrders:
    def _build_order_payload(self, menu_data, customer_name="TEST Walkin", coupon=None, qty=1):
        item = menu_data["items"][0]
        items = [{
            "item_id": item["id"],
            "name": item["name"],
            "price": item["price"],
            "quantity": qty,
        }]
        total = float(item["price"]) * qty
        payload = {
            "items": items,
            "total_price": total,
            "customer_name": customer_name,
            "phone": "03001112222",
            "address": "TEST 123 Test St, Karachi",
            "notes": "TEST order",
            "payment_method": "cod",
        }
        if coupon:
            payload["coupon_code"] = coupon
        return payload, total

    def test_create_order_public_no_auth(self, http, menu_data):
        payload, total = self._build_order_payload(menu_data)
        r = http.post(f"{API}/online-orders", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending"
        assert d["total_price"] == total
        assert d["discount_amount"] == 0
        assert d.get("customer_id") is None
        assert d["id"]

    def test_create_order_with_FAMILY15_applies_15pct(self, http, menu_data):
        # Use higher qty so discount is meaningful
        payload, total = self._build_order_payload(menu_data, coupon="FAMILY15", qty=5)
        r = http.post(f"{API}/online-orders", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        expected_discount = round(total * 0.15, 2)
        assert d["coupon_code"] == "FAMILY15"
        assert abs(d["discount_amount"] - expected_discount) < 0.01
        assert abs(d["total_price"] - (total - expected_discount)) < 0.01

    def test_create_order_with_WELCOME100_flat_off(self, http, menu_data):
        payload, total = self._build_order_payload(menu_data, coupon="WELCOME100", qty=2)
        r = http.post(f"{API}/online-orders", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["coupon_code"] == "WELCOME100"
        assert d["discount_amount"] == 100
        assert abs(d["total_price"] - max(0, total - 100)) < 0.01

    def test_create_order_invalid_coupon_no_discount(self, http, menu_data):
        payload, total = self._build_order_payload(menu_data, coupon="DOESNOTEXIST")
        r = http.post(f"{API}/online-orders", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["discount_amount"] == 0
        assert d.get("coupon_code") is None
        assert d["total_price"] == total

    def test_create_order_authenticated_customer(self, http, menu_data, customer_headers):
        payload, _ = self._build_order_payload(menu_data, customer_name="TEST Auth Cust")
        r = http.post(f"{API}/online-orders", json=payload, headers=customer_headers)
        assert r.status_code == 200
        d = r.json()
        assert d.get("customer_id")  # linked to customer

    def test_get_my_orders_requires_auth(self, http):
        r = http.get(f"{API}/online-orders/me")
        assert r.status_code == 401

    def test_get_my_orders_returns_my_orders(self, http, menu_data, customer_headers):
        # Place order then list
        payload, _ = self._build_order_payload(menu_data, customer_name="TEST Me Order")
        cr = http.post(f"{API}/online-orders", json=payload, headers=customer_headers)
        assert cr.status_code == 200
        r = http.get(f"{API}/online-orders/me", headers=customer_headers)
        assert r.status_code == 200
        orders = r.json()
        assert isinstance(orders, list) and len(orders) >= 1

    def test_admin_list_all_orders(self, http, admin_headers):
        r = http.get(f"{API}/online-orders", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_all_orders_requires_admin(self, http):
        r = http.get(f"{API}/online-orders")
        assert r.status_code in (401, 403)

    def test_update_order_status_admin(self, http, menu_data, admin_headers):
        payload, _ = self._build_order_payload(menu_data, customer_name="TEST Status")
        cr = http.post(f"{API}/online-orders", json=payload)
        assert cr.status_code == 200
        oid = cr.json()["id"]
        for status in ["preparing", "ready", "out_for_delivery", "delivered"]:
            r = http.put(f"{API}/online-orders/{oid}/status", json={"status": status}, headers=admin_headers)
            assert r.status_code == 200, f"{status} -> {r.text}"
            assert r.json()["status"] == status

    def test_update_order_status_invalid_value(self, http, menu_data, admin_headers):
        payload, _ = self._build_order_payload(menu_data)
        cr = http.post(f"{API}/online-orders", json=payload)
        oid = cr.json()["id"]
        r = http.put(f"{API}/online-orders/{oid}/status", json={"status": "bogus"}, headers=admin_headers)
        assert r.status_code == 400

    def test_update_order_status_requires_admin(self, http, menu_data):
        payload, _ = self._build_order_payload(menu_data)
        cr = http.post(f"{API}/online-orders", json=payload)
        oid = cr.json()["id"]
        r = http.put(f"{API}/online-orders/{oid}/status", json={"status": "preparing"})
        assert r.status_code in (401, 403)


# ---------- Reviews flow ----------
class TestReviews:
    def test_review_rejected_when_order_not_delivered(self, http, menu_data, customer_headers):
        # Create pending order as customer
        item = menu_data["items"][0]
        payload = {
            "items": [{"item_id": item["id"], "name": item["name"], "price": item["price"], "quantity": 1}],
            "total_price": item["price"],
            "customer_name": "TEST Review",
            "phone": "03000000000",
            "address": "TEST addr",
            "payment_method": "cod",
        }
        co = http.post(f"{API}/online-orders", json=payload, headers=customer_headers)
        assert co.status_code == 200
        oid = co.json()["id"]
        r = http.post(f"{API}/reviews", json={"order_id": oid, "rating": 5, "comment": "TEST great"}, headers=customer_headers)
        assert r.status_code == 400  # not delivered yet

    def test_review_accepted_after_delivery(self, http, menu_data, customer_headers, admin_headers):
        item = menu_data["items"][0]
        payload = {
            "items": [{"item_id": item["id"], "name": item["name"], "price": item["price"], "quantity": 1}],
            "total_price": item["price"],
            "customer_name": "TEST Review2",
            "phone": "03000000000",
            "address": "TEST addr",
            "payment_method": "cod",
        }
        co = http.post(f"{API}/online-orders", json=payload, headers=customer_headers)
        oid = co.json()["id"]
        # Admin marks delivered
        up = http.put(f"{API}/online-orders/{oid}/status", json={"status": "delivered"}, headers=admin_headers)
        assert up.status_code == 200
        # Customer can now review
        r = http.post(f"{API}/reviews", json={"order_id": oid, "rating": 5, "comment": "TEST excellent"}, headers=customer_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["rating"] == 5 and d["comment"] == "TEST excellent"
        # Duplicate review not allowed
        r2 = http.post(f"{API}/reviews", json={"order_id": oid, "rating": 4, "comment": "TEST again"}, headers=customer_headers)
        assert r2.status_code == 400

    def test_review_requires_auth(self, http):
        r = http.post(f"{API}/reviews", json={"order_id": "x", "rating": 5, "comment": "y"})
        assert r.status_code == 401


# ---------- Event bookings ----------
class TestEventBookings:
    def test_create_event_booking_public(self, http):
        r = http.post(f"{API}/event-bookings", json={
            "name": "TEST Event",
            "phone": "03001234567",
            "event_type": "wedding",
            "guests": 50,
            "event_date": "2026-03-15",
            "message": "TEST message",
            "email": "TEST@example.com",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "pending" and d["id"]

    def test_list_event_bookings_requires_admin(self, http):
        r = http.get(f"{API}/event-bookings")
        assert r.status_code in (401, 403)

    def test_list_event_bookings_admin(self, http, admin_headers):
        r = http.get(f"{API}/event-bookings", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Admin auth + offers CRUD ----------
class TestAdminAndOffersCRUD:
    def test_admin_login(self, http):
        r = http.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "admin" and d["token"]

    def test_admin_login_wrong_password(self, http):
        r = http.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongbad"})
        assert r.status_code == 401

    def test_create_offer_admin_only(self, http):
        r = http.post(f"{API}/offers", json={"title": "TEST X", "description": "x"})
        assert r.status_code in (401, 403)

    def test_offer_create_and_delete_admin(self, http, admin_headers):
        payload = {
            "title": "TEST Offer",
            "description": "TEST desc",
            "discount_percent": 10,
            "discount_amount": 0,
            "coupon_code": "TESTCODE10",
            "active": True,
        }
        r = http.post(f"{API}/offers", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        # Verify it shows in list
        lst = http.get(f"{API}/offers")
        codes = {o["coupon_code"] for o in lst.json()}
        assert "TESTCODE10" in codes
        # Delete
        d = http.delete(f"{API}/offers/{oid}", headers=admin_headers)
        assert d.status_code == 200
        # Verify gone
        lst2 = http.get(f"{API}/offers")
        codes2 = {o["coupon_code"] for o in lst2.json()}
        assert "TESTCODE10" not in codes2

    def test_delete_offer_requires_admin(self, http, admin_headers):
        r = http.post(f"{API}/offers", json={"title": "TEST Del", "description": "x", "coupon_code": "TESTDEL", "active": True}, headers=admin_headers)
        oid = r.json()["id"]
        d = http.delete(f"{API}/offers/{oid}")
        assert d.status_code in (401, 403)
        # cleanup
        http.delete(f"{API}/offers/{oid}", headers=admin_headers)
