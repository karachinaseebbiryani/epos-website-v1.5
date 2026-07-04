import 'config.dart';

/// Format an amount as PKR (no decimals — the platform prices in whole rupees).
String money(num value) =>
    '${AppConfig.currencySymbol} ${value.toStringAsFixed(0)}';
