"""
Iter8 tests: backend serving built frontend (static SPA) + /api routing priority.
These tests hit localhost:8001 directly (the backend) since the static-serve
behavior is per-backend-process. The public Emergent ingress separately routes
/ -> dev frontend on 3000, so direct backend tests are the right target here.
"""
import pytest
import requests
import json
import pathlib

BASE = "http://localhost:8001"
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# --- Static serving / SPA fallback ---

def test_root_returns_index_html(s):
    r = s.get(f"{BASE}/")
    assert r.status_code == 200, r.text[:200]
    assert "text/html" in r.headers.get("content-type", "")
    body = r.text
    assert "<title>" in body.lower()
    assert "/static/js/main" in body, "index.html should reference built main.js"


def test_static_js_served(s):
    manifest = json.loads((pathlib.Path("/app/frontend/build/asset-manifest.json")).read_text())
    main_js = manifest["files"]["main.js"]  # e.g. /static/js/main.<hash>.js
    r = s.get(f"{BASE}{main_js}")
    assert r.status_code == 200
    ct = r.headers.get("content-type", "")
    assert "javascript" in ct, f"unexpected content-type: {ct}"
    assert len(r.content) > 1000


def test_static_css_served(s):
    manifest = json.loads((pathlib.Path("/app/frontend/build/asset-manifest.json")).read_text())
    main_css = manifest["files"]["main.css"]
    r = s.get(f"{BASE}{main_css}")
    assert r.status_code == 200
    assert "css" in r.headers.get("content-type", "")


def test_spa_fallback_dashboard(s):
    """Unknown frontend route should return index.html (not JSON 404)."""
    r = s.get(f"{BASE}/dashboard")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")
    assert "<title>" in r.text.lower()


def test_spa_fallback_arbitrary_route(s):
    r = s.get(f"{BASE}/some/deep/route")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")


# --- API priority over SPA fallback ---

def test_api_get_login_not_swallowed_by_spa(s):
    """GET on a POST-only /api route must return JSON 4xx (NOT index.html).
    The SPA fallback explicitly returns JSON 404 for any unmatched /api/* path.
    """
    r = s.get(f"{BASE}/api/auth/login")
    assert r.status_code in (404, 405)
    assert "json" in r.headers.get("content-type", "")
    assert "<html" not in r.text.lower()


def test_api_nonexistent_returns_json_404(s):
    r = s.get(f"{BASE}/api/nonexistent")
    assert r.status_code == 404
    # Body must be JSON, NOT index.html
    ct = r.headers.get("content-type", "")
    assert "json" in ct, f"Expected JSON 404, got content-type {ct}, body: {r.text[:200]}"
    body = r.json()
    assert "detail" in body or "error" in body or "message" in body


# --- Auth flow on direct backend ---

def test_login_valid_returns_token(s):
    r = s.post(f"{BASE}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    # Some implementations return {token: ...} OR {access_token: ...} OR set httpOnly cookie
    has_token_in_body = any(k in body for k in ("token", "access_token", "accessToken"))
    has_cookie = any("token" in c.name.lower() or "session" in c.name.lower() for c in s.cookies)
    assert has_token_in_body or has_cookie, f"No token or auth cookie in response: {body}"


def test_login_invalid_returns_401(s):
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": "wrongpass-xyz"})
    assert r.status_code in (401, 403), f"expected 401, got {r.status_code}: {r.text[:200]}"
