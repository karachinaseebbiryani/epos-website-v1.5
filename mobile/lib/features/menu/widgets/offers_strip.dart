import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/tokens.dart';
import '../../offers/offers_models.dart';
import '../../offers/offers_repository.dart';
import '../../offers/widgets/offer_countdown.dart';

/// Horizontal strip of live offers shown at the top of the menu/home, so deals
/// are discoverable without digging into Profile (mirrors the website's home
/// "Exclusive Offers" row). Tapping a card copies the coupon code and routes to
/// the full Offers screen. Renders nothing when there are no offers.
class OffersStrip extends ConsumerWidget {
  const OffersStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final all = ref.watch(offersProvider).asData?.value ?? const <Offer>[];
    // Drop any offer that expired while the screen was open (server already
    // filters expired ones out on fetch).
    final offers = all.where((o) => !o.isExpired).toList();
    if (offers.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
          child: Row(
            children: [
              const Icon(Icons.local_offer, size: 16, color: BrandColors.red),
              const SizedBox(width: 6),
              const Text('Offers for you',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
              const Spacer(),
              TextButton(
                onPressed: () => context.push('/offers'),
                style: TextButton.styleFrom(
                    padding: EdgeInsets.zero, minimumSize: const Size(0, 0)),
                child: const Text('See all'),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 96,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: offers.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (_, i) => _OfferCard(offer: offers[i]),
          ),
        ),
      ],
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.offer});
  final Offer offer;

  String get _discountText {
    if (offer.discountPercent > 0) {
      return '${offer.discountPercent.toStringAsFixed(0)}% OFF';
    }
    if (offer.discountAmount > 0) {
      return 'Rs. ${offer.discountAmount.toStringAsFixed(0)} OFF';
    }
    return 'Offer';
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(BrandRadii.card),
      onTap: offer.couponCode.isEmpty
          ? null
          : () {
              Clipboard.setData(ClipboardData(text: offer.couponCode));
              ScaffoldMessenger.of(context)
                ..clearSnackBars()
                ..showSnackBar(SnackBar(
                  content: Text('Code ${offer.couponCode} copied'),
                  duration: const Duration(milliseconds: 1200),
                ));
            },
      child: Container(
        width: 210,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [BrandColors.red, BrandColors.yellowDark],
          ),
          borderRadius: BorderRadius.circular(BrandRadii.card),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(BrandRadii.pill),
                  ),
                  child: Text(_discountText,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 11)),
                ),
                const Spacer(),
                OfferCountdown(offer: offer, onLight: true),
              ],
            ),
            Text(
              offer.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 14),
            ),
            if (offer.couponCode.isNotEmpty)
              Row(
                children: [
                  const Icon(Icons.content_copy, size: 12, color: Colors.white70),
                  const SizedBox(width: 4),
                  Text(offer.couponCode,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5)),
                ],
              )
            else
              Text(
                offer.minOrderAmount > 0
                    ? 'Min. Rs. ${offer.minOrderAmount.toStringAsFixed(0)}'
                    : 'Auto-applied',
                style: const TextStyle(color: Colors.white70, fontSize: 11),
              ),
          ],
        ),
      ),
    );
  }
}

/// Compact one-line banner for the cart: nudges customers toward the Offers
/// screen when deals exist. Hidden when there are none.
class OffersCartBanner extends ConsumerWidget {
  const OffersCartBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(offersProvider).asData?.value.length ?? 0;
    if (count == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Material(
        color: BrandColors.cream,
        borderRadius: BorderRadius.circular(BrandRadii.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(BrandRadii.md),
          onTap: () => context.push('/offers'),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                const Icon(Icons.local_offer, size: 18, color: BrandColors.red),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    count == 1
                        ? '1 offer available — tap to view'
                        : '$count offers available — tap to view',
                    style: const TextStyle(
                        color: BrandColors.ink, fontWeight: FontWeight.w600),
                  ),
                ),
                const Icon(Icons.chevron_right, color: BrandColors.red),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
