import 'package:flutter/material.dart';

import 'loading_controller.dart';

/// A scrim + spinner painted above the whole app. Installed via
/// `MaterialApp.builder` so it covers every route, dialogs included.
class GlobalLoadingOverlay extends StatelessWidget {
  const GlobalLoadingOverlay({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        ValueListenableBuilder<int>(
          valueListenable: loadingController,
          builder: (context, count, _) {
            if (count <= 0) return const SizedBox.shrink();
            return const _Scrim();
          },
        ),
      ],
    );
  }
}

class _Scrim extends StatelessWidget {
  const _Scrim();

  @override
  Widget build(BuildContext context) {
    // Raw ARGB (25% black) — no withOpacity/withValues, so this compiles on any
    // Flutter version.
    return const Positioned.fill(
      child: AbsorbPointer(
        child: ColoredBox(
          color: Color(0x40000000),
          child: Center(child: CircularProgressIndicator()),
        ),
      ),
    );
  }
}
