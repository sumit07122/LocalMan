class BookingAddressSnapshot {
  final String id;
  final String label;
  final String addressLine1;
  final String? addressLine2;
  final String? landmark;
  final String city;
  final String state;
  final String postalCode;
  final double latitude;
  final double longitude;

  const BookingAddressSnapshot({
    required this.id,
    this.label = 'Home',
    required this.addressLine1,
    this.addressLine2,
    this.landmark,
    required this.city,
    required this.state,
    required this.postalCode,
    this.latitude = 0.0,
    this.longitude = 0.0,
  });

  String get formattedAddress {
    final parts = [
      addressLine1,
      if (addressLine2 != null && addressLine2!.isNotEmpty) addressLine2,
      if (landmark != null && landmark!.isNotEmpty) landmark,
      city,
      '$state - $postalCode',
    ];
    return parts.join(', ');
  }

  factory BookingAddressSnapshot.fromJson(Map<String, dynamic> json) {
    return BookingAddressSnapshot(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? 'Home',
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

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'addressLine1': addressLine1,
        'addressLine2': addressLine2,
        'landmark': landmark,
        'city': city,
        'state': state,
        'postalCode': postalCode,
        'latitude': latitude,
        'longitude': longitude,
      };
}

class BookingPricingSnapshot {
  final String pricingModel;
  final int basePricePaisa;
  final int? hourlyRatePaisa;
  final int? inspectionFeePaisa;
  final int? requestedHours;
  final double taxRatePercent;
  final bool isQuoteRequired;
  final int platformFeePaisa;
  final int totalAmountPaisa;
  final int? minimumHours;
  final int? estimatedHours;

  const BookingPricingSnapshot({
    required this.pricingModel,
    required this.basePricePaisa,
    this.hourlyRatePaisa,
    this.inspectionFeePaisa,
    this.requestedHours,
    this.taxRatePercent = 18.0,
    this.isQuoteRequired = false,
    this.platformFeePaisa = 0,
    this.totalAmountPaisa = 0,
    this.minimumHours,
    this.estimatedHours,
  });

  factory BookingPricingSnapshot.fromJson(Map<String, dynamic> json) {
    final basePrice = (json['basePricePaisa'] as num?)?.toInt() ?? 0;
    return BookingPricingSnapshot(
      pricingModel: json['pricingModel'] as String? ?? 'FIXED_PRICE',
      basePricePaisa: basePrice,
      hourlyRatePaisa: (json['hourlyRatePaisa'] as num?)?.toInt(),
      inspectionFeePaisa: (json['inspectionFeePaisa'] as num?)?.toInt(),
      requestedHours: (json['requestedHours'] as num?)?.toInt(),
      taxRatePercent: (json['taxRatePercent'] as num?)?.toDouble() ?? 18.0,
      isQuoteRequired: json['isQuoteRequired'] as bool? ?? false,
      platformFeePaisa: (json['platformFeePaisa'] as num?)?.toInt() ?? 0,
      totalAmountPaisa: (json['totalAmountPaisa'] as num?)?.toInt() ?? basePrice,
      minimumHours: (json['minimumHours'] as num?)?.toInt() ?? (json['requestedHours'] as num?)?.toInt(),
      estimatedHours: (json['estimatedHours'] as num?)?.toInt() ?? (json['requestedHours'] as num?)?.toInt(),
    );
  }

  Map<String, dynamic> toJson() => {
        'pricingModel': pricingModel,
        'basePricePaisa': basePricePaisa,
        'hourlyRatePaisa': hourlyRatePaisa,
        'inspectionFeePaisa': inspectionFeePaisa,
        'requestedHours': requestedHours,
        'taxRatePercent': taxRatePercent,
        'isQuoteRequired': isQuoteRequired,
        'platformFeePaisa': platformFeePaisa,
        'totalAmountPaisa': totalAmountPaisa,
        if (minimumHours != null) 'minimumHours': minimumHours,
        if (estimatedHours != null) 'estimatedHours': estimatedHours,
      };
}

class BookingServiceSnapshot {
  final String id;
  final String name;
  final String slug;
  final String categoryId;
  final String categoryName;
  final int estimatedDurationMinutes;

  const BookingServiceSnapshot({
    required this.id,
    required this.name,
    this.slug = '',
    this.categoryId = '',
    this.categoryName = '',
    this.estimatedDurationMinutes = 60,
  });

  factory BookingServiceSnapshot.fromJson(Map<String, dynamic> json) {
    return BookingServiceSnapshot(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      categoryId: json['categoryId'] as String? ?? '',
      categoryName: json['categoryName'] as String? ?? '',
      estimatedDurationMinutes:
          (json['estimatedDurationMinutes'] as num?)?.toInt() ?? 60,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'slug': slug,
        'categoryId': categoryId,
        'categoryName': categoryName,
        'estimatedDurationMinutes': estimatedDurationMinutes,
      };
}
