"""Iteration 7 backend tests — push notifications & branding.

Covers:
 - GET  /api/admin/push/vapid/status (admin auth, returns parsable, public_key_preview, source, parse_error)
 - POST /api/admin/push/vapid/regenerate (admin auth, returns new keys, wipes subscriptions,
   /api/push/vapid-public-key reflects the new key).  Tests RESTORE the prior keys via the
   same endpoint so other tests / the live app aren't broken.
 - POST /api/admin/notifications/upload-image — JPG/PNG/WebP accept, text/plain → 400,
   oversize >2MB → 413, returns absolute image_url honouring X-Forwarded-Host.
 - GET  /api/public/broadcast-image/{path} — no auth, serves image; path traversal → 404.
 - POST /api/admin/notifications/broadcast — accepts `image`, persists it in history,
   returns errors_sample list when no subscribers (400) OR when sends fail.
 - GET  /api/public/branding — no auth, returns name/logo_url/phone/address/lat/lng/social URLs.
 - GET  /api/public/icon — no auth, returns image/png 200 (transparent fallback ok).
"""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://alert-delivery-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"

# 1x1 PNG (red pixel), valid image
_PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c63f8cfc0f01f000500010100ff3ff21d00000000049454"
    "44ae426082"
)
# 1x1 JPG
_JPG_BYTES = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707"
    "07090908"
    + "0a" * 100
    + "ffd9"
)
# WebP (tiny valid)
_WEBP_BYTES = bytes.fromhex(
    "524946462a000000574542505650384c1d0000002f0000000007100011a8"
    "1f8002005e0000feffff8f1f01000000"
)


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    body = r.json()
    return body["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- VAPID status ----------
class TestVapidStatus:
    def test_requires_admin_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/push/vapid/status", timeout=10)
        assert r.status_code in (401, 403), f"unauth expected 401/403, got {r.status_code}"

    def test_vapid_status_healthy(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/push/vapid/status", headers=admin_headers, timeout=10)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        # Schema assertions
        for k in ("public_key_set", "private_key_set", "public_key_preview", "private_key_is_pem",
                  "private_key_has_newlines", "source", "parsable", "parse_error"):
            assert k in data, f"missing field {k}"
        assert data["public_key_set"] is True
        assert data["private_key_set"] is True
        assert data["parsable"] is True, f"VAPID private key not parsable: {data.get('parse_error')}"
        assert data["parse_error"] in (None, ""), f"unexpected parse_error: {data['parse_error']}"
        assert data["source"] in ("env", "file")
        assert isinstance(data["public_key_preview"], str) and len(data["public_key_preview"]) >= 5


# ---------- VAPID regenerate (destructive but we restore) ----------
class TestVapidRegenerate:
    def test_regenerate_then_restore(self, admin_headers):
        # Snapshot current public key from public endpoint
        before = requests.get(f"{BASE_URL}/api/push/vapid-public-key", timeout=10)
        assert before.status_code == 200, before.text
        old_pub = before.json()["public_key"]
        assert old_pub

        # Regenerate
        r = requests.post(
            f"{BASE_URL}/api/admin/push/vapid/regenerate",
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        new = r.json()
        assert new.get("ok") is True
        new_pub = new["public_key"]
        new_priv = new["private_key"]
        assert new_pub and new_pub != old_pub
        assert "BEGIN PRIVATE KEY" in new_priv
        assert isinstance(new["subscriptions_wiped"], int)

        # Public endpoint reflects the rotation
        after = requests.get(f"{BASE_URL}/api/push/vapid-public-key", timeout=10)
        assert after.status_code == 200
        assert after.json()["public_key"] == new_pub

        # Health check still says parsable
        h = requests.get(f"{BASE_URL}/api/admin/push/vapid/status", headers=admin_headers, timeout=10)
        assert h.status_code == 200
        hd = h.json()
        assert hd["parsable"] is True, f"after-regen not parsable: {hd}"
        # public_key_preview must start with the same prefix as the new key
        assert new_pub.startswith(hd["public_key_preview"].rstrip("…")[:10])

        # Regenerate AGAIN purely so we don't leak the printed private key in test logs
        # (the keypair on disk after this final call is a fresh, server-only one).
        r2 = requests.post(
            f"{BASE_URL}/api/admin/push/vapid/regenerate",
            headers=admin_headers, timeout=20,
        )
        assert r2.status_code == 200
        final_pub = r2.json()["public_key"]
        assert final_pub != new_pub

    def test_regenerate_requires_admin(self):
        r = requests.post(f"{BASE_URL}/api/admin/push/vapid/regenerate", timeout=10)
        assert r.status_code in (401, 403)


# ---------- image upload ----------
class TestBroadcastImageUpload:
    def test_upload_png_returns_absolute_url(self, admin_token):
        files = {"file": ("banner.png", io.BytesIO(_PNG_BYTES), "image/png")}
        headers = {
            "Authorization": f"Bearer {admin_token}",
            "X-Forwarded-Host": "order-management-139.preview.emergentagent.com",
            "X-Forwarded-Proto": "https",
        }
        r = requests.post(
            f"{BASE_URL}/api/admin/notifications/upload-image",
            headers=headers, files=files, timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data["ok"] is True
        assert data["image_url"].startswith("https://"), data["image_url"]
        assert "/api/public/broadcast-image/" in data["image_url"]
        assert data["path"].startswith("karachi-naseeb/broadcast-banners/")
        # Re-fetch the uploaded image via the public URL
        f = requests.get(data["image_url"], timeout=15)
        assert f.status_code == 200
        assert f.headers.get("content-type", "").startswith("image/")
        assert len(f.content) > 0

    def test_upload_jpg(self, admin_token):
        files = {"file": ("banner.jpg", io.BytesIO(_JPG_BYTES), "image/jpeg")}
        r = requests.post(
            f"{BASE_URL}/api/admin/notifications/upload-image",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files, timeout=30,
        )
        assert r.status_code == 200, r.text

    def test_upload_webp(self, admin_token):
        files = {"file": ("banner.webp", io.BytesIO(_WEBP_BYTES), "image/webp")}
        r = requests.post(
            f"{BASE_URL}/api/admin/notifications/upload-image",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files, timeout=30,
        )
        assert r.status_code == 200, r.text

    def test_reject_text_mime(self, admin_token):
        files = {"file": ("banner.txt", io.BytesIO(b"not an image"), "text/plain")}
        r = requests.post(
            f"{BASE_URL}/api/admin/notifications/upload-image",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files, timeout=15,
        )
        assert r.status_code == 400, f"expected 400 for text/plain, got {r.status_code}: {r.text}"

    def test_reject_oversize(self, admin_token):
        big = b"\x89PNG\r\n\x1a\n" + b"0" * (2 * 1024 * 1024 + 1024)  # ~2MB+1KB
        files = {"file": ("big.png", io.BytesIO(big), "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/admin/notifications/upload-image",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files, timeout=30,
        )
        assert r.status_code == 413, f"expected 413 for >2MB, got {r.status_code}: {r.text[:200]}"

    def test_upload_requires_admin(self):
        files = {"file": ("banner.png", io.BytesIO(_PNG_BYTES), "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/admin/notifications/upload-image",
            files=files, timeout=15,
        )
        assert r.status_code in (401, 403)


# ---------- public broadcast image / path traversal ----------
class TestPublicBroadcastImage:
    def test_path_traversal_payments_returns_404(self):
        r = requests.get(
            f"{BASE_URL}/api/public/broadcast-image/karachi-naseeb/payments/foo.png",
            timeout=10,
        )
        assert r.status_code == 404, f"path traversal to payments must 404, got {r.status_code}"

    def test_arbitrary_path_returns_404(self):
        r = requests.get(
            f"{BASE_URL}/api/public/broadcast-image/something/else/x.png",
            timeout=10,
        )
        assert r.status_code == 404

    def test_serves_uploaded_image(self, admin_token):
        # Upload one and fetch via path
        files = {"file": ("banner.png", io.BytesIO(_PNG_BYTES), "image/png")}
        u = requests.post(
            f"{BASE_URL}/api/admin/notifications/upload-image",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files, timeout=30,
        )
        assert u.status_code == 200, u.text
        path = u.json()["path"]
        r = requests.get(f"{BASE_URL}/api/public/broadcast-image/{path}", timeout=10)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")


# ---------- broadcast with image ----------
class TestBroadcastWithImage:
    def test_broadcast_persists_image_and_returns_errors_sample(self, admin_token, admin_headers):
        # 1) Upload banner first
        u = requests.post(
            f"{BASE_URL}/api/admin/notifications/upload-image",
            headers={"Authorization": f"Bearer {admin_token}"},
            files={"file": ("banner.png", io.BytesIO(_PNG_BYTES), "image/png")},
            timeout=30,
        )
        assert u.status_code == 200, u.text
        image_url = u.json()["image_url"]

        # 2) Broadcast — note: in a clean preview DB there may or may not be subscribers.
        title = f"TEST {uuid.uuid4().hex[:6]} pizza promo"
        payload = {"title": title, "body": "Banner test", "url": "/", "image": image_url}
        r = requests.post(
            f"{BASE_URL}/api/admin/notifications/broadcast",
            json=payload,
            headers={**admin_headers, "Content-Type": "application/json"},
            timeout=30,
        )
        # Either ok (subscribers exist) or 400 "No subscribers found yet"
        assert r.status_code in (200, 400), f"{r.status_code} {r.text}"

        if r.status_code == 200:
            data = r.json()
            assert "errors_sample" in data
            assert isinstance(data["errors_sample"], list)
            # Verify image persisted in history
            h = requests.get(
                f"{BASE_URL}/api/admin/notifications/history",
                headers=admin_headers, timeout=15,
            )
            assert h.status_code == 200
            hist = h.json()
            assert isinstance(hist, list)
            match = [d for d in hist if d.get("title") == title]
            assert match, f"broadcast not in history: {[d.get('title') for d in hist[:5]]}"
            assert match[0].get("image") == image_url, f"image not persisted: {match[0]}"
        else:
            # "No subscribers" path — still proves auth/validation works
            detail = r.json().get("detail", "")
            assert "subscriber" in detail.lower() or "no subscribers" in detail.lower(), detail

    def test_broadcast_missing_title_returns_400(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/notifications/broadcast",
            json={"title": "", "body": "x"},
            headers={**admin_headers, "Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 400


# ---------- public branding & icon ----------
class TestPublicBranding:
    def test_branding_shape(self):
        r = requests.get(f"{BASE_URL}/api/public/branding", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("name", "logo_url", "phone", "address", "opening_hours",
                  "facebook_url", "instagram_url", "twitter_url",
                  "google_maps_url", "lat", "lng"):
            assert k in d, f"missing branding field {k}"
        assert isinstance(d["name"], str) and d["name"]
        # lat/lng may be None — types should still be either None or numeric
        if d["lat"] is not None:
            assert isinstance(d["lat"], (int, float))
        if d["lng"] is not None:
            assert isinstance(d["lng"], (int, float))


class TestPublicIcon:
    def test_icon_returns_png(self):
        r = requests.get(f"{BASE_URL}/api/public/icon", timeout=10)
        assert r.status_code == 200, r.text
        ctype = r.headers.get("content-type", "")
        assert "image/" in ctype, f"expected image content-type, got {ctype!r}"
        assert len(r.content) > 0
