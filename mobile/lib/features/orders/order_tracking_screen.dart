import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/location.dart';
import '../../core/review_prompt.dart';
import '../auth/auth_controller.dart';
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
    // Auto-refreshing stream: polls every 5s until the order is terminal, so an
    // employee's status change on the website appears here within ~5s without a
    // manual refresh. Pull-to-refresh still forces an immediate re-read.
    final async = ref.watch(orderTrackingStreamProvider(key));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Order tracking'),
        leading: IconButton(
          icon: const Icon(Icons.home_outlined),
          onPressed: () => context.go('/'),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(orderTrackingStreamProvider(key)),
        child: async.when(
          // While reconnecting the stream keeps the last value, so `loading`
          // only shows on the very first fetch.
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
                        ref.invalidate(orderTrackingStreamProvider(key)),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
          data: (order) => _TrackingBody(order: order, trackToken: trackToken),
        ),
      ),
    );
  }
}

class _TrackingBody extends StatelessWidget {
  const _TrackingBody({required this.order, required this.trackToken});
  final Order order;
  final String trackToken;

  @override
  Widget build(BuildContext context) {
    final terminalRejected =
        order.status == 'rejected' || order.status == 'cancelled';
    final currentIndex = orderStatusFlow.indexOf(order.status);

    // Once the order is delivered, politely offer the Play in-app review — once
    // per order, after the flow completes (never during checkout). Self-gates.
    if (order.status == 'delivered') {
      WidgetsBinding.instance.addPostFrameCallback(
          (_) => ReviewPrompt.maybeRequest(order.id));
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Text('Order #${order.receiptNo}',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(width: 8),
            Chip(
              label: Text(order.isPickup ? 'Pickup' : 'Delivery'),
              visualDensity: VisualDensity.compact,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              avatar: Icon(
                  order.isPickup ? Icons.storefront : Icons.delivery_dining,
                  size: 16),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Text('Status: ${prettyStatus(order.status)}',
                style: Theme.of(context).textTheme.bodyMedium),
            if (!isTerminalStatus(order.status)) ...[
              const SizedBox(width: 8),
              const _LiveDot(),
            ],
          ],
        ),
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
        if (!terminalRejected &&
            order.status != 'delivered' &&
            !order.isPickup) ...[
          const SizedBox(height: 16),
          _ShareLocationButton(orderId: order.id),
        ],
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
        if (order.paymentStatus.isNotEmpty)
          _row('Payment status', prettyPaymentStatus(order.paymentStatus)),
        if (order.diamondsEarned > 0)
          _row('Diamonds earned', '${order.diamondsEarned} 💎'),
        const SizedBox(height: 16),
        _RefundSection(order: order, trackToken: trackToken),
        if (order.status == 'delivered') ...[
          const SizedBox(height: 24),
          _ReviewSection(orderId: order.id),
        ],
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

/// Refunds — request (paid, non-cash orders) and lifecycle display. Mirrors the
/// website's tracking page: requested → approved (2-3 business days back to the
/// payment method) → refunded, or rejected with the restaurant's note.
class _RefundSection extends ConsumerStatefulWidget {
  const _RefundSection({required this.order, required this.trackToken});
  final Order order;
  final String trackToken;

  @override
  ConsumerState<_RefundSection> createState() => _RefundSectionState();
}

class _RefundSectionState extends ConsumerState<_RefundSection> {
  bool _busy = false;

  Future<void> _request() async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request a refund'),
        content: TextField(
          controller: controller,
          maxLines: 3,
          maxLength: 500,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'e.g. Order arrived cold / items were missing…',
            helperText:
                'Approved refunds return to your payment method in 2-3 business days.',
            helperMaxLines: 2,
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, controller.text.trim()),
              child: const Text('Send request')),
        ],
      ),
    );
    if (reason == null) return;
    if (reason.length < 5) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Please describe the problem in a few words.')));
      }
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(orderRepositoryProvider).requestRefund(
          orderId: widget.order.id,
          reason: reason,
          trackToken: widget.trackToken);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text("Refund request sent — we'll update you here.")));
      // Force an immediate re-read so the status card appears without waiting
      // for the next poll (or at all, if the order is terminal).
      ref.invalidate(orderTrackingStreamProvider(
          '${widget.order.id}|${widget.trackToken}'));
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not send the request.')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rr = widget.order.refundRequest;
    if (rr != null) {
      final (icon, title, body) = switch (rr.status) {
        'requested' => (
            Icons.hourglass_top,
            'Refund requested',
            "We're reviewing your request — you'll get an update here and by notification.",
          ),
        'approved' => (
            Icons.thumb_up_alt_outlined,
            'Refund approved',
            'Rs ${rr.amount.toStringAsFixed(0)} will be returned to your payment method within 2-3 business days. Bank statements can take a few extra days to show it.',
          ),
        'refunded' => (
            Icons.check_circle_outline,
            'Refund completed',
            'Rs ${rr.amount.toStringAsFixed(0)} was sent back to your payment method. It may take a few days to appear on your statement.',
          ),
        'rejected' => (
            Icons.cancel_outlined,
            'Refund request declined',
            rr.adminNote.isNotEmpty
                ? 'Reason: ${rr.adminNote}. Please call us if you would like to discuss.'
                : 'Please call us if you would like to discuss this.',
          ),
        _ => (Icons.info_outline, 'Refund', rr.status),
      };
      return Card(
        child: ListTile(
          leading: Icon(icon),
          title: Text(title),
          subtitle: Text(body),
          isThreeLine: true,
        ),
      );
    }
    final eligible = widget.order.paymentStatus == 'paid' &&
        !const {'cod', 'pay_at_restaurant'}
            .contains(widget.order.paymentMethod);
    if (!eligible) return const SizedBox.shrink();
    return OutlinedButton.icon(
      onPressed: _busy ? null : _request,
      icon: _busy
          ? const SizedBox(
              width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
          : const Icon(Icons.currency_exchange),
      label: const Text('Problem with this order? Request a refund'),
    );
  }
}

/// Small "live" pill shown while the tracker is actively polling, mirroring the
/// website's "updates live every 5 seconds" cue.
class _LiveDot extends StatelessWidget {
  const _LiveDot();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: scheme.primary.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
                color: scheme.primary, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text('Live',
              style: TextStyle(
                  color: scheme.primary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
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

/// Rate + comment a delivered order. Shows the existing review (read-only) if
/// one exists, otherwise a form for the signed-in owner. Guests (tracking via
/// token) only see an existing review, since POST /reviews requires auth.
class _ReviewSection extends ConsumerStatefulWidget {
  const _ReviewSection({required this.orderId});
  final String orderId;

  @override
  ConsumerState<_ReviewSection> createState() => _ReviewSectionState();
}

class _ReviewSectionState extends ConsumerState<_ReviewSection> {
  final _comment = TextEditingController();
  int _rating = 0;
  bool _submitting = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ref.read(orderRepositoryProvider).submitReview(
            orderId: widget.orderId,
            rating: _rating,
            comment: _comment.text.trim(),
          );
      ref.invalidate(orderReviewProvider(widget.orderId));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Could not submit review. Please try again.')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reviewAsync = ref.watch(orderReviewProvider(widget.orderId));
    final authed = ref.watch(authControllerProvider).status ==
        AuthStatus.authenticated;

    return reviewAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (review) {
        if (review != null) {
          return _ReviewCard(
            title: 'Your review',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Stars(rating: review.rating),
                if (review.comment.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(review.comment),
                ],
              ],
            ),
          );
        }
        if (!authed) return const SizedBox.shrink();
        return _ReviewCard(
          title: 'Rate your order',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _StarSelector(
                rating: _rating,
                onChanged: (r) => setState(() => _rating = r),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _comment,
                maxLines: 3,
                maxLength: 500,
                decoration: const InputDecoration(
                  hintText: 'Tell us how it was (optional)',
                  border: OutlineInputBorder(),
                  counterText: '',
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed:
                      (_rating == 0 || _submitting) ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Submit review'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: scheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}

class _Stars extends StatelessWidget {
  const _Stars({required this.rating});
  final int rating;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        for (var i = 1; i <= 5; i++)
          Icon(i <= rating ? Icons.star : Icons.star_border,
              color: scheme.primary, size: 22),
      ],
    );
  }
}

class _StarSelector extends StatelessWidget {
  const _StarSelector({required this.rating, required this.onChanged});
  final int rating;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        for (var i = 1; i <= 5; i++)
          IconButton(
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            icon: Icon(i <= rating ? Icons.star : Icons.star_border,
                color: scheme.primary, size: 30),
            onPressed: () => onChanged(i),
          ),
      ],
    );
  }
}

/// Lets the customer push their current GPS to an in-progress order so the
/// restaurant/rider can find them (POST /online-orders/{id}/customer-location).
class _ShareLocationButton extends ConsumerStatefulWidget {
  const _ShareLocationButton({required this.orderId});
  final String orderId;

  @override
  ConsumerState<_ShareLocationButton> createState() =>
      _ShareLocationButtonState();
}

class _ShareLocationButtonState extends ConsumerState<_ShareLocationButton> {
  bool _busy = false;
  bool _shared = false;

  Future<void> _share() async {
    setState(() => _busy = true);
    try {
      final loc = await LocationService.current();
      await ref.read(orderRepositoryProvider).shareLocation(
            orderId: widget.orderId,
            lat: loc.lat,
            lng: loc.lng,
          );
      if (!mounted) return;
      setState(() => _shared = true);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Location shared with the restaurant')));
    } on LocationException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Could not share location. Please try again.')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      color: scheme.secondaryContainer,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(Icons.my_location, color: scheme.onSecondaryContainer),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                _shared
                    ? 'Location shared. Tap to update if you have moved.'
                    : 'Share your live location so the rider can find you.',
                style: TextStyle(color: scheme.onSecondaryContainer),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: _busy ? null : _share,
              child: _busy
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(_shared ? 'Update' : 'Share'),
            ),
          ],
        ),
      ),
    );
  }
}
