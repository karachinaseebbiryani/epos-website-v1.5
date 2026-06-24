"""Iteration 8 — backend sanity for stale-subscription recovery flow.

Verifies push-related endpoints used by the rewritten frontend push.js are still
healthy and non-regressed. The frontend forceRefreshes /push/vapid-public-key and
posts to /push/subscribe + /push/unsubscribe on stale detection.
"""
import os
import time
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-management-139.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def customer_token():
    """Register a throw-away customer for the subscribe/unsubscribe flow."""
    suffix = str(int(time.time()))
    email = f"TEST_iter8_{suffix}@example.com"
    payload = {"email": email, "password": "testpass123", "name": "Iter8 Tester", "phone": "+923000000000"}
    r = requests.post(f"{BASE_URL}/api/customer/register", json=payload, timeout=15)
    if r.status_code not in (200, 201):
        # fallback to /api/auth/register
        r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
    if r.status_code not in (200, 201):
        pytest.skip(f"customer register failed: {r.status_code} {r.text[:300]}")
    j = r.json()
    tok = j.get("access_token") or j.get("token")
    if not tok:
        # Try logging in
        lr = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "testpass123"}, timeout=15)
        if lr.status_code == 200:
            tok = lr.json().get("access_token") or lr.json().get("token")
    if not tok:
        pytest.skip("no customer token obtained")
    return tok


# Public VAPID key endpoint (consumed by push.js forceRefresh)
class TestVapidPublic:
    def test_public_key_returns_value(self):
        r = requests.get(f"{BASE_URL}/api/push/vapid-public-key", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "public_key" in data
        pk = data["public_key"]
        assert isinstance(pk, str) and len(pk) > 40, f"public_key looks invalid: {pk!r}"
        # URL-safe b64 sanity (no +/= chars typical of std b64)
        assert all(c.isalnum() or c in "-_=" for c in pk)


# Admin VAPID health (iteration 7 endpoint must still be healthy)
class TestVapidAdminHealth:
    def test_status_healthy(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/push/vapid/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("parsable") is True
        assert data.get("parse_error") in (None, "")
        assert "public_key_preview" in data

    def test_status_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/push/vapid/status", timeout=10)
        assert r.status_code in (401, 403)


# Subscribe + unsubscribe — accept fake endpoint so we don't touch real FCM/Mozilla
class TestSubscribeUnsubscribe:
    FAKE_ENDPOINT = "https://fcm.googleapis.com/fcm/send/TEST_iter8_stale_recovery_001"

    def _fake_keys(self):
        # 65-byte uncompressed P-256 point (placeholder) + 16-byte auth, URL-safe b64
        p256 = base64.urlsafe_b64encode(b"\x04" + b"\x01" * 64).rstrip(b"=").decode()
        auth = base64.urlsafe_b64encode(b"\x02" * 16).rstrip(b"=").decode()
        return {"p256dh": p256, "auth": auth}

    def test_subscribe_accepts_payload(self, customer_token):
        payload = {"endpoint": self.FAKE_ENDPOINT, "keys": self._fake_keys()}
        r = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json=payload,
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=15,
        )
        assert r.status_code in (200, 201), f"subscribe failed: {r.status_code} {r.text[:200]}"

    def test_subscribe_idempotent(self, customer_token):
        payload = {"endpoint": self.FAKE_ENDPOINT, "keys": self._fake_keys()}
        r = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json=payload,
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text

    def test_unsubscribe_accepts_endpoint(self, customer_token):
        r = requests.post(
            f"{BASE_URL}/api/push/unsubscribe",
            json={"endpoint": self.FAKE_ENDPOINT},
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=15,
        )
        assert r.status_code in (200, 204), r.text

    def test_unsubscribe_unknown_endpoint_safe(self, customer_token):
        r = requests.post(
            f"{BASE_URL}/api/push/unsubscribe",
            json={"endpoint": "https://fcm.googleapis.com/fcm/send/TEST_nonexistent_xyz"},
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=15,
        )
        assert r.status_code in (200, 204, 404), r.text

    def test_subscribe_requires_auth(self):
        # Confirm endpoint correctly gates anonymous calls — this matches the 401 the
        # frontend now expects when a user hasn't signed in yet.
        payload = {"endpoint": "https://fcm.googleapis.com/fcm/send/TEST_anon", "keys": self._fake_keys()}
        r = requests.post(f"{BASE_URL}/api/push/subscribe", json=payload, timeout=10)
        assert r.status_code in (401, 403)
