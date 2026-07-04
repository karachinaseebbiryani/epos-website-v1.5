import 'package:flutter/material.dart';

/// Global keys so non-widget code (Dio interceptors, controllers) can show
/// SnackBars without a BuildContext. Attached to MaterialApp.
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// Show a transient error/info message from anywhere in the app.
void showGlobalSnack(String message, {bool isError = true}) {
  final messenger = scaffoldMessengerKey.currentState;
  if (messenger == null) return;
  messenger
    ..clearSnackBars()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: isError ? const Color(0xFFB3261E) : null,
      ),
    );
}
