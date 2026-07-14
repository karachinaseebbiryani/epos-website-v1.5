import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../features/auth/auth_repository.dart';

/// Native push notifications via Firebase Cloud Messaging.
///
/// Entirely inert until the owner adds `android/app/google-services.json`:
/// [init] wraps `Firebase.initializeApp()` in a try/catch so a missing config
/// can never crash the app at launch. When Firebase is available we obtain the
/// device token and hand it to the caller (which registers it with the backend
/// via POST /customer/fcm-token). Order-status pushes are then delivered by the
/// backend's FCM fan-out.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  bool _ready = false;
  String? _token;

  bool get isReady => _ready;
  String? get token => _token;

  /// Initialise Firebase + request permission. Safe to call unconditionally.
  /// Returns true when FCM is usable on this device/build.
  Future<bool> init() async {
    if (_ready) return true;
    try {
      await Firebase.initializeApp();
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      _token = await messaging.getToken();
      _ready = _token != null;
      return _ready;
    } catch (e) {
      // No google-services.json / not configured — stay silent and disabled.
      debugPrint('PushService: FCM unavailable ($e)');
      _ready = false;
      return false;
    }
  }

  /// Register the current device token with the backend for the signed-in
  /// customer. No-op when FCM isn't ready. Also keeps the backend in sync if the
  /// token rotates.
  Future<void> registerWith(AuthRepository repo) async {
    if (!await init()) return;
    final tok = _token;
    if (tok == null || tok.isEmpty) return;
    try {
      await repo.registerFcmToken(tok);
    } catch (_) {
      // Best-effort; a failed registration must never block the auth flow.
    }
    // Re-register if Firebase rotates the token while the app is alive.
    FirebaseMessaging.instance.onTokenRefresh.listen((t) async {
      _token = t;
      try {
        await repo.registerFcmToken(t);
      } catch (_) {}
    });
  }
}
