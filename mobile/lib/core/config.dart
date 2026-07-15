/// App-wide configuration.
///
/// Defaults target the LIVE production backend on Fly.io, so a plain Android
/// Studio "Run ▶" (no flags) works out of the box. Override only if needed:
///   flutter run --dart-define=API_BASE_URL=http://127.0.0.1:8000   (local dev)
class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://knb-backend.fly.dev',
  );

  /// FastAPI mounts everything under the /api prefix.
  static String get apiRoot => '$apiBaseUrl/api';

  /// Public customer website. Policy pages (privacy/terms/refunds/delivery)
  /// are opened from the app in a WebView so app + site always show the same
  /// text (PayFast + store-listing compliance requirement).
  static const String siteBaseUrl = String.fromEnvironment(
    'SITE_BASE_URL',
    defaultValue: 'https://www.karachinaseebbiryani.com',
  );

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

  static const String currencySymbol = 'Rs.';
}
