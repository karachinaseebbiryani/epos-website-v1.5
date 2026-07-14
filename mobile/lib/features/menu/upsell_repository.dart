import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart' show apiClientProvider;
import '../../core/api_client.dart';
import '../cart/cart_controller.dart';
import 'menu_models.dart';

/// "People also buy" recommendations. Backed by the existing
/// POST /api/menu/upsell, which server-side filters to in-stock items, excludes
/// what's already in the cart, and ranks by curated related_item_ids →
/// bestseller → popular → newest. The app never picks or ranks — it just renders
/// what the backend returns.
class UpsellRepository {
  UpsellRepository(this._api);
  final ApiClient _api;

  Future<List<MenuItem>> fetch(List<String> itemIds, {int limit = 6}) async {
    if (itemIds.isEmpty) return const [];
    final res = await _api.dio.post(
      '/menu/upsell',
      data: {'item_ids': itemIds, 'limit': limit},
      // Recommendations are best-effort — a failure must never block the cart.
      options: Options(extra: {'silent': true}),
    );
    throwIfError(res);
    final data = res.data;
    final list = data is Map ? (data['items'] as List?) : (data as List?);
    return ((list) ?? const [])
        .whereType<Map>()
        .map((m) => MenuItem.fromJson(Map<String, dynamic>.from(m)))
        .toList();
  }
}

final upsellRepositoryProvider = Provider<UpsellRepository>(
  (ref) => UpsellRepository(ref.watch(apiClientProvider)),
);

/// Recommendations for the current cart. Auto-recomputes when the set of cart
/// item ids changes (adding/removing lines). Returns [] on any error.
final cartUpsellProvider = FutureProvider.autoDispose<List<MenuItem>>((ref) async {
  final lines = ref.watch(cartProvider);
  final ids = <String>{for (final l in lines) l.item.id}.toList();
  if (ids.isEmpty) return const [];
  try {
    return await ref.watch(upsellRepositoryProvider).fetch(ids);
  } catch (_) {
    return const [];
  }
});
