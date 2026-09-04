import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'app/router.dart';
import 'app/theme.dart';
import 'app/theme_controller.dart';
import 'core/app_messenger.dart';
import 'core/loading_overlay.dart';
import 'core/offline_banner.dart';
import 'core/notification_permission.dart';
import 'core/notification_service.dart';
import 'features/auth/auth_controller.dart';

// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // Background messages are automatically shown by FCM with the notification payload
  // This handler is for additional processing if needed (e.g., updating local DB)
  debugPrint('Background message received: ${message.messageId}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase and set up notification handlers
  try {
    await Firebase.initializeApp();

    // Set up background message handler
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Request notification permission
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
  } catch (e) {
    // FCM not configured - app will work without notifications
    debugPrint('Firebase init failed: $e');
  }

  runApp(const ProviderScope(child: KnbApp()));
}

class KnbApp extends ConsumerStatefulWidget {
  const KnbApp({super.key});

  @override
  ConsumerState<KnbApp> createState() => _KnbAppState();
}

class _KnbAppState extends ConsumerState<KnbApp> {
  bool _permissionChecked = false;
  bool _notificationServiceInitialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    // Initialize notification service once context is available
    if (!_notificationServiceInitialized && mounted) {
      _notificationServiceInitialized = true;
      NotificationService.instance.init(
        context,
        onNotificationTapped: (orderId) {
          // Navigate to order tracking page when notification is tapped
          final router = ref.read(routerProvider);
          router.go('/orders'); // Navigate to orders page or specific order
        },
      );
      // Check if app was launched from a notification
      NotificationService.instance.handleInitialMessage();
    }

    // Request notification permission after the first frame is rendered
    if (!_permissionChecked) {
      _permissionChecked = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          NotificationPermissionHandler.requestPermissionOnFirstLaunch(context);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = ref.watch(authControllerProvider).status;
    final themeMode = ref.watch(themeModeControllerProvider);

    // Until we know whether the stored token is valid, show a splash so the
    // router doesn't flash the login screen at an already-signed-in user.
    if (status == AuthStatus.unknown) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: themeMode,
        home: const SplashScreen(),
      );
    }

    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Karachi Naseeb',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: themeMode,
      scaffoldMessengerKey: scaffoldMessengerKey,
      routerConfig: router,
      // Global chrome: spinner over everything, offline banner below it.
      builder: (context, child) => GlobalLoadingOverlay(
        child: OfflineBanner(
          child: child ?? const SizedBox.shrink(),
        ),
      ),
    );
  }
}
