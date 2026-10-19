import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';

enum LocationStateStatus {
  initial,
  permissionDenied,
  permissionPermanentlyDenied,
  serviceDisabled,
  locating,
  active,
  error,
}

class ProviderLocationState {
  final LocationStateStatus status;
  final Position? position;
  final String? errorMessage;
  final DateTime? lastBeaconSentAt;
  final bool isTracking;

  const ProviderLocationState({
    this.status = LocationStateStatus.initial,
    this.position,
    this.errorMessage,
    this.lastBeaconSentAt,
    this.isTracking = false,
  });

  ProviderLocationState copyWith({
    LocationStateStatus? status,
    Position? position,
    String? errorMessage,
    DateTime? lastBeaconSentAt,
    bool? isTracking,
  }) {
    return ProviderLocationState(
      status: status ?? this.status,
      position: position ?? this.position,
      errorMessage: errorMessage ?? this.errorMessage,
      lastBeaconSentAt: lastBeaconSentAt ?? this.lastBeaconSentAt,
      isTracking: isTracking ?? this.isTracking,
    );
  }
}

class LocationService extends StateNotifier<ProviderLocationState> {
  final ApiClient _apiClient;
  StreamSubscription<Position>? _positionSubscription;
  Timer? _periodicBeaconTimer;
  DateTime? _lastBackendBeaconSent;

  LocationService({required ApiClient apiClient})
      : _apiClient = apiClient,
        super(const ProviderLocationState());

  /// Checks and requests runtime foreground location permissions.
  Future<bool> checkAndRequestPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      state = state.copyWith(
        status: LocationStateStatus.serviceDisabled,
        errorMessage: 'GPS Location Service is disabled on this device. Please turn on GPS in system settings.',
      );
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        state = state.copyWith(
          status: LocationStateStatus.permissionDenied,
          errorMessage: 'Location permission was denied. LocalMan Partner requires GPS access for on-duty matching.',
        );
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      state = state.copyWith(
        status: LocationStateStatus.permissionPermanentlyDenied,
        errorMessage: 'Location permissions are permanently denied. Please grant location access in device settings.',
      );
      return false;
    }

    return true;
  }

  /// Acquires single GPS fix and sends location beacon to server.
  Future<Position?> acquireAndSendCurrentLocation({String? activeBookingId}) async {
    final hasPermission = await checkAndRequestPermission();
    if (!hasPermission) return null;

    state = state.copyWith(status: LocationStateStatus.locating);

    try {
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );

      state = state.copyWith(
        status: LocationStateStatus.active,
        position: position,
        errorMessage: null,
      );

      await sendLocationBeacon(position, activeBookingId: activeBookingId);
      return position;
    } on TimeoutException {
      // Fallback to last known position if active GPS fix times out
      final lastKnown = await Geolocator.getLastKnownPosition();
      if (lastKnown != null) {
        state = state.copyWith(
          status: LocationStateStatus.active,
          position: lastKnown,
          errorMessage: 'GPS signal weak; using last known position.',
        );
        await sendLocationBeacon(lastKnown, activeBookingId: activeBookingId);
        return lastKnown;
      }
      state = state.copyWith(
        status: LocationStateStatus.error,
        errorMessage: 'GPS acquisition timed out. Please ensure you have a clear view of the sky.',
      );
      return null;
    } catch (e) {
      state = state.copyWith(
        status: LocationStateStatus.error,
        errorMessage: 'Failed to acquire GPS: ${e.toString()}',
      );
      return null;
    }
  }

  /// Sends location beacon payload to server.
  /// Enforces client-side minimum 5-second interval throttling to respect server limits.
  Future<void> sendLocationBeacon(Position position, {String? activeBookingId}) async {
    final now = DateTime.now();
    if (_lastBackendBeaconSent != null &&
        now.difference(_lastBackendBeaconSent!).inSeconds < 5) {
      debugPrint('📍 [LocationService] Beacon throttled (<5s elapsed). Skipping backend post.');
      return;
    }

    try {
      final payload = {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy > 0 ? position.accuracy : null,
        'heading': position.heading >= 0 ? position.heading : null,
        'speed': position.speed >= 0 ? position.speed : null,
        'source': 'FOREGROUND_APP',
        if (activeBookingId != null) 'bookingId': activeBookingId,
      };

      await _apiClient.post(
        ApiConstants.locationBeacon,
        data: payload,
      );

      _lastBackendBeaconSent = now;
      state = state.copyWith(
        status: LocationStateStatus.active,
        lastBeaconSentAt: now,
        errorMessage: null,
      );
      debugPrint('📍 [LocationService] Successfully synced location beacon to LocalMan backend.');
    } catch (e) {
      debugPrint('⚠️ [LocationService] Failed to send location beacon: $e');
      state = state.copyWith(
        status: LocationStateStatus.error,
        errorMessage: 'Unable to sync GPS location with server: ${e.toString()}',
      );
    }
  }

  /// Starts periodic foreground tracking while provider is on-duty or in transit.
  void startForegroundTracking({String? activeBookingId}) {
    if (state.isTracking) return;

    state = state.copyWith(isTracking: true);

    // Initial immediate fix
    acquireAndSendCurrentLocation(activeBookingId: activeBookingId);

    // Periodic beacon timer every 30 seconds while on-duty
    _periodicBeaconTimer?.cancel();
    _periodicBeaconTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      acquireAndSendCurrentLocation(activeBookingId: activeBookingId);
    });
  }

  /// Stops tracking when provider toggles OFFLINE or finishes transit.
  void stopTracking() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
    _periodicBeaconTimer?.cancel();
    _periodicBeaconTimer = null;
    state = state.copyWith(isTracking: false, status: LocationStateStatus.initial);
    debugPrint('🛑 [LocationService] Stopped foreground GPS tracking.');
  }

  @override
  void dispose() {
    stopTracking();
    super.dispose();
  }
}

final locationServiceProvider =
    StateNotifierProvider<LocationService, ProviderLocationState>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return LocationService(apiClient: apiClient);
});
