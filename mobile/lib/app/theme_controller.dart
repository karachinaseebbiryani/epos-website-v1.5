import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/prefs.dart';

/// Persisted app theme mode (system / light / dark). Loads the saved choice on
/// construction and writes back on every change.
class ThemeModeController extends StateNotifier<ThemeMode> {
  ThemeModeController(this._prefs) : super(ThemeMode.system) {
    _load();
  }

  final Prefs _prefs;
  static const _key = 'theme_mode';

  Future<void> _load() async {
    final saved = await _prefs.read(_key);
    state = switch (saved) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  Future<void> set(ThemeMode mode) async {
    state = mode;
    await _prefs.write(_key, mode.name);
  }

  /// Cycle system → light → dark → system, for a simple toggle button.
  Future<void> cycle() async {
    final next = switch (state) {
      ThemeMode.system => ThemeMode.light,
      ThemeMode.light => ThemeMode.dark,
      ThemeMode.dark => ThemeMode.system,
    };
    await set(next);
  }
}

final themeModeControllerProvider =
    StateNotifierProvider<ThemeModeController, ThemeMode>(
  (ref) => ThemeModeController(ref.watch(prefsProvider)),
);
