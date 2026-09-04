# Mobile App Notification Fix

## Problem
The mobile app was **not showing notifications** when the app is in the **foreground (open)**. Notifications only appeared when the app was closed or in the background.

## Root Cause
Firebase Cloud Messaging (FCM) requires explicit foreground message handlers to display notifications when the app is active. The app had:
- ✅ Backend correctly sending FCM notifications for all order status changes
- ✅ FCM token registration working
- ✅ Android notification channel configured properly
- ❌ **MISSING: Foreground notification handlers**

## What Was Fixed

### 1. Added Background Message Handler (`main.dart`)
```dart
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('Background message received: ${message.messageId}');
}
```

### 2. Initialized Firebase Properly (`main.dart`)
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  await FirebaseMessaging.instance.requestPermission(
    alert: true,
    badge: true,
    sound: true,
  );
  
  runApp(const ProviderScope(child: KnbApp()));
}
```

### 3. Created Notification Service (`core/notification_service.dart`)
A new service that handles:
- **Foreground notifications**: Shows a SnackBar with the notification content when app is open
- **Background tap handling**: Navigates to order when notification is tapped
- **Initial message handling**: Handles app launch from notification

### 4. Integrated Service in Main App (`main.dart`)
```dart
NotificationService.instance.init(
  context,
  onNotificationTapped: (orderId) {
    // Navigate to order tracking page
    final router = ref.read(routerProvider);
    router.go('/orders');
  },
);
```

## Notification Flow Now

### When App is Closed/Background:
1. Backend sends FCM notification via `_send_fcm_to_customer()`
2. FCM delivers notification to device
3. Android system shows notification using the `knb_orders` channel
4. User taps → App opens → Navigates to orders page

### When App is Open (Foreground):
1. Backend sends FCM notification via `_send_fcm_to_customer()`
2. FCM delivers notification to device
3. `NotificationService` receives message via `FirebaseMessaging.onMessage`
4. **Shows green SnackBar** at bottom with:
   - Notification title (e.g., "Order ready for pickup")
   - Notification body (e.g., "Your order #ABC123 is ready")
   - "View Order" button to navigate
5. SnackBar stays visible for 6 seconds

## Order Status Notifications Sent

The backend sends notifications for these statuses (from `server.py:5304-5314`):
- ✅ `accepted` → "Order accepted"
- ✅ `preparing` → "Your order is being prepared"
- ✅ `ready` → "Order ready for pickup / delivery"
- ✅ `ready_for_pickup` → "Order ready for pickup"
- ✅ `out_for_delivery` → "Your order is on the way" ⭐
- ✅ `delivered` → "Order delivered — enjoy!" ⭐
- ✅ `picked_up` → "Order picked up — enjoy!"
- ✅ `rejected` → "Order rejected"
- ✅ `cancelled` → "Order cancelled"

## Testing

### To Test Foreground Notifications:
1. Open the mobile app and log in
2. Place an order from the website or another device
3. **Keep the app open on the orders/home screen**
4. From admin panel, change order status to "Ready" or "Out for Delivery"
5. **You should see a green SnackBar** appear at the bottom with the notification

### To Test Background Notifications:
1. Open the mobile app and log in
2. Press home button (don't close app, just background it)
3. Change order status from admin panel
4. **Notification appears in notification tray**
5. Tap notification → App opens to orders page

### To Test Terminated State:
1. Fully close/kill the mobile app
2. Change order status from admin panel
3. **Notification appears in notification tray**
4. Tap notification → App launches and opens to orders page

## Files Changed

1. **`mobile/lib/main.dart`**
   - Added Firebase initialization in `main()`
   - Added background message handler
   - Integrated `NotificationService`

2. **`mobile/lib/core/notification_service.dart`** (NEW)
   - Handles foreground notifications
   - Handles background tap
   - Handles app launch from notification

## Backend (No Changes Required)

The backend already sends notifications correctly via:
- `_notify_customer_order_status()` at `server.py:5299`
- `_send_fcm_to_customer()` at `server.py:5182`

These are triggered on every status change at `server.py:4813`.

## Requirements

Ensure `google-services.json` is present in:
- `mobile/android/app/google-services.json`

And `FIREBASE_CREDENTIALS` environment variable is set on the backend.

## Notes

- Notifications use the high-importance `knb_orders` channel created in `MainActivity.kt`
- This ensures heads-up display and lock screen visibility
- FCM gracefully degrades if not configured (app works without notifications)
- Token registration happens automatically after login via `PushService.registerWith()`
