"""Iter-8 (F7 People-Also-Buy / Upsell) backend tests."""
import os
import pytest
import requests

def _load_backend_url():
    env_url = os.environ.get("REACT_APP_BACKEND_URL")
    if env_url:
        return env_url.rstrip("/")
    # fallback: read from /app/frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                line = line.strip()
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")

BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@restaurant.com", "password": "admin123"}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def menu_items():
    r = requests.get(f"{API}/menu-items", timeout=20)
    assert r.status_code == 200
    return r.json()


# ---------- model: GET menu-items returns related_item_ids ----------
def test_get_menu_items_has_related_item_ids_field(menu_items):
    assert isinstance(menu_items, list)
    assert len(menu_items) > 0
    for it in menu_items:
        assert "related_item_ids" in it, f"Item {it.get('name')} missing related_item_ids"
        assert isinstance(it["related_item_ids"], list)


# ---------- POST /menu-items default related_item_ids ----------
def test_post_menu_item_defaults_related_item_ids_to_empty(admin_session, menu_items):
    cat_id = menu_items[0]["category_id"]
    payload = {
        "name": "TEST_Iter8_NoRelated",
        "price": 100, "category_id": cat_id, "stock": 10,
    }
    r = admin_session.post(f"{API}/menu-items", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("related_item_ids") == []
    new_id = data["id"]
    # cleanup
    admin_session.delete(f"{API}/menu-items/{new_id}", timeout=20)


# ---------- POST /menu-items with related_item_ids persists ----------
def test_post_menu_item_with_related_item_ids_persists(admin_session, menu_items):
    cat_id = menu_items[0]["category_id"]
    related = [menu_items[1]["id"], menu_items[2]["id"]]
    payload = {
        "name": "TEST_Iter8_WithRelated",
        "price": 200, "category_id": cat_id, "stock": 10,
        "related_item_ids": related,
    }
    r = admin_session.post(f"{API}/menu-items", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    new_id = r.json()["id"]
    # GET back
    items = requests.get(f"{API}/menu-items", timeout=20).json()
    found = next((x for x in items if x["id"] == new_id), None)
    assert found is not None
    assert found["related_item_ids"] == related
    admin_session.delete(f"{API}/menu-items/{new_id}", timeout=20)


# ---------- PUT /menu-items/{id} updates related_item_ids ----------
def test_put_menu_item_updates_related_item_ids(admin_session, menu_items):
    cat_id = menu_items[0]["category_id"]
    payload = {"name": "TEST_Iter8_Update", "price": 150, "category_id": cat_id, "stock": 5}
    cr = admin_session.post(f"{API}/menu-items", json=payload, timeout=20)
    assert cr.status_code == 200
    new_id = cr.json()["id"]
    related = [menu_items[3]["id"]]
    ur = admin_session.put(f"{API}/menu-items/{new_id}", json={"related_item_ids": related}, timeout=20)
    assert ur.status_code == 200, ur.text
    # Re-fetch via GET
    items = requests.get(f"{API}/menu-items", timeout=20).json()
    found = next((x for x in items if x["id"] == new_id), None)
    assert found is not None
    assert found["related_item_ids"] == related
    admin_session.delete(f"{API}/menu-items/{new_id}", timeout=20)


# ---------- POST /menu/upsell empty input -> fallback (up to 4) ----------
def test_upsell_empty_input_returns_fallback_suggestions():
    r = requests.post(f"{API}/menu/upsell", json={"item_ids": [], "limit": 4}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert len(data["items"]) <= 4
    # should be non-empty if menu has items in stock
    assert len(data["items"]) > 0
    # shape check
    for it in data["items"]:
        for k in ("id", "name", "price", "original_price", "discount_percent",
                  "image_url", "is_bestseller", "is_popular", "variations"):
            assert k in it, f"missing key {k} in upsell item"
        assert isinstance(it["price"], (int, float))
        assert isinstance(it["discount_percent"], int)
        assert isinstance(it["variations"], list)


# ---------- POST /menu/upsell default limit=4 ----------
def test_upsell_default_limit_is_4():
    r = requests.post(f"{API}/menu/upsell", json={"item_ids": []}, timeout=20)
    assert r.status_code == 200
    assert len(r.json()["items"]) <= 4


# ---------- POST /menu/upsell respects max=8 cap ----------
def test_upsell_limit_capped_at_8():
    r = requests.post(f"{API}/menu/upsell", json={"item_ids": [], "limit": 50}, timeout=20)
    assert r.status_code == 200
    assert len(r.json()["items"]) <= 8


# ---------- POST /menu/upsell excludes input ids ----------
def test_upsell_excludes_input_ids(menu_items):
    in_cart = [menu_items[0]["id"], menu_items[1]["id"]]
    r = requests.post(f"{API}/menu/upsell", json={"item_ids": in_cart, "limit": 4}, timeout=20)
    assert r.status_code == 200
    out_ids = [x["id"] for x in r.json()["items"]]
    for ic in in_cart:
        assert ic not in out_ids, f"Cart item {ic} leaked into upsell suggestions"


# ---------- POST /menu/upsell prioritizes related_item_ids ----------
def test_upsell_prioritizes_related_items(admin_session, menu_items):
    """Create a parent item with related_item_ids -> the related items must show first."""
    cat_id = menu_items[0]["category_id"]
    target_id = menu_items[5]["id"] if len(menu_items) > 5 else menu_items[-1]["id"]
    payload = {
        "name": "TEST_Iter8_Parent",
        "price": 300, "category_id": cat_id, "stock": 20,
        "related_item_ids": [target_id],
    }
    cr = admin_session.post(f"{API}/menu-items", json=payload, timeout=20)
    assert cr.status_code == 200
    parent_id = cr.json()["id"]
    try:
        r = requests.post(f"{API}/menu/upsell", json={"item_ids": [parent_id], "limit": 4}, timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        ids = [x["id"] for x in items]
        assert target_id in ids, f"Related target {target_id} not in upsell {ids}"
        # Should be first
        assert ids[0] == target_id, f"Related target not first; got order {ids}"
    finally:
        admin_session.delete(f"{API}/menu-items/{parent_id}", timeout=20)


# ---------- POST /menu/upsell excludes stock=0 items ----------
def test_upsell_excludes_out_of_stock(admin_session, menu_items):
    cat_id = menu_items[0]["category_id"]
    payload = {"name": "TEST_Iter8_OOS", "price": 50, "category_id": cat_id, "stock": 0}
    cr = admin_session.post(f"{API}/menu-items", json=payload, timeout=20)
    assert cr.status_code == 200
    oos_id = cr.json()["id"]
    try:
        r = requests.post(f"{API}/menu/upsell", json={"item_ids": [], "limit": 8}, timeout=20)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()["items"]]
        assert oos_id not in ids, "Out-of-stock item leaked into upsell"
    finally:
        admin_session.delete(f"{API}/menu-items/{oos_id}", timeout=20)


# ---------- POST /menu/upsell discount fields shape ----------
def test_upsell_discount_fields_consistent_with_menu():
    r = requests.post(f"{API}/menu/upsell", json={"item_ids": [], "limit": 8}, timeout=20)
    assert r.status_code == 200
    for it in r.json()["items"]:
        if it["original_price"] is None:
            assert it["discount_percent"] == 0
        else:
            assert it["original_price"] >= it["price"]
            assert it["discount_percent"] > 0


# ---------- REGRESSION ----------
def test_regression_get_menu():
    r = requests.get(f"{API}/menu", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert "categories" in j and "items" in j
    assert isinstance(j["items"], list) and len(j["items"]) > 0


def test_regression_categories_endpoint():
    r = requests.get(f"{API}/categories", timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_regression_online_settings():
    r = requests.get(f"{API}/admin/online-settings", timeout=20)
    # Either auth-required (401/403) or open
    assert r.status_code in (200, 401, 403), r.status_code
