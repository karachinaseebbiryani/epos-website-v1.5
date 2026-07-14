import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

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

  Map<String, dynamic> toJson() => {
        'group_id': groupId,
        'option_id': optionId,
        'group_name': groupName,
        'name': name,
        'price': price,
      };

  factory SelectedModifier.fromJson(Map<String, dynamic> j) => SelectedModifier(
        groupId: (j['group_id'] ?? '').toString(),
        optionId: (j['option_id'] ?? '').toString(),
        groupName: (j['group_name'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        price: (j['price'] is num)
            ? (j['price'] as num).toDouble()
            : double.tryParse('${j['price']}') ?? 0,
      );
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

  /// Full serialization for on-device persistence (survives app restart).
  Map<String, dynamic> toJson() => {
        'item': item.toJson(),
        if (variation != null) 'variation': variation!.toJson(),
        'quantity': quantity,
        'modifiers': [for (final m in modifiers) m.toJson()],
        'removals': removals,
        if (note != null) 'note': note,
      };

  factory CartLine.fromJson(Map<String, dynamic> j) => CartLine(
        item: MenuItem.fromJson(Map<String, dynamic>.from(j['item'] as Map)),
        variation: j['variation'] == null
            ? null
            : Variation.fromJson(Map<String, dynamic>.from(j['variation'] as Map)),
        quantity: (j['quantity'] is num) ? (j['quantity'] as num).toInt() : 1,
        modifiers: ((j['modifiers'] as List?) ?? [])
            .whereType<Map>()
            .map((m) => SelectedModifier.fromJson(Map<String, dynamic>.from(m)))
            .toList(),
        removals: ((j['removals'] as List?) ?? [])
            .map((e) => e.toString())
            .toList(),
        note: j['note']?.toString(),
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
  CartController() : super(const []) {
    _hydrate();
  }

  static const _storageKey = 'cart_lines_v1';

  /// Load a previously-persisted cart from disk so it survives app close /
  /// temporary sign-out. Persisted prices are display-only; the backend
  /// re-validates everything at checkout, so a stale price never ships.
  Future<void> _hydrate() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw == null || raw.isEmpty) return;
      final list = (jsonDecode(raw) as List)
          .whereType<Map>()
          .map((e) => CartLine.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      // Only adopt the restored cart if the user hasn't already added something
      // in the moment between construction and hydration completing.
      if (state.isEmpty && list.isNotEmpty) state = list;
    } catch (_) {
      // Corrupt/incompatible payload — start clean rather than crash.
    }
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (state.isEmpty) {
        await prefs.remove(_storageKey);
      } else {
        await prefs.setString(
            _storageKey, jsonEncode([for (final l in state) l.toJson()]));
      }
    } catch (_) {
      // Persistence is best-effort; never block a cart action on disk I/O.
    }
  }

  @override
  set state(List<CartLine> value) {
    super.state = value;
    _persist();
  }

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

  /// Reconcile the (possibly restored/stale) cart against a freshly-fetched
  /// [menu]: drop items that no longer exist or are out of stock, and refresh
  /// each surviving line's item/variation to the backend's current price. The
  /// server still re-prices authoritatively at checkout — this only keeps the
  /// on-screen numbers honest. Returns a summary of what changed (empty when
  /// nothing changed).
  CartReconcileResult reconcile(Menu menu) {
    final byId = {for (final i in menu.items) i.id: i};
    final removed = <String>[];
    var repriced = false;
    final next = <CartLine>[];

    for (final line in state) {
      final fresh = byId[line.item.id];
      if (fresh == null || fresh.stock <= 0) {
        removed.add(line.item.name);
        continue;
      }
      // Re-resolve the chosen variation by name against the fresh item.
      Variation? freshVar;
      if (line.variation != null) {
        for (final v in fresh.variations) {
          if (v.name == line.variation!.name) {
            freshVar = v;
            break;
          }
        }
      }
      final oldUnit = line.unitPrice;
      final updated = CartLine(
        item: fresh,
        variation: freshVar,
        quantity: line.quantity,
        modifiers: line.modifiers,
        removals: line.removals,
        note: line.note,
      );
      if (updated.unitPrice != oldUnit) repriced = true;
      next.add(updated);
    }

    if (removed.isNotEmpty || repriced) state = next;
    return CartReconcileResult(removedItems: removed, pricesChanged: repriced);
  }
}

/// Outcome of [CartController.reconcile] — used to tell the customer if their
/// restored cart changed (item removed / price updated) before they pay.
class CartReconcileResult {
  const CartReconcileResult({
    required this.removedItems,
    required this.pricesChanged,
  });
  final List<String> removedItems;
  final bool pricesChanged;

  bool get changed => removedItems.isNotEmpty || pricesChanged;
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
