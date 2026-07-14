import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/auth_controller.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/cart/cart_screen.dart';
import '../features/checkout/checkout_screen.dart';
import '../features/faq/faq_screen.dart';
import '../features/loyalty/diamonds_screen.dart';
import '../features/menu/menu_screen.dart';
import '../features/offers/offers_screen.dart';
import '../features/payment/payment_screen.dart';
import '../features/payment/safepay_webview.dart';
import '../features/profile/profile_screen.dart';
import '../features/orders/order_tracking_screen.dart';
import '../features/orders/orders_screen.dart';

/// Router that redirects based on auth state. While auth is still `unknown`
/// (checking the stored token) we show a splash.
final routerProvider = Provider<GoRouter>((ref) {
  // go_router does NOT re-run `redirect` on its own when auth state changes.
  // Bridge Riverpod -> Listenable so a login/logout re-evaluates redirects and
  // actually navigates (otherwise the app stays stuck on the current screen).
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
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
      GoRoute(path: '/diamonds', builder: (_, __) => const DiamondsScreen()),
      GoRoute(path: '/faqs', builder: (_, __) => const FaqScreen()),
      GoRoute(path: '/offers', builder: (_, __) => const OffersScreen()),
      GoRoute(path: '/orders', builder: (_, __) => const OrdersScreen()),
      GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
      GoRoute(path: '/checkout', builder: (_, __) => const CheckoutScreen()),
      GoRoute(
        path: '/order/:id/pay',
        builder: (context, state) => PaymentScreen(
          orderId: state.pathParameters['id']!,
          via: state.uri.queryParameters['via'] ?? 'bank',
          trackToken: state.uri.queryParameters['t'] ?? '',
        ),
      ),
      GoRoute(
        path: '/order/:id/safepay',
        builder: (context, state) => SafepayWebView(
          orderId: state.pathParameters['id']!,
          trackToken: state.uri.queryParameters['t'] ?? '',
        ),
      ),
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
