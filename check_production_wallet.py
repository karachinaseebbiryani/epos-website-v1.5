"""
Production Database Check - Run this against your PRODUCTION MongoDB
This checks if production customers have wallet_balance field
"""
import asyncio
import sys
import os

# Get production MongoDB URI from user
production_uri = input("Enter your PRODUCTION MongoDB URI: ").strip()
if not production_uri:
    print("No URI provided. Using local: mongodb://localhost:27017")
    production_uri = "mongodb://localhost:27017"

db_name = input("Enter database name (default: restopos_db): ").strip() or "restopos_db"

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def check_production():
    client = AsyncIOMotorClient(production_uri)
    db = client[db_name]

    print("\n" + "=" * 70)
    print("PRODUCTION DATABASE CHECK")
    print("=" * 70)
    print(f"Database: {db_name}\n")

    # Check customers
    print("[1] Checking customers...")
    customers = await db.customers.find({}).limit(10).to_list(10)

    if not customers:
        print("  [ERROR] No customers found!")
        client.close()
        return

    print(f"  Found {len(customers)} customers\n")

    customers_without_wallet = []
    for cust in customers:
        has_wallet = "wallet_balance" in cust
        status = "[OK]" if has_wallet else "[MISSING]"
        balance = cust.get("wallet_balance", "N/A")
        print(f"  {status} {cust.get('name', 'Unknown')[:30]:30} Balance: {balance}")

        if not has_wallet:
            customers_without_wallet.append(cust)

    # Check recent orders
    print("\n[2] Checking recent orders...")
    orders = await db.online_orders.find({}).sort("created_at", -1).limit(5).to_list(5)

    for order in orders:
        has_wallet_field = "wallet_applied" in order
        status = "[OK]" if has_wallet_field else "[MISSING]"
        wallet_amt = order.get("wallet_applied", "N/A")
        print(f"  {status} Order {str(order['_id'])[-6:]} - Wallet: {wallet_amt}, Total: {order.get('total_price')}")

    # Migration needed?
    print("\n[3] Migration Status:")
    if customers_without_wallet:
        print(f"  [ACTION NEEDED] {len(customers_without_wallet)} customers need wallet_balance field!")
        print("\n  Would you like to run migration now? (yes/no)")
        choice = input("  > ").strip().lower()

        if choice == "yes":
            print("\n  Running migration...")
            result = await db.customers.update_many(
                {"wallet_balance": {"$exists": False}},
                {"$set": {"wallet_balance": 0.0}}
            )
            print(f"  [OK] Updated {result.modified_count} customers")

            # Verify
            print("\n  Verification:")
            all_customers = await db.customers.find({}).to_list(None)
            for cust in all_customers:
                has_field = "wallet_balance" in cust
                status = "[OK]" if has_field else "[FAIL]"
                print(f"    {status} {cust.get('name', 'Unknown')[:30]}")
        else:
            print("  Skipped migration.")
    else:
        print("  [OK] All customers have wallet_balance field")

    # Check backend version
    print("\n[4] Backend Code Check:")
    print("  To verify your deployed backend has wallet code, check logs:")
    print("  Look for: [WALLET DEBUG] messages in your server logs")
    print("\n  If you don't see these logs, your backend needs to be redeployed.")

    client.close()

    print("\n" + "=" * 70)
    print("NEXT STEPS:")
    print("=" * 70)
    print("1. Ensure all customers have wallet_balance field (run migration above)")
    print("2. Add test balance to a customer for testing:")
    print(f"   db.customers.updateOne({{email: 'test@example.com'}}, {{$set: {{wallet_balance: 500.0}}}}")
    print("3. Redeploy backend if [WALLET DEBUG] logs are missing")
    print("4. Test with a real order and check server logs")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(check_production())
