import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../menu/menu_models.dart';

/// A modifier option the customer picked, resolved to the ids the backend needs
/// plus name/price kept locally for display + a provisional subtotal. The server
/// re-validates and re-prices, so these prices are indicative only.
class SelectedModifier {
  const SelectedModifier({
    required this.groupId,
    required this.optionId,
    required this.groupName,
    required this.name,
    required this.price,
  });

  final String groupId;
  final String optionId;
  final String groupName;
  final String name;
  final double price;
}

/// One line in the cart: a menu item, an optional chosen variation, any selected
/// modifiers, removed ingredients, a per-line note, and qty.
class CartLine {
  const CartLine({
    required this.item,
    required this.variation,
    required this.quantity,
    this.modifiers = const [],
    this.removals = const [],
    this.note,
  });

  final MenuItem item;
  final Variation? variation;
  final int quantity;
  final List<SelectedModifier> modifiers;
  final List<String> removals; // ingredient names to omit
  final String? note;

  /// Unique key so an identical item+variation+modifiers+removals+note stacks
  /// into one line, while any difference in customization becomes its own line.
  String get key {
    final mods = modifiers.map((m) => m.optionId).toList()..sort();
    final rem = [...removals]..sort();
    return [
      item.id,
      variation?.name ?? '',
      mods.join(','),
      rem.join(','),
      note ?? '',
    ].join('::');
  }

  double get basePrice => variation?.price ?? item.price;
  double get modifierTotal =>
      modifiers.fold<double>(0, (sum, m) => sum + m.price);
  double get unitPrice => basePrice + modifierTotal;
  double get lineTotal => unitPrice * quantity;

  String get displayName =>
      variation == null ? item.name : '${item.name} (${variation!.name})';

  CartLine copyWith({int? quantity}) => CartLine(
        item: item,
        variation: variation,
        quantity: quantity ?? this.quantity,
        modifiers: modifiers,
        removals: removals,
        note: note,
      );

  /// The item payload shape POST /api/online-orders expects. Prices/total are
  /// re-computed server-side; the price we send is indicative only.
  Map<String, dynamic> toOrderItem() => {
        'item_id': item.id,
        'name': item.name,
        'price': unitPrice,
        'quantity': quantity,
        if (variation != null) 'variation_name': variation!.name,
        if (modifiers.isNotEmpty)
          'selected_modifiers': [
            for (final m in modifiers)
              {'group_id': m.groupId, 'option_id': m.optionId},
          ],
        if (removals.isNotEmpty) 'removed_ingredients': removals,
        if (note != null && note!.trim().isNotEmpty) 'line_note': note!.trim(),
      };
}

class CartController extends StateNotifier<List<CartLine>> {
  CartController() : super(const []);

  void add(
    MenuItem item, {
    Variation? variation,
    int qty = 1,
    List<SelectedModifier> modifiers = const [],
    List<String> removals = const [],
    String? note,
  }) {
    final line = CartLine(
      item: item,
      variation: variation,
      quantity: qty,
      modifiers: modifiers,
      removals: removals,
      note: (note != null && note.trim().isNotEmpty) ? note.trim() : null,
    );
    final idx = state.indexWhere((l) => l.key == line.key);
    if (idx >= 0) {
      final updated = [...state];
      updated[idx] =
          updated[idx].copyWith(quantity: updated[idx].quantity + qty);
      state = updated;
    } else {
      state = [...state, line];
    }
  }

  void setQuantity(String key, int quantity) {
    if (quantity <= 0) {
      remove(key);
      return;
    }
    state = [
      for (final l in state) if (l.key == key) l.copyWith(quantity: quantity) else l,
    ];
  }

  void increment(String key) {
    final line = state.firstWhere((l) => l.key == key);
    setQuantity(key, line.quantity + 1);
  }

  void decrement(String key) {
    final line = state.firstWhere((l) => l.key == key);
    setQuantity(key, line.quantity - 1);
  }

  void remove(String key) =>
      state = [for (final l in state) if (l.key != key) l];

  void clear() => state = const [];
}

final cartProvider =
    StateNotifierProvider<CartController, List<CartLine>>((ref) => CartController());

/// Derived totals so widgets can watch just what they need.
final cartSubtotalProvider = Provider<double>((ref) {
  return ref
      .watch(cartProvider)
      .fold<double>(0, (sum, l) => sum + l.lineTotal);
});

final cartCountProvider = Provider<int>((ref) {
  return ref.watch(cartProvider).fold<int>(0, (sum, l) => sum + l.quantity);
});
