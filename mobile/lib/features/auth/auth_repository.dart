import 'package:dio/dio.dart';

import '../../core/api_client.dart';
import '../../core/token_store.dart';
import 'customer.dart';

/// Talks to the backend's customer-auth endpoints. These already return the
/// JWT in the response body (`token`), so the app works purely header-based.
class AuthRepository {
  AuthRepository(this._api, this._tokenStore);

  final ApiClient _api;
  final TokenStore _tokenStore;

  // Auth attempts must NOT trigger the 401 refresh/logout flow — a 401 here is
  // just "wrong password". They also drive the global loading overlay.
  Options _authOpts() =>
      Options(extra: {'skipAuthRetry': true, 'showLoading': true});

  // Background calls that shouldn't pop a global error SnackBar.
  Options _silent() => Options(extra: {'silent': true, 'skipAuthRetry': true});

  Future<AuthResult> login(String email, String password) async {
    final res = await _api.dio.post('/customer/login', data: {
      'email': email,
      'password': password,
    }, options: _authOpts());
    throwIfError(res);
    final result = AuthResult.fromJson(Map<String, dynamic>.from(res.data));
    await _tokenStore.write(result.token);
    return result;
  }

  Future<AuthResult> register({
    required String name,
    required String email,
    required String phone,
    required String password,
  }) async {
    final res = await _api.dio.post('/customer/register', data: {
      'name': name,
      'email': email,
      'phone': phone,
      'password': password,
    }, options: _authOpts());
    throwIfError(res);
    final result = AuthResult.fromJson(Map<String, dynamic>.from(res.data));
    await _tokenStore.write(result.token);
    return result;
  }

  Future<AuthResult> googleLogin(String idToken) async {
    final res = await _api.dio.post('/customer/google',
        data: {'credential': idToken}, options: _authOpts());
    throwIfError(res);
    final result = AuthResult.fromJson(Map<String, dynamic>.from(res.data));
    await _tokenStore.write(result.token);
    return result;
  }

  Future<AuthResult> facebookLogin(String accessToken) async {
    final res = await _api.dio.post('/customer/facebook',
        data: {'access_token': accessToken}, options: _authOpts());
    throwIfError(res);
    final result = AuthResult.fromJson(Map<String, dynamic>.from(res.data));
    await _tokenStore.write(result.token);
    return result;
  }

  /// Confirm the emailed 6-digit OTP for the signed-in customer.
  Future<bool> verifyEmail(String otp) async {
    final res = await _api.dio.post('/customer/verify-email',
        data: {'otp': otp}, options: _authOpts());
    throwIfError(res);
    final data = Map<String, dynamic>.from(res.data);
    return data['email_verified'] == true;
  }

  /// Ask the backend to re-send the verification code (rate-limited server-side).
  Future<void> resendOtp() async {
    final res =
        await _api.dio.post('/customer/resend-otp', options: _authOpts());
    throwIfError(res);
  }

  /// Verify a stored token and hydrate the profile on app start.
  Future<Customer?> me() async {
    final token = await _tokenStore.read();
    if (token == null || token.isEmpty) return null;
    final res = await _api.dio.get('/customer/me', options: _silent());
    if (res.statusCode == 401) {
      await _tokenStore.clear();
      return null;
    }
    throwIfError(res);
    return Customer.fromJson(Map<String, dynamic>.from(res.data));
  }

  Future<void> logout() async {
    try {
      await _api.dio.post('/customer/logout', options: _silent());
    } catch (_) {
      // Best-effort; clearing the local token is what actually logs us out.
    }
    await _tokenStore.clear();
  }

  /// Clear local credentials without a server round-trip. Used when the server
  /// has already rejected us with 401 (session expired).
  Future<void> clearSession() => _tokenStore.clear();

  /// Register this device's FCM token for order-status push (P5).
  Future<void> registerFcmToken(String fcmToken) async {
    await _api.dio.post('/customer/fcm-token', data: {
      'token': fcmToken,
      'platform': 'android',
    }, options: _silent());
  }
}
