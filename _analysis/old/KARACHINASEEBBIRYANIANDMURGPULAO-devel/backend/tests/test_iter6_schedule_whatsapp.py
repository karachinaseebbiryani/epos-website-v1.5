"""
Iteration 6 backend tests: Daily Schedule + WhatsApp endpoints.
Covers:
- /api/schedule/status, /api/schedule/timezones, /api/schedule/run-now
- PUT /api/settings reschedules; invalid time/tz still returns 200
- /api/whatsapp/status, /api/whatsapp/qr, /api/whatsapp/test, /api/whatsapp/send-report
- Direct hit on local node service at 127.0.0.1:3030
"""
import os
import re
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://project-handoff-12.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASS = "admin123"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def cashier(admin):
    # Try create cashier; if exists use existing
    email = "TEST_cashier_iter6@restaurant.com"
    pw = "cashpass123"
    admin.post(f"{BASE_URL}/api/users", json={"name": "TEST cashier", "email": email, "password": pw, "role": "cashier"}, timeout=15)
    return _login(email, pw)


@pytest.fixture(scope="module", autouse=True)
def restore_settings(admin):
    """Snapshot settings, restore at module teardown."""
    r = admin.get(f"{BASE_URL}/api/settings", timeout=15)
    original = r.json() if r.status_code == 200 else {}
    yield
    payload = {
        "daily_report_time": original.get("daily_report_time", "02:15"),
        "daily_report_timezone": original.get("daily_report_timezone", "Asia/Karachi"),
        "auto_email_daily": original.get("auto_email_daily", False),
        "auto_whatsapp_daily": original.get("auto_whatsapp_daily", False),
        "daily_report_type": original.get("daily_report_type", "yesterday"),
        "whatsapp_recipients": original.get("whatsapp_recipients", []),
        "auto_whatsapp_on_z_close": original.get("auto_whatsapp_on_z_close", False),
    }
    admin.put(f"{BASE_URL}/api/settings", json=payload, timeout=15)


# ---------- /api/schedule ----------
class TestScheduleStatus:
    def test_status_returns_required_keys(self, admin):
        r = admin.get(f"{BASE_URL}/api/schedule/status", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("daily_report_time", "daily_report_timezone", "auto_email_daily",
                  "auto_whatsapp_daily", "daily_report_type", "next_run"):
            assert k in data, f"missing {k} in {data}"
        # next_run is ISO string when scheduler initialised
        if data["next_run"] is not None:
            assert isinstance(data["next_run"], str)

    def test_status_admin_only(self, cashier):
        r = cashier.get(f"{BASE_URL}/api/schedule/status", timeout=15)
        assert r.status_code == 403, r.text

    def test_timezones_list_includes_required(self, admin):
        r = admin.get(f"{BASE_URL}/api/schedule/timezones", timeout=15)
        assert r.status_code == 200
        tzs = r.json()
        assert isinstance(tzs, list) and len(tzs) > 5
        for required in ("Asia/Karachi", "UTC", "Europe/London"):
            assert required in tzs, f"{required} not in tz list"

    def test_run_now_admin_ok(self, admin):
        r = admin.post(f"{BASE_URL}/api/schedule/run-now", json={}, timeout=15)
        assert r.status_code == 200, r.text
        assert "message" in r.json()

    def test_run_now_cashier_403(self, cashier):
        r = cashier.post(f"{BASE_URL}/api/schedule/run-now", json={}, timeout=15)
        assert r.status_code == 403


class TestSettingsReschedule:
    def test_put_settings_updates_schedule_and_next_run(self, admin):
        # Set to 08:30 Europe/London, auto_email_daily True so it actually schedules
        r = admin.put(f"{BASE_URL}/api/settings", json={
            "daily_report_time": "08:30",
            "daily_report_timezone": "Europe/London",
            "auto_email_daily": True,
        }, timeout=15)
        assert r.status_code == 200
        time.sleep(0.5)  # let reschedule complete
        s = admin.get(f"{BASE_URL}/api/schedule/status", timeout=15).json()
        assert s["daily_report_time"] == "08:30"
        assert s["daily_report_timezone"] == "Europe/London"
        assert s["auto_email_daily"] is True
        # next_run should be present and contain '+' or 'Z' (tz offset)
        assert s["next_run"], "next_run missing"
        # ISO string with hour 08:30 in target tz; just sanity check the substring
        assert "08:30" in s["next_run"], f"expected 08:30 in next_run, got {s['next_run']}"

    def test_put_settings_invalid_time_still_200(self, admin):
        r = admin.put(f"{BASE_URL}/api/settings", json={"daily_report_time": "99:99"}, timeout=15)
        assert r.status_code == 200, r.text
        s = admin.get(f"{BASE_URL}/api/settings", timeout=15).json()
        assert s.get("daily_report_time") == "99:99"

    def test_put_settings_invalid_tz_still_200(self, admin):
        r = admin.put(f"{BASE_URL}/api/settings", json={"daily_report_timezone": "Foo/Bar"}, timeout=15)
        assert r.status_code == 200, r.text
        s = admin.get(f"{BASE_URL}/api/settings", timeout=15).json()
        assert s.get("daily_report_timezone") == "Foo/Bar"

    def test_restore_valid_for_remainder(self, admin):
        # Restore valid before running other tests
        r = admin.put(f"{BASE_URL}/api/settings", json={
            "daily_report_time": "02:15",
            "daily_report_timezone": "Asia/Karachi",
        }, timeout=15)
        assert r.status_code == 200


# ---------- /api/whatsapp ----------
class TestWhatsAppEndpoints:
    def test_status_admin(self, admin):
        r = admin.get(f"{BASE_URL}/api/whatsapp/status", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Should always return a ready field (False initially)
        assert "ready" in data
        assert isinstance(data["ready"], bool)
        # When service is up: 'qr_available' & 'initializing' should appear
        # When service down: 'error' string should be present (still 200)

    def test_status_cashier_403(self, cashier):
        r = cashier.get(f"{BASE_URL}/api/whatsapp/status", timeout=15)
        assert r.status_code == 403

    def test_qr_admin(self, admin):
        r = admin.get(f"{BASE_URL}/api/whatsapp/qr", timeout=20)
        # Either 200 with data URL or 200 with 'QR not yet generated' or 503
        assert r.status_code in (200, 503), r.text
        if r.status_code == 200:
            data = r.json()
            assert "qr" in data or "message" in data
            if data.get("qr"):
                assert isinstance(data["qr"], str)
                assert data["qr"].startswith("data:image/png;base64,"), data["qr"][:60]

    def test_test_send_no_recipient(self, admin):
        # POST without 'to' should 400
        r = admin.post(f"{BASE_URL}/api/whatsapp/test", json={}, timeout=15)
        assert r.status_code == 400

    def test_test_send_when_not_ready(self, admin):
        # Service is up but not connected — node returns 503 'WhatsApp not connected'
        r = admin.post(f"{BASE_URL}/api/whatsapp/test", json={"to": "+923004928411"}, timeout=30)
        # 503 is the documented expectation; could also be 500 if isRegisteredUser fails
        # Accept 4xx/5xx but flag if 200 (would mean unexpectedly succeeded)
        assert r.status_code >= 400, f"unexpected success: {r.text}"
        assert r.status_code in (500, 502, 503), f"got {r.status_code}: {r.text}"

    def test_send_report_no_recipients_400(self, admin):
        # Ensure recipients empty first
        admin.put(f"{BASE_URL}/api/settings", json={"whatsapp_recipients": []}, timeout=15)
        r = admin.post(f"{BASE_URL}/api/whatsapp/send-report", json={"report_type": "X"}, timeout=15)
        assert r.status_code == 400, r.text
        assert "recipient" in r.json().get("detail", "").lower()

    def test_send_report_with_recipients_returns_502_or_partial(self, admin):
        # Add a recipient
        admin.put(f"{BASE_URL}/api/settings", json={"whatsapp_recipients": [
            {"name": "TEST iter6", "phone": "+923004928411", "receive_x": True, "receive_z": True}
        ]}, timeout=15)
        r = admin.post(f"{BASE_URL}/api/whatsapp/send-report", json={"report_type": "X"}, timeout=60)
        # Service not connected → all fail → 502
        # Cleanup is handled by restore_settings fixture
        assert r.status_code in (200, 502), f"got {r.status_code}: {r.text}"
        if r.status_code == 502:
            detail = r.json().get("detail")
            assert isinstance(detail, dict) or isinstance(detail, str)

    def test_recipients_persist_in_settings(self, admin):
        admin.put(f"{BASE_URL}/api/settings", json={
            "whatsapp_recipients": [
                {"name": "TEST iter6 persist", "phone": "+923001111111", "receive_x": True, "receive_z": False}
            ],
            "auto_whatsapp_on_z_close": True,
        }, timeout=15)
        s = admin.get(f"{BASE_URL}/api/settings", timeout=15).json()
        assert s.get("auto_whatsapp_on_z_close") is True
        recs = s.get("whatsapp_recipients", [])
        assert any(r.get("phone") == "+923001111111" for r in recs)


class TestNodeServiceDirect:
    """Hit the node service directly (not through proxy)."""
    def test_node_status_responds(self):
        r = requests.get("http://127.0.0.1:3030/status", timeout=5)
        assert r.status_code == 200
        d = r.json()
        for k in ("ready", "phone", "qr_available", "initializing"):
            assert k in d, f"missing {k}"
        # 'error' may be None
        assert "error" in d
