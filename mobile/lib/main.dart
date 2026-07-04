import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router.dart';
import 'app/theme.dart';
import 'app/theme_controller.dart';
import 'core/app_messenger.dart';
import 'core/loading_overlay.dart';
import 'core/offline_banner.dart';
import 'features/auth/auth_controller.dart';

void main() {
  runApp(const ProviderScope(child: KnbApp()));
}

class KnbApp extends ConsumerWidget {
  const KnbApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
