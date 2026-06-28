#!/usr/bin/env python3
"""
Payment Manipulation Fix Verification Test Suite for POST /api/online-orders

Tests server-side authoritative pricing to prevent:
- Negative quantity attacks
- Negative price attacks
- Price override attacks (Rs 1 for anything)
- Total price manipulation
- Invalid item IDs
- Empty carts
- Huge quantities
"""

import requests
import json
import sys
from typing import Dict, Optional

# Backend URL from frontend/.env
BASE_URL = "https://alert-delivery-2.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"

# Test results tracking
test_results = []

def log_test(test_name: str, passed: bool, details: str):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status} - {test_name}")
    print(f"Details: {details}")
    test_results.append({
        "test": test_name,
        "passed": passed,
        "details": details
    })

def admin_login() -> Optional[str]:
    """Login as admin and return Bearer token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token") or data.get("token")
            print(f"✓ Admin login successful, token: {token[:20]}...")
            return token
        else:
            print(f"✗ Admin login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"✗ Admin login error: {e}")
        return None

def customer_signup(email: str, password: str, name: str, phone: str) -> Optional[Dict]:
    """Sign up a customer and return token + customer data"""
    try:
        response = requests.post(
            f"{BASE_URL}/customer/register",
            json={
                "email": email,
                "password": password,
                "name": name,
                "phone": phone
            },
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token") or data.get("token")
            print(f"✓ Customer signup successful: {email}, token: {token[:20] if token else 'N/A'}...")
            return {"token": token, "data": data}
        else:
            print(f"✗ Customer signup failed for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"✗ Customer signup error for {email}: {e}")
        return None

def disable_business_hours(admin_token: str) -> bool:
    """Disable business hours to allow order creation during testing"""
    try:
        response = requests.put(
            f"{BASE_URL}/admin/online-settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"business_hours_enabled": False},
            timeout=10
        )
        if response.status_code == 200:
            print("✓ Business hours disabled")
            return True
        else:
            print(f"⚠ Could not disable business hours: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"⚠ Business hours disable error: {e}")
        return False

def get_menu_items(admin_token: str) -> Optional[list]:
    """Get list of menu items"""
    try:
        response = requests.get(
            f"{BASE_URL}/menu-items",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        if response.status_code == 200:
            items = response.json()
            print(f"✓ Retrieved {len(items)} menu items")
            return items
        else:
            print(f"✗ Failed to get menu items: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"✗ Get menu items error: {e}")
        return None

def get_categories(admin_token: str) -> Optional[list]:
    """Get list of categories"""
    try:
        response = requests.get(
            f"{BASE_URL}/categories",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        if response.status_code == 200:
            categories = response.json()
            print(f"✓ Retrieved {len(categories)} categories")
            return categories
        else:
            print(f"✗ Failed to get categories: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"✗ Get categories error: {e}")
        return None

def create_menu_item(admin_token: str, category_id: str) -> Optional[Dict]:
    """Create a test menu item"""
    try:
        response = requests.post(
            f"{BASE_URL}/menu-items",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "Test Biryani",
                "price": 500,
                "category_id": category_id,
                "stock": 100,
                "is_available": True,
                "description": "Test item for payment manipulation testing"
            },
            timeout=10
        )
        if response.status_code == 200:
            item = response.json()
            print(f"✓ Created test menu item: {item.get('name')} (ID: {item.get('id')}, Price: Rs {item.get('price')})")
            return item
        else:
            print(f"✗ Failed to create menu item: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"✗ Create menu item error: {e}")
        return None

def create_offer(admin_token: str, coupon_code: str, discount_percent: int) -> Optional[Dict]:
    """Create a test offer/coupon"""
    try:
        response = requests.post(
            f"{BASE_URL}/offers",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "coupon_code": coupon_code,
                "discount_percent": discount_percent,
                "active": True,
                "title": "Payment Test Coupon",
                "description": f"{discount_percent}% discount for testing"
            },
            timeout=10
        )
        if response.status_code == 200:
            offer = response.json()
            print(f"✓ Created test offer: {coupon_code} ({discount_percent}% off)")
            return offer
        else:
            print(f"⚠ Could not create offer: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"⚠ Create offer error: {e}")
        return None

def create_order(customer_token: str, item_id: str, item_name: str, price: float, quantity: int, 
                 total_price: float, customer_name: str, phone: str, coupon_code: str = None) -> Optional[Dict]:
    """Create an online order"""
    try:
        payload = {
            "items": [{
                "item_id": item_id,
                "name": item_name,
                "price": price,
                "quantity": quantity
            }],
            "customer_name": customer_name,
            "phone": phone,
            "address": "House 12, Some Suburb, Lahore",
            "total_price": total_price,
            "payment_method": "cod"
        }
        if coupon_code:
            payload["coupon_code"] = coupon_code
        
        headers = {}
        if customer_token:
            headers["Authorization"] = f"Bearer {customer_token}"
        
        response = requests.post(
            f"{BASE_URL}/online-orders",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        return {
            "status_code": response.status_code,
            "data": response.json() if response.status_code in [200, 201] else None,
            "error": response.json() if response.status_code >= 400 else None,
            "text": response.text
        }
    except Exception as e:
        print(f"✗ Create order error: {e}")
        return None

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in test_results if r["passed"])
    failed = sum(1 for r in test_results if not r["passed"])
    total = len(test_results)
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {(passed/total*100) if total > 0 else 0:.1f}%")
    
    if failed > 0:
        print("\n" + "="*80)
        print("FAILED TESTS:")
        print("="*80)
        for r in test_results:
            if not r["passed"]:
                print(f"\n❌ {r['test']}")
                print(f"   {r['details']}")
    
    return failed == 0

def main():
    print("="*80)
    print("PAYMENT MANIPULATION FIX VERIFICATION TEST SUITE")
    print("="*80)
    
    # Step 1: Admin login
    print("\n[SETUP] Admin Login")
    admin_token = admin_login()
    if not admin_token:
        print("❌ Cannot proceed without admin token")
        sys.exit(1)
    
    # Step 2: Disable business hours
    print("\n[SETUP] Disable Business Hours")
    disable_business_hours(admin_token)
    
    # Step 3: Get or create menu item
    print("\n[SETUP] Get/Create Menu Item")
    menu_items = get_menu_items(admin_token)
    
    test_item = None
    if menu_items and len(menu_items) > 0:
        test_item = menu_items[0]
        print(f"✓ Using existing menu item: {test_item.get('name')} (ID: {test_item.get('id')}, Price: Rs {test_item.get('price')})")
    else:
        print("No menu items found, creating one...")
        categories = get_categories(admin_token)
        if categories and len(categories) > 0:
            test_item = create_menu_item(admin_token, categories[0].get('id'))
        else:
            print("❌ No categories found, cannot create menu item")
            sys.exit(1)
    
    if not test_item:
        print("❌ Cannot proceed without a menu item")
        sys.exit(1)
    
    item_id = test_item.get('id')
    item_name = test_item.get('name')
    db_price = float(test_item.get('price'))
    
    print(f"\n[TEST ITEM] ID: {item_id}, Name: {item_name}, DB Price: Rs {db_price}")
    
    # Step 4: Customer signup
    print("\n[SETUP] Customer Signup")
    import random
    random_suffix = random.randint(10000, 99999)
    customer = customer_signup(
        f"testcustomer{random_suffix}@test.com",
        "testpass123",
        "Test Customer",
        f"+923001234{random_suffix % 1000:03d}"
    )
    if not customer or not customer.get("token"):
        print("❌ Cannot proceed without customer token")
        sys.exit(1)
    
    customer_token = customer["token"]
    customer_name = "Test Customer"
    customer_phone = f"+923001234{random_suffix % 1000:03d}"
    
    # ========== TEST 1: Negative Quantity ==========
    print("\n" + "="*80)
    print("TEST 1: Negative Quantity Attack")
    print("="*80)
    result = create_order(customer_token, item_id, item_name, db_price, -3, 0, customer_name, customer_phone)
    if result:
        if result["status_code"] == 400:
            error_msg = result["error"].get("detail", "") if result["error"] else ""
            if "quantity" in error_msg.lower() or "between 1 and 100" in error_msg.lower():
                log_test("Test 1 - Negative Quantity", True, 
                        f"HTTP 400 with correct error: {error_msg}")
            else:
                log_test("Test 1 - Negative Quantity", False,
                        f"HTTP 400 but wrong error message: {error_msg}")
        else:
            log_test("Test 1 - Negative Quantity", False,
                    f"Expected HTTP 400, got {result['status_code']}: {result.get('text', '')}")
    
    # ========== TEST 2: Zero Quantity ==========
    print("\n" + "="*80)
    print("TEST 2: Zero Quantity Attack")
    print("="*80)
    result = create_order(customer_token, item_id, item_name, db_price, 0, 0, customer_name, customer_phone)
    if result:
        if result["status_code"] == 400:
            error_msg = result["error"].get("detail", "") if result["error"] else ""
            log_test("Test 2 - Zero Quantity", True,
                    f"HTTP 400 with error: {error_msg}")
        else:
            log_test("Test 2 - Zero Quantity", False,
                    f"Expected HTTP 400, got {result['status_code']}: {result.get('text', '')}")
    
    # ========== TEST 3: Negative Price ==========
    print("\n" + "="*80)
    print("TEST 3: Negative Price Attack")
    print("="*80)
    result = create_order(customer_token, item_id, item_name, -500, 1, -500, customer_name, customer_phone)
    if result:
        if result["status_code"] in [200, 201]:
            order = result["data"]
            subtotal = order.get("subtotal", 0)
            total = order.get("total_price", 0)
            item_price = order.get("items", [{}])[0].get("price", 0) if order.get("items") else 0
            
            if subtotal == db_price and total == db_price and item_price == db_price:
                log_test("Test 3 - Negative Price", True,
                        f"HTTP 201, server ignored client price. subtotal={subtotal}, total={total}, item_price={item_price} (all equal DB price {db_price})")
            else:
                log_test("Test 3 - Negative Price", False,
                        f"HTTP 201 but prices wrong: subtotal={subtotal}, total={total}, item_price={item_price}, expected all={db_price}")
        else:
            log_test("Test 3 - Negative Price", False,
                    f"Expected HTTP 201, got {result['status_code']}: {result.get('text', '')}")
    
    # ========== TEST 4: Price Override to Rs 1 ==========
    print("\n" + "="*80)
    print("TEST 4: Price Override to Rs 1 Attack")
    print("="*80)
    result = create_order(customer_token, item_id, item_name, 1.0, 1, 1.0, customer_name, customer_phone)
    if result:
        if result["status_code"] in [200, 201]:
            order = result["data"]
            subtotal = order.get("subtotal", 0)
            total = order.get("total_price", 0)
            item_price = order.get("items", [{}])[0].get("price", 0) if order.get("items") else 0
            
            if subtotal == db_price and item_price == db_price:
                log_test("Test 4 - Price Override to Rs 1", True,
                        f"HTTP 201, server ignored client price. subtotal={subtotal}, item_price={item_price} (both equal DB price {db_price})")
            else:
                log_test("Test 4 - Price Override to Rs 1", False,
                        f"HTTP 201 but prices wrong: subtotal={subtotal}, item_price={item_price}, expected={db_price}")
        else:
            log_test("Test 4 - Price Override to Rs 1", False,
                    f"Expected HTTP 201, got {result['status_code']}: {result.get('text', '')}")
    
    # ========== TEST 5: Manipulated Total ==========
    print("\n" + "="*80)
    print("TEST 5: Manipulated Total Price Attack")
    print("="*80)
    result = create_order(customer_token, item_id, item_name, db_price, 2, 1.0, customer_name, customer_phone)
    if result:
        if result["status_code"] in [200, 201]:
            order = result["data"]
            subtotal = order.get("subtotal", 0)
            total = order.get("total_price", 0)
            expected_subtotal = db_price * 2
            
            if subtotal == expected_subtotal and total == expected_subtotal:
                log_test("Test 5 - Manipulated Total", True,
                        f"HTTP 201, server ignored client total. subtotal={subtotal}, total={total} (both equal expected {expected_subtotal})")
            else:
                log_test("Test 5 - Manipulated Total", False,
                        f"HTTP 201 but prices wrong: subtotal={subtotal}, total={total}, expected={expected_subtotal}")
        else:
            log_test("Test 5 - Manipulated Total", False,
                    f"Expected HTTP 201, got {result['status_code']}: {result.get('text', '')}")
    
    # ========== TEST 6: Unknown Item ID ==========
    print("\n" + "="*80)
    print("TEST 6: Unknown Item ID")
    print("="*80)
    result = create_order(customer_token, "000000000000000000000000", item_name, db_price, 1, db_price, customer_name, customer_phone)
    if result:
        if result["status_code"] == 400:
            error_msg = result["error"].get("detail", "") if result["error"] else ""
            if "menu item" in error_msg.lower() and ("not found" in error_msg.lower() or "unavailable" in error_msg.lower()):
                log_test("Test 6 - Unknown Item ID", True,
                        f"HTTP 400 with correct error: {error_msg}")
            else:
                log_test("Test 6 - Unknown Item ID", False,
                        f"HTTP 400 but wrong error message: {error_msg}")
        else:
            log_test("Test 6 - Unknown Item ID", False,
                    f"Expected HTTP 400, got {result['status_code']}: {result.get('text', '')}")
    
    # ========== TEST 7: Invalid Item ID Format ==========
    print("\n" + "="*80)
    print("TEST 7: Invalid Item ID Format")
    print("="*80)
    result = create_order(customer_token, "not-a-valid-objectid", item_name, db_price, 1, db_price, customer_name, customer_phone)
    if result:
        if result["status_code"] == 400:
            error_msg = result["error"].get("detail", "") if result["error"] else ""
            if "invalid" in error_msg.lower() and "menu item" in error_msg.lower():
                log_test("Test 7 - Invalid Item ID Format", True,
                        f"HTTP 400 with correct error: {error_msg}")
            else:
                log_test("Test 7 - Invalid Item ID Format", False,
                        f"HTTP 400 but wrong error message: {error_msg}")
        else:
            log_test("Test 7 - Invalid Item ID Format", False,
                    f"Expected HTTP 400, got {result['status_code']}: {result.get('text', '')}")
    
    # ========== TEST 8: Empty Cart ==========
    print("\n" + "="*80)
    print("TEST 8: Empty Cart")
    print("="*80)
    try:
        payload = {
            "items": [],
            "customer_name": customer_name,
            "phone": customer_phone,
            "address": "House 12, Some Suburb, Lahore",
            "total_price": 0,
            "payment_method": "cod"
        }
        response = requests.post(
            f"{BASE_URL}/online-orders",
            headers={"Authorization": f"Bearer {customer_token}"},
            json=payload,
            timeout=10
        )
        if response.status_code == 400:
            error_msg = response.json().get("detail", "")
            if "at least one item" in error_msg.lower() or "empty" in error_msg.lower():
                log_test("Test 8 - Empty Cart", True,
                        f"HTTP 400 with correct error: {error_msg}")
            else:
                log_test("Test 8 - Empty Cart", False,
                        f"HTTP 400 but wrong error message: {error_msg}")
        else:
            log_test("Test 8 - Empty Cart", False,
                    f"Expected HTTP 400, got {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Test 8 - Empty Cart", False, f"Exception: {e}")
    
    # ========== TEST 9: Huge Quantity ==========
    print("\n" + "="*80)
    print("TEST 9: Huge Quantity")
    print("="*80)
    result = create_order(customer_token, item_id, item_name, db_price, 9999, db_price * 9999, customer_name, customer_phone)
    if result:
        if result["status_code"] == 400:
            error_msg = result["error"].get("detail", "") if result["error"] else ""
            if "quantity" in error_msg.lower() and ("between 1 and 100" in error_msg.lower() or "100" in error_msg):
                log_test("Test 9 - Huge Quantity", True,
                        f"HTTP 400 with correct error: {error_msg}")
            else:
                log_test("Test 9 - Huge Quantity", False,
                        f"HTTP 400 but wrong error message: {error_msg}")
        else:
            log_test("Test 9 - Huge Quantity", False,
                    f"Expected HTTP 400, got {result['status_code']}: {result.get('text', '')}")
    
    # ========== TEST 10: Normal Order (Regression) ==========
    print("\n" + "="*80)
    print("TEST 10: Normal Order (Regression)")
    print("="*80)
    result = create_order(customer_token, item_id, item_name, db_price, 2, db_price * 2, customer_name, customer_phone)
    if result:
        if result["status_code"] in [200, 201]:
            order = result["data"]
            subtotal = order.get("subtotal", 0)
            total = order.get("total_price", 0)
            expected_subtotal = db_price * 2
            
            if subtotal == expected_subtotal and total == expected_subtotal:
                log_test("Test 10 - Normal Order", True,
                        f"HTTP 201, order created successfully. subtotal={subtotal}, total={total} (expected {expected_subtotal})")
            else:
                log_test("Test 10 - Normal Order", False,
                        f"HTTP 201 but prices wrong: subtotal={subtotal}, total={total}, expected={expected_subtotal}")
        else:
            log_test("Test 10 - Normal Order", False,
                    f"Expected HTTP 201, got {result['status_code']}: {result.get('text', '')}")
    
    # ========== TEST 11: Coupon Discount Uses Server Subtotal ==========
    print("\n" + "="*80)
    print("TEST 11: Coupon Discount Uses Server Subtotal")
    print("="*80)
    
    # Create a test coupon
    coupon_code = f"TESTPAY{random_suffix % 100}"
    offer = create_offer(admin_token, coupon_code, 10)
    
    if offer:
        # Try to order with coupon, lying about total_price
        result = create_order(customer_token, item_id, item_name, db_price, 1, 5000, customer_name, customer_phone, coupon_code)
        if result:
            if result["status_code"] in [200, 201]:
                order = result["data"]
                discount = order.get("discount_amount", 0)
                expected_discount = db_price * 0.1  # 10% of DB price
                
                if abs(discount - expected_discount) < 0.01:  # Allow small floating point difference
                    log_test("Test 11 - Coupon Discount", True,
                            f"HTTP 201, discount calculated from server subtotal. discount={discount}, expected={expected_discount}")
                else:
                    log_test("Test 11 - Coupon Discount", False,
                            f"HTTP 201 but discount wrong: discount={discount}, expected={expected_discount} (10% of {db_price})")
            else:
                log_test("Test 11 - Coupon Discount", False,
                        f"Expected HTTP 201, got {result['status_code']}: {result.get('text', '')}")
    else:
        log_test("Test 11 - Coupon Discount", False, "Could not create test offer, skipping test")
    
    # ========== TEST 12: Float Quantity (BONUS) ==========
    print("\n" + "="*80)
    print("TEST 12: Float Quantity (BONUS)")
    print("="*80)
    try:
        payload = {
            "items": [{
                "item_id": item_id,
                "name": item_name,
                "price": db_price,
                "quantity": 1.5  # Float instead of int
            }],
            "customer_name": customer_name,
            "phone": customer_phone,
            "address": "House 12, Some Suburb, Lahore",
            "total_price": db_price * 1.5,
            "payment_method": "cod"
        }
        response = requests.post(
            f"{BASE_URL}/online-orders",
            headers={"Authorization": f"Bearer {customer_token}"},
            json=payload,
            timeout=10
        )
        
        # Note: int(1.5) = 1 in Python, so this might pass through with qty=1
        # Either behavior is acceptable as long as no Rs 0/1 order is created
        if response.status_code == 400:
            error_msg = response.json().get("detail", "")
            log_test("Test 12 - Float Quantity", True,
                    f"HTTP 400, float rejected: {error_msg}")
        elif response.status_code in [200, 201]:
            order = response.json()
            qty = order.get("items", [{}])[0].get("quantity", 0) if order.get("items") else 0
            subtotal = order.get("subtotal", 0)
            # If it converted 1.5 to 1, that's acceptable
            if qty == 1 and subtotal == db_price:
                log_test("Test 12 - Float Quantity", True,
                        f"HTTP 201, float converted to int(1). qty={qty}, subtotal={subtotal} (acceptable behavior)")
            else:
                log_test("Test 12 - Float Quantity", False,
                        f"HTTP 201 but unexpected values: qty={qty}, subtotal={subtotal}")
        else:
            log_test("Test 12 - Float Quantity", False,
                    f"Unexpected status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Test 12 - Float Quantity", False, f"Exception: {e}")
    
    # Print summary
    all_passed = print_summary()
    
    if all_passed:
        print("\n✅ ALL TESTS PASSED - Payment manipulation fix is working correctly!")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED - Please review the failures above")
        sys.exit(1)

if __name__ == "__main__":
    main()
