import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../auth/auth_controller.dart' show apiClientProvider;
import 'payment_models.dart';

/// Payment-related backend calls: public settings, manual-transfer reference +
/// proof upload, and the SafePay online gateway session.
class PaymentRepository {
  PaymentRepository(this._api);
  final ApiClient _api;

  Future<PublicPaymentSettings> fetchSettings() async {
    final res = await _api.dio
        .get('/public/settings', options: Options(extra: {'silent': true}));
    throwIfError(res);
    return PublicPaymentSettings.fromJson(Map<String, dynamic>.from(res.data));
  }

  /// Submit a manual-transfer reference (Easypaisa / JazzCash / bank).
  /// `via` must be one of `easypaisa`, `jazzcash`, `bank`.
  Future<void> submitBankPayment({
    required String orderId,
    required String via,
    required String transactionId,
    String? payerName,
  }) async {
    final res = await _api.dio.post(
      '/online-orders/$orderId/bank-payment',
      data: {
        'payment_via': via,
        'transaction_id': transactionId,
        if (payerName != null && payerName.isNotEmpty) 'payer_name': payerName,
      },
      options: Options(extra: {'showLoading': true}),
    );
    throwIfError(res);
  }

  /// Upload a payment proof screenshot/PDF for an order (multipart `file`).
  Future<void> uploadScreenshot({
    required String orderId,
    required String filePath,
  }) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
    });
    final res = await _api.dio.post(
      '/online-orders/$orderId/payment-screenshot',
      data: form,
      options: Options(extra: {'showLoading': true}),
    );
    throwIfError(res);
  }

  /// Create a SafePay hosted-checkout session for an order. Returns the checkout
  /// URL + tracker. Backend returns 503 when SafePay is not configured — callers
  /// should treat that as "gateway unavailable".
  Future<SafepaySession> createSafepaySession({
    required String orderId,
    required String originUrl,
  }) async {
    final res = await _api.dio.post(
      '/payments/safepay/create-session',
      data: {'order_id': orderId, 'origin_url': originUrl},
      options: Options(extra: {'showLoading': true, 'silent': true}),
    );
    throwIfError(res);
    final j = Map<String, dynamic>.from(res.data);
    return SafepaySession(
      url: (j['url'] ?? '').toString(),
      tracker: (j['tracker'] ?? j['session_id'] ?? '').toString(),
    );
  }

  /// Poll SafePay payment status for a tracker. Returns the payment_status
  /// string (e.g. `paid`, `pending`, `failed`).
  Future<String> safepayStatus(String tracker) async {
    final res = await _api.dio.get(
      '/payments/safepay/status/$tracker',
      options: Options(extra: {'silent': true}),
    );
    throwIfError(res);
    final j = Map<String, dynamic>.from(res.data);
    return (j['payment_status'] ?? 'pending').toString();
  }
}

class SafepaySession {
  const SafepaySession({required this.url, required this.tracker});
  final String url;
  final String tracker;
}

final paymentRepositoryProvider = Provider<PaymentRepository>(
    (ref) => PaymentRepository(ref.watch(apiClientProvider)));

final paymentSettingsProvider = FutureProvider<PublicPaymentSettings>(
    (ref) => ref.watch(paymentRepositoryProvider).fetchSettings());
