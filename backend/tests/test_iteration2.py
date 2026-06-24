"""Iteration 2 backend API tests:
- Public settings endpoint
- Delivery quote (haversine + fee tiers)
- Online order with delivery_lat/lng (server-side delivery fee)
- Admin online-settings GET/PUT
- Stripe create-session + status
- Bank-payment endpoint (manual verification)
- Admin payment-status update
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://alert-delivery-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@karachinaseeb.com"
ADMIN_PASSWORD = "admin123"

# Default seeded restaurant location (per server.py DEFAULT_ONLINE_SETTINGS)
RESTAURANT_LAT = 31.4520
RESTAURANT_LNG = 74.2680


class NoCookieSession(requests.Session):
    def send(self, request, **kwargs):
        resp = super().send(request, **kwargs)
        self.cookies.clear()
        return resp


@pytest.fixture(scope="module")
def http():
    s = NoCookieSession()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(http):
    r = http.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def menu_item(http):
    r = http.get(f"{API}/menu")
    assert r.status_code == 200
    items = r.json()["items"]
    assert items, "No menu items available"
    return items[0]


# -------------------- Public settings --------------------
class TestPublicSettings:
    def test_get_public_settings_no_auth(self, http):
        r = http.get(f"{API}/public/settings")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in (
            "restaurant_lat", "restaurant_lng", "delivery_free_radius_km",
            "delivery_base_fee", "delivery_per_km_fee", "delivery_max_radius_km",
            "payment_methods", "bank_account_title", "bank_account_number", "bank_name",
            "easypaisa_number", "jazzcash_number",
        ):
            assert k in d, f"missing {k} in public settings"
        assert isinstance(d["payment_methods"], dict)
        for pm in ("cod", "pay_at_restaurant", "bank_transfer", "card"):
            assert pm in d["payment_methods"]

    def test_public_settings_no_admin_secrets(self, http):
        # Public endpoint should not leak _id from mongo
        r = http.get(f"{API}/public/settings")
        d = r.json()
        assert "_id" not in d


# -------------------- Delivery quote --------------------
class TestDeliveryQuote:
    def test_quote_same_location_free(self, http):
        r = http.post(f"{API}/delivery/quote", json={"lat": RESTAURANT_LAT, "lng": RESTAURANT_LNG})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["in_range"] is True
        assert d["free_delivery"] is True
        assert d["fee"] == 0
        assert d["distance_km"] < 0.1

    def test_quote_within_free_radius(self, http):
        # ~1km offset (0.009 deg lat ~= 1km)
        r = http.post(f"{API}/delivery/quote", json={"lat": RESTAURANT_LAT + 0.009, "lng": RESTAURANT_LNG})
        d = r.json()
        assert d["in_range"] is True
        assert d["free_delivery"] is True
        assert d["fee"] == 0
        assert 0.5 < d["distance_km"] < 1.5

    def test_quote_paid_zone(self, http):
        # ~5km offset (0.045 deg lat)
        r = http.post(f"{API}/delivery/quote", json={"lat": RESTAURANT_LAT + 0.045, "lng": RESTAURANT_LNG})
        d = r.json()
        assert d["in_range"] is True
        assert d["free_delivery"] is False
        assert d["fee"] > 0
        # base 100 + extra(~3km)*15 = ~145
        assert 100 < d["fee"] < 200
        assert 4.5 < d["distance_km"] < 5.5

    def test_quote_out_of_range(self, http):
        # ~22km offset (0.20 deg lat)
        r = http.post(f"{API}/delivery/quote", json={"lat": RESTAURANT_LAT + 0.20, "lng": RESTAURANT_LNG})
        d = r.json()
        assert d["in_range"] is False
        assert d["fee"] == 0

    def test_quote_invalid_payload_422(self, http):
        r = http.post(f"{API}/delivery/quote", json={"lat": "not-a-num"})
        assert r.status_code == 422


# -------------------- Online order with delivery fee --------------------
class TestOnlineOrderDeliveryFee:
    def _order_payload(self, menu_item, lat=None, lng=None):
        p = {
            "items": [{"item_id": menu_item["id"], "name": menu_item["name"], "price": menu_item["price"], "quantity": 2}],
            "total_price": menu_item["price"] * 2,
            "customer_name": "TEST_DeliveryFee",
            "phone": "03001234567",
            "address": "Test address",
            "notes": "",
            "payment_method": "cod",
        }
        if lat is not None and lng is not None:
            p["delivery_lat"] = lat
            p["delivery_lng"] = lng
        return p

    def test_order_no_lat_lng_no_fee(self, http, menu_item):
        r = http.post(f"{API}/online-orders", json=self._order_payload(menu_item))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("delivery_fee", 0) == 0
        assert d["total_price"] == menu_item["price"] * 2

    def test_order_within_free_radius_no_fee(self, http, menu_item):
        r = http.post(f"{API}/online-orders", json=self._order_payload(menu_item, RESTAURANT_LAT + 0.009, RESTAURANT_LNG))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["delivery_fee"] == 0
        assert d["total_price"] == menu_item["price"] * 2

    def test_order_paid_zone_adds_fee(self, http, menu_item):
        subtotal = menu_item["price"] * 2
        r = http.post(f"{API}/online-orders", json=self._order_payload(menu_item, RESTAURANT_LAT + 0.045, RESTAURANT_LNG))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["delivery_fee"] > 0
        assert d["total_price"] == subtotal + d["delivery_fee"]
        assert d.get("distance_km") is not None

    def test_order_out_of_range_rejected(self, http, menu_item):
        r = http.post(f"{API}/online-orders", json=self._order_payload(menu_item, RESTAURANT_LAT + 0.20, RESTAURANT_LNG))
        assert r.status_code == 400, r.text
        assert "service area" in r.text.lower() or "outside" in r.text.lower()


# -------------------- Admin online-settings --------------------
class TestAdminOnlineSettings:
    def test_get_requires_auth(self, http):
        r = http.get(f"{API}/admin/online-settings")
        assert r.status_code == 401

    def test_get_with_admin(self, http, admin_headers):
        r = http.get(f"{API}/admin/online-settings", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "restaurant_lat" in d and "payment_methods" in d

    def test_put_updates_persists(self, http, admin_headers):
        # Get current
        r0 = http.get(f"{API}/admin/online-settings", headers=admin_headers)
        original = r0.json()
        original_max = original["delivery_max_radius_km"]
        # Update
        new_max = 18.0 if original_max != 18.0 else 16.0
        r = http.put(f"{API}/admin/online-settings", json={"delivery_max_radius_km": new_max}, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["delivery_max_radius_km"] == new_max
        # Verify persistence on public endpoint
        r2 = http.get(f"{API}/public/settings")
        assert r2.json()["delivery_max_radius_km"] == new_max
        # Restore
        http.put(f"{API}/admin/online-settings", json={"delivery_max_radius_km": original_max}, headers=admin_headers)

    def test_put_requires_admin(self, http):
        r = http.put(f"{API}/admin/online-settings", json={"delivery_base_fee": 999})
        assert r.status_code == 401


# -------------------- Stripe payment integration --------------------
class TestStripePayment:
    @pytest.fixture(scope="class")
    def order_id(self, http, menu_item):
        payload = {
            "items": [{"item_id": menu_item["id"], "name": menu_item["name"], "price": menu_item["price"], "quantity": 1}],
            "total_price": menu_item["price"],
            "customer_name": "TEST_Stripe",
            "phone": "03001234567",
            "address": "Test",
            "payment_method": "card",
        }
        r = http.post(f"{API}/online-orders", json=payload)
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_create_session_returns_url_and_id(self, http, order_id):
        r = http.post(f"{API}/payments/stripe/create-session", json={"order_id": order_id, "origin_url": BASE_URL})
        if r.status_code == 503:
            pytest.skip("Stripe not configured")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("url", "").startswith("https://"), f"Expected Stripe URL, got {d.get('url')}"
        assert d.get("session_id")
        # Save session_id for next test
        TestStripePayment._sid = d["session_id"]

    def test_status_returns_open_or_complete(self, http):
        sid = getattr(TestStripePayment, "_sid", None)
        if not sid:
            pytest.skip("No session_id from previous test")
        r = http.get(f"{API}/payments/stripe/status/{sid}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["session_id"] == sid
        assert d.get("status") in ("open", "complete", "expired")
        assert d.get("payment_status") in ("paid", "unpaid", "no_payment_required")

    def test_create_session_invalid_order(self, http):
        r = http.post(f"{API}/payments/stripe/create-session", json={"order_id": "000000000000000000000000", "origin_url": BASE_URL})
        assert r.status_code == 404


# -------------------- Bank payment + admin payment-status --------------------
class TestBankPayment:
    @pytest.fixture(scope="class")
    def order_id(self, http, menu_item):
        payload = {
            "items": [{"item_id": menu_item["id"], "name": menu_item["name"], "price": menu_item["price"], "quantity": 1}],
            "total_price": menu_item["price"],
            "customer_name": "TEST_Bank",
            "phone": "03001234567",
            "address": "Test",
            "payment_method": "bank_transfer",
        }
        r = http.post(f"{API}/online-orders", json=payload)
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_submit_bank_payment_sets_pending_verification(self, http, order_id, admin_headers):
        r = http.post(
            f"{API}/online-orders/{order_id}/bank-payment",
            json={"transaction_id": "TXN-TEST-12345", "payer_name": "Test Payer", "payment_via": "easypaisa"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["payment_status"] == "pending_verification"
        # Verify on order list
        r2 = http.get(f"{API}/online-orders", headers=admin_headers)
        assert r2.status_code == 200
        orders = r2.json()
        match = next((o for o in orders if o["id"] == order_id), None)
        assert match is not None, "order not found in admin list"
        assert match["payment_status"] == "pending_verification"
        assert match.get("payment_reference") == "TXN-TEST-12345"
        assert match.get("payment_method") == "easypaisa"

    def test_admin_payment_status_update_to_paid(self, http, order_id, admin_headers):
        r = http.put(
            f"{API}/online-orders/{order_id}/payment-status",
            json={"payment_status": "paid"},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        assert r.json()["payment_status"] == "paid"
        # GET to verify persistence
        r2 = http.get(f"{API}/online-orders", headers=admin_headers)
        match = next((o for o in r2.json() if o["id"] == order_id), None)
        assert match is not None and match["payment_status"] == "paid"

    def test_admin_payment_status_invalid_value(self, http, order_id, admin_headers):
        r = http.put(
            f"{API}/online-orders/{order_id}/payment-status",
            json={"payment_status": "bogus_status"},
            headers=admin_headers,
        )
        assert r.status_code == 400

    def test_admin_payment_status_requires_admin(self, http, order_id):
        r = http.put(f"{API}/online-orders/{order_id}/payment-status", json={"payment_status": "paid"})
        assert r.status_code == 401

    def test_bank_payment_invalid_order_404(self, http):
        r = http.post(
            f"{API}/online-orders/000000000000000000000000/bank-payment",
            json={"transaction_id": "X", "payer_name": "Y", "payment_via": "bank"},
        )
        assert r.status_code == 404
