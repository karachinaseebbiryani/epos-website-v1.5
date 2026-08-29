import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Handles notification permission requests on Android.
/// - Asks for permission on first app launch
/// - If denied, shows dialog to open system settings
/// - Tracks if permission has been requested before to avoid annoying users
class NotificationPermissionHandler {
  // Changed key to v2 so existing users get prompted again
  static const _permissionAskedKey = 'notification_permission_asked_v2';

  /// Request notification permission on first app launch.
  /// Returns true if permission was granted, false otherwise.
  static Future<bool> requestPermissionOnFirstLaunch(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    final hasAskedBefore = prefs.getBool(_permissionAskedKey) ?? false;

    // Only ask once on first launch
    if (hasAskedBefore) return true;

    // Mark as asked
    await prefs.setBool(_permissionAskedKey, true);

    // Request permission
    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      return true;
    } else if (settings.authorizationStatus == AuthorizationStatus.denied) {
      // Permission denied - show dialog to open settings
      if (context.mounted) {
        _showSettingsDialog(context);
      }
      return false;
    }

    return false;
  }

  /// Check current notification permission status
  static Future<AuthorizationStatus> checkPermissionStatus() async {
    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.getNotificationSettings();
    return settings.authorizationStatus;
  }

  /// Show dialog prompting user to enable notifications in system settings
  static void _showSettingsDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Enable Notifications'),
        content: const Text(
          'Stay updated with your order status! Notifications are currently disabled. '
          'Please enable them in Settings to receive important updates about your orders.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Not Now'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(context).pop();
              // Open app settings (Android)
              FirebaseMessaging.instance.requestPermission();
            },
            child: const Text('Open Settings'),
          ),
        ],
      ),
    );
  }

  /// Show a banner at the top of the screen if notifications are disabled
  static Widget notificationBanner(BuildContext context) {
    return FutureBuilder<AuthorizationStatus>(
      future: checkPermissionStatus(),
      builder: (context, snapshot) {
        if (!snapshot.hasData ||
            snapshot.data == AuthorizationStatus.authorized ||
            snapshot.data == AuthorizationStatus.provisional) {
          return const SizedBox.shrink();
        }

        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: Colors.orange.shade100,
          child: Row(
            children: [
              Icon(Icons.notifications_off, color: Colors.orange.shade900),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Enable notifications to get order updates',
                  style: TextStyle(
                    color: Colors.orange.shade900,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              TextButton(
                onPressed: () async {
                  await FirebaseMessaging.instance.requestPermission();
                },
                child: Text(
                  'Enable',
                  style: TextStyle(
                    color: Colors.orange.shade900,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
