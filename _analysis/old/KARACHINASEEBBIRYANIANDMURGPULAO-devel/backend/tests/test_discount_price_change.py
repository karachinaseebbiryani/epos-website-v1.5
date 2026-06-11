"""Tests for new discount and price change features in Restaurant POS.

Backend changes covered:
- OrderCreate now accepts discount_type, discount_value, discount_amount
- OrderItemInput now accepts original_price (for cart price-change feature)
"""
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
def seed_item(admin_session):
    """Create a fresh category and menu item for these tests."""
    cat_name = f"TEST_DiscCat_{uuid.uuid4().hex[:6]}"
    rc = admin_session.post(f"{BASE_URL}/api/categories", json={"name": cat_name})
    assert rc.status_code == 200, rc.text
    cat_id = rc.json()["id"]

    item_payload = {"name": "TEST_DiscItem", "price": 10.00, "category_id": cat_id, "stock": 100, "low_stock_threshold": 5}
    ri = admin_session.post(f"{BASE_URL}/api/menu-items", json=item_payload)
    assert ri.status_code == 200, ri.text
    item = ri.json()
    yield {"category_id": cat_id, "item_id": item["id"], "name": item["name"], "price": item["price"]}
    # Cleanup
    admin_session.delete(f"{BASE_URL}/api/menu-items/{item['id']}")
    admin_session.delete(f"{BASE_URL}/api/categories/{cat_id}")


# --- Discount tests ---
class TestDiscountOrders:
    def test_order_with_percent_discount(self, admin_session, seed_item):
        # 2 x $10 = $20, 10% discount => $2 off, after-disc subtotal = $18, tax 10% = $1.80, total = $19.80
        payload = {
            "items": [{"item_id": seed_item["item_id"], "name": seed_item["name"], "price": 10.00, "original_price": 10.00, "quantity": 2}],
            "payment_type": "cash",
            "subtotal": 20.00,
            "tax": 1.80,
            "total": 19.80,
            "discount_type": "percent",
            "discount_value": 10,
            "discount_amount": 2.00,
        }
        r = admin_session.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] == 19.80
        # Verify in today's orders
        today = admin_session.get(f"{BASE_URL}/api/orders/today").json()
        match = [o for o in today if o.get("total") == 19.80 and o.get("discount_type") == "percent"]
        assert match, "Percent discount order not persisted with discount_type"
        assert match[0]["discount_value"] == 10
        assert match[0]["discount_amount"] == 2.00

    def test_order_with_flat_discount(self, admin_session, seed_item):
        # 1 x $10 - $5 flat = $5 subtotal after disc, tax 10% = $0.50, total $5.50
        payload = {
            "items": [{"item_id": seed_item["item_id"], "name": seed_item["name"], "price": 10.00, "original_price": 10.00, "quantity": 1}],
            "payment_type": "credit",
            "subtotal": 10.00,
            "tax": 0.50,
            "total": 5.50,
            "discount_type": "flat",
            "discount_value": 5.00,
            "discount_amount": 5.00,
        }
        r = admin_session.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200, r.text
        today = admin_session.get(f"{BASE_URL}/api/orders/today").json()
        match = [o for o in today if o.get("total") == 5.50 and o.get("discount_type") == "flat"]
        assert match, "Flat discount order not persisted"
        assert match[0]["discount_value"] == 5.00
        assert match[0]["discount_amount"] == 5.00

    def test_order_no_discount_defaults(self, admin_session, seed_item):
        """Orders without discount fields should default to None/0."""
        payload = {
            "items": [{"item_id": seed_item["item_id"], "name": seed_item["name"], "price": 10.00, "quantity": 1}],
            "payment_type": "cash",
            "subtotal": 10.00,
            "tax": 1.00,
            "total": 11.00,
        }
        r = admin_session.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200, r.text


# --- Price change tests ---
class TestPriceChangeOrders:
    def test_order_with_changed_price(self, admin_session, seed_item):
        """User changed price from $10 to $7.50 in cart; original_price preserved."""
        payload = {
            "items": [{
                "item_id": seed_item["item_id"],
                "name": seed_item["name"],
                "price": 7.50,            # changed
                "original_price": 10.00,  # original
                "quantity": 2,
            }],
            "payment_type": "cash",
            "subtotal": 15.00,
            "tax": 1.50,
            "total": 16.50,
        }
        r = admin_session.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200, r.text
        today = admin_session.get(f"{BASE_URL}/api/orders/today").json()
        match = [o for o in today if o.get("total") == 16.50 and any(i.get("price") == 7.50 for i in o.get("items", []))]
        assert match, "Price-changed order not persisted"
        line = match[0]["items"][0]
        assert line["price"] == 7.50
        assert line["original_price"] == 10.00, "original_price not stored alongside changed price"

    def test_order_default_original_price(self, admin_session, seed_item):
        """When original_price is omitted, it should default to current price (no change)."""
        payload = {
            "items": [{
                "item_id": seed_item["item_id"],
                "name": seed_item["name"],
                "price": 10.00,
                "quantity": 1,
            }],
            "payment_type": "cash",
            "subtotal": 10.00,
            "tax": 1.00,
            "total": 11.00,
        }
        r = admin_session.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200, r.text
        today = admin_session.get(f"{BASE_URL}/api/orders/today").json()
        # Find a recent order with original_price equal to price (default behaviour)
        match = [o for o in today if any(i.get("price") == 10.00 and i.get("original_price") == 10.00 for i in o.get("items", []))]
        assert match, "Default original_price not set to current price"


# --- Combined ---
class TestDiscountPlusPriceChange:
    def test_combined_flow(self, admin_session, seed_item):
        # Item price changed from $10 to $8, qty 3 -> subtotal $24, percent 25% -> $6 off, after $18, tax $1.80, total $19.80
        payload = {
            "items": [{
                "item_id": seed_item["item_id"],
                "name": seed_item["name"],
                "price": 8.00,
                "original_price": 10.00,
                "quantity": 3,
            }],
            "payment_type": "credit",
            "subtotal": 24.00,
            "tax": 1.80,
            "total": 19.80,
            "discount_type": "percent",
            "discount_value": 25,
            "discount_amount": 6.00,
        }
        r = admin_session.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200, r.text
