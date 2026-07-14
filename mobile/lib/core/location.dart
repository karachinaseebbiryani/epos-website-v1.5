import 'package:geolocator/geolocator.dart';

/// A captured GPS coordinate.
class LatLng {
  const LatLng(this.lat, this.lng);
  final double lat;
  final double lng;
}

/// Thrown with a user-friendly message when the current location can't be read.
class LocationException implements Exception {
  const LocationException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Thin wrapper over geolocator that handles the permission/service dance and
/// surfaces friendly errors. Used by checkout to compute the delivery fee.
///
/// A visual map picker (drag-a-pin) will layer on top of this once the Google
/// Maps API key is available — it will feed the same [LatLng] downstream.
class LocationService {
  static Future<LatLng> current() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const LocationException(
          'Location (GPS) is off. Turn it on and try again.');
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied) {
      throw const LocationException('Location permission was denied.');
    }
    if (perm == LocationPermission.deniedForever) {
      throw const LocationException(
          'Location permission is permanently denied. Enable it in Settings.');
    }
    final pos = await Geolocator.getCurrentPosition(
      locationSettings:
          const LocationSettings(accuracy: LocationAccuracy.high),
    );
    return LatLng(pos.latitude, pos.longitude);
  }
}
