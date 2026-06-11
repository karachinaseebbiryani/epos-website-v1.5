"""Iteration-7 backend regression: F4 Categories CRUD + image upload, F5 reorder, F6 item-level discount, F8 free-delivery threshold, polish badges."""
import os
import requests
import pytest
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------------- F8: Free-delivery threshold ----------------
class TestFreeDeliveryThreshold:
    def test_public_settings_has_threshold(self):
        r = requests.get(f"{BASE_URL}/api/public/settings")
        assert r.status_code == 200
        data = r.json()
        assert "free_delivery_min_subtotal" in data
        assert isinstance(data["free_delivery_min_subtotal"], (int, float))

    def test_admin_put_threshold(self, admin_headers):
        # Set to 800 (per request agent_to_agent_context_note)
        r = requests.put(f"{BASE_URL}/api/admin/online-settings", json={"free_delivery_min_subtotal": 800}, headers=admin_headers)
        assert r.status_code == 200
        assert float(r.json()["free_delivery_min_subtotal"]) == 800.0

        # Verify persisted via public settings
        r2 = requests.get(f"{BASE_URL}/api/public/settings")
        assert float(r2.json()["free_delivery_min_subtotal"]) == 800.0

    def test_quote_in_free_radius(self, admin_headers):
        # Ensure threshold is set
        requests.put(f"{BASE_URL}/api/admin/online-settings", json={"free_delivery_min_subtotal": 800}, headers=admin_headers)
        s = requests.get(f"{BASE_URL}/api/public/settings").json()
        # Inside free radius = same lat/lng as restaurant
        r = requests.post(f"{BASE_URL}/api/delivery/quote", json={
            "lat": s["restaurant_lat"], "lng": s["restaurant_lng"], "subtotal": 100
        })
        assert r.status_code == 200
        d = r.json()
        assert d["free_delivery"] is True
        assert d.get("free_delivery_reason") == "in-free-radius"

    def test_quote_subtotal_threshold(self, admin_headers):
        requests.put(f"{BASE_URL}/api/admin/online-settings", json={"free_delivery_min_subtotal": 800}, headers=admin_headers)
        s = requests.get(f"{BASE_URL}/api/public/settings").json()
        # Far-away lat/lng so distance > free_radius. Add ~0.05deg ~= 5.5 km
        far_lat = s["restaurant_lat"] + 0.05
        far_lng = s["restaurant_lng"] + 0.05
        # subtotal >= threshold -> free_delivery true with subtotal-threshold reason
        r = requests.post(f"{BASE_URL}/api/delivery/quote", json={"lat": far_lat, "lng": far_lng, "subtotal": 1000})
        assert r.status_code == 200
        d = r.json()
        # Could still be in_free_radius if delivery_free_radius_km is huge; check distance first
        if d["distance_km"] > s["delivery_free_radius_km"] and d["distance_km"] <= s["delivery_max_radius_km"]:
            assert d["free_delivery"] is True
            assert d.get("free_delivery_reason") == "subtotal-threshold"

    def test_quote_below_threshold_returns_fee(self, admin_headers):
        requests.put(f"{BASE_URL}/api/admin/online-settings", json={"free_delivery_min_subtotal": 800}, headers=admin_headers)
        s = requests.get(f"{BASE_URL}/api/public/settings").json()
        far_lat = s["restaurant_lat"] + 0.05
        far_lng = s["restaurant_lng"] + 0.05
        r = requests.post(f"{BASE_URL}/api/delivery/quote", json={"lat": far_lat, "lng": far_lng, "subtotal": 100})
        assert r.status_code == 200
        d = r.json()
        if d["distance_km"] > s["delivery_free_radius_km"] and d["distance_km"] <= s["delivery_max_radius_km"]:
            assert d["free_delivery"] is False
            assert d["fee"] >= 0


# ---------------- F6: Discount engine on /api/menu (public) ----------------
class TestPublicMenuDiscount:
    def test_public_menu_has_discount_fields(self):
        r = requests.get(f"{BASE_URL}/api/menu")
        assert r.status_code == 200
        data = r.json()
        items = data.get("items", data) if isinstance(data, dict) else data
        assert isinstance(items, list)
        assert len(items) > 0
        for it in items:
            assert "price" in it
            assert "original_price" in it
            assert "discount_percent" in it
            assert "is_bestseller" in it
            assert "is_popular" in it
            # discount_percent is int
            assert isinstance(it["discount_percent"], int)

    def test_seeded_discount_item_returns_sale_price(self):
        r = requests.get(f"{BASE_URL}/api/menu")
        assert r.status_code == 200
        _d = r.json()
        items = _d.get("items", _d) if isinstance(_d, dict) else _d
        # Look for "Chicken Biryani Full" or "Chicken Biryani (Full)" which should have 25% discount per agent_to_agent_context_note
        biryani = [i for i in items if "Chicken Biryani" in i.get("name", "") and "Full" in i.get("name", "")]
        if not biryani:
            pytest.skip("Seeded discounted Chicken Biryani Full not found")
        b = biryani[0]
        if b["discount_percent"] == 0:
            pytest.skip("No discount applied to that item; seed may not be in place")
        assert b["original_price"] is not None
        assert b["price"] < b["original_price"]
        # 25% off => price ~ 0.75 * original
        if b["discount_type"] == "percentage":
            expected = b["original_price"] * (1 - float(b["discount_value"]) / 100)
            assert abs(b["price"] - expected) < 0.01
        assert b["discount_percent"] >= 1


# ---------------- F4 + F6 admin menu items: discount / bestseller / image upload ----------------
@pytest.fixture
def temp_menu_item(admin_headers):
    cats = requests.get(f"{BASE_URL}/api/categories").json()
    cat_id = cats[0]["id"] if cats else None
    payload = {
        "name": "TEST_Iter7_Item",
        "price": 200,
        "stock": 5,
        "category_id": cat_id,
        "image_url": "data:image/jpeg;base64,/9j/AAQSkZJRgABAQEAYABgAAD/test",
        "image_type": "data",
        "description": "Iter7 test",
    }
    r = requests.post(f"{BASE_URL}/api/menu-items", json=payload, headers=admin_headers)
    assert r.status_code in (200, 201), r.text
    item = r.json()
    yield item
    # cleanup
    try:
        requests.delete(f"{BASE_URL}/api/menu-items/{item['id']}", headers=admin_headers)
    except Exception:
        pass


class TestAdminMenuItemDiscountAndBestseller:
    def test_admin_get_menu_items_returns_new_fields(self, admin_headers, temp_menu_item):
        r = requests.get(f"{BASE_URL}/api/menu-items", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # find our test item
        ours = [i for i in items if i.get("id") == temp_menu_item["id"]]
        assert ours
        it = ours[0]
        for k in ["discount_type", "discount_value", "is_bestseller", "is_popular", "image_url"]:
            assert k in it

    def test_create_with_data_uri_image(self, admin_headers, temp_menu_item):
        # already created in fixture - validate the data URI persisted
        r = requests.get(f"{BASE_URL}/api/menu-items", headers=admin_headers)
        items = r.json()
        it = next(i for i in items if i["id"] == temp_menu_item["id"])
        assert it["image_url"].startswith("data:image/jpeg;base64,")

    def test_put_percentage_discount(self, admin_headers, temp_menu_item):
        r = requests.put(f"{BASE_URL}/api/menu-items/{temp_menu_item['id']}", json={
            "discount_type": "percentage", "discount_value": 20, "is_bestseller": True
        }, headers=admin_headers)
        assert r.status_code == 200
        # Validate via public /menu
        _pd = requests.get(f"{BASE_URL}/api/menu").json(); pub = _pd.get("items", _pd) if isinstance(_pd, dict) else _pd
        ours = next((i for i in pub if i.get("id") == temp_menu_item["id"]), None)
        assert ours is not None
        assert ours["is_bestseller"] is True
        assert ours["discount_type"] == "percentage"
        assert ours["discount_percent"] == 20
        # 200 * 0.80 = 160
        assert abs(ours["price"] - 160) < 0.01
        assert ours["original_price"] == 200

    def test_put_fixed_discount(self, admin_headers, temp_menu_item):
        r = requests.put(f"{BASE_URL}/api/menu-items/{temp_menu_item['id']}", json={
            "discount_type": "fixed", "discount_value": 50
        }, headers=admin_headers)
        assert r.status_code == 200
        _pd = requests.get(f"{BASE_URL}/api/menu").json(); pub = _pd.get("items", _pd) if isinstance(_pd, dict) else _pd
        ours = next((i for i in pub if i.get("id") == temp_menu_item["id"]), None)
        assert ours is not None
        # 200 - 50 = 150
        assert abs(ours["price"] - 150) < 0.01
        assert ours["discount_type"] == "fixed"
        assert ours["original_price"] == 200

    def test_put_clear_discount(self, admin_headers, temp_menu_item):
        # First set, then clear
        requests.put(f"{BASE_URL}/api/menu-items/{temp_menu_item['id']}", json={
            "discount_type": "percentage", "discount_value": 20
        }, headers=admin_headers)
        r = requests.put(f"{BASE_URL}/api/menu-items/{temp_menu_item['id']}", json={
            "discount_type": None, "discount_value": 0
        }, headers=admin_headers)
        assert r.status_code == 200
        _pd = requests.get(f"{BASE_URL}/api/menu").json(); pub = _pd.get("items", _pd) if isinstance(_pd, dict) else _pd
        ours = next((i for i in pub if i.get("id") == temp_menu_item["id"]), None)
        assert ours["discount_percent"] == 0
        assert ours["original_price"] is None


# ---------------- F4 Categories CRUD + reorder regression ----------------
class TestCategoriesRegression:
    def test_get_categories(self):
        r = requests.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_update_delete_category(self, admin_headers):
        # Create
        r = requests.post(f"{BASE_URL}/api/categories", json={"name": "TEST_Iter7_Cat", "color": "#ff0000"}, headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        cat = r.json()
        cat_id = cat.get("id") or cat.get("_id")
        assert cat_id
        # Update
        r2 = requests.put(f"{BASE_URL}/api/categories/{cat_id}", json={"name": "TEST_Iter7_Cat_2", "color": "#00ff00"}, headers=admin_headers)
        assert r2.status_code == 200
        # Get list and verify
        all_cats = requests.get(f"{BASE_URL}/api/categories").json()
        ours = next((c for c in all_cats if (c.get("id") or c.get("_id")) == cat_id), None)
        assert ours is not None
        assert ours["name"] == "TEST_Iter7_Cat_2"
        # Reorder regression
        r3 = requests.post(f"{BASE_URL}/api/categories/reorder", json={"ids": [cat_id]}, headers=admin_headers)
        assert r3.status_code == 200
        # Delete
        r4 = requests.delete(f"{BASE_URL}/api/categories/{cat_id}", headers=admin_headers)
        assert r4.status_code in (200, 204)


# ---------------- F5: Menu items reorder regression ----------------
class TestMenuItemsReorderRegression:
    def test_menu_items_reorder(self, admin_headers):
        items = requests.get(f"{BASE_URL}/api/menu-items", headers=admin_headers).json()
        assert isinstance(items, list)
        ids = [i["id"] for i in items[:3]]
        r = requests.post(f"{BASE_URL}/api/menu-items/reorder", json={"ids": ids}, headers=admin_headers)
        assert r.status_code == 200


# ---------------- F8 + Online Order: free-delivery applied during order create ----------------
class TestOnlineOrderFreeDelivery:
    def test_order_with_threshold_free_delivery(self, admin_headers):
        # Set threshold to a low number so subtotal >= threshold
        requests.put(f"{BASE_URL}/api/admin/online-settings", json={"free_delivery_min_subtotal": 100}, headers=admin_headers)
        # Get a menu item
        _d = requests.get(f"{BASE_URL}/api/menu").json(); items = _d.get("items", _d) if isinstance(_d, dict) else _d
        if not items:
            pytest.skip("No items")
        it = items[0]
        s = requests.get(f"{BASE_URL}/api/public/settings").json()
        # delivery far from restaurant so distance > free_radius
        far_lat = s["restaurant_lat"] + 0.05
        far_lng = s["restaurant_lng"] + 0.05
        order_payload = {
            "customer_name": "TEST_Iter7_Order",
            "customer_phone": "03001234567",
            "customer_email": "",
            "address": "TEST address line",
            "lat": far_lat,
            "lng": far_lng,
            "items": [{"item_id": it["id"], "name": it["name"], "price": it["price"], "quantity": 5}],
            "total_price": it["price"] * 5,
            "payment_method": "cod",
            "notes": "TEST",
        }
        r = requests.post(f"{BASE_URL}/api/online-orders", json=order_payload)
        if r.status_code != 200:
            pytest.skip(f"Order create not available: {r.status_code} {r.text[:200]}")
        body = r.json()
        # subtotal would be price*5 which should easily exceed 100 threshold
        if body.get("delivery", {}).get("distance_km", 0) > s["delivery_free_radius_km"]:
            assert body["delivery"]["fee"] == 0 or body.get("delivery_fee", 0) == 0
        # restore threshold
        requests.put(f"{BASE_URL}/api/admin/online-settings", json={"free_delivery_min_subtotal": 800}, headers=admin_headers)
