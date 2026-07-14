import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart' show apiClientProvider;
import '../../core/api_client.dart';
import 'loyalty_models.dart';

/// Reads the signed-in customer's diamond balance + ledger. Both endpoints
/// require the Bearer token (attached automatically by ApiClient).
class LoyaltyRepository {
  LoyaltyRepository(this._api);
  final ApiClient _api;

  Future<LoyaltyBalance> balance() async {
    final res = await _api.dio.get('/loyalty/balance');
    throwIfError(res);
    return LoyaltyBalance.fromJson(Map<String, dynamic>.from(res.data));
  }

  Future<List<LoyaltyTransaction>> transactions() async {
    final res = await _api.dio.get('/loyalty/transactions');
    throwIfError(res);
    final list = res.data as List? ?? [];
    return list
        .whereType<Map>()
        .map((e) => LoyaltyTransaction.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  /// Active rewards customers can spend diamonds on (public endpoint).
  Future<List<LoyaltyReward>> rewards() async {
    final res = await _api.dio.get('/loyalty/rewards');
    throwIfError(res);
    final list = res.data as List? ?? [];
    return list
        .whereType<Map>()
        .map((e) => LoyaltyReward.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}

final loyaltyRepositoryProvider = Provider<LoyaltyRepository>(
    (ref) => LoyaltyRepository(ref.watch(apiClientProvider)));

final loyaltyBalanceProvider =
    FutureProvider<LoyaltyBalance>((ref) => ref.watch(loyaltyRepositoryProvider).balance());

final loyaltyTransactionsProvider = FutureProvider<List<LoyaltyTransaction>>(
    (ref) => ref.watch(loyaltyRepositoryProvider).transactions());

/// Rewards catalog — what diamonds can be spent on.
final loyaltyRewardsProvider = FutureProvider<List<LoyaltyReward>>(
    (ref) => ref.watch(loyaltyRepositoryProvider).rewards());

/// The reward the customer picked to use on their next order. Mirrors the
/// website's localStorage "selected_reward" flow: pick on the Diamonds screen →
/// applied at checkout (backend validates balance + stacking and re-prices).
final selectedRewardProvider = StateProvider<LoyaltyReward?>((ref) => null);
