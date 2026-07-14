import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import 'order_models.dart';
import 'order_repository.dart';

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myOrdersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My Orders')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myOrdersProvider),
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            children: [
              const SizedBox(height: 80),
              const Icon(Icons.error_outline, size: 48),
              const SizedBox(height: 12),
              Text('$e', textAlign: TextAlign.center),
              const SizedBox(height: 12),
              Center(
                child: OutlinedButton(
                  onPressed: () => ref.invalidate(myOrdersProvider),
                  child: const Text('Retry'),
                ),
              ),
            ],
          ),
          data: (orders) {
            if (orders.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: Text('You have no orders yet')),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: orders.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) => _OrderTile(order: orders[i]),
            );
          },
        ),
      ),
    );
  }
}

class _OrderTile extends StatelessWidget {
  const _OrderTile({required this.order});
  final Order order;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: scheme.outlineVariant),
      ),
      child: ListTile(
        onTap: () {
          final tok = order.trackToken ?? '';
          context.push('/order/${order.id}?t=$tok');
        },
        title: Text('Order #${order.receiptNo}',
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 2),
            _StatusChip(status: order.status),
            if (order.createdAt.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(_shortDate(order.createdAt),
                    style: TextStyle(
                        fontSize: 12, color: scheme.onSurfaceVariant)),
              ),
          ],
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(money(order.totalPrice),
                style: const TextStyle(fontWeight: FontWeight.w700)),
            Text('${order.items.length} item${order.items.length == 1 ? '' : 's'}',
                style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
          ],
        ),
        isThreeLine: true,
      ),
    );
  }

  static String _shortDate(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    final l = d.toLocal();
    final dd = l.day.toString().padLeft(2, '0');
    final mm = l.month.toString().padLeft(2, '0');
    final hh = l.hour.toString().padLeft(2, '0');
    final mn = l.minute.toString().padLeft(2, '0');
    return '$dd/$mm/${l.year}  $hh:$mn';
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final terminal = status == 'rejected' || status == 'cancelled';
    final done = status == 'delivered';
    final Color bg = terminal
        ? scheme.errorContainer
        : done
            ? scheme.primaryContainer
            : scheme.secondaryContainer;
    final Color fg = terminal
        ? scheme.onErrorContainer
        : done
            ? scheme.onPrimaryContainer
            : scheme.onSecondaryContainer;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Text(prettyStatus(status),
          style: TextStyle(
              color: fg, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}
