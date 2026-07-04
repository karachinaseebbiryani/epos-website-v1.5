import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../menu/menu_models.dart';

/// One line in the cart: a menu item, an optional chosen variation, and qty.
class CartLine {
  const CartLine({
    required this.item,
    required this.variation,
    required this.quantity,
  });

  final MenuItem item;
  final Variation? variation;
  final int quantity;

  /// Unique key so the same item+variation stacks into one line.
  String get key => '${item.id}::${variation?.name ?? ''}';

  double get unitPrice => variation?.price ?? item.price;
  double get lineTotal => unitPrice * quantity;
  String get displayName =>
      variation == null ? item.name : '${item.name} (${variation!.name})';

  CartLine copyWith({int? quantity}) => CartLine(
        item: item,
        variation: variation,
        quantity: quantity ?? this.quantity,
      );

  /// The item payload shape POST /api/online-orders expects.
  Map<String, dynamic> toOrderItem() => {
        'item_id': item.id,
        'name': item.name,
        'price': unitPrice,
        'quantity': quantity,
        if (variation != null) 'variation_name': variation!.name,
      };
}

class CartController extends StateNotifier<List<CartLine>> {
  CartController() : super(const []);

  void add(MenuItem item, {Variation? variation, int qty = 1}) {
    final key = '${item.id}::${variation?.name ?? ''}';
    final idx = state.indexWhere((l) => l.key == key);
    if (idx >= 0) {
      final updated = [...state];
      updated[idx] =
          updated[idx].copyWith(quantity: updated[idx].quantity + qty);
      state = updated;
    } else {
      state = [
        ...state,
        CartLine(item: item, variation: variation, quantity: qty),
      ];
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
