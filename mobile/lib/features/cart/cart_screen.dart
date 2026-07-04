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
                  title: Text(line.displayName),
                  subtitle: Text(money(line.unitPrice)),
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
