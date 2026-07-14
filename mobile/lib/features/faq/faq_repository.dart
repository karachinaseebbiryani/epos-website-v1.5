import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart' show apiClientProvider;
import '../../core/api_client.dart';
import 'faq_models.dart';

/// Reads the public FAQ feed. GET /api/faqs returns a top-level JSON array,
/// already filtered to enabled entries and sorted by the server.
class FaqRepository {
  FaqRepository(this._api);
  final ApiClient _api;

  Future<List<Faq>> fetchFaqs() async {
    final res = await _api.dio.get('/faqs', options: Options(extra: {'silent': true}));
    throwIfError(res);
    final list = res.data as List? ?? [];
    return list
        .whereType<Map>()
        .map((e) => Faq.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}

final faqRepositoryProvider =
    Provider<FaqRepository>((ref) => FaqRepository(ref.watch(apiClientProvider)));

final faqProvider =
    FutureProvider<List<Faq>>((ref) => ref.watch(faqRepositoryProvider).fetchFaqs());
