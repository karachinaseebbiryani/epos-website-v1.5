import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Live connectivity stream. connectivity_plus v6 emits a *list* of results
/// (a device can be on wifi + vpn simultaneously).
final connectivityProvider = StreamProvider<List<ConnectivityResult>>((ref) {
  return Connectivity().onConnectivityChanged;
});

/// True unless we positively know there's no transport. We assume online until
/// the first event arrives so the offline banner never flashes on cold start.
final isOnlineProvider = Provider<bool>((ref) {
  final results = ref.watch(connectivityProvider).value;
  if (results == null || results.isEmpty) return true;
  return results.any((r) => r != ConnectivityResult.none);
});
