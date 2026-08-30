import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme_controller.dart';
import '../../app/tokens.dart';
import '../../core/format.dart';
import '../../core/images.dart';
import '../hours/business_hours.dart';
import '../cart/cart_controller.dart';
import '../loyalty/widgets/diamond_pill.dart';
import 'menu_models.dart';
import 'menu_repository.dart';
import 'widgets/offers_strip.dart';
import 'widgets/price_block.dart';

/// Opens the item-customization bottom sheet for [item]. Public so other
/// surfaces (e.g. the "People also buy" upsell strip) can reuse the exact same
/// picker instead of re-implementing size/modifier selection.
Future<void> showItemCustomizeSheet(BuildContext context, MenuItem item) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _CustomizeSheet(item: item),
  );
}

class MenuScreen extends ConsumerWidget {
  const MenuScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final menuAsync = ref.watch(menuProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Karachi Naseeb'),
        actions: [
          const DiamondPill(),
          IconButton(
            tooltip: 'Theme',
            icon: Icon(switch (ref.watch(themeModeControllerProvider)) {
              ThemeMode.light => Icons.light_mode,
              ThemeMode.dark => Icons.dark_mode,
              ThemeMode.system => Icons.brightness_auto,
            }),
            onPressed: () =>
                ref.read(themeModeControllerProvider.notifier).cycle(),
          ),
          IconButton(
            tooltip: 'Account',
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.push('/profile'),
          ),
        ],
      ),
      floatingActionButton: const _CartFab(),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(menuProvider),
        child: Column(
          children: [
            const _ClosedBanner(),
            const OffersStrip(),
            Expanded(
              child: menuAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => _MenuError(
                  message: '$e',
                  onRetry: () => ref.invalidate(menuProvider),
                ),
                data: (menu) => _MenuBody(menu: menu),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MenuBody extends StatelessWidget {
  const _MenuBody({required this.menu});
  final Menu menu;

  @override
  Widget build(BuildContext context) {
    // Fall back to a single "Menu" tab if the backend returned no categories.
    final categories = menu.categories.isNotEmpty
        ? menu.categories
        : const [Category(id: '', name: 'Menu')];

    return DefaultTabController(
      length: categories.length,
      child: Column(
        children: [
          Material(
            color: Theme.of(context).appBarTheme.backgroundColor,
            child: TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: [for (final c in categories) Tab(text: c.name)],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                for (final c in categories)
                  _CategoryItems(
                    items: c.id.isEmpty
                        ? menu.items
                        : menu.itemsForCategory(c.id),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryItems extends StatelessWidget {
  const _CategoryItems({required this.items});
  final List<MenuItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const Center(child: Text('No items in this category yet'));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) => _ItemTile(item: items[i]),
    );
  }
}

class _ItemTile extends ConsumerWidget {
  const _ItemTile({required this.item});
  final MenuItem item;

  Future<void> _onAdd(BuildContext context, WidgetRef ref) async {
    if (item.needsCustomization) {
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => _CustomizeSheet(item: item),
      );
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
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: scheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 76,
                height: 76,
                child: Stack(
                  children: [
                    Positioned.fill(child: ProductImage(imageUrl: item.imageUrl)),
                    Positioned(
                      top: 4,
                      left: 4,
                      child: ProductBadges(item: item),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.name,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  if (item.description.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        item.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 12, color: scheme.onSurfaceVariant),
                      ),
                    ),
                  const SizedBox(height: 6),
                  PriceBlock(item: item),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _AddButton(
              label: item.needsCustomization ? 'Choose' : 'Add',
              onPressed: () => _onAdd(context, ref),
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact red-pill add/choose button matching the website's primary CTA.
class _AddButton extends StatelessWidget {
  const _AddButton({required this.label, required this.onPressed});
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: BrandColors.red,
        foregroundColor: Colors.white,
        minimumSize: const Size(0, 40),
        padding: const EdgeInsets.symmetric(horizontal: 18),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(BrandRadii.pill),
        ),
      ),
      child: Text(label,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
    );
  }
}

/// Full item-customization bottom sheet: size (required single-choice),
/// modifier groups (single = radio, multi = checkboxes with min/max rules),
/// ingredient removals, and a per-line note. Prices shown are indicative — the
/// backend re-validates and re-prices on order.
class _CustomizeSheet extends ConsumerStatefulWidget {
  const _CustomizeSheet({required this.item});
  final MenuItem item;

  @override
  ConsumerState<_CustomizeSheet> createState() => _CustomizeSheetState();
}

class _CustomizeSheetState extends ConsumerState<_CustomizeSheet> {
  MenuItem get item => widget.item;

  Variation? _variation;
  // group id -> set of chosen option ids
  final Map<String, Set<String>> _picks = {};
  final Set<String> _removals = {}; // ingredient names
  final TextEditingController _note = TextEditingController();
  int _qty = 1;

  @override
  void initState() {
    super.initState();
    // Default the size to the first variation so there's always a valid pick.
    if (item.hasVariations) _variation = item.variations.first;
    // Pre-select the first option of any required single-choice group.
    for (final g in item.modifierGroups) {
      if (g.isSingle && g.required && g.options.isNotEmpty) {
        _picks[g.id] = {g.options.first.id};
      }
    }
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  double get _basePrice => _variation?.price ?? item.price;

  double get _modifierTotal {
    var sum = 0.0;
    for (final g in item.modifierGroups) {
      final chosen = _picks[g.id] ?? const {};
      for (final o in g.options) {
        if (chosen.contains(o.id)) sum += o.price;
      }
    }
    return sum;
  }

  double get _unitPrice => _basePrice + _modifierTotal;

  /// Returns null when the selection satisfies every group's rules, otherwise a
  /// human-readable reason the Add button is disabled.
  String? get _validationError {
    for (final g in item.modifierGroups) {
      final n = (_picks[g.id] ?? const {}).length;
      if (g.isSingle) {
        if ((g.required || g.minSelect >= 1) && n < 1) {
          return 'Please choose ${g.name}';
        }
      } else {
        final need = g.required ? (g.minSelect < 1 ? 1 : g.minSelect) : g.minSelect;
        if (need > 0 && n < need) {
          return 'Choose at least $need for ${g.name}';
        }
        if (g.maxSelect > 0 && n > g.maxSelect) {
          return 'Choose at most ${g.maxSelect} for ${g.name}';
        }
      }
    }
    return null;
  }

  void _toggle(ModifierGroup g, ModifierOption o) {
    setState(() {
      final chosen = _picks.putIfAbsent(g.id, () => <String>{});
      if (g.isSingle) {
        // Radio: required groups can't be cleared by re-tapping.
        if (chosen.contains(o.id)) {
          if (!(g.required || g.minSelect >= 1)) chosen.clear();
        } else {
          chosen
            ..clear()
            ..add(o.id);
        }
      } else {
        if (chosen.contains(o.id)) {
          chosen.remove(o.id);
        } else {
          // Respect max_select — ignore extra taps once the cap is hit.
          if (g.maxSelect > 0 && chosen.length >= g.maxSelect) return;
          chosen.add(o.id);
        }
      }
    });
  }

  void _add() {
    final mods = <SelectedModifier>[];
    for (final g in item.modifierGroups) {
      final chosen = _picks[g.id] ?? const {};
      for (final o in g.options) {
        if (chosen.contains(o.id)) {
          mods.add(SelectedModifier(
            groupId: g.id,
            optionId: o.id,
            groupName: g.name,
            name: o.name,
            price: o.price,
          ));
        }
      }
    }
    ref.read(cartProvider.notifier).add(
          item,
          variation: _variation,
          qty: _qty,
          modifiers: mods,
          removals: _removals.toList(),
          note: _note.text,
        );
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(
        content: Text('${item.name} added to cart'),
        duration: const Duration(milliseconds: 900),
      ));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final error = _validationError;

    return Padding(
      // Keep content above the keyboard when the note field is focused.
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Grab handle + title
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Column(
              children: [
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: scheme.outlineVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 12),
                Text(item.name, style: theme.textTheme.titleMedium),
              ],
            ),
          ),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              children: [
                if (item.hasVariations) _sizeSection(),
                for (final g in item.modifierGroups) _modifierSection(g),
                if (item.hasRemovals) _removalSection(),
                _noteSection(),
              ],
            ),
          ),
          _footer(error),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title, {String? hint}) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 2),
        child: Row(
          children: [
            Text(title,
                style: const TextStyle(fontWeight: FontWeight.w700)),
            if (hint != null) ...[
              const SizedBox(width: 8),
              Text(hint,
                  style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant)),
            ],
          ],
        ),
      );

  /// Variation price cell: sale price, plus struck-through original when the
  /// backend marked this size as discounted (values come straight from the API).
  Widget _variationPrice(Variation v) {
    final discounted = v.originalPrice != null && v.originalPrice! > v.price;
    if (!discounted) return Text(money(v.price));
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(money(v.price),
            style: const TextStyle(
                color: BrandColors.red, fontWeight: FontWeight.w700)),
        const SizedBox(width: 4),
        Text(
          money(v.originalPrice!),
          style: const TextStyle(
            fontSize: 11,
            decoration: TextDecoration.lineThrough,
            color: BrandColors.mutedForeground,
          ),
        ),
      ],
    );
  }

  Widget _sizeSection() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('Size', hint: 'Required'),
          RadioGroup<String>(
            groupValue: _variation?.name,
            onChanged: (name) => setState(() {
              _variation =
                  item.variations.firstWhere((v) => v.name == name);
            }),
            child: Column(
              children: [
                for (final v in item.variations)
                  RadioListTile<String>(
                    value: v.name,
                    title: Text(v.name),
                    secondary: _variationPrice(v),
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                  ),
              ],
            ),
          ),
        ],
      );

  Widget _modifierSection(ModifierGroup g) {
    final chosen = _picks[g.id] ?? const {};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader(g.name, hint: _groupHint(g)),
        if (g.isSingle)
          RadioGroup<String>(
            groupValue: chosen.isEmpty ? null : chosen.first,
            onChanged: (oid) {
              final o = g.options.firstWhere((o) => o.id == oid);
              _toggle(g, o);
            },
            child: Column(
              children: [
                for (final o in g.options)
                  RadioListTile<String>(
                    value: o.id,
                    title: Text(o.name),
                    secondary: o.price > 0 ? Text('+${money(o.price)}') : null,
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                  ),
              ],
            ),
          )
        else
          for (final o in g.options)
            CheckboxListTile(
              value: chosen.contains(o.id),
              onChanged: (_) => _toggle(g, o),
              title: Text(o.name),
              secondary: o.price > 0 ? Text('+${money(o.price)}') : null,
              contentPadding: EdgeInsets.zero,
              dense: true,
              controlAffinity: ListTileControlAffinity.leading,
            ),
      ],
    );
  }

  String? _groupHint(ModifierGroup g) {
    if (g.isSingle) return g.required ? 'Required' : 'Optional';
    if (g.required && g.minSelect > 1) return 'Choose ${g.minSelect}+';
    if (g.required) return 'Required';
    if (g.maxSelect > 0) return 'Up to ${g.maxSelect}';
    return 'Optional';
  }

  Widget _removalSection() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('Remove', hint: 'Optional'),
          for (final ing in item.removableIngredients)
            CheckboxListTile(
              value: _removals.contains(ing.name),
              onChanged: (v) => setState(() {
                if (v == true) {
                  _removals.add(ing.name);
                } else {
                  _removals.remove(ing.name);
                }
              }),
              title: Text('No ${ing.name}'),
              contentPadding: EdgeInsets.zero,
              dense: true,
              controlAffinity: ListTileControlAffinity.leading,
            ),
        ],
      );

  Widget _noteSection() => Padding(
        padding: const EdgeInsets.only(top: 12),
        child: TextField(
          controller: _note,
          maxLength: 140,
          minLines: 1,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Note (optional)',
            hintText: 'e.g. extra spicy, cut in half',
            border: OutlineInputBorder(),
          ),
        ),
      );

  Widget _footer(String? error) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, size: 16, color: scheme.error),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(error,
                          style: TextStyle(color: scheme.error, fontSize: 13)),
                    ),
                  ],
                ),
              ),
            Row(
              children: [
                _QtyStepper(
                  qty: _qty,
                  onChanged: (q) => setState(() => _qty = q),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: error == null ? _add : null,
                    child: Text('Add · ${money(_unitPrice * _qty)}'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact −/qty/+ stepper used in the customization sheet footer.
class _QtyStepper extends StatelessWidget {
  const _QtyStepper({required this.qty, required this.onChanged});
  final int qty;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: scheme.outlineVariant),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: const Icon(Icons.remove),
            visualDensity: VisualDensity.compact,
            onPressed: qty > 1 ? () => onChanged(qty - 1) : null,
          ),
          Text('$qty', style: const TextStyle(fontWeight: FontWeight.w600)),
          IconButton(
            icon: const Icon(Icons.add),
            visualDensity: VisualDensity.compact,
            onPressed: qty < 100 ? () => onChanged(qty + 1) : null,
          ),
        ],
      ),
    );
  }
}

class _CartFab extends ConsumerWidget {
  const _CartFab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(cartCountProvider);
    if (count == 0) return const SizedBox.shrink();
    final subtotal = ref.watch(cartSubtotalProvider);
    return FloatingActionButton.extended(
      onPressed: () => context.go('/cart'),
      icon: Badge(label: Text('$count'), child: const Icon(Icons.shopping_cart)),
      label: Text('View cart · ${money(subtotal)}'),
    );
  }
}

class _MenuError extends StatelessWidget {
  const _MenuError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

/// Slim banner shown at the top of the menu when the restaurant is closed, so
/// customers aren't surprised by a "closed" error at checkout.
class _ClosedBanner extends ConsumerWidget {
  const _ClosedBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hours = ref.watch(businessHoursProvider).asData?.value;
    if (hours == null || hours.isOpen) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    // Only show a same-day reopen time (HH:MM/12h); skip next-day ISO stamps.
    final reopen = (hours.nextOpenDisplay != null &&
            hours.nextOpenDisplay!.isNotEmpty &&
            !hours.nextOpenDisplay!.contains('T'))
        ? hours.nextOpenDisplay
        : null;
    return Material(
      color: scheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Icon(Icons.schedule, size: 18, color: scheme.onErrorContainer),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                reopen != null
                    ? "We're closed right now — opens at $reopen"
                    : "We're closed right now",
                style: TextStyle(
                    color: scheme.onErrorContainer,
                    fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
