class DispatchOfferModel {
  final String id;
  final String bookingId;
  final String providerId;
  final String status;
  final int attemptNumber;
  final DateTime expiresAt;
  final DateTime createdAt;
  final String bookingNumber;
  final String serviceName;
  final double basePriceRupees;
  final String addressFormatted;
  final String scheduledDate;
  final String scheduledTimeSlot;
  final String? customerNotes;

  const DispatchOfferModel({
    required this.id,
    required this.bookingId,
    required this.providerId,
    required this.status,
    required this.attemptNumber,
    required this.expiresAt,
    required this.createdAt,
    required this.bookingNumber,
    required this.serviceName,
    required this.basePriceRupees,
    required this.addressFormatted,
    required this.scheduledDate,
    required this.scheduledTimeSlot,
    this.customerNotes,
  });

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  int get remainingSeconds {
    final diff = expiresAt.difference(DateTime.now()).inSeconds;
    return diff > 0 ? diff : 0;
  }

  factory DispatchOfferModel.fromJson(Map<String, dynamic> json) {
    final booking = json['booking'] as Map<String, dynamic>? ?? {};
    final service = booking['service'] as Map<String, dynamic>? ?? {};
    final address = booking['address'] as Map<String, dynamic>? ?? {};

    final baseAmountPaisa = booking['baseAmountPaisa'] as int? ?? 0;
    final basePrice = (booking['basePrice'] as num?)?.toDouble() ?? (baseAmountPaisa / 100.0);

    String addrStr = 'Customer location';
    if (address.isNotEmpty) {
      final line1 = address['addressLine1'] ?? '';
      final city = address['city'] ?? '';
      addrStr = '$line1, $city'.replaceAll(RegExp(r'^,\s*|,\s*$'), '');
      if (addrStr.isEmpty) addrStr = 'Customer location';
    }

    return DispatchOfferModel(
      id: json['id'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? (booking['id'] as String? ?? ''),
      providerId: json['providerId'] as String? ?? '',
      status: json['status'] as String? ?? 'OFFERED',
      attemptNumber: json['attemptNumber'] as int? ?? 1,
      expiresAt: json['expiresAt'] != null
          ? DateTime.tryParse(json['expiresAt'] as String) ?? DateTime.now().add(const Duration(seconds: 60))
          : DateTime.now().add(const Duration(seconds: 60)),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      bookingNumber: booking['bookingNumber'] as String? ?? 'N/A',
      serviceName: service['name'] as String? ?? 'Home Service',
      basePriceRupees: basePrice,
      addressFormatted: addrStr,
      scheduledDate: booking['scheduledDate'] as String? ?? '',
      scheduledTimeSlot: booking['scheduledTimeSlot'] as String? ?? 'Immediate Dispatch',
      customerNotes: booking['customerNotes'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'bookingId': bookingId,
    'providerId': providerId,
    'status': status,
    'attemptNumber': attemptNumber,
    'expiresAt': expiresAt.toIso8601String(),
    'createdAt': createdAt.toIso8601String(),
  };
}
