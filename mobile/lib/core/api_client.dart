import 'dart:async';

import 'package:dio/dio.dart';

import 'app_messenger.dart';
import 'config.dart';
import 'loading_controller.dart';
import 'token_store.dart';

/// Signature for a token refresh attempt. Return true if a *new* access token
/// was obtained and written to [TokenStore]; false to force re-login.
typedef TokenRefresher = Future<bool> Function();

/// Central HTTP client:
///  - attaches the Bearer token to every request,
///  - drives the global loading overlay for requests that opt in
///    (`Options(extra: {'showLoading': true})`),
///  - performs a single-flight token refresh + retry on 401,
///  - surfaces transport/5xx failures through the global SnackBar
///    (unless `Options(extra: {'silent': true})`).
class ApiClient {
  ApiClient(
    this._tokenStore, {
    this.onRefresh,
    this.onSessionExpired,
  }) {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiRoot,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        headers: {'Content-Type': 'application/json'},
        // 4xx come back as normal responses so callers can read `detail`.
        // 401 is handled specially in onResponse (refresh + retry).
        validateStatus: (code) => code != null && code < 500,
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.extra['showLoading'] == true) loadingController.start();
          final token = await _tokenStore.read();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onResponse: (response, handler) async {
          final req = response.requestOptions;
          if (req.extra['showLoading'] == true) loadingController.stop();

          final unauthorized = response.statusCode == 401;
          final alreadyRetried = req.extra['__retried'] == true;
          final skipAuth = req.extra['skipAuthRetry'] == true;

          if (unauthorized && !alreadyRetried && !skipAuth && onRefresh != null) {
            final refreshed = await _refreshOnce();
            if (refreshed) {
              try {
                final retried = await _retry(req);
                return handler.resolve(retried);
              } catch (_) {
                // fall through to session-expired
              }
            }
            onSessionExpired?.call();
          }
          handler.next(response);
        },
        onError: (err, handler) {
          final req = err.requestOptions;
          if (req.extra['showLoading'] == true) loadingController.stop();
          // onError only fires for transport failures / timeouts / 5xx here.
          if (req.extra['silent'] != true) {
            showGlobalSnack(_friendlyMessage(err));
          }
          handler.next(err);
        },
      ),
    );
  }

  final TokenStore _tokenStore;
  final TokenRefresher? onRefresh;
  final void Function()? onSessionExpired;

  late final Dio dio;

  // --- single-flight refresh ---
  Completer<bool>? _refreshing;

  Future<bool> _refreshOnce() {
    final existing = _refreshing;
    if (existing != null) return existing.future;
    final completer = Completer<bool>();
    _refreshing = completer;
    onRefresh!().then(completer.complete).catchError((_) {
      completer.complete(false);
    }).whenComplete(() => _refreshing = null);
    return completer.future;
  }

  Future<Response<dynamic>> _retry(RequestOptions req) async {
    final token = await _tokenStore.read();
    final options = Options(
      method: req.method,
      responseType: req.responseType,
      contentType: req.contentType,
      headers: {
        ...req.headers,
        if (token != null) 'Authorization': 'Bearer $token',
      },
      extra: {...req.extra, '__retried': true},
      validateStatus: (code) => code != null && code < 500,
    );
    return dio.request(
      req.path,
      data: req.data,
      queryParameters: req.queryParameters,
      options: options,
    );
  }

  static String _friendlyMessage(DioException err) {
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return 'The server took too long to respond. Please try again.';
      case DioExceptionType.connectionError:
        return 'Cannot reach the server. Check your connection.';
      default:
        final code = err.response?.statusCode;
        if (code != null && code >= 500) {
          return 'Something went wrong on our end. Please try again.';
        }
        return err.message ?? 'Network error. Please try again.';
    }
  }
}

/// Normalised API error so UI can show `e.message` regardless of transport.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

/// Raise for non-2xx responses that Dio passed through (status < 500).
/// FastAPI returns `{"detail": "..."}`.
void throwIfError(Response res) {
  final code = res.statusCode ?? 0;
  if (code < 200 || code >= 300) {
    final data = res.data;
    final detail = (data is Map && data['detail'] != null)
        ? data['detail'].toString()
        : 'Request failed ($code)';
    throw ApiException(detail, statusCode: code);
  }
}
