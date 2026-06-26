#!/usr/bin/env python3
"""
Round 4 Testing: FAQ System + SEO Endpoints
Tests the newly added FAQ CRUD endpoints and SEO endpoints (sitemap.xml, robots.txt)
"""

import requests
import json
from typing import Optional

# Backend URL from frontend/.env
BASE_URL = "https://alert-delivery-2.preview.emergentagent.com/api"

# Admin credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "admin@restaurant.com"
ADMIN_PASSWORD = "admin123"

# Global variables to store tokens and IDs
admin_token: Optional[str] = None
faq_ids: list[str] = []


def print_test(test_name: str, status: int, expected: int, details: str, passed: bool):
    """Print test result in a consistent format"""
    status_icon = "✅" if passed else "❌"
    print(f"\n{status_icon} {test_name}")
    print(f"   Status: {status} (expected {expected})")
    print(f"   {details}")
    print(f"   Result: {'PASS' if passed else 'FAIL'}")


def login_admin():
    """Login as admin and get Bearer token"""
    global admin_token
    print("\n" + "="*80)
    print("SETUP: Admin Login")
    print("="*80)
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    
    if response.status_code == 200:
        data = response.json()
        admin_token = data.get("token")
        print(f"✅ Admin login successful. Token: {admin_token[:20]}...")
        return True
    else:
        print(f"❌ Admin login failed: {response.status_code} - {response.text}")
        return False


def test_f1_get_faqs_public():
    """F1. GET /api/faqs (no auth) → 200, array (may be empty)."""
    print("\n" + "="*80)
    print("TEST F1: GET /api/faqs (public, no auth)")
    print("="*80)
    
    response = requests.get(f"{BASE_URL}/faqs")
    
    passed = response.status_code == 200 and isinstance(response.json(), list)
    details = f"Got {len(response.json())} FAQs" if passed else f"Error: {response.text[:100]}"
    
    print_test("F1 - Public FAQ List", response.status_code, 200, details, passed)
    return passed


def test_f2_create_first_faq():
    """F2. POST /api/admin/faqs (Bearer admin token) with body:
    { "question": "How long is delivery?", "answer": "30 to 45 minutes within 7 km of Chatri Chowk.", "enabled": true }
    EXPECT 200/201. Response must include id (string), sort_order (int), enabled=true. Capture the id."""
    print("\n" + "="*80)
    print("TEST F2: POST /api/admin/faqs (create first FAQ)")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    body = {
        "question": "How long is delivery?",
        "answer": "30 to 45 minutes within 7 km of Chatri Chowk.",
        "enabled": True
    }
    
    response = requests.post(f"{BASE_URL}/admin/faqs", json=body, headers=headers)
    
    if response.status_code in [200, 201]:
        data = response.json()
        faq_id = data.get("id")
        sort_order = data.get("sort_order")
        enabled = data.get("enabled")
        
        passed = (
            isinstance(faq_id, str) and len(faq_id) > 0 and
            isinstance(sort_order, int) and
            enabled is True
        )
        
        if passed:
            faq_ids.append(faq_id)
            details = f"Created FAQ id={faq_id}, sort_order={sort_order}, enabled={enabled}"
        else:
            details = f"Response missing required fields: {data}"
    else:
        passed = False
        details = f"Error: {response.text[:200]}"
    
    print_test("F2 - Create First FAQ", response.status_code, "200/201", details, passed)
    return passed


def test_f3_create_three_more_faqs():
    """F3. Repeat F2 three more times with different questions:
    - { "question": "Do you accept Cash on Delivery?", "answer": "Yes, COD is available city-wide." }
    - { "question": "How do Diamonds work?", "answer": "Earn 10 Diamonds per Rs 100 spent." }
    - { "question": "Can I cancel an order?", "answer": "Within 2 minutes of placing it." }
    Each must succeed and return a unique id + a sort_order strictly greater than the previous one's."""
    print("\n" + "="*80)
    print("TEST F3: Create three more FAQs")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    faqs_to_create = [
        {"question": "Do you accept Cash on Delivery?", "answer": "Yes, COD is available city-wide.", "enabled": True},
        {"question": "How do Diamonds work?", "answer": "Earn 10 Diamonds per Rs 100 spent.", "enabled": True},
        {"question": "Can I cancel an order?", "answer": "Within 2 minutes of placing it.", "enabled": True}
    ]
    
    all_passed = True
    previous_sort_order = -1
    
    for i, faq_body in enumerate(faqs_to_create, start=2):
        response = requests.post(f"{BASE_URL}/admin/faqs", json=faq_body, headers=headers)
        
        if response.status_code in [200, 201]:
            data = response.json()
            faq_id = data.get("id")
            sort_order = data.get("sort_order")
            
            # Check if sort_order is strictly greater than previous
            if previous_sort_order >= 0 and sort_order <= previous_sort_order:
                print(f"   ❌ FAQ {i+1}: sort_order {sort_order} not > previous {previous_sort_order}")
                all_passed = False
            else:
                faq_ids.append(faq_id)
                print(f"   ✅ FAQ {i+1}: Created id={faq_id}, sort_order={sort_order}")
                previous_sort_order = sort_order
        else:
            print(f"   ❌ FAQ {i+1}: Failed with status {response.status_code}")
            all_passed = False
    
    details = f"Created 3 FAQs, total FAQs now: {len(faq_ids)}"
    print_test("F3 - Create Three More FAQs", "200/201", "200/201", details, all_passed)
    return all_passed


def test_f4_get_all_enabled_faqs():
    """F4. GET /api/faqs (no auth) → 200, must include ALL FOUR FAQs in sort_order ascending order."""
    print("\n" + "="*80)
    print("TEST F4: GET /api/faqs - verify all 4 FAQs present")
    print("="*80)
    
    response = requests.get(f"{BASE_URL}/faqs")
    
    if response.status_code == 200:
        faqs = response.json()
        
        # Check if all 4 FAQs are present
        faq_ids_in_response = [f["id"] for f in faqs]
        all_present = all(faq_id in faq_ids_in_response for faq_id in faq_ids)
        
        # Check if sorted by sort_order
        sort_orders = [f["sort_order"] for f in faqs]
        is_sorted = sort_orders == sorted(sort_orders)
        
        passed = all_present and is_sorted and len(faqs) >= 4
        details = f"Got {len(faqs)} FAQs, all 4 present: {all_present}, sorted: {is_sorted}"
    else:
        passed = False
        details = f"Error: {response.text[:200]}"
    
    print_test("F4 - Get All Enabled FAQs", response.status_code, 200, details, passed)
    return passed


def test_f5_disable_and_verify():
    """F5. Disable one (use the third FAQ's id): PUT /api/admin/faqs/{id} body { "enabled": false } → 200.
    Then GET /api/faqs (public) → MUST NOT contain the disabled FAQ.
    Then GET /api/admin/faqs (admin Bearer) → MUST still contain it (with enabled=false)."""
    print("\n" + "="*80)
    print("TEST F5: Disable FAQ and verify visibility")
    print("="*80)
    
    if len(faq_ids) < 3:
        print("   ❌ Not enough FAQs created to test")
        return False
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    faq_to_disable = faq_ids[2]  # Third FAQ (index 2)
    
    # Step 1: Disable the FAQ
    response = requests.put(
        f"{BASE_URL}/admin/faqs/{faq_to_disable}",
        json={"enabled": False},
        headers=headers
    )
    
    if response.status_code != 200:
        print(f"   ❌ Failed to disable FAQ: {response.status_code}")
        return False
    
    print(f"   ✅ Disabled FAQ {faq_to_disable}")
    
    # Step 2: Check public endpoint (should NOT contain disabled FAQ)
    public_response = requests.get(f"{BASE_URL}/faqs")
    if public_response.status_code == 200:
        public_faqs = public_response.json()
        public_ids = [f["id"] for f in public_faqs]
        not_in_public = faq_to_disable not in public_ids
        print(f"   {'✅' if not_in_public else '❌'} Public endpoint excludes disabled FAQ: {not_in_public}")
    else:
        print(f"   ❌ Public endpoint failed: {public_response.status_code}")
        return False
    
    # Step 3: Check admin endpoint (should STILL contain disabled FAQ)
    admin_response = requests.get(f"{BASE_URL}/admin/faqs", headers=headers)
    if admin_response.status_code == 200:
        admin_faqs = admin_response.json()
        admin_ids = [f["id"] for f in admin_faqs]
        in_admin = faq_to_disable in admin_ids
        
        # Find the disabled FAQ and check enabled=false
        disabled_faq = next((f for f in admin_faqs if f["id"] == faq_to_disable), None)
        enabled_is_false = disabled_faq and disabled_faq.get("enabled") is False
        
        print(f"   {'✅' if in_admin else '❌'} Admin endpoint includes disabled FAQ: {in_admin}")
        print(f"   {'✅' if enabled_is_false else '❌'} Disabled FAQ has enabled=false: {enabled_is_false}")
        
        passed = not_in_public and in_admin and enabled_is_false
    else:
        print(f"   ❌ Admin endpoint failed: {admin_response.status_code}")
        return False
    
    details = f"Disabled FAQ {faq_to_disable}, public excludes it, admin includes it with enabled=false"
    print_test("F5 - Disable and Verify", 200, 200, details, passed)
    return passed


def test_f6_update_text():
    """F6. Update text: PUT /api/admin/faqs/{any id} body { "answer": "Changed answer." } → 200.
    Then GET /api/faqs → the same id must now show "Changed answer."."""
    print("\n" + "="*80)
    print("TEST F6: Update FAQ text")
    print("="*80)
    
    if len(faq_ids) < 1:
        print("   ❌ No FAQs to update")
        return False
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    faq_to_update = faq_ids[0]  # First FAQ
    new_answer = "Changed answer."
    
    # Step 1: Update the FAQ
    response = requests.put(
        f"{BASE_URL}/admin/faqs/{faq_to_update}",
        json={"answer": new_answer},
        headers=headers
    )
    
    if response.status_code != 200:
        print(f"   ❌ Failed to update FAQ: {response.status_code}")
        return False
    
    print(f"   ✅ Updated FAQ {faq_to_update}")
    
    # Step 2: Verify the change in public endpoint
    public_response = requests.get(f"{BASE_URL}/faqs")
    if public_response.status_code == 200:
        public_faqs = public_response.json()
        updated_faq = next((f for f in public_faqs if f["id"] == faq_to_update), None)
        
        if updated_faq:
            answer_matches = updated_faq.get("answer") == new_answer
            print(f"   {'✅' if answer_matches else '❌'} Answer updated correctly: {answer_matches}")
            passed = answer_matches
            details = f"Updated FAQ {faq_to_update}, answer now: '{updated_faq.get('answer')}'"
        else:
            print(f"   ❌ Updated FAQ not found in public list")
            passed = False
            details = "FAQ not found after update"
    else:
        print(f"   ❌ Public endpoint failed: {public_response.status_code}")
        passed = False
        details = f"Error: {public_response.text[:200]}"
    
    print_test("F6 - Update Text", response.status_code, 200, details, passed)
    return passed


def test_f7_reorder():
    """F7. Reorder: take the four FAQ ids in their current order (call GET /api/admin/faqs again to get the canonical list), 
    reverse the list, then POST /api/admin/faqs/reorder body { "ids": [<reversed ids>] } → 200.
    Then GET /api/admin/faqs → the list must be in the reversed order, with sort_order values 0, 1, 2, 3 matching the new positions."""
    print("\n" + "="*80)
    print("TEST F7: Reorder FAQs")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 1: Get current order from admin endpoint
    response = requests.get(f"{BASE_URL}/admin/faqs", headers=headers)
    if response.status_code != 200:
        print(f"   ❌ Failed to get FAQs: {response.status_code}")
        return False
    
    current_faqs = response.json()
    current_ids = [f["id"] for f in current_faqs]
    print(f"   Current order: {current_ids}")
    
    # Step 2: Reverse the list
    reversed_ids = list(reversed(current_ids))
    print(f"   Reversed order: {reversed_ids}")
    
    # Step 3: Send reorder request
    reorder_response = requests.post(
        f"{BASE_URL}/admin/faqs/reorder",
        json={"ids": reversed_ids},
        headers=headers
    )
    
    if reorder_response.status_code != 200:
        print(f"   ❌ Failed to reorder: {reorder_response.status_code}")
        return False
    
    print(f"   ✅ Reorder request successful")
    
    # Step 4: Verify new order
    verify_response = requests.get(f"{BASE_URL}/admin/faqs", headers=headers)
    if verify_response.status_code != 200:
        print(f"   ❌ Failed to verify reorder: {verify_response.status_code}")
        return False
    
    new_faqs = verify_response.json()
    new_ids = [f["id"] for f in new_faqs]
    new_sort_orders = [f["sort_order"] for f in new_faqs]
    
    # Check if order matches reversed list
    order_matches = new_ids == reversed_ids
    # Check if sort_order values are 0, 1, 2, 3, ...
    expected_sort_orders = list(range(len(new_faqs)))
    sort_orders_correct = new_sort_orders == expected_sort_orders
    
    print(f"   {'✅' if order_matches else '❌'} Order matches reversed list: {order_matches}")
    print(f"   {'✅' if sort_orders_correct else '❌'} Sort orders are 0,1,2,3...: {sort_orders_correct}")
    print(f"   New order: {new_ids}")
    print(f"   Sort orders: {new_sort_orders}")
    
    passed = order_matches and sort_orders_correct
    details = f"Reordered {len(reversed_ids)} FAQs, order matches: {order_matches}, sort_orders correct: {sort_orders_correct}"
    
    print_test("F7 - Reorder FAQs", reorder_response.status_code, 200, details, passed)
    return passed


def test_f8_delete():
    """F8. DELETE /api/admin/faqs/{id} → 200. Subsequent GET /api/admin/faqs must NOT contain that id."""
    print("\n" + "="*80)
    print("TEST F8: Delete FAQ")
    print("="*80)
    
    if len(faq_ids) < 1:
        print("   ❌ No FAQs to delete")
        return False
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    faq_to_delete = faq_ids[-1]  # Last FAQ
    
    # Step 1: Delete the FAQ
    response = requests.delete(f"{BASE_URL}/admin/faqs/{faq_to_delete}", headers=headers)
    
    if response.status_code != 200:
        print(f"   ❌ Failed to delete FAQ: {response.status_code}")
        return False
    
    print(f"   ✅ Deleted FAQ {faq_to_delete}")
    
    # Step 2: Verify it's gone
    verify_response = requests.get(f"{BASE_URL}/admin/faqs", headers=headers)
    if verify_response.status_code == 200:
        faqs = verify_response.json()
        ids = [f["id"] for f in faqs]
        not_present = faq_to_delete not in ids
        
        print(f"   {'✅' if not_present else '❌'} FAQ not in list after delete: {not_present}")
        passed = not_present
        details = f"Deleted FAQ {faq_to_delete}, not present in subsequent GET"
    else:
        print(f"   ❌ Verify request failed: {verify_response.status_code}")
        passed = False
        details = f"Error: {verify_response.text[:200]}"
    
    print_test("F8 - Delete FAQ", response.status_code, 200, details, passed)
    return passed


def test_f9_authorization():
    """F9. Authorization checks (must each return 403 — admin-only):
    - GET /api/admin/faqs without Authorization header
    - POST /api/admin/faqs without Authorization header
    - PUT /api/admin/faqs/{any id} without Authorization header
    - DELETE /api/admin/faqs/{any id} without Authorization header
    - POST /api/admin/faqs/reorder without Authorization header
    (401 is also acceptable for these — anything in the 4xx range that denies access is fine.)"""
    print("\n" + "="*80)
    print("TEST F9: Authorization checks")
    print("="*80)
    
    test_id = faq_ids[0] if faq_ids else "000000000000000000000000"
    
    tests = [
        ("GET /api/admin/faqs", lambda: requests.get(f"{BASE_URL}/admin/faqs")),
        ("POST /api/admin/faqs", lambda: requests.post(f"{BASE_URL}/admin/faqs", json={"question": "test", "answer": "test"})),
        ("PUT /api/admin/faqs/{id}", lambda: requests.put(f"{BASE_URL}/admin/faqs/{test_id}", json={"answer": "test"})),
        ("DELETE /api/admin/faqs/{id}", lambda: requests.delete(f"{BASE_URL}/admin/faqs/{test_id}")),
        ("POST /api/admin/faqs/reorder", lambda: requests.post(f"{BASE_URL}/admin/faqs/reorder", json={"ids": [test_id]})),
    ]
    
    all_passed = True
    for test_name, test_func in tests:
        response = test_func()
        is_4xx = 400 <= response.status_code < 500
        print(f"   {'✅' if is_4xx else '❌'} {test_name}: {response.status_code} ({'PASS' if is_4xx else 'FAIL'})")
        if not is_4xx:
            all_passed = False
    
    details = "All admin endpoints return 4xx without auth"
    print_test("F9 - Authorization Checks", "4xx", "4xx", details, all_passed)
    return all_passed


def test_f10_validation():
    """F10. Validation:
    - POST /api/admin/faqs with empty question/answer { "question": "", "answer": "" } → 400.
    - PUT /api/admin/faqs/000000000000000000000000 with { "answer": "x" } → 404.
    - DELETE /api/admin/faqs/000000000000000000000000 → 404.
    - PUT /api/admin/faqs/invalid-id-format → 404."""
    print("\n" + "="*80)
    print("TEST F10: Validation checks")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    tests = [
        ("POST empty question/answer", 
         lambda: requests.post(f"{BASE_URL}/admin/faqs", json={"question": "", "answer": ""}, headers=headers),
         400),
        ("PUT non-existent ID", 
         lambda: requests.put(f"{BASE_URL}/admin/faqs/000000000000000000000000", json={"answer": "x"}, headers=headers),
         404),
        ("DELETE non-existent ID", 
         lambda: requests.delete(f"{BASE_URL}/admin/faqs/000000000000000000000000", headers=headers),
         404),
        ("PUT invalid ID format", 
         lambda: requests.put(f"{BASE_URL}/admin/faqs/invalid-id-format", json={"answer": "x"}, headers=headers),
         404),
    ]
    
    all_passed = True
    for test_name, test_func, expected_status in tests:
        response = test_func()
        passed = response.status_code == expected_status
        print(f"   {'✅' if passed else '❌'} {test_name}: {response.status_code} (expected {expected_status})")
        if not passed:
            all_passed = False
    
    details = "All validation checks return expected status codes"
    print_test("F10 - Validation Checks", "various", "various", details, all_passed)
    return all_passed


def test_s1_sitemap_xml():
    """S1. GET /api/sitemap.xml (no auth) → 200. Headers: Content-Type contains "xml".
    Body must start with `<?xml` and contain `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` 
    and at least 6 `<url>` entries.
    Confirm at least these locs are present (substring match): "/menu", "/offers", "/events", "/faq" """
    print("\n" + "="*80)
    print("TEST S1: GET /api/sitemap.xml")
    print("="*80)
    
    response = requests.get(f"{BASE_URL}/sitemap.xml")
    
    if response.status_code == 200:
        content_type = response.headers.get("Content-Type", "")
        body = response.text
        
        checks = {
            "Content-Type contains 'xml'": "xml" in content_type.lower(),
            "Body starts with '<?xml'": body.strip().startswith("<?xml"),
            "Contains <urlset xmlns=...>": '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' in body,
            "At least 6 <url> entries": body.count("<url>") >= 6,
            "Contains /menu": "/menu" in body,
            "Contains /offers": "/offers" in body,
            "Contains /events": "/events" in body,
            "Contains /faq": "/faq" in body,
        }
        
        all_passed = all(checks.values())
        
        print(f"   Content-Type: {content_type}")
        print(f"   <url> count: {body.count('<url>')}")
        for check_name, check_result in checks.items():
            print(f"   {'✅' if check_result else '❌'} {check_name}")
        
        details = f"Content-Type: {content_type}, {body.count('<url>')} <url> entries, all required locs present: {all_passed}"
    else:
        all_passed = False
        details = f"Error: {response.text[:200]}"
    
    print_test("S1 - Sitemap XML", response.status_code, 200, details, all_passed)
    return all_passed


def test_s2_robots_txt():
    """S2. GET /api/robots.txt (no auth) → 200. Headers: Content-Type contains "text/plain".
    Body must contain ALL of these literal substrings:
      "User-agent: *"
      "Disallow: /admin"
      "Sitemap: "
      "GPTBot"
      "PerplexityBot"
      "ClaudeBot" """
    print("\n" + "="*80)
    print("TEST S2: GET /api/robots.txt")
    print("="*80)
    
    response = requests.get(f"{BASE_URL}/robots.txt")
    
    if response.status_code == 200:
        content_type = response.headers.get("Content-Type", "")
        body = response.text
        
        required_strings = [
            "User-agent: *",
            "Disallow: /admin",
            "Sitemap: ",
            "GPTBot",
            "PerplexityBot",
            "ClaudeBot"
        ]
        
        checks = {f"Contains '{s}'": s in body for s in required_strings}
        checks["Content-Type contains 'text/plain'"] = "text/plain" in content_type.lower()
        
        all_passed = all(checks.values())
        
        print(f"   Content-Type: {content_type}")
        for check_name, check_result in checks.items():
            print(f"   {'✅' if check_result else '❌'} {check_name}")
        
        details = f"Content-Type: {content_type}, all required strings present: {all_passed}"
    else:
        all_passed = False
        details = f"Error: {response.text[:200]}"
    
    print_test("S2 - Robots.txt", response.status_code, 200, details, all_passed)
    return all_passed


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("ROUND 4 TESTING: FAQ SYSTEM + SEO ENDPOINTS")
    print("="*80)
    
    # Setup
    if not login_admin():
        print("\n❌ FATAL: Admin login failed. Cannot proceed with tests.")
        return
    
    # FAQ Tests
    results = {}
    results["F1"] = test_f1_get_faqs_public()
    results["F2"] = test_f2_create_first_faq()
    results["F3"] = test_f3_create_three_more_faqs()
    results["F4"] = test_f4_get_all_enabled_faqs()
    results["F5"] = test_f5_disable_and_verify()
    results["F6"] = test_f6_update_text()
    results["F7"] = test_f7_reorder()
    results["F8"] = test_f8_delete()
    results["F9"] = test_f9_authorization()
    results["F10"] = test_f10_validation()
    
    # SEO Tests
    results["S1"] = test_s1_sitemap_xml()
    results["S2"] = test_s2_robots_txt()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed_count = sum(1 for v in results.values() if v)
    total_count = len(results)
    
    print(f"\nTotal: {passed_count}/{total_count} tests passed\n")
    
    for test_name, passed in results.items():
        status_icon = "✅" if passed else "❌"
        print(f"{status_icon} {test_name}: {'PASS' if passed else 'FAIL'}")
    
    print("\n" + "="*80)
    if passed_count == total_count:
        print("🎉 ALL TESTS PASSED!")
    else:
        print(f"⚠️  {total_count - passed_count} test(s) failed")
    print("="*80)


if __name__ == "__main__":
    main()
