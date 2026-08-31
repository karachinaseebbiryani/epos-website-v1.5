"""
Test script to verify wallet balance deduction flow
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import json

async def test_wallet_flow():
    # Connect to MongoDB
    mongo_uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_uri)
    db = client.epos_db

    print("=" * 60)
    print("WALLET BALANCE INVESTIGATION")
    print("=" * 60)

    # Find recent orders with wallet_applied field
    print("\n1. Checking recent orders with wallet usage...")
    recent_orders = await db.online_orders.find({
        "wallet_applied": {"$exists": True}
    }).sort("created_at", -1).limit(5).to_list(5)

    for order in recent_orders:
        print(f"\nOrder ID: {order['_id']}")
        print(f"  Customer ID: {order.get('customer_id')}")
        print(f"  Total Price: Rs {order.get('total_price', 0)}")
        print(f"  Wallet Applied: Rs {order.get('wallet_applied', 0)}")
        print(f"  Payment Status: {order.get('payment_status')}")
        print(f"  Status: {order.get('status')}")
        print(f"  Created: {order.get('created_at')}")

        # Check if customer exists and their current balance
        if order.get('customer_id'):
            try:
                cust_id = order['customer_id'] if isinstance(order['customer_id'], ObjectId) else ObjectId(str(order['customer_id']))
                customer = await db.customers.find_one({"_id": cust_id})
                if customer:
                    print(f"  Customer Balance Now: Rs {customer.get('wallet_balance', 0)}")
                    print(f"  Customer Email: {customer.get('email', 'N/A')}")
            except Exception as e:
                print(f"  Error fetching customer: {e}")

    # Check wallet transactions
    print("\n2. Checking wallet transaction history...")
    transactions = await db.wallet_transactions.find({}).sort("created_at", -1).limit(10).to_list(10)

    if not transactions:
        print("  No wallet transactions found!")
    else:
        for txn in transactions:
            print(f"\nTransaction ID: {txn['_id']}")
            print(f"  Customer ID: {txn.get('customer_id')}")
            print(f"  Type: {txn.get('type')}")
            print(f"  Amount: Rs {txn.get('amount', 0)}")
            print(f"  Order ID: {txn.get('order_id', 'N/A')}")
            print(f"  Note: {txn.get('note', 'N/A')}")
            print(f"  Created: {txn.get('created_at')}")

    # Check customers with wallet balance
    print("\n3. Checking customers with wallet balance...")
    customers_with_balance = await db.customers.find({
        "wallet_balance": {"$gt": 0}
    }).limit(5).to_list(5)

    if not customers_with_balance:
        print("  No customers with wallet balance found!")
    else:
        for cust in customers_with_balance:
            print(f"\nCustomer ID: {cust['_id']}")
            print(f"  Name: {cust.get('name', 'N/A')}")
            print(f"  Email: {cust.get('email', 'N/A')}")
            print(f"  Phone: {cust.get('phone', 'N/A')}")
            print(f"  Wallet Balance: Rs {cust.get('wallet_balance', 0)}")

    client.close()

if __name__ == "__main__":
    asyncio.run(test_wallet_flow())
