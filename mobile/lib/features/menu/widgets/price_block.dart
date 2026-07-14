import 'package:flutter/material.dart';

import '../../../app/tokens.dart';
import '../../../core/format.dart';
import '../menu_models.dart';

/// Price display matched to the website's `PriceBlock` (MenuPage.jsx):
///   * variant item  → "From Rs. {min}"  (+ struck-through original if cheaper)
///   * simple item   → "Rs. {price}"     (+ struck-through original if on sale)
/// All values are backend-supplied; this only chooses which to show.
class PriceBlock extends StatelessWidget {
  const PriceBlock({super.key, required this.item, this.compact = false});

  final MenuItem item;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final priceStyle = TextStyle(
      color: BrandColors.red,
      fontWeight: FontWeight.w900,
      fontSize: compact ? 13 : 16,
    );
    final origStyle = TextStyle(
      fontSize: compact ? 10 : 12,
      decoration: TextDecoration.lineThrough,
      color: BrandColors.mutedForeground,
      fontWeight: FontWeight.w500,
    );
    final orig = item.fromOriginal;
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Flexible(
          child: Text(
            item.showsFromPrice
                ? 'From ${money(item.fromPrice)}'
                : money(item.fromPrice),
            style: priceStyle,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (orig != null) ...[
          const SizedBox(width: 6),
          Text(money(orig), style: origStyle),
        ],
      ],
    );
  }
}

/// The stacked top-right badges on a product image: green "{n}% OFF" and red
/// "Bestseller" pills — mirrors the website `Badges`.
class ProductBadges extends StatelessWidget {
  const ProductBadges({super.key, required this.item});
  final MenuItem item;

  @override
  Widget build(BuildContext context) {
    final badges = <Widget>[];
    if (item.discountPercent > 0) {
      badges.add(_pill('${item.discountPercent}% OFF', BrandColors.discountBadge));
    }
    if (item.isBestseller) {
      badges.add(_pill('Bestseller', BrandColors.bestsellerBadge));
    }
    if (badges.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final b in badges)
          Padding(padding: const EdgeInsets.only(bottom: 4), child: b),
      ],
    );
  }

  Widget _pill(String label, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(BrandRadii.pill),
        ),
        child: Text(
          label.toUpperCase(),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 9,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.3,
          ),
        ),
      );
}
