"""
Migration script to add wallet_balance field to all existing customers
This ensures the wallet feature works for all users
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from motor.motor_asyncio import AsyncIOMotorClient

async def migrate():
    mongo_uri = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "restopos_db")
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]

    print("=" * 60)
    print("WALLET BALANCE MIGRATION")
    print("=" * 60)
    print(f"Database: {db_name}\n")

    # Find customers without wallet_balance field
    customers_without_wallet = await db.customers.find({
        "wallet_balance": {"$exists": False}
    }).to_list(None)

    if not customers_without_wallet:
        print("All customers already have wallet_balance field.")
        client.close()
        return

    print(f"Found {len(customers_without_wallet)} customers without wallet_balance field\n")

    # Update all customers to have wallet_balance: 0.0
    result = await db.customers.update_many(
        {"wallet_balance": {"$exists": False}},
        {"$set": {"wallet_balance": 0.0}}
    )

    print(f"Updated {result.modified_count} customers")
    print(f"Matched {result.matched_count} customers\n")

    # Verify
    print("Verification:")
    all_customers = await db.customers.find({}).to_list(None)
    for cust in all_customers:
        has_field = "wallet_balance" in cust
        balance = cust.get("wallet_balance", "MISSING")
        status = "[OK]" if has_field else "[FAIL]"
        print(f"  {status} {cust.get('name', 'Unknown')[:30]:30} - Balance: Rs {balance}")

    client.close()
    print("\n" + "=" * 60)
    print("Migration completed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(migrate())
