# Wallet Debug Deployment Guide

## What Was Changed

Added detailed logging to `backend/server.py` (lines 4547-4586) to diagnose why wallet deduction might not be working:

```python
logger.info(f"[WALLET DEBUG] use_wallet={use_wallet_flag}, cust={'present' if cust else 'None'}, final_total={final_total}")
logger.info(f"[WALLET DEBUG] customer wallet_balance={balance}, will_apply={applied}")
logger.info(f"[WALLET DEBUG] MongoDB update result: matched={res.matched_count}, modified={res.modified_count}")
logger.info(f"[WALLET DEBUG] SUCCESS: wallet_applied={wallet_applied}, new final_total={final_total}")
```

## Deploy to Fly.io Backend

From the `backend/` directory:

```bash
cd D:\epos-website-v1.5\backend
fly deploy
```

Wait for deployment to complete (takes ~2-3 minutes).

## Test the Wallet Flow

1. **Place a test order** with wallet credit enabled:
   - Make sure you're signed in
   - Cart total: Rs. 450
   - Wallet balance: Rs. 500
   - Order type: Pickup
   - Enable "Use wallet credit" toggle
   - Place order

2. **Check the logs immediately** after placing order:

```bash
fly logs
```

Look for lines starting with `[WALLET DEBUG]`:

### Expected Good Output:
```
[WALLET DEBUG] use_wallet=True, cust=present, final_total=450.0
[WALLET DEBUG] customer wallet_balance=500.0, will_apply=450.0
[WALLET DEBUG] MongoDB update result: matched=1, modified=1
[WALLET DEBUG] SUCCESS: wallet_applied=450.0, new final_total=0.0
[WALLET DEBUG] Order fully paid via wallet, payment_status=paid
```

### Bad Scenarios:

**If you see:**
```
[WALLET DEBUG] use_wallet=False, skipping wallet logic
```
→ Frontend is not sending `use_wallet: true` (but this should be fixed already)

**If you see:**
```
[WALLET DEBUG] use_wallet=True, cust=None, skipping wallet logic
```
→ Customer is not found in database (auth issue)

**If you see:**
```
[WALLET DEBUG] MongoDB update result: matched=0, modified=0
```
→ Race condition or customer doesn't have enough balance

**If you see:**
```
[WALLET DEBUG] MongoDB update result: matched=1, modified=0
```
→ Database filter failed (wallet_balance < applied amount)

## After Confirming Backend Works

Once the logs show wallet is being deducted correctly, deploy the frontend changes:

1. **Build frontend:**
```bash
cd D:\epos-website-v1.5\frontend
npm run build
```

2. **Deploy to Vercel:**
   - Go to Vercel dashboard
   - Click "Redeploy" on your project
   - OR: Push to GitHub (if connected)

3. **Rebuild mobile app:**
   - User builds in Android Studio themselves (see memory: mobile-builds)
   - Changes needed are in `mobile/lib/features/orders/order_tracking_screen.dart`

## Verification Checklist

After all deployments:

- [ ] Backend logs show `[WALLET DEBUG] SUCCESS: wallet_applied=450.0`
- [ ] Customer's wallet balance decreased (500 → 50)
- [ ] Order `total_price` = 0
- [ ] Order `wallet_applied` = 450
- [ ] Order `payment_status` = "paid"
- [ ] Admin panel shows: Original Total Rs. 450, Wallet: −Rs. 450, Payment: WALLET/CREDIT
- [ ] Tracking page shows: Wallet used: −Rs. 450, Amount Paid: Rs. 0 (Paid via Wallet)
- [ ] Mobile app shows: Wallet credit: −Rs. 450, Amount paid/due: Rs. 0, Payment: WALLET/CREDIT
