import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the customer JWT (`customer_token`) in the platform keystore.
/// The backend accepts it as `Authorization: Bearer <token>`.
///
/// [refreshToken] is scaffolding for when the backend gains a
/// `/customer/refresh` endpoint — the auto-refresh interceptor already reads
/// and writes it, so wiring it up later is a one-line backend change.
class TokenStore {
  TokenStore(this._storage);

  final FlutterSecureStorage _storage;
  static const _accessKey = 'customer_token';
  static const _refreshKey = 'customer_refresh_token';

  Future<String?> read() => _storage.read(key: _accessKey);
  Future<void> write(String token) =>
      _storage.write(key: _accessKey, value: token);

  Future<String?> readRefresh() => _storage.read(key: _refreshKey);
  Future<void> writeRefresh(String token) =>
      _storage.write(key: _refreshKey, value: token);

  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}
