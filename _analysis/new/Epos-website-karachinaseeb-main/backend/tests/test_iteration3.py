"""Iteration 3 backend API tests:
- Payment screenshot upload (public, multipart, 5MB limit, MIME whitelist)
- Admin file serving (GET /api/files/{path})
- Public live tracking (GET /api/track/{id})
- Order create/update_status: WhatsApp invoked (fire-and-forget) without crashing
- online_settings.twilio_whatsapp_from field
"""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://project-handoff-12.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@karachinaseeb.com"
ADMIN_PASSWORD = "admin123"


class NoCookieSession(requests.Session):
    def send(self, request, **kwargs):
        resp = super().send(request, **kwargs)
        self.cookies.clear()
        return resp


@pytest.fixture(scope="module")
def http():
    s = NoCookieSession()
    return s


@pytest.fixture(scope="module")
def admin_token(http):
    r = http.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                  headers={"Content-Type": "application/json"})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def menu_item(http):
    r = http.get(f"{API}/menu")
    assert r.status_code == 200
    items = r.json()["items"]
    assert items
    return items[0]


@pytest.fixture(scope="module")
def order_id(http, menu_item):
    payload = {
        "items": [{"item_id": menu_item["id"], "name": menu_item["name"], "price": menu_item["price"], "quantity": 1}],
        "total_price": menu_item["price"],
        "customer_name": "TEST_Iter3",
        "phone": "03001234567",
        "address": "Test address",
        "payment_method": "bank_transfer",
    }
    r = http.post(f"{API}/online-orders", json=payload, headers={"Content-Type": "application/json"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ---------- 1x1 PNG bytes ----------
PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01"
    b"\xa6\xa6\x9b\xc7\x00\x00\x00\x00IEND\xaeB`\x82"
)


# ============== Payment screenshot upload (public) ==============
class TestPaymentScreenshotUpload:
    def test_upload_png_success(self, http, order_id):
        files = {"file": ("test.png", io.BytesIO(PNG_1X1), "image/png")}
        r = http.post(f"{API}/online-orders/{order_id}/payment-screenshot", files=files)
        if r.status_code == 503:
            pytest.skip("Object storage unavailable")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d.get("path"), "path missing"
        TestPaymentScreenshotUpload._uploaded_path = d["path"]
        # Verify order doc updated
        # Use admin endpoint to inspect
        # (verified separately after admin login)

    def test_order_now_has_screenshot_path(self, http, admin_headers, order_id):
        r = http.get(f"{API}/online-orders", headers=admin_headers)
        assert r.status_code == 200
        match = next((o for o in r.json() if o["id"] == order_id), None)
        assert match is not None
        assert match.get("payment_screenshot_path"), "payment_screenshot_path not persisted on order"

    def test_reject_unsupported_mime(self, http, order_id):
        files = {"file": ("evil.exe", io.BytesIO(b"MZ\x90\x00" + b"\x00" * 100), "application/octet-stream")}
        r = http.post(f"{API}/online-orders/{order_id}/payment-screenshot", files=files)
        assert r.status_code == 400, r.text

    def test_reject_too_large(self, http, order_id):
        big = b"\x89PNG\r\n\x1a\n" + b"A" * (5 * 1024 * 1024 + 100)  # > 5MB
        files = {"file": ("big.png", io.BytesIO(big), "image/png")}
        r = http.post(f"{API}/online-orders/{order_id}/payment-screenshot", files=files)
        assert r.status_code == 413, r.text

    def test_invalid_order_id_404(self, http):
        files = {"file": ("test.png", io.BytesIO(PNG_1X1), "image/png")}
        r = http.post(f"{API}/online-orders/000000000000000000000000/payment-screenshot", files=files)
        assert r.status_code == 404

    def test_no_auth_required(self, http, order_id):
        # Same as test_upload_png_success but explicit: NO Authorization header sent
        files = {"file": ("test2.png", io.BytesIO(PNG_1X1), "image/png")}
        r = http.post(f"{API}/online-orders/{order_id}/payment-screenshot", files=files)
        # If 503 storage skip; otherwise must be 200 (no auth needed)
        if r.status_code == 503:
            pytest.skip("Object storage unavailable")
        assert r.status_code == 200, r.text


# ============== /api/files/{path} admin only ==============
class TestServeFile:
    def test_unauth_forbidden(self, http):
        r = http.get(f"{API}/files/some/fake/path.png")
        assert r.status_code in (401, 403), r.text

    def test_non_admin_forbidden(self, http):
        # Use a bogus bearer token -> get_current_user should reject -> 401
        r = http.get(f"{API}/files/some/fake/path.png", headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code in (401, 403)

    def test_admin_get_uploaded_file(self, http, admin_headers, order_id):
        # Read order to get path
        r0 = http.get(f"{API}/online-orders", headers=admin_headers)
        match = next((o for o in r0.json() if o["id"] == order_id), None)
        if not match or not match.get("payment_screenshot_path"):
            pytest.skip("No screenshot path available")
        path = match["payment_screenshot_path"]
        r = http.get(f"{API}/files/{path}", headers=admin_headers)
        if r.status_code == 503:
            pytest.skip("Object storage unavailable")
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("image/"), r.headers
        assert len(r.content) > 0

    def test_admin_get_missing_file_404(self, http, admin_headers):
        r = http.get(f"{API}/files/karachi-naseeb/payments/nonexistent/missing.png", headers=admin_headers)
        assert r.status_code == 404


# ============== Public /api/track/{id} ==============
class TestPublicTracking:
    def test_track_returns_order(self, http, order_id):
        r = http.get(f"{API}/track/{order_id}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == order_id
        for k in ("status", "items", "total_price", "customer_name", "phone", "address", "created_at", "receipt_no"):
            assert k in d
        assert isinstance(d["items"], list)
        assert d["customer_name"] == "TEST_Iter3"

    def test_track_no_auth_needed(self, http, order_id):
        r = http.get(f"{API}/track/{order_id}")  # no auth header
        assert r.status_code == 200

    def test_track_invalid_id_404(self, http):
        r = http.get(f"{API}/track/notavalidobjectid")
        assert r.status_code == 404

    def test_track_missing_id_404(self, http):
        r = http.get(f"{API}/track/000000000000000000000000")
        assert r.status_code == 404

    def test_track_no_id_field_leaks(self, http, order_id):
        r = http.get(f"{API}/track/{order_id}")
        assert "_id" not in r.json()


# ============== Order create + update status do not crash ==============
class TestOrderCreateAndStatusWhatsApp:
    def test_create_order_succeeds_even_if_whatsapp_fails(self, http, menu_item):
        """Twilio sandbox may reject the recipient; order creation must still succeed."""
        payload = {
            "items": [{"item_id": menu_item["id"], "name": menu_item["name"], "price": menu_item["price"], "quantity": 1}],
            "total_price": menu_item["price"],
            "customer_name": "TEST_WhatsApp",
            "phone": "03009999999",  # not a sandbox-joined number
            "address": "Test",
            "payment_method": "cod",
        }
        r = http.post(f"{API}/online-orders", json=payload, headers={"Content-Type": "application/json"})
        assert r.status_code == 200, r.text
        TestOrderCreateAndStatusWhatsApp._oid = r.json()["id"]

    def test_status_update_succeeds(self, http, admin_headers):
        oid = getattr(TestOrderCreateAndStatusWhatsApp, "_oid", None)
        if not oid:
            pytest.skip("No order id")
        r = http.put(f"{API}/online-orders/{oid}/status", json={"status": "preparing"},
                     headers={**admin_headers, "Content-Type": "application/json"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "preparing"
        # Verify status reflected on /track
        time.sleep(0.5)
        t = http.get(f"{API}/track/{oid}")
        assert t.status_code == 200
        assert t.json()["status"] == "preparing"

    def test_status_update_to_delivered(self, http, admin_headers):
        oid = getattr(TestOrderCreateAndStatusWhatsApp, "_oid", None)
        if not oid:
            pytest.skip()
        r = http.put(f"{API}/online-orders/{oid}/status", json={"status": "delivered"},
                     headers={**admin_headers, "Content-Type": "application/json"})
        assert r.status_code == 200, r.text


# ============== twilio_whatsapp_from in online_settings ==============
class TestTwilioSetting:
    def test_admin_settings_includes_twilio_from(self, http, admin_headers):
        r = http.get(f"{API}/admin/online-settings", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert "twilio_whatsapp_from" in d, "twilio_whatsapp_from missing from online-settings"

    def test_admin_can_update_twilio_from(self, http, admin_headers):
        # Get current
        r0 = http.get(f"{API}/admin/online-settings", headers=admin_headers)
        original = r0.json().get("twilio_whatsapp_from")
        new_val = "whatsapp:+14155238887" if original != "whatsapp:+14155238887" else "whatsapp:+14155238886"
        r = http.put(f"{API}/admin/online-settings", json={"twilio_whatsapp_from": new_val},
                     headers={**admin_headers, "Content-Type": "application/json"})
        assert r.status_code == 200, r.text
        assert r.json()["twilio_whatsapp_from"] == new_val
        # Restore
        if original is not None:
            http.put(f"{API}/admin/online-settings", json={"twilio_whatsapp_from": original},
                     headers={**admin_headers, "Content-Type": "application/json"})
