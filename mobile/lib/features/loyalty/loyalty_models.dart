int _toInt(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString()) ?? 0;
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
