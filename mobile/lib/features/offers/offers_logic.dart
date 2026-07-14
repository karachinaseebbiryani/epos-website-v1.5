import 'offers_models.dart';

/// A coupon the app can suggest, unified across public offers and the customer's
/// personal coupons. This is a *display/suggestion* helper only — the backend is
/// the sole authority on whether a code actually applies and for how much (it
/// re-validates eligibility, min-order, one-time-use and expiry at order time).
class SuggestedCoupon {
  const SuggestedCoupon({
    required this.code,
    required this.label,
    required this.discountPercent,
    required this.discountAmount,
    required this.minOrderAmount,
    required this.personal,
  });

  final String code;
  final String label; // e.g. "20% OFF" / "Rs. 150 OFF"
  final double discountPercent;
  final double discountAmount;
  final double minOrderAmount;
  final bool personal;

  /// Indicative discount value for a given subtotal — used only to rank
  /// suggestions locally. Never sent to or trusted by the server.
  double indicativeValue(double subtotal) {
    if (subtotal < minOrderAmount) return -1; // not eligible at this subtotal
    if (discountPercent > 0) return subtotal * discountPercent / 100;
    return discountAmount;
  }
}

String _discountLabel(double percent, double amount) {
  if (percent > 0) return '${percent.toStringAsFixed(0)}% OFF';
  if (amount > 0) return 'Rs. ${amount.toStringAsFixed(0)} OFF';
  return 'Offer';
}

SuggestedCoupon fromOffer(Offer o) => SuggestedCoupon(
      code: o.couponCode,
      label: _discountLabel(o.discountPercent, o.discountAmount),
      discountPercent: o.discountPercent,
      discountAmount: o.discountAmount,
      minOrderAmount: o.minOrderAmount,
      personal: false,
    );

SuggestedCoupon fromPersonal(PersonalCoupon c) => SuggestedCoupon(
      code: c.code,
      label: _discountLabel(c.discountPercent, c.discountAmount),
      discountPercent: c.discountPercent,
      discountAmount: c.discountAmount,
      minOrderAmount: 0,
      personal: true,
    );

/// Pick the single best eligible coupon for [subtotal] from the available
/// offers + personal coupons, or null if none is eligible/has a code. Prefers
/// the largest indicative discount; ties break toward personal coupons.
SuggestedCoupon? bestEligibleCoupon({
  required List<Offer> offers,
  required List<PersonalCoupon> personal,
  required double subtotal,
}) {
  final candidates = <SuggestedCoupon>[
    for (final c in personal)
      if (c.code.isNotEmpty) fromPersonal(c),
    for (final o in offers)
      if (o.couponCode.isNotEmpty && !o.isExpired) fromOffer(o),
  ];
  SuggestedCoupon? best;
  double bestVal = 0;
  for (final c in candidates) {
    final v = c.indicativeValue(subtotal);
    if (v <= 0) continue;
    if (v > bestVal || (v == bestVal && c.personal && !(best?.personal ?? false))) {
      best = c;
      bestVal = v;
    }
  }
  return best;
}
