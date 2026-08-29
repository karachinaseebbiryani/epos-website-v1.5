import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router.dart';
import 'app/theme.dart';
import 'app/theme_controller.dart';
import 'core/app_messenger.dart';
import 'core/loading_overlay.dart';
import 'core/offline_banner.dart';
import 'core/notification_permission.dart';
import 'features/auth/auth_controller.dart';

void main() {
  runApp(const ProviderScope(child: KnbApp()));
}

class KnbApp extends ConsumerStatefulWidget {
  const KnbApp({super.key});

  @override
  ConsumerState<KnbApp> createState() => _KnbAppState();
}

class _KnbAppState extends ConsumerState<KnbApp> {
  bool _permissionChecked = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
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
