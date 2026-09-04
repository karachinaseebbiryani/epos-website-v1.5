import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

/// Handles foreground and background FCM notifications
class NotificationService {
  static final NotificationService _instance = NotificationService._();
  static NotificationService get instance => _instance;

  NotificationService._();

  BuildContext? _context;
  Function(String orderId)? _onNotificationTapped;

  /// Initialize the notification service with app context
  void init(BuildContext context, {Function(String orderId)? onNotificationTapped}) {
    _context = context;
    _onNotificationTapped = onNotificationTapped;
    _setupForegroundHandler();
    _setupBackgroundTapHandler();
  }

  /// Handle notifications when app is in foreground
  void _setupForegroundHandler() {
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('Foreground FCM message: ${message.messageId}');

      final notification = message.notification;
      if (notification == null || _context == null) return;

      // Show a SnackBar for foreground notifications
      final messenger = ScaffoldMessenger.maybeOf(_context!);
      if (messenger != null) {
        messenger.showSnackBar(
          SnackBar(
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  notification.title ?? 'Order Update',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
                if (notification.body != null) ...[
                  const SizedBox(height: 4),
                  Text(notification.body!),
                ],
              ],
            ),
            duration: const Duration(seconds: 6),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.green.shade700,
            action: message.data['order_id'] != null
                ? SnackBarAction(
                    label: 'View Order',
                    textColor: Colors.white,
                    onPressed: () {
                      final orderId = message.data['order_id'];
                      if (orderId != null && _onNotificationTapped != null) {
                        _onNotificationTapped!(orderId);
                      }
                    },
                  )
                : null,
          ),
        );
      }
    });
  }

  /// Handle notification tap when app is in background (not terminated)
  void _setupBackgroundTapHandler() {
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('Notification tapped (background): ${message.messageId}');

      final orderId = message.data['order_id'];
      if (orderId != null && _onNotificationTapped != null) {
        _onNotificationTapped!(orderId);
      }
    });
  }

  /// Check if there was a notification that launched the app (terminated state)
  Future<void> handleInitialMessage() async {
    final message = await FirebaseMessaging.instance.getInitialMessage();
    if (message != null) {
      debugPrint('App launched from notification: ${message.messageId}');

      final orderId = message.data['order_id'];
      if (orderId != null && _onNotificationTapped != null) {
        _onNotificationTapped!(orderId);
      }
    }
  }
}
