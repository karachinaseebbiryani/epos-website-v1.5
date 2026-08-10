import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart' show apiClientProvider;
import '../../core/api_client.dart';
import 'offers_models.dart';

/// Reads public offers + the signed-in customer's personal coupons.
class OffersRepository {
  OffersRepository(this._api);
  final ApiClient _api;

  Future<List<Offer>> fetchOffers() async {
    // for_platform=app ensures only app-distributed offers are returned.
    // Voucher-code-only and website-only offers are filtered server-side.
    final res = await _api.dio.get(
      '/offers',
      queryParameters: {'for_platform': 'app'},
      options: Options(extra: {'silent': true}),
    );
    throwIfError(res);
    final list = res.data as List? ?? [];
    return list
        .whereType<Map>()
        .map((e) => Offer.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<PersonalCoupon>> fetchMyCoupons() async {
    final res = await _api.dio
        .get('/personal-coupons/me', options: Options(extra: {'silent': true}));
    throwIfError(res);
    final list = res.data as List? ?? [];
    return list
        .whereType<Map>()
        .map((e) => PersonalCoupon.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}

final offersRepositoryProvider = Provider<OffersRepository>(
    (ref) => OffersRepository(ref.watch(apiClientProvider)));

final offersProvider =
    FutureProvider<List<Offer>>((ref) => ref.watch(offersRepositoryProvider).fetchOffers());

final myCouponsProvider = FutureProvider<List<PersonalCoupon>>(
    (ref) => ref.watch(offersRepositoryProvider).fetchMyCoupons());
