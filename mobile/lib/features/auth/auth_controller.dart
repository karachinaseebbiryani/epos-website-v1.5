import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:dio/dio.dart';

import 'dart:async';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/push.dart';
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
    // Refresh customer token when it expires during API calls (e.g. order placement).
    // The backend's POST /customer/refresh accepts the expired token and issues a new one.
    onRefresh: () async {
      try {
        final tokenStore = ref.watch(tokenStoreProvider);
        final oldToken = await tokenStore.read();
        if (oldToken == null || oldToken.isEmpty) return false;
        
        final refreshDio = Dio(BaseOptions(
          baseUrl: AppConfig.apiRoot,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 20),
        ));
        final res = await refreshDio.post(
          '/customer/refresh',
          options: Options(headers: {'Authorization': 'Bearer $oldToken'}),
        );
        
        if (res.statusCode == 200 && res.data is Map) {
          final newToken = res.data['token'];
          if (newToken != null && newToken.isNotEmpty) {
            await tokenStore.write(newToken);
            return true;
          }
        }
        return false;
      } catch (_) {
        return false;
      }
    },
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
  const AuthState({
    required this.status,
    this.customer,
    this.error,
    this.otpEmailFailed = false,
  });

  final AuthStatus status;
  final Customer? customer;
  final String? error;

  /// True when registration succeeded but the verification email failed to send
  /// (SMTP down/unconfigured server-side) — the verify screen shows a warning
  /// and points at "Resend code".
  final bool otpEmailFailed;

  AuthState copyWith(
          {AuthStatus? status,
          Customer? customer,
          String? error,
          bool? otpEmailFailed}) =>
      AuthState(
        status: status ?? this.status,
        customer: customer ?? this.customer,
        error: error,
        otpEmailFailed: otpEmailFailed ?? this.otpEmailFailed,
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

  /// Register this device for order-status push once signed in. Fire-and-forget;
  /// inert when FCM isn't configured (see PushService).
  void _registerPush() {
    unawaited(PushService.instance.registerWith(_repo));
  }

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
      if (me != null) _registerPush();
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
      _registerPush();
      // Fetch the full customer profile (includes wallet_balance, etc)
      // immediately after login so the UI has complete data.
      try {
        final fullCustomer = await _repo.me();
        if (fullCustomer != null) {
          state = state.copyWith(customer: fullCustomer);
        }
      } catch (_) {
        // Fallback: we have the basic customer data, app is usable
      }
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(error: e.message);
      return false;
    } catch (e) {
      // Any non-API failure (e.g. transport/parse/secure-storage) must still
      // resolve the caller so the button spinner never hangs.
      state = state.copyWith(error: 'Could not sign in. Please try again.');
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
        // otp_sent=false on register means the code email didn't go out.
        otpEmailFailed: res.otpSent == false,
      );
      _registerPush();
      // Fetch the full customer profile (includes wallet_balance, etc)
      // immediately after registration so the UI has complete data.
      try {
        final fullCustomer = await _repo.me();
        if (fullCustomer != null) {
          state = state.copyWith(customer: fullCustomer);
        }
      } catch (_) {
        // Fallback: we have the basic customer data, app is usable
      }
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(error: e.message);
      return false;
    } catch (e) {
      state = state.copyWith(error: 'Could not create account. Please try again.');
      return false;
    }
  }

  Future<bool> signInWithGoogle(String idToken) async {
    state = state.copyWith(error: null);
    try {
      final res = await _repo.googleLogin(idToken);
      state = state.copyWith(
          status: AuthStatus.authenticated, customer: res.customer);
      _registerPush();
      // Fetch the full customer profile (includes wallet_balance, etc)
      // immediately after sign-in so the UI has complete data.
      try {
        final fullCustomer = await _repo.me();
        if (fullCustomer != null) {
          state = state.copyWith(customer: fullCustomer);
        }
      } catch (_) {
        // Fallback: we have the basic customer data, app is usable
      }
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(error: e.message);
      return false;
    } catch (e) {
      state = state.copyWith(error: 'Google sign-in failed. Please try again.');
      return false;
    }
  }

  Future<bool> signInWithFacebook(String accessToken) async {
    state = state.copyWith(error: null);
    try {
      final res = await _repo.facebookLogin(accessToken);
      state = state.copyWith(
          status: AuthStatus.authenticated, customer: res.customer);
      _registerPush();
      // Fetch the full customer profile (includes wallet_balance, etc)
      // immediately after sign-in so the UI has complete data.
      try {
        final fullCustomer = await _repo.me();
        if (fullCustomer != null) {
          state = state.copyWith(customer: fullCustomer);
        }
      } catch (_) {
        // Fallback: we have the basic customer data, app is usable
      }
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(error: e.message);
      return false;
    } catch (e) {
      state = state.copyWith(error: 'Facebook sign-in failed. Please try again.');
      return false;
    }
  }

  /// Confirm the email OTP. On success flips the cached customer to verified so
  /// the router/checkout stop gating. Returns true when verified.
  Future<bool> verifyEmail(String otp) async {
    state = state.copyWith(error: null);
    try {
      final ok = await _repo.verifyEmail(otp);
      if (ok && state.customer != null) {
        state = state.copyWith(
            customer: state.customer!.copyWith(emailVerified: true));
      }
      return ok;
    } on ApiException catch (e) {
      state = state.copyWith(error: e.message);
      return false;
    } catch (_) {
      state = state.copyWith(error: 'Could not verify. Please try again.');
      return false;
    }
  }

  Future<bool> resendOtp() async {
    state = state.copyWith(error: null);
    try {
      await _repo.resendOtp();
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(error: e.message);
      return false;
    } catch (_) {
      state = state.copyWith(error: 'Could not resend the code. Please try again.');
      return false;
    }
  }

  Future<bool> signInWithApple(String identityToken, {String? name}) async {
    state = state.copyWith(error: null);
    try {
      final res = await _repo.appleLogin(identityToken, name: name);
      state = state.copyWith(
          status: AuthStatus.authenticated, customer: res.customer);
      _registerPush();
      // Fetch the full customer profile (includes wallet_balance, etc)
      // immediately after sign-in so the UI has complete data.
      try {
        final fullCustomer = await _repo.me();
        if (fullCustomer != null) {
          state = state.copyWith(customer: fullCustomer);
        }
      } catch (_) {
        // Fallback: we have the basic customer data, app is usable
      }
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(error: e.message);
      return false;
    } catch (e) {
      state = state.copyWith(error: 'Apple sign-in failed. Please try again.');
      return false;
    }
  }

  /// Permanently delete the account. On success drops to signed-out state.
  Future<bool> deleteAccount() async {
    state = state.copyWith(error: null);
    try {
      await _repo.deleteAccount();
      // Clear Google Sign-In cache so the account picker shows on next sign-in
      try {
        final googleSignIn = GoogleSignIn();
        await googleSignIn.disconnect();
        await googleSignIn.signOut();
      } catch (_) {
        // Account deletion must still complete if Google is unavailable.
      }
      state = const AuthState(status: AuthStatus.unauthenticated);
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(error: e.message);
      return false;
    } catch (_) {
      state = state.copyWith(error: 'Could not delete the account. Please try again.');
      return false;
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    // Clear Google Sign-In cache completely to force account picker on next sign-in
    try {
      final googleSignIn = GoogleSignIn();
      await googleSignIn.disconnect();
      await googleSignIn.signOut();
    } catch (_) {
      // App logout must still complete if Google is unavailable.
    }
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

  /// Refresh customer data from the server (to get updated wallet balance, etc.)
  Future<void> refreshCustomer() async {
    if (state.status != AuthStatus.authenticated) return;
    try {
      final me = await _repo.me();
      if (me != null) {
        state = state.copyWith(customer: me);
      }
    } catch (_) {
      // Silent fail - keep existing customer data if refresh fails
    }
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(ref.watch(authRepositoryProvider)),
);
