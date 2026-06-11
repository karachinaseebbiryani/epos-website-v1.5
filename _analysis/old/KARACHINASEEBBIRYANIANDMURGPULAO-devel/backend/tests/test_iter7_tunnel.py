"""Iter7 - Cloudflare Tunnel: status/refresh endpoints, watcher loop, settings persistence."""
import os
import time
import requests
import pytest

def _load_backend_url():
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if not val:
        env_path = "/app/frontend/.env"
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        val = line.split("=", 1)[1].strip()
                        break
    return val.rstrip("/")


BASE_URL = _load_backend_url()
LOG_PATH = "/app/cloudflared.log"
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    # Pre-cleanup
    if os.path.exists(LOG_PATH):
        os.remove(LOG_PATH)
    yield
    # Post-cleanup
    if os.path.exists(LOG_PATH):
        os.remove(LOG_PATH)


def _write_log(url):
    with open(LOG_PATH, "w") as f:
        f.write(f"2025-01-01 INFO some banner stuff\n")
        f.write(f"INF |  {url}                                                                                  |\n")
        f.write(f"INF +------------------------------------------------------------+\n")


# --- Test 1: status with no log file ---
def test_tunnel_status_no_log(admin_session):
    # Ensure no log
    if os.path.exists(LOG_PATH):
        os.remove(LOG_PATH)
    # Reset DB
    admin_session.post(f"{BASE_URL}/api/tunnel/refresh")  # noop
    r = admin_session.get(f"{BASE_URL}/api/tunnel/status")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "url" in data
    assert "updated_at" in data
    assert "log_path" in data
    assert "log_exists" in data
    assert "notify_on_change" in data
    assert data["log_exists"] is False
    assert isinstance(data["notify_on_change"], bool)


def test_tunnel_status_admin_only():
    s = requests.Session()
    r = s.get(f"{BASE_URL}/api/tunnel/status")
    # Unauthenticated should be 401
    assert r.status_code in (401, 403), f"Got {r.status_code}"


# --- Test 2: refresh detects URL ---
def test_tunnel_refresh_detects_url(admin_session):
    test_url = "https://abc-test-xyz.trycloudflare.com"
    _write_log(test_url)
    r = admin_session.post(f"{BASE_URL}/api/tunnel/refresh")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("url") == test_url, f"Got {data}"
    assert data.get("log_path", "").endswith("cloudflared.log")

    # Status should also reflect
    r2 = admin_session.get(f"{BASE_URL}/api/tunnel/status")
    assert r2.status_code == 200
    s = r2.json()
    assert s["url"] == test_url
    assert s["updated_at"] is not None
    assert s["log_exists"] is True


# --- Test 3: watcher loop picks new URL automatically ---
def test_tunnel_watcher_auto_update(admin_session):
    new_url = "https://newurl-watcher-pick.trycloudflare.com"
    _write_log(new_url)
    # Watcher polls every 15s; wait up to 30s
    detected = None
    for _ in range(20):
        time.sleep(2)
        r = admin_session.get(f"{BASE_URL}/api/tunnel/status")
        if r.status_code == 200 and r.json().get("url") == new_url:
            detected = r.json()
            break
    assert detected is not None, "Watcher loop did not auto-detect new URL within 40s"
    assert detected["url"] == new_url


# --- Test 4: settings persistence for tunnel_notify_on_change ---
def test_settings_tunnel_notify_persists(admin_session):
    # toggle off
    r = admin_session.put(f"{BASE_URL}/api/settings", json={"tunnel_notify_on_change": False})
    assert r.status_code == 200, r.text
    g = admin_session.get(f"{BASE_URL}/api/settings")
    assert g.status_code == 200
    assert g.json().get("tunnel_notify_on_change") is False
    # toggle back on
    r = admin_session.put(f"{BASE_URL}/api/settings", json={"tunnel_notify_on_change": True})
    assert r.status_code == 200
    g = admin_session.get(f"{BASE_URL}/api/settings")
    assert g.json().get("tunnel_notify_on_change") is True


# --- Test 5: notify-on-change does not crash when SMTP/WA not configured ---
def test_tunnel_notify_does_not_crash(admin_session):
    # Add an email recipient so notify path tries to send
    admin_session.put(f"{BASE_URL}/api/settings", json={
        "email_recipients": [{"name": "TEST", "email": "test@example.com"}],
        "tunnel_notify_on_change": True,
    })
    # Write a brand-new URL to force a change
    new_url = "https://notify-test-12345.trycloudflare.com"
    _write_log(new_url)
    r = admin_session.post(f"{BASE_URL}/api/tunnel/refresh")
    assert r.status_code == 200
    # Wait for watcher to also pass and trigger notify (it only triggers on change)
    time.sleep(20)
    # The endpoint should still respond, and status should be sane
    r2 = admin_session.get(f"{BASE_URL}/api/tunnel/status")
    assert r2.status_code == 200
    # cleanup
    admin_session.put(f"{BASE_URL}/api/settings", json={"email_recipients": []})
