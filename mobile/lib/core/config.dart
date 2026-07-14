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
    defaultValue: 'https://knb-backend.fly.dev',
  );

  /// FastAPI mounts everything under the /api prefix.
  static String get apiRoot => '$apiBaseUrl/api';

  /// Google OAuth *Web* client id, used as GoogleSignIn.serverClientId so the
  /// returned idToken's audience matches the backend's GOOGLE_CLIENT_ID.
  /// Default = the Karachi Naseeb web client (project 487494109113). Override at
  /// build time with --dart-define=GOOGLE_SERVER_CLIENT_ID=... if it ever changes.
  /// NOTE: the backend's GOOGLE_CLIENT_ID env var MUST equal this exact value,
  /// or Google sign-in tokens from the app will be rejected.
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '487494109113-bb4g8tj60u9449fo02ql0airoi9rbvpk.apps.googleusercontent.com',
  );

  /// Facebook App ID. When empty (default) the Facebook sign-in button stays a
  /// graceful "not set up" placeholder. Set the real values in
  /// android/app/src/main/res/values/strings.xml AND pass
  /// --dart-define=FACEBOOK_APP_ID=<id> to activate sign-in.
  static const String facebookAppId =
      String.fromEnvironment('FACEBOOK_APP_ID', defaultValue: '');

  static bool get facebookConfigured => facebookAppId.isNotEmpty;

  static const String currencySymbol = 'Rs';
}
