import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/api_client.dart';
import 'payment_repository.dart';

/// Hosted-checkout WebView for the SafePay gateway. Creates a session for the
/// order, loads the checkout URL, and watches for the success/cancel redirect
/// (any navigation back to our `origin_url`). On return it polls the backend for
/// the authoritative payment status, then continues to order tracking.
///
/// Used for cards (`via: card`) and — when the gateway is enabled — the
/// Easypaisa/JazzCash wallets, which SafePay charges on its hosted page. If the
/// gateway is unavailable and the wallet has manual account details configured,
/// the error view offers the manual transfer flow as a fallback.
///
/// Inert until the backend is configured: `createSafepaySession` returns a 503
/// (surfaced as an ApiException) which we show as "not available".
class SafepayWebView extends ConsumerStatefulWidget {
  const SafepayWebView({
    super.key,
    required this.orderId,
    required this.trackToken,
    this.via = 'card',
  });

  final String orderId;
  final String trackToken;

  /// What the customer chose to pay with: `card`, `easypaisa` or `jazzcash`.
  /// Cosmetic for the hosted page (SafePay shows its own method picker) but
  /// drives the title and the manual-transfer fallback on error.
  final String via;

  @override
  ConsumerState<SafepayWebView> createState() => _SafepayWebViewState();
}

class _SafepayWebViewState extends ConsumerState<SafepayWebView> {
  // Sentinel origin the backend uses to build success/cancel redirect URLs.
  static const String _origin = 'https://knb.payment.return';

  WebViewController? _controller;
  String? _tracker;
  String? _error;
  bool _finishing = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      final session = await ref.read(paymentRepositoryProvider).createSafepaySession(
            orderId: widget.orderId,
            originUrl: _origin,
          );
      if (session.url.isEmpty) {
        setState(() => _error = 'Could not start the payment.');
        return;
      }
      _tracker = session.tracker;
      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setNavigationDelegate(NavigationDelegate(
          onNavigationRequest: (req) {
            if (_isReturnUrl(req.url)) {
              _finish();
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ))
        ..loadRequest(Uri.parse(session.url));
      if (!mounted) return;
      setState(() => _controller = controller);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.statusCode == 503
          ? 'Online payment is not available yet.'
          : e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not start the payment.');
    }
  }

  /// True when the checkout signals completion. Two shapes exist:
  ///  - our sentinel origin (backend-built redirect/cancel URLs), kept for
  ///    backward compatibility, and
  ///  - SafePay's mobile-mode return, which navigates to `/mobile?action=
  ///    complete|cancelled` on SafePay's own domain instead of redirecting
  ///    to the sentinel — previously undetected, leaving the customer
  ///    stranded on the "return to your mobile application" screen.
  bool _isReturnUrl(String url) {
    if (url.startsWith(_origin)) return true;
    final uri = Uri.tryParse(url);
    if (uri == null) return false;
    return uri.path.endsWith('/mobile') &&
        const {'complete', 'cancelled'}.contains(uri.queryParameters['action']);
  }

  Future<void> _finish() async {
    if (_finishing) return;
    _finishing = true;
    // Confirm with the backend rather than trusting the redirect alone.
    try {
      if (_tracker != null && _tracker!.isNotEmpty) {
        await ref.read(paymentRepositoryProvider).safepayStatus(_tracker!);
      }
    } catch (_) {
      // Tracking screen shows the authoritative status regardless.
    }
    if (!mounted) return;
    context.go('/order/${widget.orderId}?t=${widget.trackToken}');
  }

  String get _title => switch (widget.via) {
        'easypaisa' => 'Easypaisa payment',
        'jazzcash' => 'JazzCash payment',
        _ => 'Card payment',
      };

  /// Manual account details exist for the chosen wallet, so the transfer +
  /// reference flow can stand in when the gateway fails.
  bool get _manualFallbackAvailable {
    final s = ref.read(paymentSettingsProvider).asData?.value;
    if (s == null) return false;
    return switch (widget.via) {
      'easypaisa' => s.easypaisaManual,
      'jazzcash' => s.jazzcashManual,
      _ => false,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        actions: [
          TextButton(
            onPressed: () =>
                context.go('/order/${widget.orderId}?t=${widget.trackToken}'),
            child: const Text('Skip'),
          ),
        ],
      ),
      body: _error != null
          ? _ErrorView(
              message: _error!,
              onContinue: () => context.go(
                  '/order/${widget.orderId}?t=${widget.trackToken}'),
              onManualTransfer: _manualFallbackAvailable
                  ? () => context.go(
                      '/order/${widget.orderId}/pay?via=${widget.via}&t=${widget.trackToken}')
                  : null,
            )
          : _controller == null
              ? const Center(child: CircularProgressIndicator())
              : WebViewWidget(controller: _controller!),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({
    required this.message,
    required this.onContinue,
    this.onManualTransfer,
  });
  final String message;
  final VoidCallback onContinue;
  final VoidCallback? onManualTransfer;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.info_outline, size: 44),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            if (onManualTransfer != null) ...[
              FilledButton(
                onPressed: onManualTransfer,
                child: const Text('Pay by manual transfer instead'),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: onContinue,
                child: const Text('View order'),
              ),
            ] else
              FilledButton(
                onPressed: onContinue,
                child: const Text('View order'),
              ),
          ],
        ),
      ),
    );
  }
}
