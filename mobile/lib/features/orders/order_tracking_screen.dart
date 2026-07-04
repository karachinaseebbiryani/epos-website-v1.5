import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import 'order_models.dart';
import 'order_repository.dart';

class OrderTrackingScreen extends ConsumerWidget {
  const OrderTrackingScreen({
    super.key,
    required this.orderId,
    required this.trackToken,
  });

  final String orderId;
  final String trackToken;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = '$orderId|$trackToken';
    final async = ref.watch(orderTrackingProvider(key));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Order tracking'),
        leading: IconButton(
          icon: const Icon(Icons.home_outlined),
          onPressed: () => context.go('/'),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(orderTrackingProvider(key)),
        child: async.when(
          loading: () => const _Scrollable(
            child: Padding(
              padding: EdgeInsets.only(top: 80),
              child: CircularProgressIndicator(),
            ),
          ),
          error: (e, _) => _Scrollable(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline, size: 48),
                  const SizedBox(height: 12),
                  Text('$e', textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () =>
                        ref.invalidate(orderTrackingProvider(key)),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
          data: (order) => _TrackingBody(order: order),
        ),
      ),
    );
  }
}

class _TrackingBody extends StatelessWidget {
  const _TrackingBody({required this.order});
  final Order order;

  @override
  Widget build(BuildContext context) {
    final terminalRejected =
        order.status == 'rejected' || order.status == 'cancelled';
    final currentIndex = orderStatusFlow.indexOf(order.status);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Order #${order.receiptNo}',
            style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 4),
        Text('Status: ${prettyStatus(order.status)}',
            style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 20),
        if (terminalRejected)
          Card(
            color: Theme.of(context).colorScheme.errorContainer,
            child: ListTile(
              leading: const Icon(Icons.cancel_outlined),
              title: Text(prettyStatus(order.status)),
            ),
          )
        else
          _StatusTimeline(currentIndex: currentIndex),
        const SizedBox(height: 24),
        Text('Items', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        for (final item in order.items)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text(item.variationName == null
                ? item.name
                : '${item.name} (${item.variationName})'),
            leading: Text('${item.quantity}×'),
            trailing: Text(money(item.price * item.quantity)),
          ),
        const Divider(),
        _row('Subtotal', money(order.subtotal)),
        if (order.discountAmount > 0)
          _row('Discount', '- ${money(order.discountAmount)}'),
        _row('Delivery', money(order.deliveryFee)),
        _row('Total', money(order.totalPrice), bold: true),
        const SizedBox(height: 8),
        _row('Payment', order.paymentMethod.toUpperCase()),
        if (order.diamondsEarned > 0)
          _row('Diamonds earned', '${order.diamondsEarned} 💎'),
      ],
    );
  }

  Widget _row(String label, String value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label),
            Text(value,
                style: TextStyle(
                    fontWeight: bold ? FontWeight.w700 : FontWeight.w400)),
          ],
        ),
      );
}

class _StatusTimeline extends StatelessWidget {
  const _StatusTimeline({required this.currentIndex});
  final int currentIndex;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        for (var i = 0; i < orderStatusFlow.length; i++)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                children: [
                  Icon(
                    i <= currentIndex
                        ? Icons.check_circle
                        : Icons.radio_button_unchecked,
                    color: i <= currentIndex ? scheme.primary : scheme.outline,
                    size: 22,
                  ),
                  if (i < orderStatusFlow.length - 1)
                    Container(
                      width: 2,
                      height: 24,
                      color: i < currentIndex ? scheme.primary : scheme.outlineVariant,
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Text(
                  prettyStatus(orderStatusFlow[i]),
                  style: TextStyle(
                    fontWeight:
                        i == currentIndex ? FontWeight.w700 : FontWeight.w400,
                    color: i <= currentIndex ? null : scheme.outline,
                  ),
                ),
              ),
            ],
          ),
      ],
    );
  }
}

class _Scrollable extends StatelessWidget {
  const _Scrollable({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(child: child),
        ),
      ),
    );
  }
}
