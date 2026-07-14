int _toInt(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString()) ?? 0;
}

double _toDouble(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

/// A redeemable reward from GET /api/loyalty/rewards. Redemption itself is
/// validated server-side at checkout (balance check, price math, stacking
/// rules) — the app only sends the chosen reward_id.
class LoyaltyReward {
  const LoyaltyReward({
    required this.id,
    required this.title,
    required this.description,
    required this.rewardType, // free_item | discount_percent | discount_fixed
    required this.rewardValue,
    required this.costDiamonds,
    this.freeItemName = '',
    this.freeItemImage = '',
    this.freeItemValue = 0,
  });

  final String id;
  final String title;
  final String description;
  final String rewardType;
  final String rewardValue;
  final int costDiamonds;
  final String freeItemName;
  final String freeItemImage;
  final double freeItemValue;

  /// Short label of what you get: "15% OFF" / "Rs. 100 OFF" / "FREE <item>".
  String get benefitLabel => switch (rewardType) {
        'discount_percent' => '${_toDouble(rewardValue).toStringAsFixed(0)}% OFF',
        'discount_fixed' => 'Rs. ${_toDouble(rewardValue).toStringAsFixed(0)} OFF',
        'free_item' => freeItemName.isEmpty ? 'Free item' : 'FREE $freeItemName',
        _ => title,
      };

  factory LoyaltyReward.fromJson(Map<String, dynamic> j) => LoyaltyReward(
        id: (j['id'] ?? '').toString(),
        title: (j['title'] ?? '').toString(),
        description: (j['description'] ?? '').toString(),
        rewardType: (j['reward_type'] ?? '').toString(),
        rewardValue: (j['reward_value'] ?? '').toString(),
        costDiamonds: _toInt(j['cost_diamonds']),
        freeItemName: (j['free_item_name'] ?? '').toString(),
        freeItemImage: (j['free_item_image'] ?? '').toString(),
        freeItemValue: _toDouble(j['free_item_value']),
      );
}

/// Customer diamond balance from GET /api/loyalty/balance.
class LoyaltyBalance {
  const LoyaltyBalance({
    required this.diamondBalance,
    required this.lifetimeEarned,
    required this.lifetimeSpent,
  });

  final int diamondBalance;
  final int lifetimeEarned;
  final int lifetimeSpent;

  factory LoyaltyBalance.fromJson(Map<String, dynamic> j) => LoyaltyBalance(
        diamondBalance: _toInt(j['diamond_balance']),
        lifetimeEarned: _toInt(j['lifetime_diamonds_earned']),
        lifetimeSpent: _toInt(j['lifetime_diamonds_spent']),
      );
}

/// One row from GET /api/loyalty/transactions. `diamonds` is signed:
/// positive when earned, negative when spent.
class LoyaltyTransaction {
  const LoyaltyTransaction({
    required this.id,
    required this.type,
    required this.diamonds,
    required this.balanceAfter,
    required this.notes,
    required this.createdAt,
    this.orderId,
    this.rewardId,
  });

  final String id;
  final String type;
  final int diamonds;
  final int balanceAfter;
  final String notes;
  final String createdAt;
  final String? orderId;
  final String? rewardId;

  bool get isCredit => diamonds >= 0;

  factory LoyaltyTransaction.fromJson(Map<String, dynamic> j) =>
      LoyaltyTransaction(
        id: (j['id'] ?? '').toString(),
        type: (j['transaction_type'] ?? '').toString(),
        diamonds: _toInt(j['diamonds']),
        balanceAfter: _toInt(j['balance_after']),
        notes: (j['notes'] ?? '').toString(),
        createdAt: (j['created_at'] ?? '').toString(),
        orderId: j['order_id']?.toString(),
        rewardId: j['reward_id']?.toString(),
      );
}
