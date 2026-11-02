class LiveMapStateModel {
  final String bookingId;
  final String bookingStatus;
  final String mapState;
  final bool isTrackingPermitted;
  final bool isNearDestination;
  final int nearDestinationThresholdMeters;
  final MapDestination? destination;
  final MapProvider? provider;
  final MapProviderLocation? providerLocation;
  final MapRouteInfo? route;
  final DateTime timestamp;

  const LiveMapStateModel({
    required this.bookingId,
    required this.bookingStatus,
    required this.mapState,
    required this.isTrackingPermitted,
    required this.isNearDestination,
    required this.nearDestinationThresholdMeters,
    this.destination,
    this.provider,
    this.providerLocation,
    this.route,
    required this.timestamp,
  });

  bool get hasValidCoordinates =>
      providerLocation != null &&
      providerLocation!.latitude != null &&
      providerLocation!.longitude != null;

  String get formattedDistance {
    if (route?.distanceMeters == null) return '';
    final meters = route!.distanceMeters!;
    if (meters < 1000) return '$meters m away';
    return '${(meters / 1000).toStringAsFixed(1)} km away';
  }

  String get formattedEta {
    if (mapState == 'PROVIDER_ARRIVED') return 'Arrived at your location';
    if (isNearDestination) return 'Arriving soon (< 5 mins)';
    if (route?.etaMinutes != null && route!.etaMinutes! > 0) {
      return 'Est. ${route!.etaMinutes} mins';
    }
    if (route?.distanceMeters != null) {
      return formattedDistance;
    }
    return 'ETA unavailable';
  }

  String get statusDisplayLabel {
    switch (mapState) {
      case 'SEARCHING':
        return 'Searching for nearby service experts...';
      case 'PROVIDER_ASSIGNED_LOCATION_UNAVAILABLE':
        return 'Expert assigned • Preparing for departure';
      case 'PROVIDER_ON_THE_WAY':
        return 'Expert is on the way';
      case 'PROVIDER_NEAR_DESTINATION':
        return 'Expert is arriving soon!';
      case 'PROVIDER_ARRIVED':
        return 'Expert has arrived at your address';
      case 'TRACKING_STOPPED_JOB_STARTED':
        return 'Service in progress • Live tracking stopped';
      case 'LOCATION_STALE':
        return 'GPS signal weak • Waiting for next beacon';
      case 'LOCATION_UNAVAILABLE':
        return 'Location temporarily unavailable';
      case 'BOOKING_CANCELLED':
        return 'Booking cancelled';
      case 'BOOKING_COMPLETED':
        return 'Service completed';
      default:
        return 'Status: $bookingStatus';
    }
  }

  factory LiveMapStateModel.fromJson(Map<String, dynamic> json) {
    return LiveMapStateModel(
      bookingId: json['bookingId'] as String? ?? '',
      bookingStatus: json['bookingStatus'] as String? ?? '',
      mapState: json['mapState'] as String? ?? 'SEARCHING',
      isTrackingPermitted: json['isTrackingPermitted'] as bool? ?? false,
      isNearDestination: json['isNearDestination'] as bool? ?? false,
      nearDestinationThresholdMeters:
          (json['nearDestinationThresholdMeters'] as num?)?.toInt() ?? 500,
      destination: json['destination'] != null
          ? MapDestination.fromJson(json['destination'] as Map<String, dynamic>)
          : null,
      provider: json['provider'] != null
          ? MapProvider.fromJson(json['provider'] as Map<String, dynamic>)
          : null,
      providerLocation: json['providerLocation'] != null
          ? MapProviderLocation.fromJson(
              json['providerLocation'] as Map<String, dynamic>)
          : null,
      route: json['route'] != null
          ? MapRouteInfo.fromJson(json['route'] as Map<String, dynamic>)
          : null,
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class MapDestination {
  final String addressLine1;
  final String? addressLine2;
  final String? landmark;
  final String city;
  final String state;
  final String postalCode;
  final double latitude;
  final double longitude;

  const MapDestination({
    required this.addressLine1,
    this.addressLine2,
    this.landmark,
    required this.city,
    required this.state,
    required this.postalCode,
    required this.latitude,
    required this.longitude,
  });

  factory MapDestination.fromJson(Map<String, dynamic> json) {
    return MapDestination(
      addressLine1: json['addressLine1'] as String? ?? '',
      addressLine2: json['addressLine2'] as String?,
      landmark: json['landmark'] as String?,
      city: json['city'] as String? ?? '',
      state: json['state'] as String? ?? '',
      postalCode: json['postalCode'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class MapProvider {
  final String id;
  final String? businessName;
  final String? fullName;
  final String? avatarUrl;
  final String? phoneNumber;
  final double ratingAverage;
  final int experienceYears;

  const MapProvider({
    required this.id,
    this.businessName,
    this.fullName,
    this.avatarUrl,
    this.phoneNumber,
    this.ratingAverage = 5.0,
    this.experienceYears = 0,
  });

  factory MapProvider.fromJson(Map<String, dynamic> json) {
    return MapProvider(
      id: json['id'] as String? ?? '',
      businessName: json['businessName'] as String?,
      fullName: json['fullName'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      phoneNumber: json['phoneNumber'] as String?,
      ratingAverage: (json['ratingAverage'] as num?)?.toDouble() ?? 5.0,
      experienceYears: (json['experienceYears'] as num?)?.toInt() ?? 0,
    );
  }
}

class MapProviderLocation {
  final double? latitude;
  final double? longitude;
  final double? heading;
  final double? speed;
  final double? accuracy;
  final String? lastLocationAt;
  final String freshnessStatus;

  const MapProviderLocation({
    this.latitude,
    this.longitude,
    this.heading,
    this.speed,
    this.accuracy,
    this.lastLocationAt,
    this.freshnessStatus = 'UNAVAILABLE',
  });

  factory MapProviderLocation.fromJson(Map<String, dynamic> json) {
    return MapProviderLocation(
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      heading: (json['heading'] as num?)?.toDouble(),
      speed: (json['speed'] as num?)?.toDouble(),
      accuracy: (json['accuracy'] as num?)?.toDouble(),
      lastLocationAt: json['lastLocationAt'] as String?,
      freshnessStatus: json['freshnessStatus'] as String? ?? 'UNAVAILABLE',
    );
  }
}

class MapRouteInfo {
  final int? distanceMeters;
  final int? durationSeconds;
  final int? etaMinutes;
  final bool isRealTimeRouting;
  final String status;

  const MapRouteInfo({
    this.distanceMeters,
    this.durationSeconds,
    this.etaMinutes,
    this.isRealTimeRouting = false,
    this.status = 'UNKNOWN',
  });

  factory MapRouteInfo.fromJson(Map<String, dynamic> json) {
    return MapRouteInfo(
      distanceMeters: (json['distanceMeters'] as num?)?.toInt(),
      durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
      etaMinutes: (json['etaMinutes'] as num?)?.toInt(),
      isRealTimeRouting: json['isRealTimeRouting'] as bool? ?? false,
      status: json['status'] as String? ?? 'UNKNOWN',
    );
  }
}
