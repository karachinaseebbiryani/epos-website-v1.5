#!/usr/bin/env python3
"""
Round 6 Bug Fix Testing
=======================
BUG 1: Admin password no longer reset to env-var on restart
BUG 2: Order endpoints honor the online_orders permission
"""

import requests
import time
import subprocess
import sys

# Backend URL from frontend/.env
BACKEND_URL = "https://alert-delivery-2.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"
NEW_ADMIN_PASSWORD = "newAdminPass#2026"

# Test staff users
STAFF_WITH_PERM = {
    "email": "orderstaff@test.local",
    "password": "StaffPass123!",
    "name": "Order Staff",
    "role": "cashier",
    "permissions": ["online_orders"]
}

STAFF_WITHOUT_PERM = {
    "email": "posonly@test.local",
    "password": "PosPass123!",
    "name": "POS Only",
    "role": "cashier",
    "permissions": ["pos"]
}

# Test customer for order creation
TEST_CUSTOMER = {
    "email": f"testcustomer{int(time.time())}@test.com",
    "password": "TestPass123!",
    "name": "Test Customer",
    "phone": "923001234567"
}

def log(msg):
    print(f"[TEST] {msg}")

def admin_login():
    """Login as admin and return Bearer token"""
    log(f"Logging in as admin: {ADMIN_EMAIL}")
    resp = requests.post(f"{BACKEND_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        log(f"❌ Admin login failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    log(f"✅ Admin login successful, role={data.get('role')}")
    return data.get("token")

def admin_login_with_password(password):
    """Login as admin with specific password"""
    log(f"Logging in as admin with password: {password}")
    resp = requests.post(f"{BACKEND_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": password
    })
    return resp

def get_admin_user_id(admin_token):
    """Get the admin user's ID"""
    log("Fetching admin user ID from /api/users")
    resp = requests.get(f"{BACKEND_URL}/users", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    if resp.status_code != 200:
        log(f"❌ Failed to get users: {resp.status_code}")
        return None
    users = resp.json()
    for user in users:
        if user.get("email") == ADMIN_EMAIL:
            log(f"✅ Found admin user ID: {user.get('id')}")
            return user.get("id")
    log("❌ Admin user not found in users list")
    return None

def change_admin_password(admin_token, admin_id, new_password):
    """Change admin password via PUT /api/users/{id}"""
    log(f"Changing admin password to: {new_password}")
    resp = requests.put(f"{BACKEND_URL}/users/{admin_id}", 
                       headers={"Authorization": f"Bearer {admin_token}"},
                       json={"password": new_password})
    if resp.status_code == 200:
        log(f"✅ Password changed successfully")
        return True
    else:
        log(f"❌ Password change failed: {resp.status_code} {resp.text}")
        return False

def restart_backend():
    """Restart backend service via supervisorctl"""
    log("Restarting backend service...")
    try:
        subprocess.run(["sudo", "supervisorctl", "restart", "backend"], 
                      check=True, capture_output=True, text=True)
        log("✅ Backend restart command sent")
        log("Waiting 4 seconds for backend to come back up...")
        time.sleep(4)
        return True
    except subprocess.CalledProcessError as e:
        log(f"❌ Backend restart failed: {e}")
        return False

def create_staff_user(admin_token, staff_data):
    """Create a staff user and return their ID"""
    log(f"Creating staff user: {staff_data['email']}")
    resp = requests.post(f"{BACKEND_URL}/users",
                        headers={"Authorization": f"Bearer {admin_token}"},
                        json=staff_data)
    if resp.status_code in [200, 201]:
        user_id = resp.json().get("id")
        log(f"✅ Staff user created: {user_id}")
        return user_id
    else:
        log(f"❌ Staff user creation failed: {resp.status_code} {resp.text}")
        return None

def staff_login(email, password):
    """Login as staff user and return token + user data"""
    log(f"Logging in as staff: {email}")
    resp = requests.post(f"{BACKEND_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    if resp.status_code != 200:
        log(f"❌ Staff login failed: {resp.status_code} {resp.text}")
        return None, None
    data = resp.json()
    log(f"✅ Staff login successful, role={data.get('role')}, permissions={data.get('permissions')}")
    return data.get("token"), data

def customer_signup():
    """Sign up a test customer and return token"""
    log(f"Signing up customer: {TEST_CUSTOMER['email']}")
    resp = requests.post(f"{BACKEND_URL}/customer/register", json=TEST_CUSTOMER)
    if resp.status_code not in [200, 201]:
        log(f"❌ Customer signup failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    log(f"✅ Customer signup successful")
    return data.get("token")

def get_menu_item(admin_token):
    """Get a menu item for order creation"""
    log("Fetching menu items...")
    resp = requests.get(f"{BACKEND_URL}/menu-items", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    if resp.status_code != 200:
        log(f"❌ Failed to get menu items: {resp.status_code}")
        return None
    items = resp.json()
    if not items:
        log("❌ No menu items found")
        return None
    item = items[0]
    log(f"✅ Using menu item: {item.get('name')} (ID: {item.get('id')}, Price: {item.get('price')})")
    return item

def disable_business_hours(admin_token):
    """Disable business hours to allow order creation"""
    log("Disabling business hours...")
    resp = requests.put(f"{BACKEND_URL}/admin/online-settings",
                       headers={"Authorization": f"Bearer {admin_token}"},
                       json={"business_hours_enabled": False})
    if resp.status_code == 200:
        log("✅ Business hours disabled")
        return True
    else:
        log(f"⚠️ Could not disable business hours: {resp.status_code}")
        return False

def create_order(customer_token, menu_item):
    """Create an online order and return order ID"""
    log("Creating online order...")
    order_data = {
        "items": [{
            "item_id": menu_item["id"],
            "name": menu_item["name"],
            "price": menu_item["price"],
            "quantity": 1
        }],
        "customer_name": TEST_CUSTOMER["name"],
        "phone": TEST_CUSTOMER["phone"],
        "address": "Test Address, Block A, Test City",
        "total_price": menu_item["price"],
        "payment_method": "cod"
    }
    resp = requests.post(f"{BACKEND_URL}/online-orders",
                        headers={"Authorization": f"Bearer {customer_token}"},
                        json=order_data)
    if resp.status_code not in [200, 201]:
        log(f"❌ Order creation failed: {resp.status_code} {resp.text}")
        return None
    order = resp.json()
    order_id = order.get("id")
    log(f"✅ Order created: {order_id}")
    return order_id

def delete_user(admin_token, user_id):
    """Delete a user"""
    log(f"Deleting user: {user_id}")
    resp = requests.delete(f"{BACKEND_URL}/users/{user_id}",
                          headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code == 200:
        log(f"✅ User deleted")
        return True
    else:
        log(f"⚠️ User deletion failed: {resp.status_code}")
        return False

# ============================================================
# BUG 1 TESTS: Admin password reset
# ============================================================

def test_bug1_admin_password_reset():
    """Test that admin password survives backend restart"""
    log("\n" + "="*60)
    log("BUG 1: Admin password no longer reset on restart")
    log("="*60)
    
    results = []
    
    # Step a: Login as admin and get user ID
    admin_token = admin_login()
    if not admin_token:
        results.append(("Test 1.1a - Admin login", "FAIL", "Could not login as admin"))
        return results
    results.append(("Test 1.1a - Admin login", "PASS", f"Logged in successfully"))
    
    admin_id = get_admin_user_id(admin_token)
    if not admin_id:
        results.append(("Test 1.1a - Get admin ID", "FAIL", "Could not get admin user ID"))
        return results
    results.append(("Test 1.1a - Get admin ID", "PASS", f"Admin ID: {admin_id}"))
    
    # Step b: Change admin password
    if not change_admin_password(admin_token, admin_id, NEW_ADMIN_PASSWORD):
        results.append(("Test 1.1b - Change password", "FAIL", "Password change failed"))
        return results
    results.append(("Test 1.1b - Change password", "PASS", f"Password changed to {NEW_ADMIN_PASSWORD}"))
    
    # Step c: Restart backend
    if not restart_backend():
        results.append(("Test 1.1c - Restart backend", "FAIL", "Backend restart failed"))
        return results
    results.append(("Test 1.1c - Restart backend", "PASS", "Backend restarted"))
    
    # Step d: Try logging in with NEW password (should work)
    resp = admin_login_with_password(NEW_ADMIN_PASSWORD)
    if resp.status_code == 200:
        results.append(("Test 1.1d - Login with new password", "PASS", 
                       f"HTTP {resp.status_code} - New password survived restart ✅"))
    else:
        results.append(("Test 1.1d - Login with new password", "FAIL", 
                       f"HTTP {resp.status_code} - New password did NOT survive restart ❌"))
    
    # Step e: Try logging in with OLD password (should fail)
    resp = admin_login_with_password(ADMIN_PASSWORD)
    if resp.status_code == 401:
        results.append(("Test 1.1e - Login with old password", "PASS", 
                       f"HTTP {resp.status_code} - Old password correctly rejected ✅"))
    else:
        results.append(("Test 1.1e - Login with old password", "FAIL", 
                       f"HTTP {resp.status_code} - Old password still works (should be 401) ❌"))
    
    # Step f: CLEANUP - Reset password back to admin123
    log("\n--- CLEANUP: Resetting admin password back to admin123 ---")
    new_admin_token = admin_login_with_password(NEW_ADMIN_PASSWORD).json().get("token")
    if new_admin_token:
        if change_admin_password(new_admin_token, admin_id, ADMIN_PASSWORD):
            results.append(("Test 1.1f - Cleanup", "PASS", "Password reset to admin123"))
            # Verify cleanup worked
            resp = admin_login_with_password(ADMIN_PASSWORD)
            if resp.status_code == 200:
                log("✅ Cleanup verified: admin123 password works again")
            else:
                log("⚠️ Cleanup verification failed: admin123 doesn't work")
        else:
            results.append(("Test 1.1f - Cleanup", "FAIL", "Could not reset password"))
    else:
        results.append(("Test 1.1f - Cleanup", "FAIL", "Could not login with new password for cleanup"))
    
    return results

# ============================================================
# BUG 2 TESTS: Permission-gated order endpoints
# ============================================================

def test_bug2_permission_gated_orders():
    """Test that order endpoints honor online_orders permission"""
    log("\n" + "="*60)
    log("BUG 2: Order endpoints honor online_orders permission")
    log("="*60)
    
    results = []
    
    # Setup: Login as admin
    admin_token = admin_login()
    if not admin_token:
        results.append(("Setup - Admin login", "FAIL", "Could not login as admin"))
        return results
    
    # Setup: Disable business hours
    disable_business_hours(admin_token)
    
    # Setup: Create staff user WITH online_orders permission
    staff_with_id = create_staff_user(admin_token, STAFF_WITH_PERM)
    if not staff_with_id:
        results.append(("Setup - Create staff WITH perm", "FAIL", "Could not create staff user"))
        return results
    results.append(("Setup - Create staff WITH perm", "PASS", f"Staff user created: {staff_with_id}"))
    
    # Setup: Login as staff WITH permission
    staff_with_token, staff_with_data = staff_login(STAFF_WITH_PERM["email"], STAFF_WITH_PERM["password"])
    if not staff_with_token:
        results.append(("Setup - Staff WITH perm login", "FAIL", "Could not login as staff"))
        return results
    
    # Verify staff has correct role and permissions
    if staff_with_data.get("role") == "cashier" and "online_orders" in staff_with_data.get("permissions", []):
        results.append(("Setup - Staff WITH perm login", "PASS", 
                       f"role={staff_with_data.get('role')}, permissions={staff_with_data.get('permissions')}"))
    else:
        results.append(("Setup - Staff WITH perm login", "FAIL", 
                       f"Incorrect role/permissions: {staff_with_data}"))
    
    # Setup: Create staff user WITHOUT online_orders permission
    staff_without_id = create_staff_user(admin_token, STAFF_WITHOUT_PERM)
    if not staff_without_id:
        results.append(("Setup - Create staff WITHOUT perm", "FAIL", "Could not create staff user"))
        return results
    results.append(("Setup - Create staff WITHOUT perm", "PASS", f"Staff user created: {staff_without_id}"))
    
    # Setup: Login as staff WITHOUT permission
    staff_without_token, staff_without_data = staff_login(STAFF_WITHOUT_PERM["email"], STAFF_WITHOUT_PERM["password"])
    if not staff_without_token:
        results.append(("Setup - Staff WITHOUT perm login", "FAIL", "Could not login as staff"))
        return results
    results.append(("Setup - Staff WITHOUT perm login", "PASS", 
                   f"role={staff_without_data.get('role')}, permissions={staff_without_data.get('permissions')}"))
    
    # Setup: Create a test order
    customer_token = customer_signup()
    if not customer_token:
        results.append(("Setup - Customer signup", "FAIL", "Could not signup customer"))
        return results
    
    menu_item = get_menu_item(admin_token)
    if not menu_item:
        results.append(("Setup - Get menu item", "FAIL", "Could not get menu item"))
        return results
    
    order_id = create_order(customer_token, menu_item)
    if not order_id:
        results.append(("Setup - Create order", "FAIL", "Could not create order"))
        return results
    results.append(("Setup - Create order", "PASS", f"Order created: {order_id}"))
    
    # Test 2.1: Staff WITH perm can LIST orders
    log("\n--- Test 2.1: Staff WITH perm can LIST orders ---")
    resp = requests.get(f"{BACKEND_URL}/online-orders", 
                       headers={"Authorization": f"Bearer {staff_with_token}"})
    if resp.status_code == 200:
        orders = resp.json()
        if any(o.get("id") == order_id for o in orders):
            results.append(("Test 2.1 - LIST orders (staff WITH perm)", "PASS", 
                           f"HTTP {resp.status_code}, found {len(orders)} orders including test order"))
        else:
            results.append(("Test 2.1 - LIST orders (staff WITH perm)", "FAIL", 
                           f"HTTP {resp.status_code}, test order not in list"))
    else:
        results.append(("Test 2.1 - LIST orders (staff WITH perm)", "FAIL", 
                       f"HTTP {resp.status_code} (expected 200)"))
    
    # Test 2.2: Staff WITH perm can ACCEPT order
    log("\n--- Test 2.2: Staff WITH perm can ACCEPT order ---")
    resp = requests.post(f"{BACKEND_URL}/online-orders/{order_id}/accept",
                        headers={"Authorization": f"Bearer {staff_with_token}"})
    if resp.status_code == 200:
        results.append(("Test 2.2 - ACCEPT order (staff WITH perm)", "PASS", 
                       f"HTTP {resp.status_code}, order accepted"))
    else:
        results.append(("Test 2.2 - ACCEPT order (staff WITH perm)", "FAIL", 
                       f"HTTP {resp.status_code} (expected 200): {resp.text[:100]}"))
    
    # Test 2.3: Staff WITH perm can UPDATE STATUS
    log("\n--- Test 2.3: Staff WITH perm can UPDATE STATUS ---")
    resp = requests.put(f"{BACKEND_URL}/online-orders/{order_id}/status",
                       headers={"Authorization": f"Bearer {staff_with_token}"},
                       json={"status": "preparing"})
    if resp.status_code == 200:
        results.append(("Test 2.3 - UPDATE STATUS (staff WITH perm)", "PASS", 
                       f"HTTP {resp.status_code}, status updated to preparing"))
    else:
        results.append(("Test 2.3 - UPDATE STATUS (staff WITH perm)", "FAIL", 
                       f"HTTP {resp.status_code} (expected 200): {resp.text[:100]}"))
    
    # Test 2.4: Staff WITH perm can GET single order
    log("\n--- Test 2.4: Staff WITH perm can GET single order ---")
    resp = requests.get(f"{BACKEND_URL}/online-orders/{order_id}",
                       headers={"Authorization": f"Bearer {staff_with_token}"})
    if resp.status_code == 200:
        order = resp.json()
        results.append(("Test 2.4 - GET single order (staff WITH perm)", "PASS", 
                       f"HTTP {resp.status_code}, order status={order.get('status')}"))
    else:
        results.append(("Test 2.4 - GET single order (staff WITH perm)", "FAIL", 
                       f"HTTP {resp.status_code} (expected 200)"))
    
    # Test 2.5: Staff WITH perm can VIEW pending-count
    log("\n--- Test 2.5: Staff WITH perm can VIEW pending-count ---")
    resp = requests.get(f"{BACKEND_URL}/online-orders/pending-count",
                       headers={"Authorization": f"Bearer {staff_with_token}"})
    if resp.status_code == 200:
        results.append(("Test 2.5 - VIEW pending-count (staff WITH perm)", "PASS", 
                       f"HTTP {resp.status_code}, count={resp.json()}"))
    else:
        results.append(("Test 2.5 - VIEW pending-count (staff WITH perm)", "FAIL", 
                       f"HTTP {resp.status_code} (expected 200)"))
    
    # Test 2.6: Staff WITHOUT perm is BLOCKED from LIST
    log("\n--- Test 2.6: Staff WITHOUT perm is BLOCKED ---")
    resp = requests.get(f"{BACKEND_URL}/online-orders",
                       headers={"Authorization": f"Bearer {staff_without_token}"})
    if resp.status_code == 403:
        results.append(("Test 2.6a - LIST blocked (staff WITHOUT perm)", "PASS", 
                       f"HTTP {resp.status_code} (correctly blocked)"))
    else:
        results.append(("Test 2.6a - LIST blocked (staff WITHOUT perm)", "FAIL", 
                       f"HTTP {resp.status_code} (expected 403)"))
    
    # Test 2.6: Staff WITHOUT perm is BLOCKED from ACCEPT
    resp = requests.post(f"{BACKEND_URL}/online-orders/{order_id}/accept",
                        headers={"Authorization": f"Bearer {staff_without_token}"})
    if resp.status_code == 403:
        results.append(("Test 2.6b - ACCEPT blocked (staff WITHOUT perm)", "PASS", 
                       f"HTTP {resp.status_code} (correctly blocked)"))
    else:
        results.append(("Test 2.6b - ACCEPT blocked (staff WITHOUT perm)", "FAIL", 
                       f"HTTP {resp.status_code} (expected 403)"))
    
    # Test 2.7: Admin still works (regression)
    log("\n--- Test 2.7: Admin still works (regression) ---")
    resp = requests.get(f"{BACKEND_URL}/online-orders",
                       headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code == 200:
        orders = resp.json()
        results.append(("Test 2.7 - Admin LIST orders (regression)", "PASS", 
                       f"HTTP {resp.status_code}, found {len(orders)} orders"))
    else:
        results.append(("Test 2.7 - Admin LIST orders (regression)", "FAIL", 
                       f"HTTP {resp.status_code} (expected 200)"))
    
    # Cleanup: Delete test staff users
    log("\n--- CLEANUP: Deleting test staff users ---")
    delete_user(admin_token, staff_with_id)
    delete_user(admin_token, staff_without_id)
    results.append(("Cleanup - Delete staff users", "PASS", "Staff users deleted"))
    
    return results

# ============================================================
# Main test runner
# ============================================================

def main():
    log("="*60)
    log("ROUND 6 BUG FIX TESTING")
    log("="*60)
    
    all_results = []
    
    # Run Bug 1 tests
    bug1_results = test_bug1_admin_password_reset()
    all_results.extend(bug1_results)
    
    # Run Bug 2 tests
    bug2_results = test_bug2_permission_gated_orders()
    all_results.extend(bug2_results)
    
    # Print summary
    log("\n" + "="*60)
    log("TEST SUMMARY")
    log("="*60)
    
    passed = 0
    failed = 0
    
    for test_name, status, details in all_results:
        if status == "PASS":
            log(f"✅ {test_name}: {details}")
            passed += 1
        else:
            log(f"❌ {test_name}: {details}")
            failed += 1
    
    log("\n" + "="*60)
    log(f"TOTAL: {passed} PASSED, {failed} FAILED")
    log("="*60)
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
