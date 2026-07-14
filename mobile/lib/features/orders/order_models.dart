double _toDouble(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

int _toInt(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString()) ?? 0;
}

/// The canonical order status flow, in display order.
const List<String> orderStatusFlow = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
];

/// Customer-facing status labels — kept in sync with the website tracker
/// (frontend/src/pages/TrackingPage.jsx STEPS) so app and site read identically.
String prettyStatus(String s) => switch (s) {
      'pending' => 'Order Placed',
      'accepted' => 'Accepted',
      'preparing' => 'Preparing',
      'ready' => 'Ready',
      'out_for_delivery' => 'On the way',
      'delivered' => 'Delivered',
      'rejected' => 'Rejected',
      'cancelled' => 'Cancelled',
      _ => s,
    };

/// Terminal states never change again, so live polling can stop once reached.
const Set<String> terminalStatuses = {'delivered', 'cancelled', 'rejected'};

bool isTerminalStatus(String s) => terminalStatuses.contains(s);

/// Human-readable payment status, matching the website (raw value with
/// underscores as spaces, e.g. pending_verification → "pending verification").
String prettyPaymentStatus(String s) => s.replaceAll('_', ' ');

class OrderItem {
  const OrderItem({required this.name, required this.price, required this.quantity, this.variationName});
  final String name;
  final double price;
  final int quantity;
  final String? variationName;

  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        name: (j['name'] ?? '').toString(),
        price: _toDouble(j['price']),
        quantity: _toInt(j['quantity']),
        variationName: j['variation_name']?.toString(),
      );
}

class Order {
  const Order({
    required this.id,
    required this.receiptNo,
    required this.status,
    required this.subtotal,
    required this.deliveryFee,
    required this.discountAmount,
    required this.totalPrice,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.items,
    this.orderType = 'delivery',
    this.trackToken,
    this.diamondsEarned = 0,
    this.customerName = '',
    this.phone = '',
    this.address = '',
    this.createdAt = '',
  });

  final String id;
  final String receiptNo;
  final String status;
  final double subtotal;
  final double deliveryFee;
  final double discountAmount;
  final double totalPrice;
  final String paymentMethod;
  final String paymentStatus;
  final List<OrderItem> items;
  final String orderType; // 'delivery' | 'pickup'
  final String? trackToken;

  bool get isPickup => orderType == 'pickup';
  final int diamondsEarned;
  final String customerName;
  final String phone;
  final String address;
  final String createdAt;

  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: (j['id'] ?? '').toString(),
        receiptNo: (j['receipt_no'] ?? '').toString(),
        status: (j['status'] ?? 'pending').toString(),
        subtotal: _toDouble(j['subtotal']),
        deliveryFee: _toDouble(j['delivery_fee']),
        discountAmount: _toDouble(j['discount_amount']),
        totalPrice: _toDouble(j['total_price']),
        paymentMethod: (j['payment_method'] ?? 'cod').toString(),
        paymentStatus: (j['payment_status'] ?? 'pending').toString(),
        items: ((j['items'] as List?) ?? [])
            .whereType<Map>()
            .map((i) => OrderItem.fromJson(Map<String, dynamic>.from(i)))
            .toList(),
        orderType: (j['order_type'] ?? 'delivery').toString(),
        trackToken: j['track_token']?.toString(),
        diamondsEarned: _toInt(j['diamonds_earned']),
        customerName: (j['customer_name'] ?? '').toString(),
        phone: (j['phone'] ?? '').toString(),
        address: (j['address'] ?? '').toString(),
        createdAt: (j['created_at'] ?? '').toString(),
      );
}

/// Response of POST /api/delivery/quote.
class DeliveryQuote {
  const DeliveryQuote({
    required this.distanceKm,
    required this.fee,
    required this.inRange,
    required this.freeDelivery,
    required this.maxRadiusKm,
  });

  final double distanceKm;
  final double fee;
  final bool inRange;
  final bool freeDelivery;
  final double maxRadiusKm;

  factory DeliveryQuote.fromJson(Map<String, dynamic> j) => DeliveryQuote(
        distanceKm: _toDouble(j['distance_km']),
        fee: _toDouble(j['fee']),
        inRange: j['in_range'] == true,
        freeDelivery: j['free_delivery'] == true,
        maxRadiusKm: _toDouble(j['max_radius_km']),
      );
}

/// A customer review of a delivered order (POST /reviews, GET /reviews/order/{id}).
class Review {
  const Review({
    required this.id,
    required this.rating,
    required this.comment,
    required this.customerName,
    required this.createdAt,
  });

  final String id;
  final int rating;
  final String comment;
  final String customerName;
  final String createdAt;

  factory Review.fromJson(Map<String, dynamic> j) => Review(
        id: (j['id'] ?? '').toString(),
        rating: _toInt(j['rating']),
        comment: (j['comment'] ?? '').toString(),
        customerName: (j['customer_name'] ?? '').toString(),
        createdAt: (j['created_at'] ?? '').toString(),
      );
}
