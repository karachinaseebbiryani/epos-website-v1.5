import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/api_client.dart';
import '../../core/session_events.dart';
import '../../core/token_store.dart';
import 'auth_repository.dart';
import 'customer.dart';

// --- Dependency providers ---------------------------------------------------

final tokenStoreProvider = Provider<TokenStore>(
  (ref) => TokenStore(const FlutterSecureStorage()),
);

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    ref.watch(tokenStoreProvider),
    // No customer refresh endpoint yet: return false to force re-login.
    // When you add POST /customer/refresh, call it here, store the new access
    // token via TokenStore.write(), and return true.
    onRefresh: () async => false,
    // Signal session expiry through a decoupled singleton so this provider does
    // NOT reference authControllerProvider (which would form an initializer
    // cycle). AuthController listens to sessionEvents and logs out.
    onSessionExpired: () => sessionEvents.notifyExpired(),
  );
});

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(
    ref.watch(apiClientProvider),
    ref.watch(tokenStoreProvider),
  ),
);

// --- Auth state -------------------------------------------------------------

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState({required this.status, this.customer, this.error});

  final AuthStatus status;
  final Customer? customer;
  final String? error;

  AuthState copyWith({AuthStatus? status, Customer? customer, String? error}) =>
      AuthState(
        status: status ?? this.status,
        customer: customer ?? this.customer,
        error: error,
      );

  static const initial = AuthState(status: AuthStatus.unknown);
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._repo) : super(AuthState.initial) {
    sessionEvents.addListener(_onSessionExpired);
    _bootstrap();
  }

  final AuthRepository _repo;

  void _onSessionExpired() => forceLogout();

  @override
  void dispose() {
    sessionEvents.removeListener(_onSessionExpired);
    super.dispose();
  }

  Future<void> _bootstrap() async {
    try {
      final me = await _repo.me();
      state = me == null
          ? state.copyWith(status: AuthStatus.unauthenticated)
          : state.copyWith(status: AuthStatus.authenticated, customer: me);
    } catch (_) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(error: null);
    try {
      final res = await _repo.login(email, password);
      state = state.copyWith(
        status: AuthStatus.authenticated,
        customer: res.customer,
      );
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(error: e.message);
      return false;
    }
  }

  Future<bool> register({
    required String name,
    required String email,
    required String phone,
    required String password,
  }) async {
    state = state.copyWith(error: null);
    try {
      final res = await _repo.register(
        name: name,
        email: email,
        phone: phone,
        password: password,
      );
      state = state.copyWith(
        status: AuthStatus.authenticated,
        customer: res.customer,
      );
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(error: e.message);
      return false;
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Session expired (server returned 401 and refresh failed). Clear the token
  /// locally and drop to unauthenticated so the router redirects to /login.
  void forceLogout() {
    _repo.clearSession();
    if (state.status != AuthStatus.unauthenticated) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(ref.watch(authRepositoryProvider)),
);
