"""
Iteration 6 — Menu Item Variations (size + price)
Backend tests:
- POST /api/menu-items with variations
- PUT /api/menu-items/{id} replacing variations (incl. clear with [])
- GET /api/menu-items (admin) returns variations
- GET /api/menu (public) returns variations
- Backward compat: items without variations -> []
- Negative price doesn't crash backend
- Regression: price/stock update + delete still work
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://alert-delivery-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@restaurant.com", "password": "admin123"})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    body = r.json()
    token = body.get("token") or body.get("access_token")
    assert token, f"no token in {body}"
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def category_id(admin_headers):
    """Use existing category or create one."""
    r = requests.get(f"{API}/categories")
    assert r.status_code == 200
    cats = r.json()
    if cats:
        return cats[0]["id"]
    r = requests.post(f"{API}/categories", json={"name": "TEST_VarCat", "color": "#fff"}, headers=admin_headers)
    assert r.status_code == 200
    return r.json()["id"]


# --------------------- create ---------------------
class TestCreateWithVariations:
    def test_create_item_with_variations(self, admin_headers, category_id):
        payload = {
            "name": "TEST_VarBiryani",
            "price": 350,
            "category_id": category_id,
            "stock": 50,
            "variations": [
                {"name": "Half", "price": 350},
                {"name": "Full", "price": 650},
                {"name": "Family", "price": 1200},
            ],
        }
        r = requests.post(f"{API}/menu-items", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_VarBiryani"
        assert "id" in data
        assert isinstance(data.get("variations"), list)
        assert len(data["variations"]) == 3
        names = [v["name"] for v in data["variations"]]
        assert names == ["Half", "Full", "Family"]
        prices = [v["price"] for v in data["variations"]]
        assert prices == [350, 650, 1200]
        # Cleanup
        requests.delete(f"{API}/menu-items/{data['id']}", headers=admin_headers)

    def test_create_item_without_variations_returns_empty_list(self, admin_headers, category_id):
        payload = {"name": "TEST_NoVar", "price": 100, "category_id": category_id}
        r = requests.post(f"{API}/menu-items", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("variations") == []
        requests.delete(f"{API}/menu-items/{data['id']}", headers=admin_headers)


# --------------------- update ---------------------
class TestUpdateVariations:
    @pytest.fixture
    def fresh_item(self, admin_headers, category_id):
        r = requests.post(
            f"{API}/menu-items",
            json={"name": "TEST_UpdItem", "price": 200, "category_id": category_id},
            headers=admin_headers,
        )
        assert r.status_code == 200
        item = r.json()
        yield item
        requests.delete(f"{API}/menu-items/{item['id']}", headers=admin_headers)

    def test_put_adds_variations(self, admin_headers, fresh_item):
        item_id = fresh_item["id"]
        r = requests.put(
            f"{API}/menu-items/{item_id}",
            json={"variations": [{"name": "Small", "price": 100}, {"name": "Large", "price": 300}]},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("variations"), list)
        assert len(data["variations"]) == 2
        # Verify persisted via GET admin
        r2 = requests.get(f"{API}/menu-items")
        assert r2.status_code == 200
        match = next((x for x in r2.json() if x["id"] == item_id), None)
        assert match is not None
        assert len(match["variations"]) == 2
        assert match["variations"][0]["name"] == "Small"
        assert match["variations"][1]["price"] == 300

    def test_put_clear_variations_with_empty_list(self, admin_headers, fresh_item):
        item_id = fresh_item["id"]
        # First set
        requests.put(
            f"{API}/menu-items/{item_id}",
            json={"variations": [{"name": "X", "price": 50}]},
            headers=admin_headers,
        )
        # Clear
        r = requests.put(f"{API}/menu-items/{item_id}", json={"variations": []}, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json().get("variations") == []
        # Confirm via public menu
        r2 = requests.get(f"{API}/menu")
        match = next((x for x in r2.json()["items"] if x["id"] == item_id), None)
        assert match is not None
        assert match["variations"] == []

    def test_put_negative_price_does_not_crash(self, admin_headers, fresh_item):
        item_id = fresh_item["id"]
        r = requests.put(
            f"{API}/menu-items/{item_id}",
            json={"variations": [{"name": "Bad", "price": -50}]},
            headers=admin_headers,
        )
        # Backend should not 500. It may save (frontend validates) or 422.
        assert r.status_code in (200, 400, 422), f"backend crashed: {r.status_code} {r.text}"


# --------------------- public + admin GETs ---------------------
class TestGetReturnsVariations:
    def test_admin_get_returns_variations_field(self, admin_headers):
        r = requests.get(f"{API}/menu-items")
        assert r.status_code == 200
        items = r.json()
        # Every item should have variations field (default [])
        for it in items:
            assert "variations" in it, f"item {it.get('id')} missing variations field"
            assert isinstance(it["variations"], list)

    def test_public_menu_returns_variations_field(self):
        r = requests.get(f"{API}/menu")
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
        for it in body["items"]:
            assert "variations" in it, f"public item {it.get('id')} missing variations field"
            assert isinstance(it["variations"], list)

    def test_seeded_biryani_has_three_variations(self):
        """Seeded item id from review_request."""
        seeded_id = "69fb7c4d37875c3341ef97f3"
        r = requests.get(f"{API}/menu")
        assert r.status_code == 200
        match = next((x for x in r.json()["items"] if x["id"] == seeded_id), None)
        if match is None:
            pytest.skip(f"Seed item {seeded_id} not present in this environment")
        assert len(match["variations"]) >= 1
        # If main agent seeded with Half/Full/Family, validate
        if len(match["variations"]) == 3:
            names = sorted(v["name"] for v in match["variations"])
            assert names == sorted(["Half", "Full", "Family"]), f"unexpected names: {names}"
            prices = {v["name"]: v["price"] for v in match["variations"]}
            assert prices.get("Half") == 350
            assert prices.get("Full") == 650
            assert prices.get("Family") == 1200


# --------------------- regression ---------------------
class TestRegression:
    @pytest.fixture
    def reg_item(self, admin_headers, category_id):
        r = requests.post(
            f"{API}/menu-items",
            json={"name": "TEST_Regression", "price": 500, "category_id": category_id, "stock": 10},
            headers=admin_headers,
        )
        assert r.status_code == 200
        item = r.json()
        yield item
        requests.delete(f"{API}/menu-items/{item['id']}", headers=admin_headers)

    def test_price_update_unchanged(self, admin_headers, reg_item):
        item_id = reg_item["id"]
        r = requests.put(f"{API}/menu-items/{item_id}", json={"price": 999}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["price"] == 999

    def test_stock_update_unchanged(self, admin_headers, reg_item):
        item_id = reg_item["id"]
        r = requests.put(f"{API}/inventory/{item_id}", json={"stock": 77}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["stock"] == 77

    def test_delete_unchanged(self, admin_headers, category_id):
        r = requests.post(
            f"{API}/menu-items",
            json={"name": "TEST_DelItem", "price": 1, "category_id": category_id},
            headers=admin_headers,
        )
        item_id = r.json()["id"]
        d = requests.delete(f"{API}/menu-items/{item_id}", headers=admin_headers)
        assert d.status_code == 200

    def test_online_order_create_still_works(self):
        """Cart→checkout contract unchanged - items[].item_id, name, price, qty."""
        payload = {
            "items": [{"item_id": "abc123", "name": "TEST_Chicken Biryani (Half)", "price": 350, "quantity": 2}],
            "total_price": 700,
            "customer_name": "TEST_VarCust",
            "phone": "03001112222",
            "address": "TEST var addr",
            "payment_method": "cod",
            "notes": "iter6 var test",
        }
        r = requests.post(f"{API}/online-orders", json=payload)
        assert r.status_code in (200, 201), f"online order failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["items"][0]["name"] == "TEST_Chicken Biryani (Half)"
        assert data["items"][0]["price"] == 350
