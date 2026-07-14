double _toDouble(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

DateTime? _parseUtc(dynamic v) {
  if (v == null) return null;
  final s = v.toString();
  if (s.isEmpty) return null;
  return DateTime.tryParse(s)?.toUtc();
}

/// A public promotional offer from GET /api/offers.
class Offer {
  Offer({
    required this.id,
    required this.title,
    required this.description,
    required this.discountPercent,
    required this.discountAmount,
    required this.couponCode,
    required this.minOrderAmount,
    this.imageUrl = '',
    this.validUntil,
    DateTime? serverNow,
    DateTime? fetchedAt,
  })  : _serverNow = serverNow,
        _fetchedAt = fetchedAt ?? DateTime.now().toUtc();

  final String id;
  final String title;
  final String description;
  final double discountPercent;
  final double discountAmount;
  final String couponCode;
  final double minOrderAmount;
  final String imageUrl;

  /// Server-controlled expiry (UTC). Null = no expiry.
  final DateTime? validUntil;
  // Server clock at fetch + the local time we parsed it, so countdowns tick from
  // the server's clock and can't be extended by changing the device clock.
  final DateTime? _serverNow;
  final DateTime _fetchedAt;

  bool get hasExpiry => validUntil != null;

  /// Best estimate of the server's "now", adjusted for time elapsed since fetch.
  DateTime get _serverNowEstimate {
    final base = _serverNow;
    final elapsed = DateTime.now().toUtc().difference(_fetchedAt);
    return base == null ? DateTime.now().toUtc() : base.add(elapsed);
  }

  /// Time left until this offer expires (server-clock based), or null if no
  /// expiry. Zero/negative means expired.
  Duration? get timeLeft => validUntil?.difference(_serverNowEstimate);

  bool get isExpired {
    final left = timeLeft;
    return left != null && left.isNegative;
  }

  factory Offer.fromJson(Map<String, dynamic> j) => Offer(
        id: (j['id'] ?? '').toString(),
        title: (j['title'] ?? '').toString(),
        description: (j['description'] ?? '').toString(),
        discountPercent: _toDouble(j['discount_percent']),
        discountAmount: _toDouble(j['discount_amount']),
        couponCode: (j['coupon_code'] ?? '').toString(),
        minOrderAmount: _toDouble(j['min_order_amount']),
        imageUrl: (j['image_url'] ?? '').toString(),
        validUntil: _parseUtc(j['valid_until']),
        serverNow: _parseUtc(j['server_now']),
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
