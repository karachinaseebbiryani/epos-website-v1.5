import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/format.dart';
import '../../core/images.dart';
import 'offers_models.dart';
import 'offers_repository.dart';
import 'widgets/offer_countdown.dart';

class OffersScreen extends ConsumerStatefulWidget {
  const OffersScreen({super.key});

  @override
  ConsumerState<OffersScreen> createState() => _OffersScreenState();
}

class _OffersScreenState extends ConsumerState<OffersScreen> {
  Set<String> _hiddenCouponIds = {};

  @override
  void initState() {
    super.initState();
    _loadHiddenCoupons();
  }

  Future<void> _loadHiddenCoupons() async {
    final prefs = await SharedPreferences.getInstance();
    final hidden = prefs.getStringList('hidden_coupons') ?? [];
    setState(() {
      _hiddenCouponIds = hidden.toSet();
    });
  }

  Future<void> _hideCoupon(String couponId) async {
    setState(() {
      _hiddenCouponIds.add(couponId);
    });
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('hidden_coupons', _hiddenCouponIds.toList());
  }

  @override
  Widget build(BuildContext context) {
    final offersAsync = ref.watch(offersProvider);
    final couponsAsync = ref.watch(myCouponsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Offers & Coupons')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(offersProvider);
          ref.invalidate(myCouponsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            couponsAsync.maybeWhen(
              data: (coupons) {
                final visibleCoupons = coupons
                    .where((c) => !_hiddenCouponIds.contains(c.id))
                    .toList();
                return visibleCoupons.isEmpty
                    ? const SizedBox.shrink()
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Your coupons',
                              style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 8),
                          for (final c in visibleCoupons)
                            _CouponCard(
                              coupon: c,
                              onHide: () => _hideCoupon(c.id),
                            ),
                          const SizedBox(height: 16),
                        ],
                      );
              },
              orElse: () => const SizedBox.shrink(),
            ),
            Text('Offers', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            offersAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Text('$e', textAlign: TextAlign.center),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: () => ref.invalidate(offersProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (offers) => offers.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(child: Text('No offers right now')),
                    )
                  : Column(
                      children: [for (final o in offers) _OfferCard(offer: o)],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

String _discountText(double percent, double amount) {
  if (percent > 0) return '${percent.toStringAsFixed(0)}% off';
  if (amount > 0) return '${money(amount)} off';
  return '';
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.offer});
  final Offer offer;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final disc = _discountText(offer.discountPercent, offer.discountAmount);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: scheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (offer.imageUrl.trim().isNotEmpty)
            SizedBox(
              height: 140,
              child: ProductImage(imageUrl: offer.imageUrl),
            ),
          Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(offer.title,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
                if (disc.isNotEmpty)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: scheme.primaryContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(disc,
                        style: TextStyle(
                            color: scheme.onPrimaryContainer,
                            fontWeight: FontWeight.w600)),
                  ),
              ],
            ),
            if (offer.description.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(offer.description,
                  style: TextStyle(color: scheme.onSurfaceVariant)),
            ],
            if (offer.minOrderAmount > 0) ...[
              const SizedBox(height: 4),
              Text('Min order ${money(offer.minOrderAmount)}',
                  style: TextStyle(
                      fontSize: 12, color: scheme.onSurfaceVariant)),
            ],
            if (offer.hasExpiry) ...[
              const SizedBox(height: 6),
              OfferCountdown(offer: offer),
            ],
            if (offer.couponCode.isNotEmpty) ...[
              const SizedBox(height: 8),
              _CodeChip(code: offer.couponCode),
            ],
          ],
        ),
          ),
        ],
      ),
    );
  }
}

class _CouponCard extends StatelessWidget {
  const _CouponCard({required this.coupon, required this.onHide});
  final PersonalCoupon coupon;
  final VoidCallback onHide;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final disc = _discountText(coupon.discountPercent, coupon.discountAmount);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      color: scheme.secondaryContainer,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(disc.isEmpty ? 'Coupon' : disc,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      if (coupon.source.isNotEmpty)
                        Text(coupon.source,
                            style: TextStyle(
                                fontSize: 12, color: scheme.onSecondaryContainer)),
                    ],
                  ),
                ),
                _CodeChip(code: coupon.code),
              ],
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: onHide,
                icon: const Icon(Icons.visibility_off, size: 16),
                label: const Text('Hide'),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CodeChip extends StatelessWidget {
  const _CodeChip({required this.code});
  final String code;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: () {
        Clipboard.setData(ClipboardData(text: code));
        ScaffoldMessenger.of(context)
          ..clearSnackBars()
          ..showSnackBar(SnackBar(
              content: Text('Copied "$code"'),
              duration: const Duration(milliseconds: 900)));
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: scheme.outline),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(code,
                style: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: 1)),
            const SizedBox(width: 6),
            const Icon(Icons.copy, size: 14),
          ],
        ),
      ),
    );
  }
}
