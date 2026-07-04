import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme_controller.dart';
import '../../core/format.dart';
import '../auth/auth_controller.dart';
import '../cart/cart_controller.dart';
import 'menu_models.dart';
import 'menu_repository.dart';

class MenuScreen extends ConsumerWidget {
  const MenuScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final menuAsync = ref.watch(menuProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Karachi Naseeb'),
        actions: [
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
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      floatingActionButton: const _CartFab(),
      body: menuAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _MenuError(
          message: '$e',
          onRetry: () => ref.invalidate(menuProvider),
        ),
        data: (menu) => _MenuBody(menu: menu),
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
    if (item.hasVariations) {
      await showModalBottomSheet<void>(
        context: context,
        builder: (_) => _VariationPicker(item: item),
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
                width: 72,
                height: 72,
                child: item.imageUrl.isEmpty
                    ? Container(
                        color: scheme.surfaceContainerHighest,
                        child: const Icon(Icons.restaurant),
                      )
                    : CachedNetworkImage(
                        imageUrl: item.imageUrl,
                        fit: BoxFit.cover,
                        placeholder: (_, __) =>
                            Container(color: scheme.surfaceContainerHighest),
                        errorWidget: (_, __, ___) => Container(
                          color: scheme.surfaceContainerHighest,
                          child: const Icon(Icons.restaurant),
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.name,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
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
                  Row(
                    children: [
                      Text(money(item.price),
                          style:
                              const TextStyle(fontWeight: FontWeight.w700)),
                      if (item.isDiscounted) ...[
                        const SizedBox(width: 6),
                        Text(
                          money(item.originalPrice!),
                          style: TextStyle(
                            fontSize: 12,
                            decoration: TextDecoration.lineThrough,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            FilledButton.tonal(
              onPressed: () => _onAdd(context, ref),
              child: Text(item.hasVariations ? 'Choose' : 'Add'),
            ),
          ],
        ),
      ),
    );
  }
}

class _VariationPicker extends ConsumerWidget {
  const _VariationPicker({required this.item});
  final MenuItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text('Choose a size — ${item.name}',
                style: Theme.of(context).textTheme.titleMedium),
          ),
          for (final v in item.variations)
            ListTile(
              title: Text(v.name),
              trailing: Text(money(v.price)),
              onTap: () {
                ref.read(cartProvider.notifier).add(item, variation: v);
                Navigator.of(context).pop();
                ScaffoldMessenger.of(context)
                  ..clearSnackBars()
                  ..showSnackBar(SnackBar(
                    content: Text('${item.name} (${v.name}) added'),
                    duration: const Duration(milliseconds: 900),
                  ));
              },
            ),
          const SizedBox(height: 8),
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
