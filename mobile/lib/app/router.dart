import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/auth_controller.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/cart/cart_screen.dart';
import '../features/checkout/checkout_screen.dart';
import '../features/menu/menu_screen.dart';
import '../features/orders/order_tracking_screen.dart';

/// Router that redirects based on auth state. While auth is still `unknown`
/// (checking the stored token) we show a splash.
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    redirect: (context, goState) {
      final status = ref.read(authControllerProvider).status;
      final loc = goState.matchedLocation;
      final onAuthPage = loc == '/login' || loc == '/register';

      if (status == AuthStatus.unknown) return null; // splash handles it
      if (status == AuthStatus.unauthenticated) {
        return onAuthPage ? null : '/login';
      }
      // authenticated
      return onAuthPage ? '/' : null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const MenuScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(path: '/cart', builder: (_, __) => const CartScreen()),
      GoRoute(path: '/checkout', builder: (_, __) => const CheckoutScreen()),
      GoRoute(
        path: '/order/:id',
        builder: (context, state) => OrderTrackingScreen(
          orderId: state.pathParameters['id']!,
          trackToken: state.uri.queryParameters['t'] ?? '',
        ),
      ),
    ],
  );
});

/// Splash shown while the stored token is being validated on cold start.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}
