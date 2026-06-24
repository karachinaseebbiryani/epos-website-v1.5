"""Iter4: Tests for user management CRUD + configurable tax rate settings."""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://alert-delivery-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


@pytest.fixture(scope="module")
def cashier_creds(admin_session):
    """Create a cashier user used by tests, return creds + id. Cleanup at end."""
    email = f"TEST_cashier_{uuid.uuid4().hex[:8]}@restaurant.com"
    pwd = "cashpass123"
    r = admin_session.post(f"{BASE_URL}/api/users", json={
        "email": email, "password": pwd, "name": "TEST Cashier", "role": "cashier"
    })
    assert r.status_code == 200, f"Create cashier failed: {r.text}"
    uid = r.json()["id"]
    yield {"email": email, "password": pwd, "id": uid}
    admin_session.delete(f"{BASE_URL}/api/users/{uid}")


# ---------------- User CRUD ----------------
class TestUserCRUD:
    def test_list_users_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/users")
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        assert any(u["email"] == ADMIN_EMAIL for u in users)
        # Must NOT leak password_hash
        for u in users:
            assert "password_hash" not in u
            assert "id" in u and "email" in u and "role" in u

    def test_create_user_and_persist(self, admin_session):
        email = f"TEST_create_{uuid.uuid4().hex[:8]}@restaurant.com".lower()
        r = admin_session.post(f"{BASE_URL}/api/users", json={
            "email": email, "password": "pwd12345", "name": "TEST Create", "role": "cashier"
        })
        assert r.status_code == 200
        uid = r.json()["id"]
        assert r.json()["role"] == "cashier"
        # GET to verify persistence
        r2 = admin_session.get(f"{BASE_URL}/api/users")
        assert any(u["id"] == uid and u["email"] == email for u in r2.json())
        admin_session.delete(f"{BASE_URL}/api/users/{uid}")

    def test_create_duplicate_email_rejected(self, admin_session, cashier_creds):
        r = admin_session.post(f"{BASE_URL}/api/users", json={
            "email": cashier_creds["email"], "password": "x", "name": "dup", "role": "cashier"
        })
        assert r.status_code == 400

    def test_update_user_role_and_persist(self, admin_session, cashier_creds):
        # cashier -> admin
        r = admin_session.put(f"{BASE_URL}/api/users/{cashier_creds['id']}", json={"role": "admin"})
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
        # verify via list
        users = admin_session.get(f"{BASE_URL}/api/users").json()
        assert next(u for u in users if u["id"] == cashier_creds["id"])["role"] == "admin"
        # Revert
        r2 = admin_session.put(f"{BASE_URL}/api/users/{cashier_creds['id']}", json={"role": "cashier"})
        assert r2.json()["role"] == "cashier"

    def test_update_user_password_login_works(self, admin_session, cashier_creds):
        new_pwd = "newpwd9876"
        r = admin_session.put(f"{BASE_URL}/api/users/{cashier_creds['id']}", json={"password": new_pwd})
        assert r.status_code == 200
        # Login with new password
        s = requests.Session()
        login = s.post(f"{BASE_URL}/api/auth/login", json={"email": cashier_creds["email"], "password": new_pwd})
        assert login.status_code == 200
        # Login with old password should fail
        bad = s.post(f"{BASE_URL}/api/auth/login", json={"email": cashier_creds["email"], "password": cashier_creds["password"]})
        assert bad.status_code == 401
        # Restore
        admin_session.put(f"{BASE_URL}/api/users/{cashier_creds['id']}", json={"password": cashier_creds["password"]})

    def test_delete_self_blocked(self, admin_session):
        me = admin_session.get(f"{BASE_URL}/api/auth/me").json()
        r = admin_session.delete(f"{BASE_URL}/api/users/{me['id']}")
        assert r.status_code == 400

    def test_delete_user_removes_persistently(self, admin_session):
        email = f"TEST_del_{uuid.uuid4().hex[:8]}@restaurant.com"
        c = admin_session.post(f"{BASE_URL}/api/users", json={
            "email": email, "password": "x12345", "name": "TEST Del", "role": "cashier"
        })
        uid = c.json()["id"]
        d = admin_session.delete(f"{BASE_URL}/api/users/{uid}")
        assert d.status_code == 200
        users = admin_session.get(f"{BASE_URL}/api/users").json()
        assert not any(u["id"] == uid for u in users)


# ---------------- Authorization ----------------
class TestUserAuthz:
    def test_cashier_cannot_list_users(self, cashier_creds):
        s = requests.Session()
        login = s.post(f"{BASE_URL}/api/auth/login", json={"email": cashier_creds["email"], "password": cashier_creds["password"]})
        token = login.json()["token"]
        s.headers.update({"Authorization": f"Bearer {token}"})
        r = s.get(f"{BASE_URL}/api/users")
        assert r.status_code == 403

    def test_cashier_cannot_create_user(self, cashier_creds):
        s = requests.Session()
        login = s.post(f"{BASE_URL}/api/auth/login", json={"email": cashier_creds["email"], "password": cashier_creds["password"]})
        s.headers.update({"Authorization": f"Bearer {login.json()['token']}"})
        r = s.post(f"{BASE_URL}/api/users", json={"email": "x@y.com", "password": "p", "name": "n", "role": "cashier"})
        assert r.status_code == 403

    def test_unauthenticated_users_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/users")
        assert r.status_code == 401


# ---------------- Settings (tax_rate) ----------------
class TestSettings:
    def test_get_settings_returns_tax_rate(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        data = r.json()
        assert "tax_rate" in data
        assert isinstance(data["tax_rate"], (int, float))

    def test_update_tax_rate_admin_persists(self, admin_session):
        # Save current to restore
        original = admin_session.get(f"{BASE_URL}/api/settings").json()["tax_rate"]
        try:
            r = admin_session.put(f"{BASE_URL}/api/settings", json={"tax_rate": 10.0})
            assert r.status_code == 200
            assert r.json()["tax_rate"] == 10.0
            # GET to verify persistence
            r2 = admin_session.get(f"{BASE_URL}/api/settings")
            assert r2.json()["tax_rate"] == 10.0
            # Update again to a different value
            r3 = admin_session.put(f"{BASE_URL}/api/settings", json={"tax_rate": 7.5})
            assert r3.json()["tax_rate"] == 7.5
        finally:
            admin_session.put(f"{BASE_URL}/api/settings", json={"tax_rate": original})

    def test_cashier_can_get_settings_but_not_update(self, cashier_creds):
        s = requests.Session()
        login = s.post(f"{BASE_URL}/api/auth/login", json={"email": cashier_creds["email"], "password": cashier_creds["password"]})
        s.headers.update({"Authorization": f"Bearer {login.json()['token']}"})
        # Cashier should be able to GET (POS reads tax_rate)
        g = s.get(f"{BASE_URL}/api/settings")
        assert g.status_code == 200
        # Cashier should NOT be able to update
        u = s.put(f"{BASE_URL}/api/settings", json={"tax_rate": 50})
        assert u.status_code == 403

    def test_unauthenticated_settings_blocked(self):
        r = requests.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 401
