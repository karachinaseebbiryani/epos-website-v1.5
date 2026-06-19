"""Iter5 tests: category/menu-item colors and email reports (SMTP, recipients, /email/test, /email/send-report)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-management-139.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@restaurant.com", "password": "admin123"}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def cashier_session(admin_session):
    """Create temp cashier user, login, return session. Cleanup at end."""
    email = "TEST_iter5_cashier@example.com"
    pw = "testpass123"
    # Cleanup any leftover
    users = admin_session.get(f"{BASE_URL}/api/users").json()
    for u in users:
        if u.get("email") == email:
            admin_session.delete(f"{BASE_URL}/api/users/{u['id']}")
    cr = admin_session.post(f"{BASE_URL}/api/users", json={"email": email, "password": pw, "name": "T5 Cashier", "role": "cashier"})
    assert cr.status_code == 200, cr.text
    uid = cr.json()["id"]
    cs = requests.Session()
    lr = cs.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert lr.status_code == 200
    yield cs
    admin_session.delete(f"{BASE_URL}/api/users/{uid}")


# --- Category color persistence ---
class TestCategoryColor:
    def test_create_category_with_color(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/categories", json={"name": "TEST_CatColor", "color": "#FF5733"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_CatColor"
        assert data["color"] == "#FF5733"
        assert "id" in data
        # GET verify persistence
        all_cats = admin_session.get(f"{BASE_URL}/api/categories").json()
        match = [c for c in all_cats if c["id"] == data["id"]]
        assert len(match) == 1
        assert match[0]["color"] == "#FF5733"
        # cleanup
        admin_session.delete(f"{BASE_URL}/api/categories/{data['id']}")

    def test_create_category_without_color(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/categories", json={"name": "TEST_NoColor"})
        assert r.status_code == 200
        data = r.json()
        assert data["color"] is None
        admin_session.delete(f"{BASE_URL}/api/categories/{data['id']}")

    def test_update_category_color(self, admin_session):
        cr = admin_session.post(f"{BASE_URL}/api/categories", json={"name": "TEST_UpdCat", "color": "#111111"})
        cid = cr.json()["id"]
        ur = admin_session.put(f"{BASE_URL}/api/categories/{cid}", json={"color": "#ABCDEF"})
        assert ur.status_code == 200
        assert ur.json()["color"] == "#ABCDEF"
        # GET to verify
        cats = admin_session.get(f"{BASE_URL}/api/categories").json()
        assert next(c for c in cats if c["id"] == cid)["color"] == "#ABCDEF"
        admin_session.delete(f"{BASE_URL}/api/categories/{cid}")


# --- Menu item color persistence ---
class TestMenuItemColor:
    @pytest.fixture
    def category_id(self, admin_session):
        cr = admin_session.post(f"{BASE_URL}/api/categories", json={"name": "TEST_ItemCat", "color": "#222222"})
        cid = cr.json()["id"]
        yield cid
        admin_session.delete(f"{BASE_URL}/api/categories/{cid}")

    def test_create_menu_item_with_color(self, admin_session, category_id):
        r = admin_session.post(f"{BASE_URL}/api/menu-items", json={"name": "TEST_ItemColor", "price": 9.99, "category_id": category_id, "color": "#00FF00"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["color"] == "#00FF00"
        # GET verify
        items = admin_session.get(f"{BASE_URL}/api/menu-items").json()
        assert next(i for i in items if i["id"] == data["id"])["color"] == "#00FF00"
        admin_session.delete(f"{BASE_URL}/api/menu-items/{data['id']}")

    def test_create_menu_item_without_color(self, admin_session, category_id):
        r = admin_session.post(f"{BASE_URL}/api/menu-items", json={"name": "TEST_NoItemColor", "price": 5.0, "category_id": category_id})
        assert r.status_code == 200
        assert r.json()["color"] is None
        admin_session.delete(f"{BASE_URL}/api/menu-items/{r.json()['id']}")

    def test_update_menu_item_color(self, admin_session, category_id):
        cr = admin_session.post(f"{BASE_URL}/api/menu-items", json={"name": "TEST_UpdItem", "price": 10.0, "category_id": category_id, "color": "#000000"})
        iid = cr.json()["id"]
        ur = admin_session.put(f"{BASE_URL}/api/menu-items/{iid}", json={"color": "#FEDCBA"})
        assert ur.status_code == 200
        assert ur.json()["color"] == "#FEDCBA"
        admin_session.delete(f"{BASE_URL}/api/menu-items/{iid}")


# --- Settings: SMTP + email_recipients ---
class TestEmailSettings:
    def test_settings_returns_email_fields(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        d = r.json()
        for f in ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from", "smtp_use_tls", "email_recipients", "auto_email_on_z_close"]:
            assert f in d, f"Missing field {f}"
        assert isinstance(d["email_recipients"], list)
        assert isinstance(d["smtp_use_tls"], bool)
        assert isinstance(d["auto_email_on_z_close"], bool)

    def test_update_email_recipients_persists(self, admin_session):
        # Save original
        original = admin_session.get(f"{BASE_URL}/api/settings").json()
        recipients = [
            {"name": "TEST_R1", "email": "test1@example.com", "receive_x": True, "receive_z": True},
            {"name": "TEST_R2", "email": "test2@example.com", "receive_x": False, "receive_z": True},
        ]
        ur = admin_session.put(f"{BASE_URL}/api/settings", json={"email_recipients": recipients, "auto_email_on_z_close": True})
        assert ur.status_code == 200
        # GET to verify persistence
        gd = admin_session.get(f"{BASE_URL}/api/settings").json()
        assert len(gd["email_recipients"]) == 2
        assert gd["email_recipients"][0]["email"] == "test1@example.com"
        assert gd["email_recipients"][1]["receive_x"] is False
        assert gd["auto_email_on_z_close"] is True
        # Restore
        admin_session.put(f"{BASE_URL}/api/settings", json={
            "email_recipients": original.get("email_recipients", []),
            "auto_email_on_z_close": original.get("auto_email_on_z_close", False),
        })


# --- /email/test endpoint ---
class TestEmailTestEndpoint:
    def test_email_test_unauthenticated(self):
        r = requests.post(f"{BASE_URL}/api/email/test", json={})
        assert r.status_code == 401

    def test_email_test_cashier_forbidden(self, cashier_session):
        r = cashier_session.post(f"{BASE_URL}/api/email/test", json={})
        assert r.status_code == 403

    def test_email_test_smtp_not_configured(self, admin_session):
        # Save original settings
        original = admin_session.get(f"{BASE_URL}/api/settings").json()
        # Clear SMTP
        admin_session.put(f"{BASE_URL}/api/settings", json={"smtp_host": "", "smtp_user": "", "smtp_password": ""})
        r = admin_session.post(f"{BASE_URL}/api/email/test", json={"to": "x@example.com"})
        assert r.status_code == 400
        assert "SMTP" in r.json().get("detail", "")
        # Restore
        admin_session.put(f"{BASE_URL}/api/settings", json={
            "smtp_host": original.get("smtp_host", ""),
            "smtp_user": original.get("smtp_user", ""),
            "smtp_password": original.get("smtp_password", ""),
        })


# --- /email/send-report endpoint ---
class TestEmailSendReport:
    def test_send_report_unauthenticated(self):
        r = requests.post(f"{BASE_URL}/api/email/send-report", json={"report_type": "X"})
        assert r.status_code == 401

    def test_send_report_cashier_forbidden(self, cashier_session):
        r = cashier_session.post(f"{BASE_URL}/api/email/send-report", json={"report_type": "X"})
        assert r.status_code == 403

    def test_send_report_smtp_not_configured(self, admin_session):
        original = admin_session.get(f"{BASE_URL}/api/settings").json()
        admin_session.put(f"{BASE_URL}/api/settings", json={"smtp_host": "", "smtp_user": "", "smtp_password": ""})
        r = admin_session.post(f"{BASE_URL}/api/email/send-report", json={"report_type": "X"})
        assert r.status_code == 400
        assert "SMTP" in r.json().get("detail", "")
        admin_session.put(f"{BASE_URL}/api/settings", json={
            "smtp_host": original.get("smtp_host", ""),
            "smtp_user": original.get("smtp_user", ""),
            "smtp_password": original.get("smtp_password", ""),
        })

    def test_send_report_no_recipients(self, admin_session):
        """When SMTP is configured but recipients list is empty, should return 400."""
        original = admin_session.get(f"{BASE_URL}/api/settings").json()
        # Configure SMTP with fake creds, empty recipients
        admin_session.put(f"{BASE_URL}/api/settings", json={
            "smtp_host": "smtp.example.com",
            "smtp_port": 587,
            "smtp_user": "x@example.com",
            "smtp_password": "fake",
            "smtp_from": "x@example.com",
            "email_recipients": [],
        })
        r = admin_session.post(f"{BASE_URL}/api/email/send-report", json={"report_type": "X"})
        assert r.status_code == 400
        assert "recipient" in r.json().get("detail", "").lower()
        # Restore
        admin_session.put(f"{BASE_URL}/api/settings", json={
            "smtp_host": original.get("smtp_host", ""),
            "smtp_port": original.get("smtp_port", 587),
            "smtp_user": original.get("smtp_user", ""),
            "smtp_password": original.get("smtp_password", ""),
            "smtp_from": original.get("smtp_from", ""),
            "email_recipients": original.get("email_recipients", []),
        })


# --- Z-close still works without auto-email ---
class TestZCloseAutoEmail:
    def test_z_close_succeeds_when_auto_email_off(self, admin_session):
        # Ensure auto email is off
        original = admin_session.get(f"{BASE_URL}/api/settings").json()
        admin_session.put(f"{BASE_URL}/api/settings", json={"auto_email_on_z_close": False})
        # Try to close z-report (may already be closed today: 400 acceptable)
        r = admin_session.post(f"{BASE_URL}/api/reports/z/close")
        assert r.status_code in (200, 400), f"Unexpected: {r.status_code} {r.text}"
        if r.status_code == 200:
            body = r.json()
            assert "report" in body
            assert "email_error" not in body  # since auto-email off
        # Restore
        admin_session.put(f"{BASE_URL}/api/settings", json={"auto_email_on_z_close": original.get("auto_email_on_z_close", False)})
