import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import 'cart_controller.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lines = ref.watch(cartProvider);
    final subtotal = ref.watch(cartSubtotalProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Your cart'),
        actions: [
          if (lines.isNotEmpty)
            TextButton(
              onPressed: () => ref.read(cartProvider.notifier).clear(),
              child: const Text('Clear'),
            ),
        ],
      ),
      body: lines.isEmpty
          ? _EmptyCart(onBrowse: () => context.go('/'))
          : ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: lines.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final line = lines[i];
                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(vertical: 4),
                  isThreeLine: line.modifiers.isNotEmpty ||
                      line.removals.isNotEmpty ||
                      (line.note?.isNotEmpty ?? false),
                  title: Text(line.displayName),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(money(line.unitPrice)),
                      _CustomizationDetail(line: line),
                    ],
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.remove_circle_outline),
                        onPressed: () =>
                            ref.read(cartProvider.notifier).decrement(line.key),
                      ),
                      Text('${line.quantity}',
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      IconButton(
                        icon: const Icon(Icons.add_circle_outline),
                        onPressed: () =>
                            ref.read(cartProvider.notifier).increment(line.key),
                      ),
                    ],
                  ),
                );
              },
            ),
      bottomNavigationBar: lines.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('Subtotal'),
                          Text(money(subtotal),
                              style: const TextStyle(
                                  fontSize: 20, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                    FilledButton(
                      onPressed: () => context.go('/checkout'),
                      child: const Text('Checkout'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

/// Small grey lines under a cart item summarising its modifiers, removals, and
/// note. Renders nothing when the line has no customization.
class _CustomizationDetail extends StatelessWidget {
  const _CustomizationDetail({required this.line});
  final CartLine line;

  @override
  Widget build(BuildContext context) {
    final parts = <String>[
      for (final m in line.modifiers) m.name,
      for (final r in line.removals) 'No $r',
    ];
    final hasNote = line.note != null && line.note!.isNotEmpty;
    if (parts.isEmpty && !hasNote) return const SizedBox.shrink();

    final style = TextStyle(
      fontSize: 12,
      color: Theme.of(context).colorScheme.onSurfaceVariant,
    );
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (parts.isNotEmpty) Text(parts.join(' · '), style: style),
          if (hasNote)
            Text('Note: ${line.note}',
                style: style.copyWith(fontStyle: FontStyle.italic)),
        ],
      ),
    );
  }
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart({required this.onBrowse});
  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.shopping_cart_outlined, size: 64),
          const SizedBox(height: 12),
          const Text('Your cart is empty'),
          const SizedBox(height: 12),
          FilledButton(onPressed: onBrowse, child: const Text('Browse menu')),
        ],
      ),
    );
  }
}
