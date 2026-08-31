"""
Comprehensive wallet diagnostic and test customer setup
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def diagnose():
    mongo_uri = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "restopos_db")
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]

    print(f"MongoDB URI: {mongo_uri}")
    print(f"Database: {db_name}")

    print("=" * 60)
    print("WALLET SYSTEM DIAGNOSTIC")
    print("=" * 60)

    # Check all customers
    print("\n1. Checking ALL customers...")
    customers = await db.customers.find({}).limit(10).to_list(10)

    if not customers:
        print("  [X] No customers found in database!")
    else:
        print(f"  [OK] Found {len(customers)} customers")
        for cust in customers:
            print(f"\n  Customer: {cust.get('name', 'N/A')}")
            print(f"    ID: {cust['_id']}")
            print(f"    Email: {cust.get('email', 'N/A')}")
            print(f"    Phone: {cust.get('phone', 'N/A')}")
            print(f"    Wallet Balance: Rs {cust.get('wallet_balance', 0)}")

            # Check if wallet_balance field exists
            if 'wallet_balance' not in cust:
                print(f"    [WARNING] wallet_balance field is MISSING!")

    # Check recent orders
    print("\n2. Checking recent orders...")
    orders = await db.online_orders.find({}).sort("created_at", -1).limit(5).to_list(5)

    if not orders:
        print("  [X] No orders found!")
    else:
        print(f"  [OK] Found {len(orders)} recent orders")
        for order in orders:
            print(f"\n  Order: {order['_id']}")
            print(f"    Customer ID: {order.get('customer_id', 'N/A')}")
            print(f"    Total: Rs {order.get('total_price', 0)}")
            print(f"    Payment Method: {order.get('payment_method', 'N/A')}")
            print(f"    Payment Status: {order.get('payment_status', 'N/A')}")

            # Check if wallet fields exist
            if 'wallet_applied' in order:
                print(f"    Wallet Applied: Rs {order.get('wallet_applied', 0)}")
            else:
                print(f"    [WARNING] wallet_applied field MISSING!")

            if 'use_wallet' in order:
                print(f"    Use Wallet Flag: {order.get('use_wallet')}")

    # Check database collections
    print("\n3. Checking database collections...")
    collections = await db.list_collection_names()

    if 'wallet_transactions' in collections:
        print("  [OK] wallet_transactions collection exists")
        count = await db.wallet_transactions.count_documents({})
        print(f"    Documents: {count}")
    else:
        print("  [X] wallet_transactions collection MISSING!")

    if 'customers' in collections:
        print("  [OK] customers collection exists")
        count = await db.customers.count_documents({})
        print(f"    Documents: {count}")

    # Test: Add wallet balance to first customer for testing
    print("\n4. Would you like to add test wallet balance?")
    if customers:
        first_customer = customers[0]
        print(f"\n  Suggested: Add Rs 500 to {first_customer.get('name', 'customer')}")
        print(f"  Customer ID: {first_customer['_id']}")
        print(f"  Current Balance: Rs {first_customer.get('wallet_balance', 0)}")

        # Add wallet balance for testing
        result = await db.customers.update_one(
            {"_id": first_customer["_id"]},
            {"$set": {"wallet_balance": 500.0}}
        )

        if result.modified_count > 0:
            print(f"  [OK] Added Rs 500 wallet balance for testing")

            # Verify
            updated = await db.customers.find_one({"_id": first_customer["_id"]})
            print(f"  New Balance: Rs {updated.get('wallet_balance', 0)}")
        else:
            print(f"  [INFO] Balance already set or update failed")

    client.close()

if __name__ == "__main__":
    asyncio.run(diagnose())
