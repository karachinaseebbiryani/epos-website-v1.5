import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Ref-counted global loading state. Multiple in-flight operations can each
/// call [start]/[stop]; the overlay is visible while the count is > 0, so
/// overlapping requests don't prematurely hide it.
class LoadingController extends ValueNotifier<int> {
  LoadingController() : super(0);

  bool get isLoading => value > 0;

  void start() => value = value + 1;

  void stop() {
    if (value > 0) value = value - 1;
  }

  /// Wrap an async operation so the overlay is shown for its duration.
  Future<T> wrap<T>(Future<T> Function() action) async {
    start();
    try {
      return await action();
    } finally {
      stop();
    }
  }
}

/// Single global instance — read by the Dio interceptor (non-widget code) and
/// the overlay widget alike, so it lives outside the widget tree.
final loadingController = LoadingController();

final loadingControllerProvider =
    Provider<LoadingController>((ref) => loadingController);
