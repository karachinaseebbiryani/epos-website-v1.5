# Wallet Not Working in Production - Diagnostic Guide

## Current Situation
- ✅ Local test passes (wallet deducts correctly)
- ❌ Production: Payment status shows "pending" with "pay_at_restaurant"
- ❌ Wallet balance NOT deducted in production

## Root Cause Analysis

### Issue 1: Production Database Missing `wallet_balance` Field
**Local DB:** Has `wallet_balance` field (we ran migration)
**Production DB:** Likely MISSING this field

When customers don't have `wallet_balance` field:
- Backend reads `cust.get("wallet_balance", 0)` → defaults to 0
- Applied amount = min(0, total) = 0
- No wallet deduction happens
- Order proceeds without wallet

### Issue 2: Production Backend May Be Outdated
The wallet deduction code exists in your local `server.py` but production may be running an older version.

## Step-by-Step Fix

### Step 1: Check Production Database

Run this script and provide your **PRODUCTION** MongoDB URI:

```bash
python check_production_wallet.py
```

This will:
- ✓ Check if customers have `wallet_balance` field
- ✓ Show recent orders with wallet info
- ✓ Offer to run migration automatically

**Expected Issue:** Customers missing `wallet_balance` field

### Step 2: Run Migration on Production Database

**Option A - Using the script (Recommended):**
```bash
python check_production_wallet.py
# Answer "yes" when asked to run migration
```

**Option B - Manually via MongoDB:**
```javascript
// Connect to your production MongoDB
use restopos_db  // or your database name

// Add wallet_balance to all customers
db.customers.updateMany(
  { wallet_balance: { $exists: false } },
  { $set: { wallet_balance: 0.0 } }
)

// Verify
db.customers.find({}).forEach(function(c) {
  print(c.name + ": " + c.wallet_balance)
})
```

### Step 3: Add Test Balance to a Customer

In production MongoDB:
```javascript
// Find a customer
db.customers.find({ email: "your-test-email@gmail.com" })

// Add test balance
db.customers.updateOne(
  { email: "your-test-email@gmail.com" },
  { $set: { wallet_balance: 500.0 } }
)

// Verify
db.customers.findOne({ email: "your-test-email@gmail.com" })
```

### Step 4: Verify Backend Has Wallet Code

Check your production backend logs for `[WALLET DEBUG]` messages:

**If deployed on Fly.io:**
```bash
cd backend
fly logs
```

**If deployed elsewhere:**
Check your server logs after placing a test order.

**Look for:**
```
[WALLET DEBUG] use_wallet=True, cust=present, final_total=450.0
[WALLET DEBUG] customer wallet_balance=500.0, will_apply=450.0
[WALLET DEBUG] MongoDB update result: matched=1, modified=1
[WALLET DEBUG] SUCCESS: wallet_applied=450.0, new final_total=0.0
```

**If you DON'T see these logs:** Your backend code is outdated.

### Step 5: Redeploy Backend (if needed)

If logs show no `[WALLET DEBUG]` messages:

```bash
cd D:\epos-website-v1.5\backend
fly deploy
```

Wait 2-3 minutes for deployment to complete.

### Step 6: Test Again

1. Login as the customer with wallet balance
2. Add items to cart (e.g., Rs 200 order)
3. Go to checkout
4. **Check the "Use wallet credit" checkbox**
5. Place order
6. Check logs immediately: `fly logs`
7. Verify customer wallet balance decreased

## Common Issues & Solutions

### Issue: Checkbox Not Showing
**Cause:** Customer `wallet_balance` is 0 or missing
**Solution:** Add balance using Step 3

### Issue: Checkbox Showing But Balance Not Deducting
**Cause:** Production database missing `wallet_balance` field
**Solution:** Run Step 2 migration

### Issue: No Debug Logs
**Cause:** Backend code outdated
**Solution:** Redeploy backend (Step 5)

### Issue: "use_wallet=False" in logs
**Cause:** Frontend not sending the flag
**Solution:** Check frontend is sending `use_wallet: true` in API call

### Issue: "cust=None" in logs
**Cause:** Customer not authenticated
**Solution:** Ensure customer is logged in before checkout

## Verification Checklist

After running all fixes:

- [ ] Production DB: All customers have `wallet_balance` field
- [ ] Production DB: Test customer has balance > 0 (e.g., 500)
- [ ] Backend logs show `[WALLET DEBUG]` messages
- [ ] Test order: Checkbox appears at checkout
- [ ] Test order: Balance deducts after order placed
- [ ] Order document has `wallet_applied` > 0
- [ ] Order `payment_status` = "paid" (if fully covered)
- [ ] `wallet_transactions` collection has entry

## Quick Test Command

After fixes, run this to verify:

```bash
# Check production DB
python check_production_wallet.py

# Place test order
# Then immediately check logs
fly logs

# Verify in DB
mongo <your-connection-string>
use restopos_db
db.customers.findOne({ email: "test@example.com" })
db.online_orders.find().sort({ created_at: -1 }).limit(1)
db.wallet_transactions.find().sort({ created_at: -1 }).limit(1)
```

## Most Likely Fix

Based on your issue ("still same issue even deployed"), the problem is:

**You ran the migration locally but NOT on production database.**

Run:
```bash
python check_production_wallet.py
```

And answer "yes" to run the migration on production.

---

**Need Help?** Share:
1. Output of `python check_production_wallet.py`
2. Backend logs after placing test order
3. Customer's wallet_balance from production DB
