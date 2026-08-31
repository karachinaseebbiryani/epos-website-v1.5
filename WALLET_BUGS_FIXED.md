# Wallet Deduction Bugs - FIXED

## Bug #1: Backend - ObjectId Type Mismatch (CRITICAL)

### Root Cause
`get_current_customer()` converts customer `_id` from ObjectId to string (line 3394):
```python
cust["_id"] = str(cust["_id"])
```

But the wallet deduction code was using this string directly in MongoDB query:
```python
{"_id": cust["_id"], ...}  # String, but DB has ObjectId
```

MongoDB doesn't implicitly cast between ObjectId and string, so the query never matched any document → `matched=0, modified=0`.

### Fix Applied
**File:** `backend/server.py`  
**Line:** 4567

```python
# BEFORE
{"_id": cust["_id"], "wallet_balance": {"$gte": applied}}

# AFTER
{"_id": ObjectId(cust["_id"]), "wallet_balance": {"$gte": applied}}
```

### Symptoms This Fixes
- ✅ Wallet balance will now actually deduct from database
- ✅ Order `wallet_applied` will be > 0
- ✅ Order `total_price` will reflect reduced amount
- ✅ `wallet_transactions` entry will be created
- ✅ Payment status will be "paid" when fully covered by wallet

---

## Bug #2: Mobile App - Missing `walletApplied` Field (DISPLAY)

### Root Cause
The tracking screen (order_tracking_screen.dart) uses `order.walletApplied`, but the Order class never declared or parsed this field from JSON.

### Fix Applied
**File:** `mobile/lib/features/orders/order_models.dart`

**1. Added to constructor (line 81):**
```dart
this.walletApplied = 0.0,
```

**2. Added field declaration (line 102):**
```dart
final double walletApplied;
```

**3. Added to fromJson (line 138):**
```dart
walletApplied: _toDouble(j['wallet_applied']),
```

### Symptoms This Fixes
- ✅ Mobile tracking screen will now display "Wallet credit: −Rs. X"
- ✅ Mobile app will compile without errors
- ✅ Total will correctly show as "Amount paid/due" with wallet deduction

---

## Deployment Steps

### 1. Backend (CRITICAL - Deploy First)
```bash
cd D:\epos-website-v1.5\backend
fly deploy
```

Wait 2-3 minutes for deployment.

### 2. Mobile App (Rebuild Required)
```bash
cd D:\epos-website-v1.5\mobile
flutter clean
flutter pub get
flutter build apk --release
# Distribute new APK to users
```

### 3. Web Frontend (No Changes Needed)
The web app already handles `wallet_applied` correctly - no deployment needed.

---

## Verification Steps

### Step 1: Check Backend Logs
After deploying backend, place a test order and check logs:

```bash
fly logs
```

**Expected output:**
```
[WALLET DEBUG] use_wallet=True, cust=present, final_total=700.0
[WALLET DEBUG] customer wallet_balance=500.0, will_apply=500.0
[WALLET DEBUG] MongoDB update result: matched=1, modified=1  ← KEY FIX!
[WALLET DEBUG] SUCCESS: wallet_applied=500.0, new final_total=200.0
```

**Before fix:** `matched=0, modified=0`  
**After fix:** `matched=1, modified=1` ✓

### Step 2: Verify Database Changes

```javascript
// Check customer balance
db.customers.findOne({email: "test@example.com"})
// Before: wallet_balance: 500
// After: wallet_balance: 0  ✓

// Check order
db.online_orders.find().sort({created_at: -1}).limit(1)
// wallet_applied: 500  ✓
// total_price: 200  ✓
// payment_status: "pending" (for 200 remainder) ✓

// Check transaction
db.wallet_transactions.find().sort({created_at: -1}).limit(1)
// type: "spend"
// amount: -500  ✓
```

### Step 3: Web UI Verification
- Checkout page shows wallet deduction preview
- Tracking page shows "Wallet used: −Rs. 500"
- Admin panel shows wallet deduction line
- Total reflects reduced amount

### Step 4: Mobile UI Verification (After Rebuild)
- Tracking screen shows "Wallet credit: −Rs. 500"
- "Amount paid/due" shows reduced total
- Payment method shows "WALLET/CREDIT" if fully paid

---

## Test Scenario

**Setup:**
- Customer has Rs. 500 wallet balance
- Order total: Rs. 700

**Expected Results:**

| Field | Value |
|-------|-------|
| Order `wallet_applied` | Rs. 500 |
| Order `total_price` | Rs. 200 |
| Order `payment_status` | "pending" (still need to pay Rs. 200) |
| Order `payment_method` | "pay_at_restaurant" (or chosen method) |
| Customer `wallet_balance` | Rs. 0 (500 deducted) |
| Transaction created | Yes, type="spend", amount=-500 |
| Backend logs | matched=1, modified=1 |

---

## Root Cause Summary

**Why this wasn't caught earlier:**
1. Local testing worked because we always tested with fresh database queries that returned ObjectId directly
2. The API layer converts ObjectId to string for JSON serialization, but the conversion happens BEFORE the wallet logic runs
3. The silent failure (`matched=0`) was logged as a "race condition" warning, not an error
4. Frontend preview calculation worked (client-side), masking the backend failure

**Why refunds worked but wallet didn't:**
The refund code (line 8133) correctly wraps with `ObjectId(str(cid))` - wallet code was missing this wrap.

---

## Prevention

Added to code review checklist:
- ✅ Always wrap string IDs with `ObjectId()` in MongoDB queries
- ✅ Verify `matched_count > 0` after critical updates
- ✅ Add assertions in tests for atomic operations
- ✅ Ensure mobile models parse all fields used in UI

---

**Status:** ✅ FIXED  
**Deploy Status:** ⏳ Pending backend deployment  
**Files Modified:**
- `backend/server.py` (1 line)
- `mobile/lib/features/orders/order_models.dart` (3 additions)
