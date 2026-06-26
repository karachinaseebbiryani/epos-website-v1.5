#!/usr/bin/env python3
"""
IDOR Fix Verification Test Suite for GET /api/track/{order_id}

Tests the per-order track_token authorization mechanism that prevents
enumeration attacks on MongoDB ObjectId-based order IDs.
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

def create_order(customer_token: str, customer_name: str, phone: str) -> Optional[Dict]:
    """Create an online order and return order data including track_token"""
    try:
        order_data = {
            "items": [
                {
                    "item_id": "test-item-001",
                    "name": "Chicken Biryani",
                    "price": 500,
                    "quantity": 1
                }
            ],
            "customer_name": customer_name,
            "phone": phone,
            "address": "House 12, Block A, DHA Phase 5, Lahore, Punjab",
            "total_price": 500,
            "payment_method": "cod",
            "notes": "Test order for IDOR verification"
        }
        
        response = requests.post(
            f"{BASE_URL}/online-orders",
            headers={"Authorization": f"Bearer {customer_token}"},
            json=order_data,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            order_id = data.get("id")
            track_token = data.get("track_token")
            print(f"✓ Order created: ID={order_id}, track_token={track_token}")
            return data
        else:
            print(f"✗ Order creation failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"✗ Order creation error: {e}")
        return None

def test_track_endpoint(
    test_name: str,
    order_id: str,
    token: Optional[str] = None,
    bearer_token: Optional[str] = None,
    expected_status: int = 200,
    expect_masked: bool = False,
    expect_full: bool = False
) -> Dict:
    """Test the /api/track/{order_id} endpoint with various auth scenarios"""
    try:
        url = f"{BASE_URL}/track/{order_id}"
        if token:
            url += f"?t={token}"
        
        headers = {}
        if bearer_token:
            headers["Authorization"] = f"Bearer {bearer_token}"
        
        response = requests.get(url, headers=headers, timeout=10)
        
        result = {
            "status_code": response.status_code,
            "response": response.text[:500]  # Limit response size
        }
        
        passed = response.status_code == expected_status
        
        details = f"Status: {response.status_code} (expected {expected_status})"
        
        if response.status_code == 200:
            try:
                data = response.json()
                phone = data.get("phone", "")
                address = data.get("address", "")
                customer_name = data.get("customer_name", "")
                
                details += f"\n  Phone: {phone}"
                details += f"\n  Address: {address[:50]}..."
                details += f"\n  Customer Name: {customer_name}"
                
                if expect_masked:
                    # Check if PII is masked
                    phone_masked = "*" in phone
                    address_masked = "…" in address or len(address) <= 20
                    name_masked = " " not in customer_name  # First name only
                    
                    if phone_masked and address_masked and name_masked:
                        details += "\n  ✓ PII is properly MASKED"
                    else:
                        details += f"\n  ✗ PII masking incomplete: phone_masked={phone_masked}, address_masked={address_masked}, name_masked={name_masked}"
                        passed = False
                
                if expect_full:
                    # Check if PII is full (not masked)
                    phone_full = "*" not in phone and len(phone) > 4
                    address_full = "…" not in address and len(address) > 20
                    
                    if phone_full and address_full:
                        details += "\n  ✓ PII is FULL (not masked)"
                    else:
                        details += f"\n  ✗ PII should be full but appears masked: phone_full={phone_full}, address_full={address_full}"
                        passed = False
                        
            except json.JSONDecodeError:
                details += f"\n  Response: {response.text[:200]}"
        else:
            details += f"\n  Response: {response.text[:200]}"
        
        log_test(test_name, passed, details)
        return result
        
    except Exception as e:
        details = f"Exception: {str(e)}"
        log_test(test_name, False, details)
        return {"error": str(e)}

def mutate_order_id(order_id: str) -> str:
    """Mutate the last hex character of an order ID for enumeration testing"""
    if len(order_id) < 24:
        return order_id
    
    last_char = order_id[-1]
    # Increment the last hex character
    if last_char == '9':
        new_char = 'a'
    elif last_char == 'f':
        new_char = '0'
    else:
        try:
            new_char = hex(int(last_char, 16) + 1)[2:]
        except:
            new_char = '0'
    
    return order_id[:-1] + new_char

def main():
    print("=" * 80)
    print("IDOR FIX VERIFICATION TEST SUITE")
    print("Testing GET /api/track/{order_id} with per-order track_token")
    print("=" * 80)
    
    # Step 1: Admin login
    print("\n[STEP 1] Admin Login")
    admin_token = admin_login()
    if not admin_token:
        print("❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Step 2: Disable business hours
    print("\n[STEP 2] Disable Business Hours")
    disable_business_hours(admin_token)
    
    # Step 3: Sign up Customer A
    print("\n[STEP 3] Sign up Customer A")
    customer_a = customer_signup(
        email="customer_a_idor_test@example.com",
        password="SecurePass123!",
        name="Ahmed Khan",
        phone="+923001234567"
    )
    if not customer_a:
        print("❌ CRITICAL: Customer A signup failed. Cannot proceed.")
        sys.exit(1)
    
    # Step 4: Sign up Customer B
    print("\n[STEP 4] Sign up Customer B")
    customer_b = customer_signup(
        email="customer_b_idor_test@example.com",
        password="SecurePass456!",
        name="Fatima Ali",
        phone="+923009876543"
    )
    if not customer_b:
        print("❌ CRITICAL: Customer B signup failed. Cannot proceed.")
        sys.exit(1)
    
    # Step 5: Create order as Customer A
    print("\n[STEP 5] Create Order as Customer A")
    order = create_order(
        customer_token=customer_a["token"],
        customer_name="Ahmed Khan",
        phone="+923001234567"
    )
    if not order:
        print("❌ CRITICAL: Order creation failed. Cannot proceed.")
        sys.exit(1)
    
    order_id = order.get("id")
    track_token = order.get("track_token")
    
    # Test H: Verify track_token is present in order creation response
    print("\n[TEST H] Order Creation Embeds Token")
    if track_token and len(track_token) > 0:
        log_test(
            "Test H - Order creation includes track_token",
            True,
            f"track_token present: {track_token} (length: {len(track_token)})"
        )
    else:
        log_test(
            "Test H - Order creation includes track_token",
            False,
            f"track_token missing or empty in response: {order}"
        )
    
    # Run all track endpoint tests
    print("\n" + "=" * 80)
    print("RUNNING TRACK ENDPOINT TESTS")
    print("=" * 80)
    
    # Test A: No auth, no token
    print("\n[TEST A] No auth, no token")
    test_track_endpoint(
        "Test A - No auth, no token → 404",
        order_id=order_id,
        expected_status=404
    )
    
    # Test B: No auth, wrong token
    print("\n[TEST B] No auth, wrong token")
    test_track_endpoint(
        "Test B - No auth, wrong token → 404",
        order_id=order_id,
        token="AAAAAAAAAAAAAAAAAAAAAA",  # Random 22-char string
        expected_status=404
    )
    
    # Test C: No auth, correct token (should return masked PII)
    print("\n[TEST C] No auth, correct token")
    test_track_endpoint(
        "Test C - No auth, correct token → 200 with MASKED PII",
        order_id=order_id,
        token=track_token,
        expected_status=200,
        expect_masked=True
    )
    
    # Test D: Owner auth, no token (should return full PII)
    print("\n[TEST D] Owner auth, no token")
    test_track_endpoint(
        "Test D - Owner auth, no token → 200 with FULL PII",
        order_id=order_id,
        bearer_token=customer_a["token"],
        expected_status=200,
        expect_full=True
    )
    
    # Test E: Admin auth, no token (should return full PII)
    print("\n[TEST E] Admin auth, no token")
    test_track_endpoint(
        "Test E - Admin auth, no token → 200 with FULL PII",
        order_id=order_id,
        bearer_token=admin_token,
        expected_status=200,
        expect_full=True
    )
    
    # Test F: Different customer auth, no token (should return 404)
    print("\n[TEST F] Different customer auth, no token")
    test_track_endpoint(
        "Test F - Different customer auth, no token → 404",
        order_id=order_id,
        bearer_token=customer_b["token"],
        expected_status=404
    )
    
    # Test G: Enumeration attack simulation
    print("\n[TEST G] Enumeration attack simulation")
    mutated_id = mutate_order_id(order_id)
    print(f"  Original ID: {order_id}")
    print(f"  Mutated ID:  {mutated_id}")
    test_track_endpoint(
        "Test G - Enumeration attack (mutated ID, no auth, no token) → 404",
        order_id=mutated_id,
        expected_status=404
    )
    
    # Additional verification: Check existing endpoints
    print("\n" + "=" * 80)
    print("ADDITIONAL VERIFICATION")
    print("=" * 80)
    
    print("\n[VERIFY] GET /api/online-orders/me (Customer A)")
    try:
        response = requests.get(
            f"{BASE_URL}/online-orders/me",
            headers={"Authorization": f"Bearer {customer_a['token']}"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                first_order = data[0]
                has_track_token = "track_token" in first_order
                log_test(
                    "Verify - /api/online-orders/me includes track_token",
                    has_track_token,
                    f"track_token present: {has_track_token}, order: {first_order.get('id', 'N/A')}"
                )
            else:
                log_test(
                    "Verify - /api/online-orders/me returns orders",
                    False,
                    f"No orders returned: {data}"
                )
        else:
            log_test(
                "Verify - /api/online-orders/me endpoint",
                False,
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
    except Exception as e:
        log_test(
            "Verify - /api/online-orders/me endpoint",
            False,
            f"Exception: {str(e)}"
        )
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    total_tests = len(test_results)
    passed_tests = sum(1 for r in test_results if r["passed"])
    failed_tests = total_tests - passed_tests
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"Passed: {passed_tests} ✅")
    print(f"Failed: {failed_tests} ❌")
    
    if failed_tests > 0:
        print("\n❌ FAILED TESTS:")
        for result in test_results:
            if not result["passed"]:
                print(f"  - {result['test']}")
                print(f"    {result['details'][:200]}")
    
    print("\n" + "=" * 80)
    
    # Exit with appropriate code
    sys.exit(0 if failed_tests == 0 else 1)

if __name__ == "__main__":
    main()
