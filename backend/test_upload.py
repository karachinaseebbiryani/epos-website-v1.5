#!/usr/bin/env python3
"""Test payment screenshot upload functionality"""
import requests
import json
import io

base = 'http://localhost:8001/api'

print("=" * 60)
print("Testing Payment Upload System")
print("=" * 60)

# Step 1: Register/login as customer
print("\n1. Customer Registration...")
resp = requests.post(f'{base}/customer/register', json={
    'email': 'testupload@test.com',
    'password': 'test123',
    'name': 'Upload Test User',
    'phone': '03001234567'
})
print(f"   Register: {resp.status_code}")

resp = requests.post(f'{base}/customer/login', json={
    'email': 'testupload@test.com',
    'password': 'test123'
})
if resp.status_code == 200:
    token = resp.json().get('token')
    print(f"   Login: ✅ Token acquired")
else:
    print(f"   Login failed: {resp.status_code}")
    exit(1)

# Step 2: Get menu
print("\n2. Fetching menu...")
resp = requests.get(f'{base}/menu-items')
menu = resp.json() if isinstance(resp.json(), list) else []
print(f"   Menu items available: {len(menu)}")

if not menu:
    print("   ❌ No menu items found. Cannot test.")
    exit(1)

# Step 3: Create test order
print("\n3. Creating test order...")
item = menu[0]
order_data = {
    'items': [{
        'item_id': item['id'],
        'quantity': 1,
        'price': item['price'],
        'name': item['name']
    }],
    'subtotal': item['price'],
    'tax': 0,
    'total_price': item['price'],
    'address': 'Test Address for Upload',
    'phone': '03001234567',
    'customer_name': 'Upload Test User',
    'payment_method': 'bank_transfer',
    'delivery_fee': 0,
    'special_instructions': 'Test order for upload'
}
resp = requests.post(f'{base}/online-orders',
                    headers={'Authorization': f'Bearer {token}'},
                    json=order_data)
if resp.status_code in [200, 201]:
    order = resp.json()
    order_id = order['id']
    print(f"   Order created: ✅ ID={order_id}")
else:
    print(f"   ❌ Order creation failed: {resp.status_code} - {resp.text}")
    exit(1)

# Step 4: Upload payment screenshot
print("\n4. Uploading payment screenshot...")
# Create a minimal valid 1x1 PNG image
png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

files = {'file': ('payment_proof.png', io.BytesIO(png_data), 'image/png')}
resp = requests.post(f'{base}/online-orders/{order_id}/payment-screenshot', files=files)

print(f"   Upload status: {resp.status_code}")
if resp.status_code == 200:
    result = resp.json()
    print(f"   Upload result: {json.dumps(result, indent=2)}")
    
    # Check if file exists locally
    import os
    storage_path = result.get('path', '')
    local_path = f"/app/backend/uploads/{storage_path}"
    if os.path.exists(local_path):
        print(f"   ✅ File stored locally at: {local_path}")
        print(f"   ✅ File size: {os.path.getsize(local_path)} bytes")
    else:
        print(f"   ⚠️  File stored in cloud (path: {storage_path})")
    
    print("\n" + "=" * 60)
    print("✅ PAYMENT UPLOAD TEST PASSED")
    print("=" * 60)
else:
    print(f"   ❌ Upload failed: {resp.status_code}")
    print(f"   Error: {resp.text}")
    print("\n" + "=" * 60)
    print("❌ PAYMENT UPLOAD TEST FAILED")
    print("=" * 60)
    exit(1)

# Step 5: Verify order was updated
print("\n5. Verifying order update...")
resp = requests.get(f'{base}/online-orders/{order_id}',
                   headers={'Authorization': f'Bearer {token}'})
if resp.status_code == 200:
    order_check = resp.json()
    if order_check.get('payment_screenshot_path'):
        print(f"   ✅ Order updated with screenshot path")
    else:
        print(f"   ⚠️  Order not updated with screenshot path")
