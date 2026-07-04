import 'package:flutter/foundation.dart';

/// Cross-cutting auth signal. The API layer calls [notifyExpired] when a 401
/// can't be recovered; the auth layer listens and logs out.
///
/// Kept as a plain singleton (not a provider) so `ApiClient` does NOT depend on
/// the auth providers — that would form a provider initializer cycle
/// (apiClient -> authController -> authRepository -> apiClient).
class SessionEvents extends ChangeNotifier {
  void notifyExpired() => notifyListeners();
}

final sessionEvents = SessionEvents();
