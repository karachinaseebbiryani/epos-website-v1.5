import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart' show apiClientProvider;
import '../../core/api_client.dart';
import 'menu_models.dart';

/// Reads the public menu. GET /api/menu is cacheable + public (no auth needed).
class MenuRepository {
  MenuRepository(this._api);
  final ApiClient _api;

  Future<Menu> fetchMenu() async {
    final res = await _api.dio.get('/menu');
    throwIfError(res);
    return Menu.fromJson(Map<String, dynamic>.from(res.data));
  }
}

final menuRepositoryProvider = Provider<MenuRepository>(
  (ref) => MenuRepository(ref.watch(apiClientProvider)),
);

/// The menu, fetched once and cached by Riverpod. `ref.invalidate(menuProvider)`
/// (or pull-to-refresh) forces a refetch.
final menuProvider = FutureProvider<Menu>(
  (ref) => ref.watch(menuRepositoryProvider).fetchMenu(),
);
