import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/config.dart';

/// Renders a website policy page (privacy / terms / refunds / delivery) inside
/// the app. One WebView instead of duplicated native text so the app and the
/// website can never drift apart — a PayFast merchant-onboarding and app-store
/// listing requirement is that these policies exist and match.
class PolicyWebView extends StatefulWidget {
  const PolicyWebView({super.key, required this.slug, required this.title});

  /// Website path: `privacy`, `terms`, `refunds`, `delivery`.
  final String slug;
  final String title;

  @override
  State<PolicyWebView> createState() => _PolicyWebViewState();
}

class _PolicyWebViewState extends State<PolicyWebView> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) {
          if (mounted) setState(() => _loading = false);
        },
        onWebResourceError: (e) {
          // Only treat main-frame failures as fatal (subresource errors are
          // common and harmless).
          if (e.isForMainFrame ?? true) {
            if (mounted) {
              setState(() {
                _error = true;
                _loading = false;
              });
            }
          }
        },
      ))
      ..loadRequest(Uri.parse('${AppConfig.siteBaseUrl}/${widget.slug}'));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: _error
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.wifi_off, size: 44),
                    const SizedBox(height: 12),
                    const Text('Could not load the page. '
                        'Please check your connection and try again.'),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () {
                        setState(() {
                          _error = false;
                          _loading = true;
                        });
                        _controller.reload();
                      },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          : Stack(
              children: [
                WebViewWidget(controller: _controller),
                if (_loading)
                  const Center(child: CircularProgressIndicator()),
              ],
            ),
    );
  }
}
