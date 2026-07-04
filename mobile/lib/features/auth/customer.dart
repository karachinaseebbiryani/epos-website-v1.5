/// Customer profile as returned by the /customer/* auth endpoints.
class Customer {
  const Customer({
    required this.id,
    required this.email,
    required this.name,
    required this.phone,
  });

  final String id;
  final String email;
  final String name;
  final String phone;

  factory Customer.fromJson(Map<String, dynamic> json) => Customer(
        id: (json['id'] ?? '').toString(),
        email: (json['email'] ?? '').toString(),
        name: (json['name'] ?? '').toString(),
        phone: (json['phone'] ?? '').toString(),
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
