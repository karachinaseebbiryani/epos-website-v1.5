/// App-wide configuration.
///
/// Override the backend at build/run time, e.g.:
///   flutter run --dart-define=API_BASE_URL=https://api.karachinaseeb.com
///
/// Default targets the host machine's localhost from an Android emulator
/// (10.0.2.2 is the emulator's alias for the host loopback).
class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000',
  );

  /// FastAPI mounts everything under the /api prefix.
  static String get apiRoot => '$apiBaseUrl/api';

  static const String currencySymbol = 'Rs';
}
