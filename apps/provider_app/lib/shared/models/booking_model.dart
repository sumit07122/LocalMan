class BookingMaterial {
  final String id;
  final String bookingId;
  final String itemName;
  final int quantity;
  final int unitPricePaisa;
  final int totalPricePaisa;
  final bool isCustomerApproved;

  const BookingMaterial({
    required this.id,
    required this.bookingId,
    required this.itemName,
    this.quantity = 1,
    required this.unitPricePaisa,
    required this.totalPricePaisa,
    this.isCustomerApproved = false,
  });

  double get totalPriceRupees => totalPricePaisa / 100.0;

  factory BookingMaterial.fromJson(Map<String, dynamic> json) {
    return BookingMaterial(
      id: json['id'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? '',
      itemName: json['itemName'] as String? ?? '',
      quantity: json['quantity'] as int? ?? 1,
      unitPricePaisa: json['unitPricePaisa'] as int? ?? 0,
      totalPricePaisa: (json['totalPricePaisa'] as int?) ??
          ((json['unitPricePaisa'] as int? ?? 0) * (json['quantity'] as int? ?? 1)),
      isCustomerApproved: json['isCustomerApproved'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'bookingId': bookingId,
    'itemName': itemName,
    'quantity': quantity,
    'unitPricePaisa': unitPricePaisa,
    'totalPricePaisa': totalPricePaisa,
    'isCustomerApproved': isCustomerApproved,
  };
}

class BookingQuote {
  final String id;
  final String bookingId;
  final int quotedAmountPaisa;
  final String? notes;
  final String status;

  const BookingQuote({
    required this.id,
    required this.bookingId,
    required this.quotedAmountPaisa,
    this.notes,
    this.status = 'PENDING',
  });

  double get quotedAmountRupees => quotedAmountPaisa / 100.0;

  factory BookingQuote.fromJson(Map<String, dynamic> json) {
    return BookingQuote(
      id: json['id'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? '',
      quotedAmountPaisa: json['quotedAmountPaisa'] as int? ?? 0,
      notes: json['notes'] as String?,
      status: json['status'] as String? ?? 'PENDING',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'bookingId': bookingId,
    'quotedAmountPaisa': quotedAmountPaisa,
    'notes': notes,
    'status': status,
  };
}

class Booking {
  final String id;
  final String bookingNumber;
  final String currentStatus;
  final String pricingModel;
  final int baseAmountPaisa;
  final int totalAmountPaisa;
  final int platformFeePaisa;
  final String? startOtp;
  final String? scheduledTimeSlot;
  final DateTime? scheduledDate;
  final String serviceName;
  final String customerName;
  final String customerPhone;
  final String addressFormatted;
  final List<BookingMaterial> materials;

  const Booking({
    required this.id,
    required this.bookingNumber,
    required this.currentStatus,
    this.pricingModel = 'FIXED_PRICE',
    this.baseAmountPaisa = 0,
    this.totalAmountPaisa = 0,
    this.platformFeePaisa = 0,
    this.startOtp,
    this.scheduledTimeSlot,
    this.scheduledDate,
    required this.serviceName,
    required this.customerName,
    required this.customerPhone,
    required this.addressFormatted,
    this.materials = const [],
  });

  double get totalAmountRupees => totalAmountPaisa / 100.0;
  double get baseAmountRupees => baseAmountPaisa / 100.0;
  double get platformFeeRupees => platformFeePaisa / 100.0;

  // Authoritative provider payout estimate (Labor minus platform fee + approved materials)
  double get netPayoutRupees {
    final netLaborPaisa = (baseAmountPaisa - platformFeePaisa);
    final approvedMaterialsPaisa = materials
        .where((m) => m.isCustomerApproved)
        .fold(0, (sum, m) => sum + m.totalPricePaisa);
    return (netLaborPaisa + approvedMaterialsPaisa) / 100.0;
  }

  factory Booking.fromJson(Map<String, dynamic> rawJson) {
    final json = (rawJson['data'] is Map<String, dynamic>)
        ? rawJson['data'] as Map<String, dynamic>
        : rawJson;
    final serviceMap = json['service'] as Map<String, dynamic>? ?? {};
    final customerMap = json['customer'] as Map<String, dynamic>? ?? {};
    final addressMap = json['address'] as Map<String, dynamic>? ?? {};
    final materialsList = json['materials'] as List<dynamic>? ?? [];

    String formattedAddr = '';
    if (addressMap.isNotEmpty) {
      final line1 = addressMap['addressLine1'] ?? addressMap['line1'] ?? '';
      final line2 = addressMap['addressLine2'] ?? addressMap['line2'] ?? '';
      final city = addressMap['city'] ?? '';
      final postal = addressMap['postalCode'] ?? addressMap['postal_code'] ?? '';
      formattedAddr = [line1, line2, city, postal]
          .where((s) => s != null && s.toString().trim().isNotEmpty)
          .join(', ');
    }

    return Booking(
      id: json['id'] as String? ?? '',
      bookingNumber: json['bookingNumber'] as String? ?? '',
      currentStatus: json['currentStatus'] as String? ?? 'REQUESTED',
      pricingModel: json['pricingModel'] as String? ?? 'FIXED_PRICE',
      baseAmountPaisa: json['baseAmountPaisa'] as int? ?? 0,
      totalAmountPaisa: json['totalAmountPaisa'] as int? ?? 0,
      platformFeePaisa: json['platformFeePaisa'] as int? ?? 0,
      startOtp: json['startOtp'] as String?,
      scheduledTimeSlot: json['scheduledTimeSlot'] as String?,
      scheduledDate: json['scheduledDate'] != null
          ? DateTime.tryParse(json['scheduledDate'] as String)
          : null,
      serviceName: serviceMap['name'] as String? ?? 'Service',
      customerName: customerMap['fullName'] as String? ?? 'Customer',
      customerPhone: customerMap['phoneNumber'] as String? ?? '',
      addressFormatted: formattedAddr.isNotEmpty ? formattedAddr : 'Customer Address',
      materials: materialsList
          .map((m) => BookingMaterial.fromJson(m as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'bookingNumber': bookingNumber,
    'currentStatus': currentStatus,
    'pricingModel': pricingModel,
    'baseAmountPaisa': baseAmountPaisa,
    'totalAmountPaisa': totalAmountPaisa,
    'platformFeePaisa': platformFeePaisa,
    'scheduledTimeSlot': scheduledTimeSlot,
    'scheduledDate': scheduledDate?.toIso8601String(),
    'serviceName': serviceName,
    'customerName': customerName,
    'customerPhone': customerPhone,
    'addressFormatted': addressFormatted,
    'materials': materials.map((m) => m.toJson()).toList(),
  };
}
