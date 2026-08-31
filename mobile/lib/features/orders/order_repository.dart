import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../auth/auth_controller.dart' show apiClientProvider;
import '../cart/cart_controller.dart';
import 'order_models.dart';

class OrderRepository {
  OrderRepository(this._api);
  final ApiClient _api;

  /// Place an online order. The server re-validates items + prices, so the
  /// returned Order is authoritative for totals.
  Future<Order> placeOrder({
    required List<CartLine> lines,
    required double subtotal,
    required String customerName,
    required String phone,
    required String address,
    String orderType = 'delivery',
    String notes = '',
    String paymentMethod = 'cod',
    String? couponCode,
    double? deliveryLat,
    double? deliveryLng,
    String? rewardId,
    bool useWalletCredit = false,
    double walletCreditAmount = 0.0,
  }) async {
    final pickup = orderType == 'pickup';
    final res = await _api.dio.post(
      '/online-orders',
      data: {
        'items': [for (final l in lines) l.toOrderItem()],
        'total_price': subtotal,
        'customer_name': customerName,
        'phone': phone,
        'address': pickup ? '' : address,
        'order_type': orderType,
        'notes': notes,
        'payment_method': paymentMethod,
        'platform': 'app',  // Identify orders from mobile app
        if (couponCode != null && couponCode.isNotEmpty) 'coupon_code': couponCode,
        // Delivery coordinates are meaningless for pickup — never send them.
        if (!pickup && deliveryLat != null) 'delivery_lat': deliveryLat,
        if (!pickup && deliveryLng != null) 'delivery_lng': deliveryLng,
        if (rewardId != null) 'reward_id': rewardId,
        if (useWalletCredit) 'use_wallet': true,
      },
      options: Options(extra: {'showLoading': true}),
    );
    throwIfError(res);
    return Order.fromJson(Map<String, dynamic>.from(res.data));
  }

  Future<DeliveryQuote> quote({
    required double lat,
    required double lng,
    required double subtotal,
  }) async {
    final res = await _api.dio.post('/delivery/quote', data: {
      'lat': lat,
      'lng': lng,
      'subtotal': subtotal,
    });
    throwIfError(res);
    return DeliveryQuote.fromJson(Map<String, dynamic>.from(res.data));
  }

  /// Public live-tracking read. Requires the per-order track token.
  Future<Order> track(String orderId, String? trackToken) async {
    final res = await _api.dio.get(
      '/track/$orderId',
      queryParameters: {if (trackToken != null) 't': trackToken},
      options: Options(extra: {'silent': true}),
    );
    throwIfError(res);
    return Order.fromJson(Map<String, dynamic>.from(res.data));
  }

  /// Existing review for an order (public read). Returns null if none yet.
  Future<Review?> reviewForOrder(String orderId) async {
    final res = await _api.dio
        .get('/reviews/order/$orderId', options: Options(extra: {'silent': true}));
    throwIfError(res);
    final data = Map<String, dynamic>.from(res.data);
    final r = data['review'];
    return r == null ? null : Review.fromJson(Map<String, dynamic>.from(r));
  }

  /// Submit a review for a delivered order (customer auth required).
  Future<Review> submitReview({
    required String orderId,
    required int rating,
    required String comment,
  }) async {
    final res = await _api.dio.post(
      '/reviews',
      data: {'order_id': orderId, 'rating': rating, 'comment': comment},
      options: Options(extra: {'showLoading': true}),
    );
    throwIfError(res);
    return Review.fromJson(Map<String, dynamic>.from(res.data));
  }

  /// Customer re-shares their GPS location for an in-progress order so the
  /// rider can find them (POST /online-orders/{id}/customer-location).
  Future<void> shareLocation({
    required String orderId,
    required double lat,
    required double lng,
    String? note,
  }) async {
    final res = await _api.dio.post(
      '/online-orders/$orderId/customer-location',
      data: {
        'lat': lat,
        'lng': lng,
        if (note != null && note.isNotEmpty) 'note': note,
      },
      options: Options(extra: {'showLoading': true}),
    );
    throwIfError(res);
  }

  /// Ask for a refund on a paid order. Same authorization as tracking: the
  /// signed-in owner, or the per-order track token for guest orders.
  Future<void> requestRefund({
    required String orderId,
    required String reason,
    String? trackToken,
  }) async {
    final res = await _api.dio.post(
      '/online-orders/$orderId/refund-request',
      data: {'reason': reason},
      queryParameters: {
        if (trackToken != null && trackToken.isNotEmpty) 't': trackToken,
      },
      options: Options(extra: {'showLoading': true}),
    );
    throwIfError(res);
  }

  /// Send a message on the refund conversation (text; optional image as a
  /// data: URL). Same authorization as requestRefund.
  Future<void> sendRefundMessage({
    required String orderId,
    required String text,
    String? imageDataUrl,
    String? trackToken,
  }) async {
    final res = await _api.dio.post(
      '/online-orders/$orderId/refund-message',
      data: {'text': text, if (imageDataUrl != null) 'image': imageDataUrl},
      queryParameters: {
        if (trackToken != null && trackToken.isNotEmpty) 't': trackToken,
      },
      options: Options(extra: {'showLoading': true}),
    );
    throwIfError(res);
  }

  Future<List<Order>> myOrders() async {
    final res = await _api.dio.get('/online-orders/me');
    throwIfError(res);
    final data = res.data;
    final list = data is List ? data : (data['orders'] as List? ?? []);
    return list
        .whereType<Map>()
        .map((o) => Order.fromJson(Map<String, dynamic>.from(o)))
        .toList();
  }
}

final orderRepositoryProvider = Provider<OrderRepository>(
  (ref) => OrderRepository(ref.watch(apiClientProvider)),
);

/// Live tracking for one order. `.family` keyed by "orderId|token".

/// One-shot read (used for pull-to-refresh / manual invalidation).
final orderTrackingProvider =
    FutureProvider.family<Order, String>((ref, key) {
  final parts = key.split('|');
  final id = parts.first;
  final token = parts.length > 1 && parts[1].isNotEmpty ? parts[1] : null;
  return ref.watch(orderRepositoryProvider).track(id, token);
});

/// Auto-refreshing tracking: polls GET /track every 5s (matching the website's
/// 5-second poll) while the order is non-terminal, then stops. This is what
/// keeps the app's status in step with employee changes on the website even
/// when FCM push isn't configured/delivered. Keyed by "orderId|token".
final orderTrackingStreamProvider =
    StreamProvider.autoDispose.family<Order, String>((ref, key) async* {
  final parts = key.split('|');
  final id = parts.first;
  final token = parts.length > 1 && parts[1].isNotEmpty ? parts[1] : null;
  final repo = ref.watch(orderRepositoryProvider);

  // Emit immediately, then poll until a terminal status is reached.
  while (true) {
    final order = await repo.track(id, token);
    yield order;
    if (isTerminalStatus(order.status)) break;
    await Future<void>.delayed(const Duration(seconds: 5));
  }
});

/// Existing review for an order (null if not yet reviewed). Keyed by order id.
/// The signed-in customer's past orders (GET /online-orders/me, auth).
final myOrdersProvider =
    FutureProvider<List<Order>>((ref) => ref.watch(orderRepositoryProvider).myOrders());

final orderReviewProvider = FutureProvider.family<Review?, String>(
    (ref, orderId) => ref.watch(orderRepositoryProvider).reviewForOrder(orderId));
