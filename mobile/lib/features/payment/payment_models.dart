/// Public payment configuration from GET /api/public/settings.
///
/// `payment_methods` is a map of enabled flags on the backend
/// (`cod`, `pay_at_restaurant`, `bank_transfer`, `card`). The manual-transfer
/// account details (bank / Easypaisa / JazzCash) are always returned, but we
/// only surface them when `bank_transfer` is enabled. `card` gates the online
/// gateway (SafePay / Stripe).
class PublicPaymentSettings {
  const PublicPaymentSettings({
    required this.cod,
    required this.payAtRestaurant,
    required this.bankTransfer,
    required this.card,
    required this.payfastEnabled,
    required this.bankAccountTitle,
    required this.bankAccountNumber,
    required this.bankName,
    required this.iban,
    required this.easypaisaNumber,
    required this.easypaisaAccountTitle,
    required this.jazzcashNumber,
    required this.jazzcashAccountTitle,
  });

  final bool cod;
  final bool payAtRestaurant;
  final bool bankTransfer;
  final bool card;

  /// PayFast gateway configured on the backend — charges Easypaisa/JazzCash
  /// wallets natively on its hosted page (SafePay doesn't list PK wallets).
  final bool payfastEnabled;

  final String bankAccountTitle;
  final String bankAccountNumber;
  final String bankName;
  final String iban;
  final String easypaisaNumber;
  final String easypaisaAccountTitle;
  final String jazzcashNumber;
  final String jazzcashAccountTitle;

  /// The wallet gateway (PayFast) can charge Easypaisa/JazzCash in-app.
  bool get gatewayOn => payfastEnabled;

  /// Manual-transfer details are configured for each wallet / the bank.
  bool get easypaisaManual => bankTransfer && easypaisaNumber.isNotEmpty;
  bool get jazzcashManual => bankTransfer && jazzcashNumber.isNotEmpty;
  bool get hasBank => bankTransfer && bankAccountNumber.isNotEmpty;

  /// A wallet is offered when EITHER the gateway can charge it in-app OR the
  /// manual account number is configured (fallback flow).
  bool get easypaisaAvailable => gatewayOn || easypaisaManual;
  bool get jazzcashAvailable => gatewayOn || jazzcashManual;

  factory PublicPaymentSettings.fromJson(Map<String, dynamic> j) {
    final pm = (j['payment_methods'] is Map)
        ? Map<String, dynamic>.from(j['payment_methods'])
        : const <String, dynamic>{};
    String s(String k) => (j[k] ?? '').toString();
    return PublicPaymentSettings(
      cod: pm['cod'] != false,
      payAtRestaurant: pm['pay_at_restaurant'] != false,
      bankTransfer: pm['bank_transfer'] == true,
      card: pm['card'] == true,
      payfastEnabled: j['payfast_enabled'] == true,
      bankAccountTitle: s('bank_account_title'),
      bankAccountNumber: s('bank_account_number'),
      bankName: s('bank_name'),
      iban: s('iban'),
      easypaisaNumber: s('easypaisa_number'),
      easypaisaAccountTitle: s('easypaisa_account_title'),
      jazzcashNumber: s('jazzcash_number'),
      jazzcashAccountTitle: s('jazzcash_account_title'),
    );
  }
}

/// A payment option offered at checkout. `method` is the string sent to the
/// backend as `payment_method`; `needsTransfer` marks the manual-transfer
/// options that route to the payment screen after the order is placed.
class PaymentOption {
  const PaymentOption({
    required this.method,
    required this.title,
    this.subtitle,
    this.needsTransfer = false,
    this.isGateway = false,
  });

  final String method;
  final String title;
  final String? subtitle;
  final bool needsTransfer;
  final bool isGateway;
}
