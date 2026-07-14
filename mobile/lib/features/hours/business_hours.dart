import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart' show apiClientProvider;
import '../../core/api_client.dart';

/// Restaurant open/closed state from GET /api/public/business-hours.
class BusinessHours {
  const BusinessHours({
    required this.isOpen,
    this.nextOpenDisplay,
    this.todayOpen,
    this.todayClose,
    this.todayClosed = false,
  });

  final bool isOpen;
  final String? nextOpenDisplay; // friendly time the shop next opens
  final String? todayOpen;
  final String? todayClose;
  final bool todayClosed;

  factory BusinessHours.fromJson(Map<String, dynamic> j) {
    final today = (j['today'] is Map)
        ? Map<String, dynamic>.from(j['today'])
        : const <String, dynamic>{};
    return BusinessHours(
      isOpen: j['is_open'] == true,
      nextOpenDisplay:
          (j['next_open_display'] ?? j['next_open_at'])?.toString(),
      todayOpen: today['open']?.toString(),
      todayClose: today['close']?.toString(),
      todayClosed: today['closed'] == true,
    );
  }
}

class BusinessHoursRepository {
  BusinessHoursRepository(this._api);
  final ApiClient _api;

  Future<BusinessHours> fetch() async {
    final res = await _api.dio
        .get('/public/business-hours', options: Options(extra: {'silent': true}));
    throwIfError(res);
    return BusinessHours.fromJson(Map<String, dynamic>.from(res.data));
  }
}

final businessHoursRepositoryProvider = Provider<BusinessHoursRepository>(
    (ref) => BusinessHoursRepository(ref.watch(apiClientProvider)));

final businessHoursProvider = FutureProvider<BusinessHours>(
    (ref) => ref.watch(businessHoursRepositoryProvider).fetch());
