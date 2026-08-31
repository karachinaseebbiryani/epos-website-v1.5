# Wallet Payment Display Fixes

## Summary
Fixed wallet payment logic for pickup orders to correctly display wallet credit usage across all platforms.

## Backend (Already Working Correctly)
- ✅ Deducts wallet credit atomically
- ✅ Sets `payment_status: "paid"` when wallet covers full amount
- ✅ Saves `wallet_applied` amount in order document
- ✅ Updates customer's wallet balance

## Frontend Changes Made

### 1. Web Checkout Page (`frontend/src/pages/CheckoutPage.jsx`)
**Changes:**
- Added wallet credit calculation: `walletWillApply` and `finalAmountToPay`
- Display "👛 Wallet Credit: − Rs. X" line in order summary
- Show "Amount to Pay" instead of "Total" when wallet is used
- Update Place Order button to show final amount after wallet

### 2. Web Tracking Page (`frontend/src/pages/TrackingPage.jsx`)
**Changes:**
- Show wallet credit deduction in order summary
- Display "(Paid via Wallet)" indicator when fully covered
- Change payment method to "WALLET/CREDIT" when fully paid via wallet
- Change "Total" label to "Amount Paid/Due" when wallet is used

### 3. Admin Orders Page (`frontend/src/pages/admin/AdminOrders.jsx`)
**Changes:**
- Display original total + wallet deduction separately
- Show "Wallet: −Rs. X" below the total
- Display "WALLET/CREDIT" as payment method when fully paid
- Add "✓ Fully paid via wallet" badge for clarity

### 4. Mobile Tracking Screen (`mobile/lib/features/orders/order_tracking_screen.dart`)
**Changes:**
- Show "Wallet credit: − Rs. X" line in order summary
- Change "Total" to "Amount paid/due" when wallet is used
- Display "WALLET/CREDIT" as payment method when fully paid via wallet

## Deployment Steps

### Frontend (Web)
```bash
cd frontend
npm run build
# Deploy the build folder to Vercel or your hosting
```

### Mobile (Flutter)
```bash
cd mobile
flutter build apk  # or flutter build ios
# Deploy the new build to your users
```

### Backend (No changes needed)
Backend is already working correctly. No deployment required.

## Expected Behavior After Deployment

**Example: Rs. 450 order with Rs. 500 wallet balance**

### Customer Checkout:
- Subtotal: Rs. 450
- 👛 Wallet Credit: − Rs. 450
- **Amount to Pay: Rs. 0**
- Button: "Place Order — Rs. 0"

### Customer Tracking:
- Subtotal: Rs. 450
- Wallet used: − Rs. 450
- **Amount Paid/Due: Rs. 0 (Paid via Wallet)**
- Payment: **WALLET/CREDIT**
- Payment Status: **PAID**

### Admin Panel:
- Total: **Rs. 450**
- Wallet: **−Rs. 450**
- Payment: **WALLET/CREDIT**
- Payment Status: **PAID**
- ✓ Fully paid via wallet

### Customer Wallet:
- Before: Rs. 500
- **After: Rs. 50** (500 - 450)

## Files Modified

1. `frontend/src/pages/CheckoutPage.jsx`
2. `frontend/src/pages/TrackingPage.jsx`
3. `frontend/src/pages/admin/AdminOrders.jsx`
4. `mobile/lib/features/orders/order_tracking_screen.dart`

## Testing Checklist

- [ ] Web checkout shows wallet deduction preview
- [ ] Web checkout shows correct final amount
- [ ] Order success page shows wallet was used
- [ ] Web tracking page shows WALLET/CREDIT payment method
- [ ] Admin panel shows wallet deduction clearly
- [ ] Mobile tracking shows wallet deduction
- [ ] Customer wallet balance is updated correctly
- [ ] Backend properly deducts wallet amount
- [ ] Works for both delivery and pickup orders
- [ ] Works when wallet partially covers order
- [ ] Works when wallet fully covers order
