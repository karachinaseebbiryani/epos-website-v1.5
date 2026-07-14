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
}

final loyaltyRepositoryProvider = Provider<LoyaltyRepository>(
    (ref) => LoyaltyRepository(ref.watch(apiClientProvider)));

final loyaltyBalanceProvider =
    FutureProvider<LoyaltyBalance>((ref) => ref.watch(loyaltyRepositoryProvider).balance());

final loyaltyTransactionsProvider = FutureProvider<List<LoyaltyTransaction>>(
    (ref) => ref.watch(loyaltyRepositoryProvider).transactions());
