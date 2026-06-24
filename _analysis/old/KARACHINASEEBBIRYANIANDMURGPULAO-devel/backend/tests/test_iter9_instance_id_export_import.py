"""
iter9 backend tests:
1. Instance-bound JWT: backend restart invalidates issued tokens (force re-login).
2. /api/data/export: includes _meta (version=2), users, settings + all collections; admin only.
3. /api/data/import: replace mode + ObjectId preservation + invalid _id graceful drop.
4. Regression smoke: login still works.
"""

import os
import time
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://alert-delivery-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"


def _login():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    j = r.json()
    token = j.get("access_token") or j.get("token")
    assert token, f"No token in login response: {j}"
    return token


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Section 1: Force re-login on backend restart ----------

class TestInstanceBoundJWT:
    def test_login_returns_token_and_me_works(self):
        token = _login()
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth_headers(token), timeout=10)
        assert r.status_code == 200, f"/auth/me failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("email") == ADMIN_EMAIL
        assert data.get("role") == "admin"

    def test_token_invalid_after_backend_restart(self):
        # Get token from current instance
        token = _login()
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth_headers(token), timeout=10)
        assert r.status_code == 200, "Token should be valid before restart"

        # Restart backend
        result = subprocess.run(
            ["sudo", "supervisorctl", "restart", "backend"],
            capture_output=True, text=True, timeout=30,
        )
        assert result.returncode == 0, f"supervisor restart failed: {result.stderr}"

        # Wait for backend to come back
        deadline = time.time() + 45
        ready = False
        while time.time() < deadline:
            try:
                hr = requests.get(f"{BASE_URL}/api/", timeout=5)
                if hr.status_code in (200, 404, 401):
                    ready = True
                    break
            except Exception:
                pass
            time.sleep(1)
        assert ready, "Backend did not come up after restart"
        # Extra sleep to ensure full readiness
        time.sleep(2)

        # Old token must now be rejected with 401 + "Session expired" message
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth_headers(token), timeout=10)
        assert r.status_code == 401, f"Old token should be rejected, got {r.status_code} {r.text}"
        detail = r.json().get("detail", "")
        assert "Session expired" in detail or "log in again" in detail, (
            f"Expected session-expired message, got: {detail}"
        )

        # Fresh login should work again
        new_token = _login()
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth_headers(new_token), timeout=10)
        assert r.status_code == 200, "Fresh login token should work"


# ---------- Section 2: Data Export ----------

class TestDataExport:
    def test_export_structure_and_meta(self):
        token = _login()
        r = requests.get(f"{BASE_URL}/api/data/export", headers=_auth_headers(token), timeout=30)
        assert r.status_code == 200, f"Export failed: {r.status_code} {r.text}"
        data = r.json()

        # _meta keys
        assert "_meta" in data, "Missing _meta"
        meta = data["_meta"]
        assert "exported_at" in meta
        assert meta.get("version") == 2, f"Expected version 2, got {meta.get('version')}"

        # All required collection keys present
        required = ["users", "settings", "categories", "menu_items", "vendors", "orders",
                    "z_reports", "expenses", "vendor_transactions", "vendor_payments", "refunds"]
        for k in required:
            assert k in data, f"Missing collection key: {k}"
            assert isinstance(data[k], list), f"{k} should be a list"

    def test_export_includes_users_with_password_hash(self):
        token = _login()
        r = requests.get(f"{BASE_URL}/api/data/export", headers=_auth_headers(token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        users = data.get("users", [])
        assert len(users) >= 1, "Expected at least admin user in export"
        admin = next((u for u in users if u.get("email") == ADMIN_EMAIL), None)
        assert admin is not None, "Admin user missing from export"
        assert "password_hash" in admin, "password_hash should be preserved in export"
        assert admin["password_hash"].startswith("$2"), "password_hash should be a bcrypt hash"

    def test_export_admin_only(self):
        # Without auth → 401/403
        r = requests.get(f"{BASE_URL}/api/data/export", timeout=10)
        assert r.status_code in (401, 403), f"Unauth access should fail, got {r.status_code}"


# ---------- Section 3: Data Import (replace + ObjectId preservation) ----------

class TestDataImport:
    def test_import_replace_preserves_ids(self):
        token = _login()
        h = _auth_headers(token)

        # (a) Snapshot current categories+menu_items (full export)
        exp = requests.get(f"{BASE_URL}/api/data/export", headers=h, timeout=30)
        assert exp.status_code == 200
        snapshot = exp.json()
        original_cats = snapshot.get("categories", [])
        original_items = snapshot.get("menu_items", [])
        original_cat_ids = {c["_id"] for c in original_cats}
        original_item_ids = {i["_id"] for i in original_items}

        # (b) Create a NEW test category + menu item linked to it
        cat_resp = requests.post(
            f"{BASE_URL}/api/categories",
            json={"name": "TEST_iter9_cat", "color": "#abcdef"},
            headers=h, timeout=10,
        )
        assert cat_resp.status_code in (200, 201), f"Create category failed: {cat_resp.text}"
        new_cat = cat_resp.json()
        new_cat_id = new_cat.get("id") or new_cat.get("_id")
        assert new_cat_id, f"No id returned for new cat: {new_cat}"

        item_resp = requests.post(
            f"{BASE_URL}/api/menu-items",
            json={"name": "TEST_iter9_item", "price": 9.99, "category_id": new_cat_id, "stock": 10},
            headers=h, timeout=10,
        )
        assert item_resp.status_code in (200, 201), f"Create menu item failed: {item_resp.text}"
        new_item = item_resp.json()
        new_item_id = new_item.get("id") or new_item.get("_id")
        assert new_item_id

        # Sanity: new items now exist
        cats_now = requests.get(f"{BASE_URL}/api/categories", headers=h, timeout=10).json()
        assert any(c.get("id") == new_cat_id or c.get("_id") == new_cat_id for c in cats_now), \
            "New category not visible before import"

        # (c) Re-import the saved snapshot (replace mode)
        imp = requests.post(
            f"{BASE_URL}/api/data/import",
            json=snapshot, headers=h, timeout=60,
        )
        assert imp.status_code == 200, f"Import failed: {imp.status_code} {imp.text}"
        imp_body = imp.json()
        assert "imported" in imp_body
        # categories & menu_items counts should match originals
        assert imp_body["imported"].get("categories") == len(original_cats)
        assert imp_body["imported"].get("menu_items") == len(original_items)

        # (d) Verify new test items GONE & original ids preserved
        cats_after = requests.get(f"{BASE_URL}/api/categories", headers=h, timeout=10).json()
        ids_after_cats = {c.get("id") or c.get("_id") for c in cats_after}
        assert new_cat_id not in ids_after_cats, "Test category should be wiped after import"
        # Original cat ids are subset of post-import cat ids
        missing = original_cat_ids - ids_after_cats
        assert not missing, f"Original category ids not preserved after import: missing={missing}"

        items_after = requests.get(f"{BASE_URL}/api/menu-items", headers=h, timeout=10).json()
        ids_after_items = {i.get("id") or i.get("_id") for i in items_after}
        assert new_item_id not in ids_after_items, "Test menu item should be wiped after import"
        missing_items = original_item_ids - ids_after_items
        assert not missing_items, f"Original menu_item ids not preserved: missing={missing_items}"

        # Verify referential integrity: each menu_item.category_id resolves to a real category
        for it in items_after:
            cid = it.get("category_id")
            if cid:
                assert cid in ids_after_cats, f"Dangling category_id={cid} on item {it.get('id')}"

    def test_import_invalid_object_id_dropped_gracefully(self):
        token = _login()
        h = _auth_headers(token)

        # Snapshot first so we can restore
        exp = requests.get(f"{BASE_URL}/api/data/export", headers=h, timeout=30)
        assert exp.status_code == 200
        snapshot = exp.json()

        # Build a tiny payload importing only a "vendors" collection with an invalid _id
        bad_payload = {
            "vendors": [
                {"_id": "foo", "name": "TEST_iter9_bad_vendor", "phone": "0000"},
                {"_id": "not-an-objectid", "name": "TEST_iter9_bad_vendor2", "phone": "1111"},
            ]
        }
        r = requests.post(f"{BASE_URL}/api/data/import", json=bad_payload, headers=h, timeout=30)
        assert r.status_code == 200, f"Should not crash on bad _id: {r.status_code} {r.text}"
        body = r.json()
        # Both inserted, mongo auto-assigned ids
        assert body["imported"].get("vendors") == 2, f"Got {body}"

        # Restore vendors to original snapshot value to keep db sane
        restore = {"vendors": snapshot.get("vendors", [])}
        rr = requests.post(f"{BASE_URL}/api/data/import", json=restore, headers=h, timeout=30)
        assert rr.status_code == 200


# ---------- Section 4: Regression smoke ----------

class TestRegressionSmoke:
    def test_login_still_works(self):
        token = _login()
        assert isinstance(token, str) and len(token) > 20

    def test_settings_global_readable(self):
        token = _login()
        r = requests.get(f"{BASE_URL}/api/settings", headers=_auth_headers(token), timeout=10)
        assert r.status_code == 200, f"settings GET failed: {r.text}"
