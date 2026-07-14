import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/tokens.dart';
import '../../auth/auth_controller.dart';
import '../loyalty_repository.dart';

/// Live diamond-balance pill, mirroring the website header's yellow diamond
/// chip. Shows the backend balance (display-only — earning/spending is entirely
/// server-controlled) and taps through to the Diamonds screen. Renders nothing
/// for signed-out users (they have no balance yet).
class DiamondPill extends ConsumerWidget {
  const DiamondPill({super.key, this.onTap});

  /// Optional override; defaults to navigating to /diamonds.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authed =
        ref.watch(authControllerProvider).status == AuthStatus.authenticated;
    if (!authed) {
      // Signed-out: keep the entry point but without a (nonexistent) balance.
      return IconButton(
        tooltip: 'Diamonds',
        icon: const Icon(Icons.diamond_outlined),
        onPressed: onTap ?? () => context.push('/diamonds'),
      );
    }
    final balance = ref.watch(loyaltyBalanceProvider).asData?.value.diamondBalance;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      child: Material(
        color: BrandColors.yellow.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(BrandRadii.pill),
        child: InkWell(
          borderRadius: BorderRadius.circular(BrandRadii.pill),
          onTap: onTap ?? () => context.push('/diamonds'),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.diamond, size: 16, color: BrandColors.yellowDark),
                const SizedBox(width: 5),
                Text(
                  balance == null ? '—' : '$balance',
                  style: const TextStyle(
                    color: BrandColors.ink,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
