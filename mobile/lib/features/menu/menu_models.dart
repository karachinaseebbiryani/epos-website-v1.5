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

  bool get hasVariations => variations.isNotEmpty;
  bool get isDiscounted => originalPrice != null && originalPrice! > price;

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
      );
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
