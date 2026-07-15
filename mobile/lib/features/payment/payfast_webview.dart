import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/api_client.dart';
import 'payment_repository.dart';

/// Hosted-checkout WebView for the PayFast (gopayfast) gateway — the route
/// that actually charges Easypaisa / JazzCash wallets in-app. Creates a
/// session, auto-submits the transaction form to PayFast's hosted page, and
/// watches for the success/cancel redirect back to our sentinel origin. The
/// redirect's err_code is reported to the backend (which flips the order to
/// paid), then we continue to order tracking.
///
/// Inert until the backend has PAYFAST_MERCHANT_ID/PAYFAST_SECURED_KEY: the
/// session call 503s and the error view offers the manual transfer flow.
class PayfastWebView extends ConsumerStatefulWidget {
  const PayfastWebView({
    super.key,
    required this.orderId,
    required this.trackToken,
    this.via = 'easypaisa',
  });

  final String orderId;
  final String trackToken;

  /// Wallet the customer picked: `easypaisa` or `jazzcash`. Cosmetic (PayFast
  /// shows its own method picker) but drives the title + manual fallback.
  final String via;

  @override
  ConsumerState<PayfastWebView> createState() => _PayfastWebViewState();
}

class _PayfastWebViewState extends ConsumerState<PayfastWebView> {
  // Sentinel origin the backend embeds in SUCCESS_URL / FAILURE_URL.
  static const String _origin = 'https://knb.payment.return';

  WebViewController? _controller;
  String? _basketId;
  String? _error;
  bool _finishing = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      final session = await ref.read(paymentRepositoryProvider).createPayfastSession(
            orderId: widget.orderId,
            originUrl: _origin,
          );
      if (session.actionUrl.isEmpty) {
        setState(() => _error = 'Could not start the payment.');
        return;
      }
      _basketId = session.basketId;
      // PayFast's redirect model wants a form POST, not a GET — render a tiny
      // self-submitting form so the WebView lands on the hosted checkout.
      final inputs = session.fields.entries
          .map((e) =>
              '<input type="hidden" name="${_esc(e.key)}" value="${_esc(e.value)}">')
          .join();
      final html = '<!DOCTYPE html><html><body>'
          '<p style="font-family:sans-serif;text-align:center;margin-top:40vh">'
          'Connecting to PayFast…</p>'
          '<form id="pf" method="post" action="${_esc(session.actionUrl)}">$inputs</form>'
          '<script>document.getElementById("pf").submit();</script>'
          '</body></html>';
      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setNavigationDelegate(NavigationDelegate(
          onNavigationRequest: (req) {
            if (req.url.startsWith(_origin)) {
              _finish(Uri.parse(req.url));
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ))
        ..loadHtmlString(html);
      if (!mounted) return;
      setState(() => _controller = controller);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.statusCode == 503
          ? 'Online wallet payment is not available yet.'
          : e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not start the payment.');
    }
  }

  String _esc(String s) => const HtmlEscape(HtmlEscapeMode.attribute).convert(s);

  Future<void> _finish(Uri redirect) async {
    if (_finishing) return;
    _finishing = true;
    // Success redirects land on $_origin/success, failures on /cancel. PayFast
    // appends err_code/err_msg/transaction_id — forward them so the BACKEND
    // decides paid vs failed (the app never trusts the redirect alone).
    try {
      if (_basketId != null && _basketId!.isNotEmpty) {
        final q = redirect.queryParameters;
        await ref.read(paymentRepositoryProvider).payfastReturn(
              basketId: _basketId!,
              errCode: q['err_code'] ??
                  (redirect.path.contains('success') ? '000' : null),
              errMsg: q['err_msg'],
              transactionId: q['transaction_id'],
              validationHash: q['validation_hash'],
            );
      }
    } catch (_) {
      // Tracking screen shows the authoritative status regardless.
    }
    if (!mounted) return;
    context.go('/order/${widget.orderId}?t=${widget.trackToken}');
  }

  String get _title => switch (widget.via) {
        'jazzcash' => 'JazzCash payment',
        _ => 'Easypaisa payment',
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
