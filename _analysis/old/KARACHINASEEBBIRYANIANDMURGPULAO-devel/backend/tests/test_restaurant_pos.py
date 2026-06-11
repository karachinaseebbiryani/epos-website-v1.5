"""End-to-end backend API tests for Restaurant POS app.

Covers: auth, categories, menu items, inventory, orders, reports, dashboard.
Uses real backend at REACT_APP_BACKEND_URL with cookie-based auth.
"""
import os
import time
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"


# ------------------------- Fixtures -------------------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["role"] == "admin"
    assert "token" in data
    # Verify cookie is set
    assert "access_token" in s.cookies, "httpOnly access_token cookie not set"
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


@pytest.fixture(scope="session")
def cashier_session():
    """Register a fresh cashier and return authenticated session."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_cashier_{uuid.uuid4().hex[:8]}@test.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "cashier123", "name": "Test Cashier", "role": "cashier"
    })
    assert r.status_code == 200, f"Cashier register failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["role"] == "cashier"
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


# ------------------------- Auth -------------------------
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "wrong@x.com", "password": "wrong"})
        assert r.status_code == 401

    def test_login_admin_success(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == ADMIN_EMAIL
        assert body["role"] == "admin"

    def test_register_duplicate(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": ADMIN_EMAIL, "password": "x", "name": "x", "role": "cashier"
        })
        assert r.status_code == 400

    def test_logout(self, admin_session):
        # use a separate session so we don't kill other tests
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        r = s.post(f"{BASE_URL}/api/auth/logout")
        assert r.status_code == 200

    def test_unauthenticated_protected_route(self):
        r = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 401


# ------------------------- Categories -------------------------
class TestCategories:
    created_id = None

    def test_create_category_admin(self, admin_session):
        name = f"TEST_Cat_{uuid.uuid4().hex[:6]}"
        r = admin_session.post(f"{BASE_URL}/api/categories", json={"name": name})
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == name
        assert "id" in data
        TestCategories.created_id = data["id"]
        TestCategories.created_name = name

    def test_get_categories(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        assert any(c["id"] == TestCategories.created_id for c in cats)

    def test_cashier_cannot_create_category(self, cashier_session):
        r = cashier_session.post(f"{BASE_URL}/api/categories", json={"name": "Hack"})
        assert r.status_code == 403

    def test_update_category(self, admin_session):
        new_name = TestCategories.created_name + "_upd"
        r = admin_session.put(f"{BASE_URL}/api/categories/{TestCategories.created_id}", json={"name": new_name})
        assert r.status_code == 200
        assert r.json()["name"] == new_name


# ------------------------- Menu Items -------------------------
class TestMenuItems:
    item_id = None

    def test_create_menu_item(self, admin_session):
        cat_id = TestCategories.created_id
        assert cat_id is not None
        payload = {"name": "TEST_Wings", "price": 9.99, "category_id": cat_id, "stock": 50, "low_stock_threshold": 5}
        r = admin_session.post(f"{BASE_URL}/api/menu-items", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_Wings"
        assert data["price"] == 9.99
        assert data["stock"] == 50
        TestMenuItems.item_id = data["id"]

    def test_get_menu_items(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/menu-items")
        assert r.status_code == 200
        items = r.json()
        assert any(i["id"] == TestMenuItems.item_id for i in items)

    def test_update_menu_item(self, admin_session):
        r = admin_session.put(f"{BASE_URL}/api/menu-items/{TestMenuItems.item_id}", json={"price": 11.50})
        assert r.status_code == 200, r.text
        assert r.json().get("price") == 11.50

    def test_cashier_cannot_create_item(self, cashier_session):
        r = cashier_session.post(f"{BASE_URL}/api/menu-items", json={"name": "x", "price": 1, "category_id": TestCategories.created_id})
        assert r.status_code == 403


# ------------------------- Inventory -------------------------
class TestInventory:
    def test_get_inventory(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/inventory")
        assert r.status_code == 200
        items = r.json()
        ours = [i for i in items if i["id"] == TestMenuItems.item_id]
        assert ours, "Created menu item not found in inventory"
        assert "category_name" in ours[0]
        assert "is_low_stock" in ours[0]

    def test_update_stock(self, admin_session):
        r = admin_session.put(f"{BASE_URL}/api/inventory/{TestMenuItems.item_id}", json={"stock": 30})
        assert r.status_code == 200
        # verify GET reflects
        inv = admin_session.get(f"{BASE_URL}/api/inventory").json()
        ours = [i for i in inv if i["id"] == TestMenuItems.item_id][0]
        assert ours["stock"] == 30

    def test_cashier_cannot_update_stock(self, cashier_session):
        r = cashier_session.put(f"{BASE_URL}/api/inventory/{TestMenuItems.item_id}", json={"stock": 1})
        assert r.status_code == 403

    def test_low_stock_endpoint(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/inventory/low-stock")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ------------------------- Orders -------------------------
class TestOrders:
    def _make_order(self, payment_type, qty=2):
        return {
            "items": [{"item_id": TestMenuItems.item_id, "name": "TEST_Wings", "price": 11.50, "quantity": qty}],
            "payment_type": payment_type,
            "subtotal": 11.50 * qty,
            "tax": round(11.50 * qty * 0.1, 2),
            "total": round(11.50 * qty * 1.1, 2),
        }

    def test_create_cash_order(self, cashier_session, admin_session):
        # snapshot stock
        before = [i for i in admin_session.get(f"{BASE_URL}/api/inventory").json() if i["id"] == TestMenuItems.item_id][0]["stock"]
        r = cashier_session.post(f"{BASE_URL}/api/orders", json=self._make_order("cash", qty=2))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["payment_type"] == "cash"
        # Verify stock deducted
        after = [i for i in admin_session.get(f"{BASE_URL}/api/inventory").json() if i["id"] == TestMenuItems.item_id][0]["stock"]
        assert after == before - 2, f"Stock not deducted: before={before}, after={after}"

    def test_create_credit_order(self, cashier_session):
        r = cashier_session.post(f"{BASE_URL}/api/orders", json=self._make_order("credit", qty=1))
        assert r.status_code == 200
        assert r.json()["payment_type"] == "credit"

    def test_today_orders(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/orders/today")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ------------------------- Reports -------------------------
class TestReports:
    def test_x_report(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/reports/x")
        assert r.status_code == 200
        rep = r.json()
        for k in ["total_sales", "cash_sales", "credit_sales", "total_orders", "total_items_sold", "top_items", "report_type"]:
            assert k in rep
        assert rep["report_type"] == "X"
        assert rep["total_orders"] >= 2

    def test_x_report_cashier_allowed(self, cashier_session):
        r = cashier_session.get(f"{BASE_URL}/api/reports/x")
        assert r.status_code == 200

    def test_z_report_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/reports/z")
        assert r.status_code == 200
        assert r.json()["report_type"] == "Z"

    def test_z_report_cashier_forbidden(self, cashier_session):
        r = cashier_session.get(f"{BASE_URL}/api/reports/z")
        assert r.status_code == 403

    def test_history_admin_only(self, admin_session, cashier_session):
        r = admin_session.get(f"{BASE_URL}/api/reports/history")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        r2 = cashier_session.get(f"{BASE_URL}/api/reports/history")
        assert r2.status_code == 403


# ------------------------- Dashboard -------------------------
class TestDashboard:
    def test_dashboard_stats(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_sales", "cash_sales", "credit_sales", "total_orders", "low_stock_count", "total_menu_items", "total_categories"]:
            assert k in d


# ------------------------- Cleanup -------------------------
def test_zz_cleanup(admin_session):
    """Delete created test data (run last alphabetically)."""
    if TestMenuItems.item_id:
        admin_session.delete(f"{BASE_URL}/api/menu-items/{TestMenuItems.item_id}")
    if TestCategories.created_id:
        admin_session.delete(f"{BASE_URL}/api/categories/{TestCategories.created_id}")
