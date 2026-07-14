double _toDouble(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

/// A public promotional offer from GET /api/offers.
class Offer {
  const Offer({
    required this.id,
    required this.title,
    required this.description,
    required this.discountPercent,
    required this.discountAmount,
    required this.couponCode,
    required this.minOrderAmount,
  });

  final String id;
  final String title;
  final String description;
  final double discountPercent;
  final double discountAmount;
  final String couponCode;
  final double minOrderAmount;

  factory Offer.fromJson(Map<String, dynamic> j) => Offer(
        id: (j['id'] ?? '').toString(),
        title: (j['title'] ?? '').toString(),
        description: (j['description'] ?? '').toString(),
        discountPercent: _toDouble(j['discount_percent']),
        discountAmount: _toDouble(j['discount_amount']),
        couponCode: (j['coupon_code'] ?? '').toString(),
        minOrderAmount: _toDouble(j['min_order_amount']),
      );
}

/// A per-customer coupon from GET /api/personal-coupons/me (auth).
class PersonalCoupon {
  const PersonalCoupon({
    required this.id,
    required this.code,
    required this.discountAmount,
    required this.discountPercent,
    required this.source,
    this.expiresAt,
  });

  final String id;
  final String code;
  final double discountAmount;
  final double discountPercent;
  final String source;
  final String? expiresAt;

  factory PersonalCoupon.fromJson(Map<String, dynamic> j) => PersonalCoupon(
        id: (j['id'] ?? '').toString(),
        code: (j['code'] ?? '').toString(),
        discountAmount: _toDouble(j['discount_amount']),
        discountPercent: _toDouble(j['discount_percent']),
        source: (j['source'] ?? '').toString(),
        expiresAt: j['expires_at']?.toString(),
      );
}
