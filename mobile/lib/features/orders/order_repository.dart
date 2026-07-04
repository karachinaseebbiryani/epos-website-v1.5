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
    String notes = '',
    String paymentMethod = 'cod',
    String? couponCode,
    double? deliveryLat,
    double? deliveryLng,
    String? rewardId,
  }) async {
    final res = await _api.dio.post(
      '/online-orders',
      data: {
        'items': [for (final l in lines) l.toOrderItem()],
        'total_price': subtotal,
        'customer_name': customerName,
        'phone': phone,
        'address': address,
        'notes': notes,
        'payment_method': paymentMethod,
        if (couponCode != null && couponCode.isNotEmpty) 'coupon_code': couponCode,
        if (deliveryLat != null) 'delivery_lat': deliveryLat,
        if (deliveryLng != null) 'delivery_lng': deliveryLng,
        if (rewardId != null) 'reward_id': rewardId,
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
final orderTrackingProvider =
    FutureProvider.family<Order, String>((ref, key) {
  final parts = key.split('|');
  final id = parts.first;
  final token = parts.length > 1 && parts[1].isNotEmpty ? parts[1] : null;
  return ref.watch(orderRepositoryProvider).track(id, token);
});
