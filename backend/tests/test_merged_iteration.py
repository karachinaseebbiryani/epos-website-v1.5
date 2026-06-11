"""Backend API tests for the MERGED Karachi Naseeb Biryani platform.

Validates that BOTH:
  (1) OLD POS-operational endpoints (auth, categories, menu-items, orders,
      vendors, expenses, refunds, reports, dashboard, settings)
  (2) NEW customer-facing endpoints (public menu, customer auth, online-orders,
      reviews, offers, event-bookings, public restaurant-info, track)
remain functional after the merge (backend = NEW's superset which includes OLD).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@restaurant.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")


# ---------- Fixtures ----------
class NoCookieSession(requests.Session):
    """Session that does NOT persist cookies between requests."""
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
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("role") == "admin"
    assert data.get("token")
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def customer(http):
    """Register + login a fresh customer; return (token, user_dict)."""
    email = f"TEST_cust_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "Passw0rd!", "name": "Test Cust", "phone": "9999999999"}
    r = http.post(f"{API}/customer/register", json=payload)
    assert r.status_code == 200, f"Customer register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return {"email": email, "password": "Passw0rd!", "token": data["token"], "user": data.get("user", data)}


@pytest.fixture(scope="session")
def cust_headers(customer):
    return {"Authorization": f"Bearer {customer['token']}", "Content-Type": "application/json"}


# =====================================================================
# OLD: Staff Auth
# =====================================================================
class TestStaffAuth:
    def test_login_admin(self, http):
        r = http.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert d["role"] == "admin"
        assert isinstance(d.get("permissions"), list) and len(d["permissions"]) > 0
        assert d.get("token")

    def test_login_invalid(self, http):
        r = http.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code in (400, 401)

    def test_auth_me(self, http, admin_headers):
        r = http.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# =====================================================================
# OLD: Categories CRUD
# =====================================================================
class TestCategories:
    def test_list(self, http):
        r = http.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list) and len(cats) >= 1

    def test_create_update_delete(self, http, admin_headers):
        # CREATE
        name = f"TEST_cat_{uuid.uuid4().hex[:6]}"
        r = http.post(f"{API}/categories", json={"name": name, "color": "#abcdef"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        # GET (verify in list)
        listed = http.get(f"{API}/categories").json()
        assert any(c["id"] == cid for c in listed)
        # UPDATE
        r2 = http.put(f"{API}/categories/{cid}", json={"name": name + "_u"}, headers=admin_headers)
        assert r2.status_code == 200
        # DELETE
        r3 = http.delete(f"{API}/categories/{cid}", headers=admin_headers)
        assert r3.status_code == 200


# =====================================================================
# OLD: Menu Items
# =====================================================================
class TestMenuItems:
    def test_list_menu_items(self, http):
        r = http.get(f"{API}/menu-items")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        first = items[0]
        for k in ("id", "name", "price", "category_id"):
            assert k in first

    def test_create_update_delete(self, http, admin_headers):
        cats = http.get(f"{API}/categories").json()
        cat_id = cats[0]["id"]
        name = f"TEST_item_{uuid.uuid4().hex[:6]}"
        r = http.post(f"{API}/menu-items", json={
            "name": name, "price": 250.0, "category_id": cat_id, "stock": 10
        }, headers=admin_headers)
        assert r.status_code == 200, r.text
        iid = r.json()["id"]
        # UPDATE
        r2 = http.put(f"{API}/menu-items/{iid}", json={"price": 300.0}, headers=admin_headers)
        assert r2.status_code == 200
        # DELETE
        r3 = http.delete(f"{API}/menu-items/{iid}", headers=admin_headers)
        assert r3.status_code == 200


# =====================================================================
# OLD: Inventory
# =====================================================================
class TestInventory:
    def test_inventory_list(self, http, admin_headers):
        r = http.get(f"{API}/inventory", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# =====================================================================
# OLD: POS Orders
# =====================================================================
class TestPOSOrders:
    def test_create_pos_order(self, http, admin_headers):
        items = http.get(f"{API}/menu-items").json()
        assert items, "Need at least 1 menu item"
        it = items[0]
        payload = {
            "items": [{"item_id": it["id"], "name": it["name"], "price": it["price"], "quantity": 1}],
            "subtotal": it["price"],
            "tax": 0,
            "total": it["price"],
            "payment_type": "cash",
        }
        r = http.post(f"{API}/orders", json=payload, headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert any(k in body for k in ("id", "receipt_id", "order_id", "receipt_no"))

    def test_orders_today(self, http, admin_headers):
        r = http.get(f"{API}/orders/today", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_orders_history(self, http, admin_headers):
        r = http.get(f"{API}/orders/history", headers=admin_headers)
        assert r.status_code == 200


# =====================================================================
# OLD: Reports / Dashboard
# =====================================================================
class TestReports:
    def test_x_report(self, http, admin_headers):
        r = http.get(f"{API}/reports/x", headers=admin_headers)
        assert r.status_code == 200

    def test_z_report(self, http, admin_headers):
        r = http.get(f"{API}/reports/z", headers=admin_headers)
        assert r.status_code == 200

    def test_dashboard_stats(self, http, admin_headers):
        r = http.get(f"{API}/dashboard/stats", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        # at minimum keys are present
        assert isinstance(d, dict)

    def test_dashboard_hourly_sales(self, http, admin_headers):
        r = http.get(f"{API}/dashboard/hourly-sales", headers=admin_headers)
        assert r.status_code == 200


# =====================================================================
# OLD: Expenses
# =====================================================================
class TestExpenses:
    def test_expense_crud(self, http, admin_headers):
        r = http.post(f"{API}/expenses", json={
            "description": "TEST_expense",
            "amount": 100.0,
            "category": "Misc",
        }, headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        eid = body.get("id")
        assert eid
        # list
        lst = http.get(f"{API}/expenses", headers=admin_headers)
        assert lst.status_code == 200
        # delete
        r2 = http.delete(f"{API}/expenses/{eid}", headers=admin_headers)
        assert r2.status_code == 200


# =====================================================================
# OLD: Vendors
# =====================================================================
class TestVendors:
    def test_vendor_crud_and_transactions(self, http, admin_headers):
        # CREATE vendor
        r = http.post(f"{API}/vendors", json={"name": f"TEST_vendor_{uuid.uuid4().hex[:6]}", "contact": "1234567890"}, headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        vid = r.json()["id"]
        # LIST vendors
        lst = http.get(f"{API}/vendors", headers=admin_headers)
        assert lst.status_code == 200
        # add transaction (correct schema: vendor_id, items, total)
        rt = http.post(f"{API}/vendors/{vid}/transactions", json={
            "vendor_id": vid,
            "items": [{"name": "Rice", "quantity": 10, "unit_price": 50}],
            "total": 500,
            "notes": "TEST_tx",
        }, headers=admin_headers)
        assert rt.status_code in (200, 201), rt.text
        # add payment (correct schema: vendor_id, amount)
        rp = http.post(f"{API}/vendors/{vid}/payments", json={
            "vendor_id": vid, "amount": 200, "notes": "TEST"
        }, headers=admin_headers)
        assert rp.status_code in (200, 201), rp.text
        # today summary
        rt2 = http.get(f"{API}/vendors/{vid}/today", headers=admin_headers)
        assert rt2.status_code == 200
        # cleanup
        d = http.delete(f"{API}/vendors/{vid}", headers=admin_headers)
        assert d.status_code == 200


# =====================================================================
# OLD: Settings
# =====================================================================
class TestSettings:
    def test_get_settings(self, http, admin_headers):
        r = http.get(f"{API}/settings", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), dict)


# =====================================================================
# OLD: Voice Assistant (LLM)
# =====================================================================
class TestVoice:
    def test_voice_status(self, http, admin_headers):
        r = http.get(f"{API}/voice/status", headers=admin_headers)
        assert r.status_code == 200
        # EMERGENT_LLM_KEY is empty so expected enabled=False or available=False
        body = r.json()
        assert isinstance(body, dict)


# =====================================================================
# OLD: Refunds
# =====================================================================
class TestRefunds:
    def test_refunds_today(self, http, admin_headers):
        r = http.get(f"{API}/refunds/today", headers=admin_headers)
        assert r.status_code == 200

    def test_refunds_summary(self, http, admin_headers):
        r = http.get(f"{API}/refunds/summary", headers=admin_headers)
        assert r.status_code == 200


# =====================================================================
# OLD: Schedule / WhatsApp / Tunnel statuses
# =====================================================================
class TestStatusEndpoints:
    def test_schedule_status(self, http, admin_headers):
        r = http.get(f"{API}/schedule/status", headers=admin_headers)
        assert r.status_code == 200

    def test_schedule_timezones(self, http, admin_headers):
        r = http.get(f"{API}/schedule/timezones", headers=admin_headers)
        assert r.status_code == 200

    def test_whatsapp_status(self, http, admin_headers):
        r = http.get(f"{API}/whatsapp/status", headers=admin_headers)
        assert r.status_code == 200

    def test_tunnel_status(self, http, admin_headers):
        r = http.get(f"{API}/tunnel/status", headers=admin_headers)
        assert r.status_code == 200


# =====================================================================
# NEW: Public restaurant info / public settings / menu
# =====================================================================
class TestPublic:
    def test_public_restaurant_info(self, http):
        r = http.get(f"{API}/public/restaurant-info")
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_public_settings(self, http):
        r = http.get(f"{API}/public/settings")
        assert r.status_code == 200

    def test_public_menu(self, http):
        r = http.get(f"{API}/menu")
        assert r.status_code == 200
        body = r.json()
        # NEW shape: {"categories": [...], "items": [...]}
        if isinstance(body, dict):
            assert "items" in body and isinstance(body["items"], list) and len(body["items"]) >= 1
        else:
            assert isinstance(body, list) and len(body) >= 1


# =====================================================================
# NEW: Customer Auth
# =====================================================================
class TestCustomerAuth:
    def test_register_login_me(self, http):
        email = f"TEST_c_{uuid.uuid4().hex[:8]}@example.com"
        pw = "Passw0rd!"
        r = http.post(f"{API}/customer/register", json={"email": email, "password": pw, "name": "X", "phone": "1112223333"})
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        # login
        r2 = http.post(f"{API}/customer/login", json={"email": email, "password": pw})
        assert r2.status_code == 200
        token = r2.json()["token"]
        # me (server lowercases stored email)
        r3 = http.get(f"{API}/customer/me", headers={"Authorization": f"Bearer {token}"})
        assert r3.status_code == 200
        assert r3.json()["email"].lower() == email.lower()


# =====================================================================
# NEW: Online Orders
# =====================================================================
class TestOnlineOrders:
    def test_place_track_and_admin_list(self, http, customer, cust_headers, admin_headers):
        # Get a menu item from public menu (shape may be {items, categories} or list)
        body = http.get(f"{API}/menu").json()
        if isinstance(body, dict):
            items = body.get("items", [])
        else:
            items = body
        assert items
        it = items[0]
        # Place order (customer) — schema requires item_id, quantity, total_price, customer_name, address
        order_payload = {
            "items": [{"item_id": it["id"], "name": it["name"], "price": it["price"], "quantity": 1}],
            "subtotal": it["price"],
            "tax": 0,
            "delivery_fee": 0,
            "total": it["price"],
            "total_price": it["price"],
            "order_type": "delivery",
            "address": "TEST 123 Test St",
            "delivery_address": "TEST 123 Test St",
            "phone": "9999999999",
            "customer_name": "Test Cust",
            "name": "Test Cust",
            "payment_method": "cod",
        }
        r = http.post(f"{API}/online-orders", json=order_payload, headers=cust_headers)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        oid = body.get("id") or body.get("order_id") or body.get("order", {}).get("id")
        assert oid, f"No order id in response: {body}"

        # Track (public)
        rt = http.get(f"{API}/track/{oid}")
        assert rt.status_code == 200

        # My online orders (customer)
        rm = http.get(f"{API}/online-orders/me", headers=cust_headers)
        assert rm.status_code == 200
        assert isinstance(rm.json(), list)

        # Admin list
        ra = http.get(f"{API}/online-orders", headers=admin_headers)
        assert ra.status_code == 200

        # Admin pending count
        rc = http.get(f"{API}/online-orders/pending-count", headers=admin_headers)
        assert rc.status_code == 200


# =====================================================================
# NEW: Offers
# =====================================================================
class TestOffers:
    def test_list_offers(self, http):
        r = http.get(f"{API}/offers")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_offers_crud(self, http, admin_headers):
        title = f"TEST_offer_{uuid.uuid4().hex[:6]}"
        r = http.post(f"{API}/offers", json={
            "title": title, "description": "desc", "discount_percent": 10, "active": True
        }, headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        oid = r.json().get("id")
        assert oid
        # delete
        d = http.delete(f"{API}/offers/{oid}", headers=admin_headers)
        assert d.status_code == 200


# =====================================================================
# NEW: Reviews public list
# =====================================================================
class TestReviewsPublic:
    def test_list_reviews(self, http):
        r = http.get(f"{API}/reviews")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# =====================================================================
# NEW: Event Bookings
# =====================================================================
class TestEventBookings:
    def test_create_and_list(self, http, cust_headers, admin_headers):
        payload = {
            "name": "TEST Event Booker",
            "phone": "9999999999",
            "email": "test@example.com",
            "event_type": "Birthday",
            "event_date": "2026-12-31",
            "guests": 25,
            "message": "TEST booking",
        }
        r = http.post(f"{API}/event-bookings", json=payload)
        assert r.status_code in (200, 201), r.text
        # admin list
        ra = http.get(f"{API}/event-bookings", headers=admin_headers)
        assert ra.status_code == 200
        assert isinstance(ra.json(), list)


# =====================================================================
# Negative / Auth-Guard checks
# =====================================================================
class TestAuthGuards:
    def test_orders_today_unauth(self, http):
        r = http.get(f"{API}/orders/today")
        assert r.status_code in (401, 403)

    def test_dashboard_unauth(self, http):
        r = http.get(f"{API}/dashboard/stats")
        assert r.status_code in (401, 403)

    def test_admin_offers_create_unauth(self, http):
        # Send a valid body so we hit auth check (not validation)
        r = http.post(f"{API}/offers", json={
            "title": "x", "description": "d", "discount_percent": 10, "active": True
        })
        assert r.status_code in (401, 403)
