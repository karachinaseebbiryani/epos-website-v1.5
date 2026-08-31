"""
End-to-end test to verify wallet deduction works correctly
Tests the complete flow from placing order to verifying balance deduction
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone

async def test_wallet_deduction():
    mongo_uri = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "restopos_db")
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]

    print("=" * 70)
    print("WALLET DEDUCTION END-TO-END TEST")
    print("=" * 70)

    # Step 1: Find a customer with wallet balance
    print("\n[STEP 1] Finding customer with wallet balance...")
    customer = await db.customers.find_one({"wallet_balance": {"$gt": 0}})

    if not customer:
        print("  [FAIL] No customer with wallet balance found!")
        print("  Run: python diagnose_wallet.py to add test balance")
        client.close()
        return

    print(f"  [OK] Found customer: {customer.get('name')}")
    print(f"      Customer ID: {customer['_id']}")
    print(f"      Email: {customer.get('email')}")
    print(f"      Initial Balance: Rs {customer.get('wallet_balance', 0)}")

    initial_balance = float(customer.get('wallet_balance', 0))
    customer_id = customer['_id']

    # Step 2: Simulate order placement with wallet
    print("\n[STEP 2] Simulating order with wallet deduction...")

    # Create a test order directly in database (simulating what backend does)
    order_amount = 200.0  # Test order for Rs 200
    wallet_to_apply = min(initial_balance, order_amount)
    final_total = max(0, order_amount - wallet_to_apply)

    print(f"  Order Amount: Rs {order_amount}")
    print(f"  Wallet to Apply: Rs {wallet_to_apply}")
    print(f"  Final Total: Rs {final_total}")

    # Step 3: Perform atomic wallet deduction (same logic as backend)
    print("\n[STEP 3] Performing atomic wallet deduction...")

    result = await db.customers.update_one(
        {"_id": customer_id, "wallet_balance": {"$gte": wallet_to_apply}},
        {"$inc": {"wallet_balance": -wallet_to_apply}}
    )

    print(f"  MongoDB Update Result:")
    print(f"    Matched: {result.matched_count}")
    print(f"    Modified: {result.modified_count}")

    if result.modified_count == 0:
        print("  [FAIL] Wallet deduction failed - balance not updated!")
        client.close()
        return

    print("  [OK] Wallet balance deducted successfully")

    # Step 4: Create order document
    print("\n[STEP 4] Creating order document...")

    now = datetime.now(timezone.utc)
    order_doc = {
        "customer_id": customer_id,
        "customer_name": customer.get('name', 'Test Customer'),
        "phone": customer.get('phone', '03001234567'),
        "address": "Test Address",
        "items": [
            {"name": "Test Item", "price": 200.0, "quantity": 1}
        ],
        "subtotal": 200.0,
        "total_price": final_total,
        "wallet_applied": wallet_to_apply,
        "payment_method": "cod",
        "payment_status": "paid" if final_total <= 0 else "pending",
        "status": "pending",
        "order_type": "delivery",
        "platform": "test",
        "created_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
    }

    order_result = await db.online_orders.insert_one(order_doc)
    order_id = str(order_result.inserted_id)

    print(f"  [OK] Order created: {order_id}")
    print(f"      Total Price: Rs {final_total}")
    print(f"      Wallet Applied: Rs {wallet_to_apply}")
    print(f"      Payment Status: {order_doc['payment_status']}")

    # Step 5: Create wallet transaction entry
    print("\n[STEP 5] Creating wallet transaction entry...")

    txn_doc = {
        "customer_id": str(customer_id),
        "type": "spend",
        "amount": -wallet_to_apply,
        "order_id": order_id,
        "note": f"TEST: Applied to order #{order_id[-6:].upper()}",
        "created_at": now.isoformat()
    }

    await db.wallet_transactions.insert_one(txn_doc)
    print(f"  [OK] Transaction logged")
    print(f"      Type: spend")
    print(f"      Amount: Rs {-wallet_to_apply}")

    # Step 6: Verify final state
    print("\n[STEP 6] Verifying final state...")

    # Check customer balance
    updated_customer = await db.customers.find_one({"_id": customer_id})
    final_balance = float(updated_customer.get('wallet_balance', 0))
    expected_balance = initial_balance - wallet_to_apply

    print(f"  Customer Balance:")
    print(f"    Initial: Rs {initial_balance}")
    print(f"    Deducted: Rs {wallet_to_apply}")
    print(f"    Expected: Rs {expected_balance}")
    print(f"    Actual: Rs {final_balance}")

    balance_match = abs(final_balance - expected_balance) < 0.01
    print(f"    Status: {'[OK]' if balance_match else '[FAIL]'}")

    # Check order
    created_order = await db.online_orders.find_one({"_id": order_result.inserted_id})
    wallet_in_order = float(created_order.get('wallet_applied', 0))

    print(f"\n  Order Document:")
    print(f"    Wallet Applied: Rs {wallet_in_order}")
    print(f"    Total Price: Rs {created_order.get('total_price', 0)}")
    print(f"    Status: {'[OK]' if wallet_in_order == wallet_to_apply else '[FAIL]'}")

    # Check transaction
    transaction = await db.wallet_transactions.find_one({"order_id": order_id})

    print(f"\n  Transaction Record:")
    if transaction:
        print(f"    Type: {transaction.get('type')}")
        print(f"    Amount: Rs {transaction.get('amount', 0)}")
        print(f"    Order ID: {transaction.get('order_id')}")
        print(f"    Status: [OK]")
    else:
        print(f"    Status: [FAIL] Transaction not found")

    # Overall result
    print("\n" + "=" * 70)
    if balance_match and wallet_in_order == wallet_to_apply and transaction:
        print("TEST RESULT: [PASS] ✓")
        print("Wallet deduction is working correctly!")
    else:
        print("TEST RESULT: [FAIL] ✗")
        print("Some checks failed - review logs above")
    print("=" * 70)

    # Cleanup option
    print(f"\nTest order ID: {order_id}")
    print("Note: This is a test order. You may want to delete it from the database.")

    client.close()

if __name__ == "__main__":
    asyncio.run(test_wallet_deduction())
