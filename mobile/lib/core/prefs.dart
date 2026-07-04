import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Tiny string key/value store for lightweight preferences (e.g. theme mode).
/// Backed by secure storage to avoid pulling in another dependency.
class Prefs {
  Prefs(this._storage);
  final FlutterSecureStorage _storage;

  Future<String?> read(String key) => _storage.read(key: key);
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);
}

final prefsProvider = Provider<Prefs>(
  (ref) => Prefs(const FlutterSecureStorage()),
);
