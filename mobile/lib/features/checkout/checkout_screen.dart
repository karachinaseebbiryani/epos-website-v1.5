import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/location.dart';
import '../auth/auth_controller.dart';
import '../cart/cart_controller.dart';
import '../orders/order_models.dart';
import '../orders/order_repository.dart';
import '../payment/payment_models.dart';
import '../payment/payment_repository.dart';
import '../profile/profile_repository.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});
  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _notes = TextEditingController();
  final _coupon = TextEditingController();
  String _paymentMethod = 'cod';
  bool _busy = false;

  double? _lat;
  double? _lng;
  DeliveryQuote? _quote;
  bool _locating = false;

  @override
  void initState() {
    super.initState();
    final c = ref.read(authControllerProvider).customer;
    if (c != null) {
      _name.text = c.name;
      _phone.text = c.phone;
    }
    // Auto-fill saved allergens into the order note so the kitchen sees them.
    // Kept editable; only prefilled when the note is otherwise empty.
    final allergens = ref.read(allergensProvider).asData?.value;
    if (allergens != null && allergens.isNotEmpty && _notes.text.isEmpty) {
      _notes.text = 'Allergies: ${allergens.join(', ')}';
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _notes.dispose();
    _coupon.dispose();
    super.dispose();
  }

  double get _deliveryFee => _quote?.fee ?? 0;
  bool get _outOfRange => _quote != null && !_quote!.inRange;

  Future<void> _captureLocation() async {
    setState(() => _locating = true);
    try {
      final loc = await LocationService.current();
      final q = await ref.read(orderRepositoryProvider).quote(
            lat: loc.lat,
            lng: loc.lng,
            subtotal: ref.read(cartSubtotalProvider),
          );
      if (!mounted) return;
      setState(() {
        _lat = loc.lat;
        _lng = loc.lng;
        _quote = q;
      });
      if (!q.inRange) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content:
                Text('Sorry - your location is outside our delivery area.')));
      }
    } on LocationException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Could not get a delivery quote. Please try again.')));
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _placeOrder() async {
    if (!_formKey.currentState!.validate()) return;
    final lines = ref.read(cartProvider);
    if (lines.isEmpty) return;
    setState(() => _busy = true);
    try {
      final order = await ref.read(orderRepositoryProvider).placeOrder(
            lines: lines,
            subtotal: ref.read(cartSubtotalProvider),
            customerName: _name.text.trim(),
            phone: _phone.text.trim(),
            address: _address.text.trim(),
            notes: _notes.text.trim(),
            paymentMethod: _paymentMethod,
            couponCode: _coupon.text.trim(),
            deliveryLat: _lat,
            deliveryLng: _lng,
          );
      ref.read(cartProvider.notifier).clear();
      if (!mounted) return;
      final tok = order.trackToken ?? '';
      // Route by payment method: manual transfers need a reference/proof step,
      // SafePay opens the hosted checkout; COD / pay-at-restaurant go straight
      // to tracking.
      const manual = {'easypaisa', 'jazzcash', 'bank'};
      if (manual.contains(_paymentMethod)) {
        context.go('/order/${order.id}/pay?via=$_paymentMethod&t=$tok');
      } else if (_paymentMethod == 'safepay') {
        context.go('/order/${order.id}/safepay?t=$tok');
      } else {
        context.go('/order/${order.id}?t=$tok');
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Could not place order. Please try again.')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final subtotal = ref.watch(cartSubtotalProvider);
    final total = subtotal + _deliveryFee;
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(
                  labelText: 'Name', border: OutlineInputBorder()),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Enter your name' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                  labelText: 'Phone', border: OutlineInputBorder()),
              validator: (v) =>
                  (v == null || v.trim().length < 7) ? 'Enter your phone' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _address,
              maxLines: 2,
              decoration: const InputDecoration(
                  labelText: 'Delivery address', border: OutlineInputBorder()),
              validator: (v) => (v == null || v.trim().length < 6)
                  ? 'Enter your address'
                  : null,
            ),
            const SizedBox(height: 20),
            _DeliveryLocationCard(
              hasLocation: _lat != null,
              locating: _locating,
              quote: _quote,
              onCapture: _locating ? null : _captureLocation,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notes,
              decoration: const InputDecoration(
                  labelText: 'Notes (optional)', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _coupon,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'Coupon code (optional)',
                helperText: 'Applied when you place the order',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 20),
            Text('Payment method',
                style: Theme.of(context).textTheme.titleMedium),
            _PaymentMethodPicker(
              selected: _paymentMethod,
              onChanged: (v) => setState(() => _paymentMethod = v),
            ),
            const Divider(height: 28),
            _SummaryRow(label: 'Subtotal', value: money(subtotal)),
            const SizedBox(height: 4),
            _SummaryRow(
              label: 'Delivery',
              value: _quote == null
                  ? '-'
                  : (_quote!.freeDelivery ? 'FREE' : money(_deliveryFee)),
            ),
            const SizedBox(height: 6),
            _SummaryRow(label: 'Total', value: money(total), bold: true),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: (_busy || _outOfRange || _lat == null) ? null : _placeOrder,
              child: _busy
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(_outOfRange
                      ? 'Outside delivery area'
                      : _lat == null
                          ? 'Add delivery location'
                          : 'Place order - ${money(total)}'),
            ),
          ),
        ),
      ),
    );
  }
}

/// Payment options driven by GET /public/settings. COD + pay-at-restaurant are
/// always available; Easypaisa/JazzCash/bank appear when `bank_transfer` is on
/// and the account is configured; SafePay (card) appears when `card` is on.
class _PaymentMethodPicker extends ConsumerWidget {
  const _PaymentMethodPicker({required this.selected, required this.onChanged});

  final String selected;
  final ValueChanged<String> onChanged;

  List<PaymentOption> _options(PublicPaymentSettings? s) {
    return [
      if (s == null || s.cod)
        const PaymentOption(method: 'cod', title: 'Cash on delivery'),
      if (s == null || s.payAtRestaurant)
        const PaymentOption(
            method: 'pay_at_restaurant', title: 'Pay at restaurant'),
      if (s != null && s.hasEasypaisa)
        const PaymentOption(
            method: 'easypaisa',
            title: 'Easypaisa',
            subtitle: 'Transfer then submit reference',
            needsTransfer: true),
      if (s != null && s.hasJazzcash)
        const PaymentOption(
            method: 'jazzcash',
            title: 'JazzCash',
            subtitle: 'Transfer then submit reference',
            needsTransfer: true),
      if (s != null && s.hasBank)
        const PaymentOption(
            method: 'bank',
            title: 'Bank transfer',
            subtitle: 'Transfer then submit reference',
            needsTransfer: true),
      if (s != null && s.card)
        const PaymentOption(
            method: 'safepay',
            title: 'Debit / Credit card',
            subtitle: 'Pay securely online',
            isGateway: true),
    ];
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(paymentSettingsProvider).asData?.value;
    final options = _options(settings);
    return RadioGroup<String>(
      groupValue: selected,
      onChanged: (v) {
        if (v != null) onChanged(v);
      },
      child: Column(
        children: [
          for (final o in options)
            RadioListTile<String>(
              value: o.method,
              title: Text(o.title),
              subtitle: o.subtitle == null ? null : Text(o.subtitle!),
              contentPadding: EdgeInsets.zero,
            ),
        ],
      ),
    );
  }
}

class _DeliveryLocationCard extends StatelessWidget {
  const _DeliveryLocationCard({
    required this.hasLocation,
    required this.locating,
    required this.quote,
    required this.onCapture,
  });

  final bool hasLocation;
  final bool locating;
  final DeliveryQuote? quote;
  final VoidCallback? onCapture;

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
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.location_on, color: scheme.primary, size: 20),
                const SizedBox(width: 8),
                Text('Delivery location',
                    style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 8),
            if (hasLocation)
              Row(
                children: [
                  Icon(Icons.check_circle, color: scheme.primary, size: 18),
                  const SizedBox(width: 6),
                  const Expanded(child: Text('Location captured')),
                  TextButton(
                    onPressed: onCapture,
                    child: Text(locating ? '...' : 'Update'),
                  ),
                ],
              )
            else
              OutlinedButton.icon(
                onPressed: onCapture,
                icon: locating
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.my_location),
                label: Text(locating
                    ? 'Getting your location...'
                    : 'Use my current location'),
              ),
            if (quote != null) ...[
              const SizedBox(height: 8),
              _QuoteLine(quote: quote!),
            ],
          ],
        ),
      ),
    );
  }
}

class _QuoteLine extends StatelessWidget {
  const _QuoteLine({required this.quote});
  final DeliveryQuote quote;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (!quote.inRange) {
      final maxKm = quote.maxRadiusKm.toStringAsFixed(0);
      return Text(
        'Outside our delivery area (max $maxKm km).',
        style: TextStyle(color: scheme.error),
      );
    }
    final km = quote.distanceKm.toStringAsFixed(1);
    final feeText =
        quote.freeDelivery ? 'Free delivery' : 'Delivery ${money(quote.fee)}';
    return Text(
      '$km km away - $feeText',
      style: TextStyle(color: scheme.onSurfaceVariant),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow(
      {required this.label, required this.value, this.bold = false});
  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final style = bold
        ? Theme.of(context)
            .textTheme
            .titleMedium
            ?.copyWith(fontWeight: FontWeight.w700)
        : Theme.of(context).textTheme.bodyMedium;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [Text(label, style: style), Text(value, style: style)],
    );
  }
}
