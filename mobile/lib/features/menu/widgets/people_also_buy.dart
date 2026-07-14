import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/tokens.dart';
import '../../../core/images.dart';
import '../../cart/cart_controller.dart';
import '../menu_models.dart';
import '../menu_screen.dart' show showItemCustomizeSheet;
import '../upsell_repository.dart';
import 'price_block.dart';

/// "People also buy" horizontal strip, mirroring the website's PeopleAlsoBuy.
/// Shows on cart + checkout. Recommendations come from the backend
/// (/menu/upsell); adding routes through cartProvider so identical configs stack
/// (no duplicate lines) and variant items open the shared customization sheet.
/// Renders nothing while empty/loading so it never adds noise to the layout.
class PeopleAlsoBuy extends ConsumerWidget {
  const PeopleAlsoBuy({super.key, this.title = 'People also buy'});
  final String title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(cartUpsellProvider);
    final items = async.asData?.value ?? const <MenuItem>[];
    if (items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Row(
            children: [
              const Icon(Icons.auto_awesome, size: 18, color: BrandColors.yellowDark),
              const SizedBox(width: 6),
              Text(title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 15)),
            ],
          ),
        ),
        SizedBox(
          height: 194,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            physics: const BouncingScrollPhysics(),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (_, i) => _UpsellCard(item: items[i]),
          ),
        ),
      ],
    );
  }
}

class _UpsellCard extends ConsumerWidget {
  const _UpsellCard({required this.item});
  final MenuItem item;

  Future<void> _add(BuildContext context, WidgetRef ref) async {
    if (item.needsCustomization) {
      await showItemCustomizeSheet(context, item);
    } else {
      ref.read(cartProvider.notifier).add(item);
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(
          content: Text('${item.name} added to cart'),
          duration: const Duration(milliseconds: 900),
        ));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: 140,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(BrandRadii.md),
                child: SizedBox(
                  height: 110,
                  width: 140,
                  child: ProductImage(imageUrl: item.imageUrl, iconSize: 28),
                ),
              ),
              Positioned(top: 6, left: 6, child: ProductBadges(item: item)),
              Positioned(
                bottom: 6,
                right: 6,
                child: Material(
                  color: BrandColors.ink,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: () => _add(context, ref),
                    child: const SizedBox(
                      width: 30,
                      height: 30,
                      child: Icon(Icons.add, size: 18, color: Colors.white),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            item.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
                fontWeight: FontWeight.w600, fontSize: 13, color: scheme.onSurface),
          ),
          const SizedBox(height: 2),
          PriceBlock(item: item, compact: true),
        ],
      ),
    );
  }
}
