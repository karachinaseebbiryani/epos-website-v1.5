import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/auth_controller.dart';
import '../features/auth/forgot_password_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/auth/verify_email_screen.dart';
import '../features/cart/cart_screen.dart';
import '../features/checkout/checkout_screen.dart';
import '../features/faq/faq_screen.dart';
import '../features/loyalty/diamonds_screen.dart';
import '../features/menu/menu_screen.dart';
import '../features/offers/offers_screen.dart';
import '../features/payment/payment_screen.dart';
import '../features/payment/payfast_webview.dart';
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
      final onAuthPage = loc == '/login' ||
          loc == '/register' ||
          loc == '/forgot-password';

      if (status == AuthStatus.unknown) return null; // splash handles it
      if (status == AuthStatus.unauthenticated) {
        return onAuthPage ? null : '/login';
      }
      // authenticated
      return onAuthPage ? '/' : null;
    },
    routes: [
      // Child routes of '/' so deep locations build a page STACK above the menu
      // (menu → cart → …). With the old flat layout, go()/deep-links produced a
      // single-page stack and the system back gesture exited the whole app.
      GoRoute(
        path: '/',
        builder: (_, __) => const MenuScreen(),
        routes: [
          GoRoute(path: 'cart', builder: (_, __) => const CartScreen()),
          GoRoute(path: 'checkout', builder: (_, __) => const CheckoutScreen()),
          GoRoute(path: 'diamonds', builder: (_, __) => const DiamondsScreen()),
          GoRoute(path: 'faqs', builder: (_, __) => const FaqScreen()),
          GoRoute(path: 'offers', builder: (_, __) => const OffersScreen()),
          GoRoute(path: 'orders', builder: (_, __) => const OrdersScreen()),
          GoRoute(path: 'profile', builder: (_, __) => const ProfileScreen()),
          GoRoute(
            path: 'verify-email',
            builder: (_, state) => VerifyEmailScreen(
              redirectTo: state.uri.queryParameters['redirect'] ?? '/',
            ),
          ),
          GoRoute(
            path: 'order/:id',
            builder: (context, state) => OrderTrackingScreen(
              orderId: state.pathParameters['id']!,
              trackToken: state.uri.queryParameters['t'] ?? '',
            ),
            routes: [
              GoRoute(
                path: 'pay',
                builder: (context, state) => PaymentScreen(
                  orderId: state.pathParameters['id']!,
                  via: state.uri.queryParameters['via'] ?? 'bank',
                  trackToken: state.uri.queryParameters['t'] ?? '',
                ),
              ),
              GoRoute(
                path: 'safepay',
                builder: (context, state) => SafepayWebView(
                  orderId: state.pathParameters['id']!,
                  via: state.uri.queryParameters['via'] ?? 'card',
                  trackToken: state.uri.queryParameters['t'] ?? '',
                ),
              ),
              GoRoute(
                path: 'payfast',
                builder: (context, state) => PayfastWebView(
                  orderId: state.pathParameters['id']!,
                  via: state.uri.queryParameters['via'] ?? 'easypaisa',
                  trackToken: state.uri.queryParameters['t'] ?? '',
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(
          path: '/forgot-password',
          builder: (_, __) => const ForgotPasswordScreen()),
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
