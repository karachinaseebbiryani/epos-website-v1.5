import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../auth/auth_controller.dart' show apiClientProvider;

/// Customer profile extras beyond the base auth fields — currently the saved
/// allergen list (GET /customer/me returns `allergens`, PUT /customer/allergens
/// saves it). Kept separate from AuthRepository so the profile screen can load
/// and mutate allergens without touching the auth session flow.
class ProfileRepository {
  ProfileRepository(this._api);
  final ApiClient _api;

  Future<List<String>> fetchAllergens() async {
    final res = await _api.dio
        .get('/customer/me', options: Options(extra: {'silent': true}));
    throwIfError(res);
    final data = Map<String, dynamic>.from(res.data);
    final list = (data['allergens'] as List?) ?? const [];
    return list.map((e) => e.toString()).toList();
  }

  Future<List<String>> saveAllergens(List<String> allergens) async {
    final res = await _api.dio.put(
      '/customer/allergens',
      data: {'allergens': allergens},
      options: Options(extra: {'showLoading': true}),
    );
    throwIfError(res);
    final data = Map<String, dynamic>.from(res.data);
    final list = (data['allergens'] as List?) ?? const [];
    return list.map((e) => e.toString()).toList();
  }
}

final profileRepositoryProvider = Provider<ProfileRepository>(
    (ref) => ProfileRepository(ref.watch(apiClientProvider)));

/// The signed-in customer's saved allergens. Auto-filled into the checkout note.
final allergensProvider = FutureProvider<List<String>>(
    (ref) => ref.watch(profileRepositoryProvider).fetchAllergens());

/// Common allergens offered as quick-pick chips in the profile screen.
const List<String> commonAllergens = [
  'Peanuts',
  'Tree nuts',
  'Dairy',
  'Eggs',
  'Gluten',
  'Soy',
  'Shellfish',
  'Fish',
  'Sesame',
];
