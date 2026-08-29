import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/tokens.dart';
import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/location.dart';
import '../auth/auth_controller.dart';
import '../cart/cart_controller.dart';
import '../loyalty/loyalty_repository.dart';
import '../loyalty/widgets/diamond_pill.dart';
import '../menu/menu_repository.dart';
import '../menu/widgets/people_also_buy.dart';
import '../offers/offers_logic.dart';
import '../offers/offers_repository.dart';
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
  String _orderType = 'delivery'; // 'delivery' | 'pickup'
  bool _busy = false;
  bool _useWalletCredit = false;

  bool get _isPickup => _orderType == 'pickup';

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
    // Re-validate a possibly-restored/stale cart against the live menu before
    // the customer pays: drop unavailable items, refresh prices to backend
    // truth. The server still re-prices authoritatively on order.
    WidgetsBinding.instance.addPostFrameCallback((_) => _revalidateCart());
  }

  Future<void> _revalidateCart() async {
    try {
      final menu = await ref.read(menuRepositoryProvider).fetchMenu();
      if (!mounted) return;
      final result = ref.read(cartProvider.notifier).reconcile(menu);
      if (!mounted || !result.changed) return;
      final parts = <String>[
        if (result.removedItems.isNotEmpty)
          '${result.removedItems.join(', ')} no longer available',
        if (result.pricesChanged) 'prices updated',
      ];
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Cart updated: ${parts.join(' · ')}'),
        duration: const Duration(seconds: 3),
      ));
      if (ref.read(cartProvider).isEmpty && mounted) {
        context.go('/'); // everything went out of stock
      }
    } catch (_) {
      // Non-blocking: if the menu can't be fetched, checkout proceeds and the
      // backend still validates at order time.
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
    final customer = ref.read(authControllerProvider).customer;
    final walletBalance = customer?.walletBalance ?? 0.0;
    final subtotal = ref.read(cartSubtotalProvider);
    final totalBeforeWallet = subtotal + _deliveryFee;
    final walletCreditApplied = _useWalletCredit
        ? (walletBalance > totalBeforeWallet ? totalBeforeWallet : walletBalance)
        : 0.0;
    setState(() => _busy = true);
    try {
      final order = await ref.read(orderRepositoryProvider).placeOrder(
            lines: lines,
            subtotal: ref.read(cartSubtotalProvider),
            customerName: _name.text.trim(),
            phone: _phone.text.trim(),
            address: _address.text.trim(),
            orderType: _orderType,
            notes: _notes.text.trim(),
            paymentMethod: _paymentMethod,
            couponCode: _coupon.text.trim(),
            deliveryLat: _isPickup ? null : _lat,
            deliveryLng: _isPickup ? null : _lng,
            rewardId: ref.read(selectedRewardProvider)?.id,
            useWalletCredit: _useWalletCredit,
            walletCreditAmount: _useWalletCredit ? walletCreditApplied : 0.0,
          );
      ref.read(cartProvider.notifier).clear();
      // Reward is consumed by this order (server deducted the diamonds).
      ref.read(selectedRewardProvider.notifier).state = null;
      // Diamonds are awarded server-side on delivery; refresh the cached balance
      // so the pill reflects any coupon/loyalty change on next view.
      ref.invalidate(loyaltyBalanceProvider);
      // Wallet balance may have been deducted — refresh customer data.
      if (_useWalletCredit && walletCreditApplied > 0) {
        ref.invalidate(authControllerProvider);
      }
      if (!mounted) return;
      final tok = order.trackToken ?? '';
      // Route by payment method. Wallets (Easypaisa/JazzCash) go through the
      // PayFast hosted checkout when that gateway is configured — a real
      // in-app charge — and fall back to the manual transfer+reference screen
      // when it isn't. Bank transfer is always manual; card uses SafePay;
      // COD / pay-at-restaurant go straight to tracking.
      final gatewayOn =
          ref.read(paymentSettingsProvider).asData?.value.gatewayOn ?? false;
      const wallets = {'easypaisa', 'jazzcash'};
      if (wallets.contains(_paymentMethod) && gatewayOn) {
        context.go(
            '/order/${order.id}/payfast?via=$_paymentMethod&t=$tok');
      } else if (wallets.contains(_paymentMethod) || _paymentMethod == 'bank') {
        context.go('/order/${order.id}/pay?via=$_paymentMethod&t=$tok');
      } else if (_paymentMethod == 'safepay') {
        context.go('/order/${order.id}/safepay?via=card&t=$tok');
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
    final customer = ref.watch(authControllerProvider).customer;
    final walletBalance = customer?.walletBalance ?? 0.0;
    final totalBeforeWallet = subtotal + _deliveryFee;
    final walletCreditApplied = _useWalletCredit
        ? (walletBalance > totalBeforeWallet ? totalBeforeWallet : walletBalance)
        : 0.0;
    final total = totalBeforeWallet - walletCreditApplied;
    final needsVerify = customer != null && !customer.emailVerified;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Checkout'),
        actions: const [DiamondPill()],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (needsVerify) ...[
              _VerifyEmailBanner(
                onVerify: () => context.push('/verify-email?redirect=/checkout'),
              ),
              const SizedBox(height: 16),
            ],
            _OrderTypeSelector(
              selected: _orderType,
              onChanged: (v) => setState(() => _orderType = v),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _name,
              maxLength: 60,
              decoration: const InputDecoration(
                  labelText: 'Name',
                  border: OutlineInputBorder(),
                  counterText: ''),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Enter your name' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              maxLength: 20,
              decoration: const InputDecoration(
                  labelText: 'Phone',
                  border: OutlineInputBorder(),
                  counterText: ''),
              validator: (v) =>
                  (v == null || v.trim().length < 7) ? 'Enter your phone' : null,
            ),
            const SizedBox(height: 12),
            // Address + delivery location are only relevant for delivery orders.
            // Pickup / pay-at-restaurant customers are never asked for them.
            if (!_isPickup) ...[
              TextFormField(
                controller: _address,
                maxLines: 2,
                maxLength: 200,
                decoration: const InputDecoration(
                    labelText: 'Delivery address',
                    border: OutlineInputBorder(),
                    counterText: ''),
                validator: (v) => _isPickup
                    ? null
                    : (v == null || v.trim().length < 6)
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
            ] else
              const _PickupNotice(),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notes,
              maxLength: 300,
              decoration: const InputDecoration(
                  labelText: 'Notes (optional)',
                  border: OutlineInputBorder(),
                  counterText: ''),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _coupon,
              maxLength: 30,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'Coupon code (optional)',
                helperText: 'Applied and validated when you place the order',
                border: OutlineInputBorder(),
                counterText: '',
              ),
            ),
            const SizedBox(height: 8),
            _CouponSuggestion(
              subtotal: subtotal,
              currentCode: _coupon.text.trim(),
              onApply: (code) => setState(() => _coupon.text = code),
            ),
            // Diamond reward picked on the Diamonds screen — applied server-side.
            Consumer(builder: (context, ref, _) {
              final reward = ref.watch(selectedRewardProvider);
              if (reward == null) return const SizedBox.shrink();
              final clashesWithCoupon = _coupon.text.trim().isNotEmpty &&
                  reward.rewardType != 'free_item';
              return Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    InputChip(
                      avatar: const Icon(Icons.diamond,
                          size: 18, color: BrandColors.yellowDark),
                      label: Text(
                          '${reward.benefitLabel} · ${reward.costDiamonds} 💎'),
                      onDeleted: () => ref
                          .read(selectedRewardProvider.notifier)
                          .state = null,
                    ),
                    if (clashesWithCoupon)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'A coupon can\'t be combined with a diamond discount — remove one.',
                          style: TextStyle(
                              fontSize: 12,
                              color: Theme.of(context).colorScheme.error),
                        ),
                      ),
                  ],
                ),
              );
            }),
            const SizedBox(height: 20),
            Text('Payment method',
                style: Theme.of(context).textTheme.titleMedium),
            _PaymentMethodPicker(
              selected: _paymentMethod,
              onChanged: (v) => setState(() => _paymentMethod = v),
            ),
            // Wallet credit toggle — only shown when customer has balance
            if (walletBalance > 0) ...[
              const SizedBox(height: 12),
              CheckboxListTile(
                value: _useWalletCredit,
                onChanged: (val) => setState(() => _useWalletCredit = val ?? false),
                title: Text(
                  'Use wallet credit (Rs. ${walletBalance.toStringAsFixed(0)} available)',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
                dense: true,
              ),
            ],
            const SizedBox(height: 8),
            // "People also buy" — same recommendations the website shows at
            // checkout. Its own internal padding handles horizontal insets.
            const PeopleAlsoBuy(),
            const Divider(height: 28),
            _SummaryRow(label: 'Subtotal', value: money(subtotal)),
            if (!_isPickup) ...[
              const SizedBox(height: 4),
              _SummaryRow(
                label: 'Delivery',
                value: _quote == null
                    ? '-'
                    : (_quote!.freeDelivery ? 'FREE' : money(_deliveryFee)),
              ),
            ],
            if (walletCreditApplied > 0) ...[
              const SizedBox(height: 4),
              _SummaryRow(
                label: 'Wallet credit',
                value: '- ${money(walletCreditApplied)}',
                color: Colors.green,
              ),
            ],
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
              onPressed: (_busy ||
                      needsVerify ||
                      (!_isPickup && (_outOfRange || _lat == null)))
                  ? (needsVerify
                      ? () => context.push('/verify-email?redirect=/checkout')
                      : null)
                  : _placeOrder,
              child: _busy
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(needsVerify
                      ? 'Verify email to order'
                      : _isPickup
                          ? 'Place pickup order - ${money(total)}'
                          : _outOfRange
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

/// Shown at the top of checkout when a signed-in account hasn't verified its
/// email — the backend will reject the order otherwise.
class _VerifyEmailBanner extends StatelessWidget {
  const _VerifyEmailBanner({required this.onVerify});
  final VoidCallback onVerify;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: BrandColors.yellow.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(BrandRadii.md),
        border: Border.all(color: BrandColors.yellowDark.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.mark_email_unread_outlined,
              color: BrandColors.yellowDark),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Verify your email to place orders and earn diamonds.',
              style: TextStyle(
                  color: BrandColors.ink, fontWeight: FontWeight.w600),
            ),
          ),
          TextButton(onPressed: onVerify, child: const Text('Verify')),
        ],
      ),
    );
  }
}

/// Delivery vs Pickup toggle. Pickup hides the address + delivery fee entirely.
class _OrderTypeSelector extends StatelessWidget {
  const _OrderTypeSelector({required this.selected, required this.onChanged});
  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<String>(
      segments: const [
        ButtonSegment(
            value: 'delivery',
            label: Text('Delivery'),
            icon: Icon(Icons.delivery_dining)),
        ButtonSegment(
            value: 'pickup',
            label: Text('Pickup'),
            icon: Icon(Icons.storefront)),
      ],
      selected: {selected},
      onSelectionChanged: (s) => onChanged(s.first),
      showSelectedIcon: false,
    );
  }
}

/// Shown instead of the address/location card for pickup orders.
class _PickupNotice extends StatelessWidget {
  const _PickupNotice();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: BrandColors.cream,
        borderRadius: BorderRadius.circular(BrandRadii.md),
      ),
      child: Row(
        children: [
          const Icon(Icons.storefront, color: BrandColors.red, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Pick up your order at the restaurant — no delivery address needed.',
              style: TextStyle(color: scheme.onSurface),
            ),
          ),
        ],
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
      if (s != null && s.easypaisaAvailable)
        PaymentOption(
            method: 'easypaisa',
            title: 'Easypaisa',
            subtitle: s.gatewayOn
                ? 'Pay in app via secure checkout'
                : 'Transfer then submit reference',
            needsTransfer: !s.gatewayOn),
      if (s != null && s.jazzcashAvailable)
        PaymentOption(
            method: 'jazzcash',
            title: 'JazzCash',
            subtitle: s.gatewayOn
                ? 'Pay in app via secure checkout'
                : 'Transfer then submit reference',
            needsTransfer: !s.gatewayOn),
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

/// Suggests the single best eligible coupon for the current subtotal and lets
/// the customer apply it with one tap. The backend still validates and computes
/// the real discount on order — this only stages the code into the field.
class _CouponSuggestion extends ConsumerWidget {
  const _CouponSuggestion({
    required this.subtotal,
    required this.currentCode,
    required this.onApply,
  });

  final double subtotal;
  final String currentCode;
  final ValueChanged<String> onApply;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offers = ref.watch(offersProvider).asData?.value ?? const [];
    final coupons = ref.watch(myCouponsProvider).asData?.value ?? const [];
    final best = bestEligibleCoupon(
      offers: offers,
      personal: coupons,
      subtotal: subtotal,
    );
    if (best == null) return const SizedBox.shrink();
    // Already applied → confirm, don't re-suggest.
    final applied = currentCode.toUpperCase() == best.code.toUpperCase();
    final saving = best.indicativeValue(subtotal);

    return Material(
      color: BrandColors.cream,
      borderRadius: BorderRadius.circular(BrandRadii.md),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            const Icon(Icons.local_offer, size: 18, color: BrandColors.red),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    applied
                        ? '${best.code} applied'
                        : 'Save ~Rs. ${saving.toStringAsFixed(0)} with ${best.code}',
                    style: const TextStyle(
                        color: BrandColors.ink, fontWeight: FontWeight.w700),
                  ),
                  Text(best.label,
                      style: const TextStyle(
                          color: BrandColors.mutedForeground, fontSize: 12)),
                ],
              ),
            ),
            if (applied)
              const Icon(Icons.check_circle, color: BrandColors.discountBadge)
            else
              TextButton(
                onPressed: () => onApply(best.code),
                child: const Text('Apply'),
              ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow(
      {required this.label, required this.value, this.bold = false, this.color});
  final String label;
  final String value;
  final bool bold;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final style = bold
        ? Theme.of(context)
            .textTheme
            .titleMedium
            ?.copyWith(fontWeight: FontWeight.w700, color: color)
        : Theme.of(context).textTheme.bodyMedium?.copyWith(color: color);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [Text(label, style: style), Text(value, style: style)],
    );
  }
}
