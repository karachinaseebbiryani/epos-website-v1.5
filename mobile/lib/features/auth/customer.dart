/// Customer profile as returned by the /customer/* auth endpoints.
class Customer {
  const Customer({
    required this.id,
    required this.email,
    required this.name,
    required this.phone,
    this.emailVerified = true,
  });

  final String id;
  final String email;
  final String name;
  final String phone;

  /// Whether the account's email is confirmed. Defaults true so grandfathered /
  /// social accounts (backend omits or sets the flag) are never wrongly blocked.
  final bool emailVerified;

  Customer copyWith({bool? emailVerified}) => Customer(
        id: id,
        email: email,
        name: name,
        phone: phone,
        emailVerified: emailVerified ?? this.emailVerified,
      );

  factory Customer.fromJson(Map<String, dynamic> json) => Customer(
        id: (json['id'] ?? '').toString(),
        email: (json['email'] ?? '').toString(),
        name: (json['name'] ?? '').toString(),
        phone: (json['phone'] ?? '').toString(),
        // Absent → true (grandfathered). Only an explicit false blocks.
        emailVerified: json['email_verified'] != false,
      );
}

/// Login/register responses additionally carry the JWT.
class AuthResult {
  const AuthResult({required this.customer, required this.token});
  final Customer customer;
  final String token;

  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
        customer: Customer.fromJson(json),
        token: (json['token'] ?? '').toString(),
      );
}
