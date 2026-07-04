import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'connectivity.dart';

/// A slim banner pinned to the top of the app while offline. Installed inside
/// the loading overlay (below the spinner) via MaterialApp.builder.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(isOnlineProvider);
    return Column(
      children: [
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: online
              ? const SizedBox(width: double.infinity)
              : const _OfflineStrip(),
        ),
        Expanded(child: child),
      ],
    );
  }
}

class _OfflineStrip extends StatelessWidget {
  const _OfflineStrip();

  @override
  Widget build(BuildContext context) {
    return const Material(
      color: Color(0xFFB3261E),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 6, horizontal: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.wifi_off, size: 16, color: Colors.white),
              SizedBox(width: 8),
              Text('No internet connection',
                  style: TextStyle(color: Colors.white, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }
}
