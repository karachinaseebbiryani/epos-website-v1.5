// Menu domain models. Hand-written fromJson (no codegen) matching the exact
// shape of GET /api/menu.

double _toDouble(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

int _toInt(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString()) ?? 0;
}

class Category {
  const Category({required this.id, required this.name, this.color});

  final String id;
  final String name;
  final String? color;

  factory Category.fromJson(Map<String, dynamic> j) => Category(
        id: (j['id'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        color: j['color']?.toString(),
      );
}

class Variation {
  const Variation({required this.name, required this.price, this.originalPrice});

  final String name;
  final double price;
  final double? originalPrice;

  factory Variation.fromJson(Map<String, dynamic> j) => Variation(
        name: (j['name'] ?? '').toString(),
        price: _toDouble(j['price']),
        originalPrice:
            j['original_price'] == null ? null : _toDouble(j['original_price']),
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'price': price,
        if (originalPrice != null) 'original_price': originalPrice,
      };
}

/// A single choice within a [ModifierGroup] (e.g. "Extra cheese +Rs 100").
class ModifierOption {
  const ModifierOption({required this.id, required this.name, this.price = 0});

  final String id;
  final String name;
  final double price;

  factory ModifierOption.fromJson(Map<String, dynamic> j) => ModifierOption(
        id: (j['id'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        price: _toDouble(j['price']),
      );
}

/// A group of modifier options with selection rules. `type` is "single" (radio,
/// pick one) or "multi" (checkboxes, pick min..max). Mirrors the backend's
/// modifier_groups schema; the server re-validates + re-prices on order.
class ModifierGroup {
  const ModifierGroup({
    required this.id,
    required this.name,
    required this.type,
    required this.required,
    required this.minSelect,
    required this.maxSelect,
    this.active = true,
    this.options = const [],
  });

  final String id;
  final String name;
  final String type; // "single" | "multi"
  final bool required;
  final int minSelect;
  final int maxSelect;
  final bool active;
  final List<ModifierOption> options;

  bool get isSingle => type == 'single';

  factory ModifierGroup.fromJson(Map<String, dynamic> j) => ModifierGroup(
        id: (j['id'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        type: (j['type'] ?? 'multi').toString() == 'single' ? 'single' : 'multi',
        required: j['required'] == true,
        minSelect: _toInt(j['min_select']),
        maxSelect: _toInt(j['max_select']),
        active: j['active'] != false,
        options: ((j['options'] as List?) ?? [])
            .whereType<Map>()
            .map((o) => ModifierOption.fromJson(Map<String, dynamic>.from(o)))
            .toList(),
      );
}

/// An ingredient the customer may optionally remove (e.g. "No onion").
class MenuIngredient {
  const MenuIngredient({
    required this.id,
    required this.name,
    this.removable = true,
  });

  final String id;
  final String name;
  final bool removable;

  factory MenuIngredient.fromJson(Map<String, dynamic> j) => MenuIngredient(
        id: (j['id'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        removable: j['removable'] != false,
      );
}

class MenuItem {
  const MenuItem({
    required this.id,
    required this.name,
    required this.price,
    required this.categoryId,
    this.originalPrice,
    this.discountPercent = 0,
    this.imageUrl = '',
    this.description = '',
    this.stock = 0,
    this.isPopular = false,
    this.isBestseller = false,
    this.variations = const [],
    this.modifierGroups = const [],
    this.ingredients = const [],
  });

  final String id;
  final String name;
  final double price; // already-discounted "sale" price from the server
  final String categoryId;
  final double? originalPrice; // non-null only when discounted
  final int discountPercent;
  final String imageUrl;
  final String description;
  final int stock;
  final bool isPopular;
  final bool isBestseller;
  final List<Variation> variations;
  final List<ModifierGroup> modifierGroups;
  final List<MenuIngredient> ingredients;

  bool get hasVariations => variations.isNotEmpty;
  bool get hasModifiers => modifierGroups.isNotEmpty;
  List<MenuIngredient> get removableIngredients =>
      ingredients.where((i) => i.removable).toList();
  bool get hasRemovals => removableIngredients.isNotEmpty;

  /// True when adding this item needs the customization sheet (a size to pick,
  /// add-ons/choices, or removable ingredients) rather than a one-tap add.
  bool get needsCustomization => hasVariations || hasModifiers || hasRemovals;

  bool get isDiscounted => originalPrice != null && originalPrice! > price;

  /// Minimum sale price to advertise on the card. For a variant item this is the
  /// cheapest variation (the website's "From Rs. {min}"), otherwise the item's
  /// own sale price. Pure min-selection over backend-supplied prices — the app
  /// never computes a price itself.
  double get fromPrice => hasVariations
      ? variations.map((v) => v.price).reduce((a, b) => a < b ? a : b)
      : price;

  /// The pre-discount original that pairs with [fromPrice], for strike-through.
  /// Null when there's nothing to strike (no discount on the cheapest option).
  double? get fromOriginal {
    if (hasVariations) {
      final orig = variations
          .map((v) => v.originalPrice ?? v.price)
          .reduce((a, b) => a < b ? a : b);
      return orig > fromPrice ? orig : null;
    }
    return isDiscounted ? originalPrice : null;
  }

  /// True when this item shows a "From" (multiple price points to choose from).
  bool get showsFromPrice => hasVariations;

  factory MenuItem.fromJson(Map<String, dynamic> j) => MenuItem(
        id: (j['id'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        price: _toDouble(j['price']),
        categoryId: (j['category_id'] ?? '').toString(),
        originalPrice: j['original_price'] == null
            ? null
            : _toDouble(j['original_price']),
        discountPercent: _toInt(j['discount_percent']),
        imageUrl: (j['image_url'] ?? '').toString(),
        description: (j['description'] ?? '').toString(),
        stock: _toInt(j['stock']),
        isPopular: j['is_popular'] == true,
        isBestseller: j['is_bestseller'] == true,
        variations: ((j['variations'] as List?) ?? [])
            .whereType<Map>()
            .map((v) => Variation.fromJson(Map<String, dynamic>.from(v)))
            .toList(),
        modifierGroups: ((j['modifier_groups'] as List?) ?? [])
            .whereType<Map>()
            .map((g) => ModifierGroup.fromJson(Map<String, dynamic>.from(g)))
            .where((g) => g.active && g.options.isNotEmpty)
            .toList(),
        ingredients: ((j['ingredients'] as List?) ?? [])
            .whereType<Map>()
            .map((i) => MenuIngredient.fromJson(Map<String, dynamic>.from(i)))
            .toList(),
      );

  /// Serialize just enough to rebuild a persisted cart line for display. The
  /// customization sheet is never reopened from a restored line, so modifier
  /// groups / ingredients are intentionally omitted to keep storage light.
  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'price': price,
        'category_id': categoryId,
        if (originalPrice != null) 'original_price': originalPrice,
        'discount_percent': discountPercent,
        'image_url': imageUrl,
        'description': description,
        'stock': stock,
        'is_popular': isPopular,
        'is_bestseller': isBestseller,
        'variations': [for (final v in variations) v.toJson()],
      };
}

/// Full menu payload: categories + items.
class Menu {
  const Menu({required this.categories, required this.items});

  final List<Category> categories;
  final List<MenuItem> items;

  List<MenuItem> itemsForCategory(String categoryId) =>
      items.where((i) => i.categoryId == categoryId).toList();

  factory Menu.fromJson(Map<String, dynamic> j) => Menu(
        categories: ((j['categories'] as List?) ?? [])
            .whereType<Map>()
            .map((c) => Category.fromJson(Map<String, dynamic>.from(c)))
            .toList(),
        items: ((j['items'] as List?) ?? [])
            .whereType<Map>()
            .map((i) => MenuItem.fromJson(Map<String, dynamic>.from(i)))
            .toList(),
      );
}
