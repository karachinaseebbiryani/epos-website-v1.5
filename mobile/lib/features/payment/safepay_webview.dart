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
/// Inert until the backend is configured: `createSafepaySession` returns a 503
/// (surfaced as an ApiException) which we show as "not available".
class SafepayWebView extends ConsumerStatefulWidget {
  const SafepayWebView({
    super.key,
    required this.orderId,
    required this.trackToken,
  });

  final String orderId;
  final String trackToken;

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
            if (req.url.startsWith(_origin)) {
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
          ? 'Online card payment is not available yet.'
          : e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not start the payment.');
    }
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Card payment'),
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
            )
          : _controller == null
              ? const Center(child: CircularProgressIndicator())
              : WebViewWidget(controller: _controller!),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onContinue});
  final String message;
  final VoidCallback onContinue;

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
