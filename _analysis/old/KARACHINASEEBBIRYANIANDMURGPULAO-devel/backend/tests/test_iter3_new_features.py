"""Iteration 3 new feature tests: hourly-sales, CSV exports, history export, full order details for receipt."""
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def cashier_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_iter3_{uuid.uuid4().hex[:8]}@test.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "pw12345", "name": "Iter3 Cashier", "role": "cashier"
    })
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def seed_item(admin_session):
    cat_name = f"TEST_Iter3Cat_{uuid.uuid4().hex[:6]}"
    rc = admin_session.post(f"{BASE_URL}/api/categories", json={"name": cat_name})
    cat_id = rc.json()["id"]
    ri = admin_session.post(f"{BASE_URL}/api/menu-items", json={
        "name": "TEST_Iter3Item", "price": 5.00, "category_id": cat_id, "stock": 100, "low_stock_threshold": 5
    })
    item = ri.json()
    yield item
    admin_session.delete(f"{BASE_URL}/api/menu-items/{item['id']}")
    admin_session.delete(f"{BASE_URL}/api/categories/{cat_id}")


# ---- Hourly Sales chart endpoint ----
class TestHourlySales:
    def test_hourly_sales_unauth(self):
        r = requests.get(f"{BASE_URL}/api/dashboard/hourly-sales")
        assert r.status_code == 401

    def test_hourly_sales_returns_24_buckets(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dashboard/hourly-sales")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 24, f"expected 24 hourly buckets, got {len(data)}"
        for bucket in data:
            assert "hour" in bucket and "cash" in bucket and "credit" in bucket and "total" in bucket and "orders" in bucket
            assert bucket["hour"].endswith(":00")

    def test_hourly_sales_reflects_new_order(self, cashier_session, admin_session, seed_item):
        before = admin_session.get(f"{BASE_URL}/api/dashboard/hourly-sales").json()
        before_total = sum(b["total"] for b in before)
        before_orders = sum(b["orders"] for b in before)
        # Create a new cash order
        order = {
            "items": [{"item_id": seed_item["id"], "name": seed_item["name"], "price": 5.00, "quantity": 2}],
            "payment_type": "cash",
            "subtotal": 10.00, "tax": 0.50, "total": 10.50,
        }
        ro = cashier_session.post(f"{BASE_URL}/api/orders", json=order)
        assert ro.status_code == 200, ro.text
        after = admin_session.get(f"{BASE_URL}/api/dashboard/hourly-sales").json()
        after_total = sum(b["total"] for b in after)
        after_orders = sum(b["orders"] for b in after)
        assert after_orders == before_orders + 1
        assert round(after_total - before_total, 2) == 10.50


# ---- Order create returns full details for receipt ----
class TestOrderForReceipt:
    def test_order_response_has_receipt_fields(self, cashier_session, seed_item):
        order = {
            "items": [{"item_id": seed_item["id"], "name": seed_item["name"], "price": 5.00, "quantity": 1}],
            "payment_type": "cash",
            "subtotal": 5.00, "tax": 0.25, "total": 5.25,
        }
        r = cashier_session.post(f"{BASE_URL}/api/orders", json=order)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["id", "items", "payment_type", "subtotal", "tax", "total", "created_at", "cashier_name"]:
            assert k in d, f"missing receipt field: {k}"
        assert d["items"][0]["name"] == seed_item["name"]
        assert d["items"][0]["quantity"] == 1
        assert d["payment_type"] == "cash"

    def test_credit_order_receipt(self, cashier_session, seed_item):
        order = {
            "items": [{"item_id": seed_item["id"], "name": seed_item["name"], "price": 5.00, "quantity": 1}],
            "payment_type": "credit",
            "subtotal": 5.00, "tax": 0.25, "total": 5.25,
        }
        r = cashier_session.post(f"{BASE_URL}/api/orders", json=order)
        assert r.status_code == 200
        assert r.json()["payment_type"] == "credit"

    def test_discounted_order_receipt(self, cashier_session, seed_item):
        order = {
            "items": [{"item_id": seed_item["id"], "name": seed_item["name"], "price": 5.00, "quantity": 2}],
            "payment_type": "cash",
            "subtotal": 10.00, "tax": 0.45, "total": 9.45,
            "discount_type": "flat", "discount_value": 1.00, "discount_amount": 1.00,
        }
        r = cashier_session.post(f"{BASE_URL}/api/orders", json=order)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["discount_amount"] == 1.00


# ---- CSV export endpoints ----
class TestCSVExport:
    def test_export_csv_unauth(self):
        r = requests.get(f"{BASE_URL}/api/reports/export/csv")
        assert r.status_code == 401

    def test_export_csv_returns_rows(self, admin_session, cashier_session, seed_item):
        # Create a fresh order so today has data
        order = {
            "items": [{"item_id": seed_item["id"], "name": seed_item["name"], "price": 5.00, "quantity": 3}],
            "payment_type": "cash",
            "subtotal": 15.00, "tax": 0.75, "total": 15.75,
        }
        cashier_session.post(f"{BASE_URL}/api/orders", json=order)
        r = admin_session.get(f"{BASE_URL}/api/reports/export/csv")
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) > 0
        sample = rows[0]
        for k in ["date", "time", "item_name", "quantity", "unit_price", "line_total", "payment_type", "discount", "order_total", "cashier"]:
            assert k in sample, f"missing csv key: {k}"

    def test_export_csv_cashier_allowed(self, cashier_session):
        # Cashier can export today's CSV (no admin guard in code)
        r = cashier_session.get(f"{BASE_URL}/api/reports/export/csv")
        assert r.status_code == 200


# ---- History export ----
class TestHistoryExport:
    def test_history_export_unauth(self):
        r = requests.get(f"{BASE_URL}/api/reports/history/export")
        assert r.status_code == 401

    def test_history_export_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/reports/history/export")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_history_export_cashier_forbidden(self, cashier_session):
        r = cashier_session.get(f"{BASE_URL}/api/reports/history/export")
        assert r.status_code == 403
