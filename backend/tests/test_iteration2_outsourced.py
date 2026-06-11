"""Backend tests for iteration 2 (production workflow improvements):
- 19 permissions on admin login (13 OLD + 6 NEW online_*)
- Outsourced menu items: is_outsourced + outsourced_vendor_id + outsourced_unit_cost
- Auto vendor_transaction creation on order with outsourced items
- Auto reversal (negative vendor_transaction) on refund
- /api/vendors/{vid}/sales-summary endpoint
- Backward compat: non-outsourced items unaffected
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"

EXPECTED_PERMS = {
    "dashboard", "pos", "menu", "menu_edit", "inventory", "reports_x", "reports_z",
    "orders_history", "settings", "expenses", "vendors", "reprint_invoices", "refunds",
    "online_dashboard", "online_orders", "online_menu", "online_offers",
    "online_events", "online_settings",
}


@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_headers(http):
    r = http.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


# ====== Permissions ======
class TestAdminPermissions:
    def test_login_returns_19_permissions(self, http):
        r = http.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        perms = set(data.get("permissions") or [])
        # Must include ALL 19 expected
        missing = EXPECTED_PERMS - perms
        assert not missing, f"Missing perms: {missing}. Got: {perms}"
        assert len(perms) >= 19, f"Expected >=19 perms, got {len(perms)}: {perms}"

    def test_login_has_all_6_online_perms(self, http):
        r = http.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        perms = set(r.json()["permissions"])
        online_perms = {"online_dashboard", "online_orders", "online_menu", "online_offers",
                        "online_events", "online_settings"}
        assert online_perms.issubset(perms), f"Missing online perms: {online_perms - perms}"


# ====== Menu items expose outsourced fields ======
class TestMenuItemsOutsourcedFields:
    def test_list_returns_outsourced_fields(self, http):
        r = http.get(f"{API}/menu-items")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and items
        first = items[0]
        for k in ("is_outsourced", "outsourced_vendor_id", "outsourced_unit_cost"):
            assert k in first, f"Missing field {k} in {first.keys()}"


# ====== End-to-end outsourced flow ======
class TestOutsourcedOrderFlow:
    @pytest.fixture(scope="class")
    def vendor_id(self, http, admin_headers):
        r = http.post(
            f"{API}/vendors",
            json={"name": f"TEST_outsrc_{uuid.uuid4().hex[:6]}", "contact": "5551234567"},
            headers=admin_headers,
        )
        assert r.status_code in (200, 201), r.text
        vid = r.json()["id"]
        yield vid
        try:
            http.delete(f"{API}/vendors/{vid}", headers=admin_headers)
        except Exception:
            pass

    @pytest.fixture(scope="class")
    def outsourced_item(self, http, admin_headers, vendor_id):
        cats = http.get(f"{API}/categories").json()
        cat_id = cats[0]["id"]
        payload = {
            "name": f"TEST_pepsi_{uuid.uuid4().hex[:5]}",
            "price": 100.0,
            "category_id": cat_id,
            "stock": 50,
            "is_outsourced": True,
            "outsourced_vendor_id": vendor_id,
            "outsourced_unit_cost": 70.0,
        }
        r = http.post(f"{API}/menu-items", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["is_outsourced"] is True
        assert body["outsourced_vendor_id"] == vendor_id
        assert float(body["outsourced_unit_cost"]) == 70.0
        yield body
        try:
            http.delete(f"{API}/menu-items/{body['id']}", headers=admin_headers)
        except Exception:
            pass

    def test_a_create_outsourced_item_persists(self, http, outsourced_item, vendor_id):
        # GET single item via list and check fields
        items = http.get(f"{API}/menu-items").json()
        match = next((i for i in items if i["id"] == outsourced_item["id"]), None)
        assert match, "Outsourced item not in menu-items list"
        assert match["is_outsourced"] is True
        assert match["outsourced_vendor_id"] == vendor_id
        assert float(match["outsourced_unit_cost"]) == 70.0

    def test_b_place_order_triggers_vendor_transaction(self, http, admin_headers, outsourced_item, vendor_id):
        it = outsourced_item
        # Order qty 3 → expected vendor billing: 3 * 70 = 210
        order_payload = {
            "items": [{"item_id": it["id"], "name": it["name"], "price": it["price"], "quantity": 3}],
            "subtotal": it["price"] * 3,
            "tax": 0,
            "total": it["price"] * 3,
            "payment_type": "cash",
        }
        r = http.post(f"{API}/orders", json=order_payload, headers=admin_headers)
        assert r.status_code in (200, 201), r.text

        # Sales summary should show auto_billed_from_orders >= 210
        rs = http.get(f"{API}/vendors/{vendor_id}/sales-summary", headers=admin_headers)
        assert rs.status_code == 200, rs.text
        data = rs.json()
        assert data["vendor_id"] == vendor_id
        assert data["auto_billed_from_orders"] >= 210.0, f"Expected >=210, got {data['auto_billed_from_orders']}"
        # products array should contain the item
        names = [p["name"] for p in data.get("products", [])]
        assert it["name"] in names, f"Item {it['name']} not in products: {names}"
        # Save baseline for next test
        pytest.outsourced_total_billed_after_order = data["total_billed"]
        pytest.outsourced_order_id = r.json().get("id") or r.json().get("order_id") or r.json().get("receipt_id")

    def test_c_refund_creates_negative_reversal(self, http, admin_headers, outsourced_item, vendor_id):
        it = outsourced_item
        order_id = getattr(pytest, "outsourced_order_id", None) or "test-order"
        baseline_total = getattr(pytest, "outsourced_total_billed_after_order", 0.0)

        # Refund 1 unit (item-level reversal: 1 * 70 = 70)
        refund_payload = {
            "order_id": str(order_id),
            "reason": "TEST refund — outsourced reversal",
            "amount": 100.0,
            "items": [{"item_id": it["id"], "name": it["name"], "price": it["price"], "quantity": 1}],
        }
        rr = http.post(f"{API}/refunds", json=refund_payload, headers=admin_headers)
        assert rr.status_code in (200, 201), rr.text

        # Sales summary: auto_reversed_from_refunds should now be negative,
        # and total_billed should drop by ~70.
        rs = http.get(f"{API}/vendors/{vendor_id}/sales-summary", headers=admin_headers)
        assert rs.status_code == 200
        d = rs.json()
        assert d["auto_reversed_from_refunds"] < 0, f"Expected negative reversal, got {d['auto_reversed_from_refunds']}"
        assert d["auto_reversed_from_refunds"] <= -70.0, f"Expected <=-70, got {d['auto_reversed_from_refunds']}"
        # total_billed should drop relative to baseline
        assert d["total_billed"] < baseline_total, f"Expected total_billed to drop from {baseline_total}, got {d['total_billed']}"


# ====== Backward compatibility: non-outsourced items ======
class TestNonOutsourcedRegression:
    def test_regular_item_no_vendor_transaction(self, http, admin_headers):
        """Non-outsourced order should not create stray vendor transactions."""
        # Create fresh vendor with NO transactions
        rv = http.post(
            f"{API}/vendors",
            json={"name": f"TEST_unused_{uuid.uuid4().hex[:6]}", "contact": "5550000000"},
            headers=admin_headers,
        )
        vid = rv.json()["id"]

        # Place an order with a regular menu item
        items = http.get(f"{API}/menu-items").json()
        regular = next((i for i in items if not i.get("is_outsourced")), None)
        assert regular, "Need at least one non-outsourced menu item"
        order_payload = {
            "items": [{"item_id": regular["id"], "name": regular["name"], "price": regular["price"], "quantity": 1}],
            "subtotal": regular["price"],
            "tax": 0,
            "total": regular["price"],
            "payment_type": "cash",
        }
        r = http.post(f"{API}/orders", json=order_payload, headers=admin_headers)
        assert r.status_code in (200, 201)

        # The unused vendor must still have 0 auto_billed
        rs = http.get(f"{API}/vendors/{vid}/sales-summary", headers=admin_headers)
        assert rs.status_code == 200
        d = rs.json()
        assert d["auto_billed_from_orders"] == 0.0
        assert d["transactions_count"] == 0

        # Cleanup
        http.delete(f"{API}/vendors/{vid}", headers=admin_headers)


# ====== sales-summary auth guard ======
class TestSalesSummaryAuth:
    def test_unauth_returns_401_or_403(self):
        # Use a fresh session with no cookies/headers to isolate auth check
        clean = requests.Session()
        r = clean.get(f"{API}/vendors/anything/sales-summary")
        assert r.status_code in (401, 403)
