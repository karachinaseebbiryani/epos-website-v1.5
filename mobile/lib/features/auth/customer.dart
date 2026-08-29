/// Customer profile as returned by the /customer/* auth endpoints.
class Customer {
  const Customer({
    required this.id,
    required this.email,
    required this.name,
    required this.phone,
    this.emailVerified = true,
    this.walletBalance = 0.0,
    this.diamondBalance = 0,
  });

  final String id;
  final String email;
  final String name;
  final String phone;

  /// Whether the account's email is confirmed. Defaults true so grandfathered /
  /// social accounts (backend omits or sets the flag) are never wrongly blocked.
  final bool emailVerified;

  /// Wallet balance (store credit from refunds)
  final double walletBalance;

  /// Diamond balance (loyalty points)
  final int diamondBalance;

  Customer copyWith({bool? emailVerified, double? walletBalance, int? diamondBalance}) => Customer(
        id: id,
        email: email,
        name: name,
        phone: phone,
        emailVerified: emailVerified ?? this.emailVerified,
        walletBalance: walletBalance ?? this.walletBalance,
        diamondBalance: diamondBalance ?? this.diamondBalance,
      );

  factory Customer.fromJson(Map<String, dynamic> json) => Customer(
        id: (json['id'] ?? '').toString(),
        email: (json['email'] ?? '').toString(),
        name: (json['name'] ?? '').toString(),
        phone: (json['phone'] ?? '').toString(),
        // Absent → true (grandfathered). Only an explicit false blocks.
        emailVerified: json['email_verified'] != false,
        walletBalance: (json['wallet_balance'] ?? 0.0) is num
            ? (json['wallet_balance'] ?? 0.0).toDouble()
            : double.tryParse(json['wallet_balance'].toString()) ?? 0.0,
        diamondBalance: (json['diamond_balance'] ?? 0) is num
            ? (json['diamond_balance'] ?? 0).toInt()
            : int.tryParse(json['diamond_balance'].toString()) ?? 0,
      );
}

/// Login/register responses additionally carry the JWT.
class AuthResult {
  const AuthResult({required this.customer, required this.token, this.otpSent});
  final Customer customer;
  final String token;

  /// Register-only: whether the verification email actually sent (null on
  /// login/social where it doesn't apply). False = SMTP failed server-side —
  /// the UI should tell the user to hit "Resend code".
  final bool? otpSent;

  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
        customer: Customer.fromJson(json),
        token: (json['token'] ?? '').toString(),
        otpSent: json.containsKey('otp_sent') ? json['otp_sent'] == true : null,
      );
}
