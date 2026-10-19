/// Production-grade customer payment models for LocalMan Phase 3F.
/// Encapsulates checkout session, signature verification payloads, and
/// server-authoritative payment summary/receipt.

class PaymentCheckoutResponse {
  final String paymentId;
  final String bookingId;
  final int amountPaisa;
  final String currency;
  final String paymentGateway;
  final String? gatewayOrderId;
  final String? clientSecret;
  final String paymentStatus;
  final String idempotencyKey;

  const PaymentCheckoutResponse({
    required this.paymentId,
    required this.bookingId,
    required this.amountPaisa,
    this.currency = 'INR',
    required this.paymentGateway,
    this.gatewayOrderId,
    this.clientSecret,
    required this.paymentStatus,
    required this.idempotencyKey,
  });

  factory PaymentCheckoutResponse.fromJson(Map<String, dynamic> json) {
    return PaymentCheckoutResponse(
      paymentId: json['paymentId'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? '',
      amountPaisa: (json['amountPaisa'] as num?)?.toInt() ?? 0,
      currency: json['currency'] as String? ?? 'INR',
      paymentGateway: json['paymentGateway'] as String? ?? 'MOCK',
      gatewayOrderId: json['gatewayOrderId'] as String?,
      clientSecret: json['clientSecret'] as String?,
      paymentStatus: json['paymentStatus'] as String? ?? 'CREATED',
      idempotencyKey: json['idempotencyKey'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'paymentId': paymentId,
      'bookingId': bookingId,
      'amountPaisa': amountPaisa,
      'currency': currency,
      'paymentGateway': paymentGateway,
      if (gatewayOrderId != null) 'gatewayOrderId': gatewayOrderId,
      if (clientSecret != null) 'clientSecret': clientSecret,
      'paymentStatus': paymentStatus,
      'idempotencyKey': idempotencyKey,
    };
  }
}

class PaymentSummaryItem {
  final String description;
  final int amountPaisa;
  final String type; // BASE_SERVICE | MATERIAL | TAX | PLATFORM_FEE

  const PaymentSummaryItem({
    required this.description,
    required this.amountPaisa,
    required this.type,
  });

  factory PaymentSummaryItem.fromJson(Map<String, dynamic> json) {
    return PaymentSummaryItem(
      description: json['description'] as String? ?? '',
      amountPaisa: (json['amountPaisa'] as num?)?.toInt() ?? 0,
      type: json['type'] as String? ?? 'BASE_SERVICE',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'description': description,
      'amountPaisa': amountPaisa,
      'type': type,
    };
  }
}

class PaymentSummary {
  final String paymentId;
  final String bookingId;
  final String bookingNumber;
  final String serviceName;
  final String? providerBusinessName;
  final int totalAmountPaisa;
  final int baseAmountPaisa;
  final int materialsAmountPaisa;
  final int platformFeePaisa;
  final int taxAmountPaisa;
  final String currency;
  final String paymentStatus;
  final String paymentGateway;
  final String? gatewayPaymentId;
  final DateTime? paidAt;
  final List<PaymentSummaryItem> items;

  const PaymentSummary({
    required this.paymentId,
    required this.bookingId,
    required this.bookingNumber,
    required this.serviceName,
    this.providerBusinessName,
    required this.totalAmountPaisa,
    required this.baseAmountPaisa,
    this.materialsAmountPaisa = 0,
    this.platformFeePaisa = 0,
    required this.taxAmountPaisa,
    this.currency = 'INR',
    required this.paymentStatus,
    this.paymentGateway = 'MOCK',
    this.gatewayPaymentId,
    this.paidAt,
    this.items = const [],
  });

  factory PaymentSummary.fromJson(Map<String, dynamic> json) {
    final rawItems = (json['items'] as List<dynamic>?) ?? [];
    return PaymentSummary(
      paymentId: json['paymentId'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? '',
      bookingNumber: json['bookingNumber'] as String? ?? '',
      serviceName: json['serviceName'] as String? ?? 'Service',
      providerBusinessName: json['providerBusinessName'] as String?,
      totalAmountPaisa: (json['totalAmountPaisa'] as num?)?.toInt() ?? 0,
      baseAmountPaisa: (json['baseAmountPaisa'] as num?)?.toInt() ?? 0,
      materialsAmountPaisa: (json['materialsAmountPaisa'] as num?)?.toInt() ?? 0,
      platformFeePaisa: (json['platformFeePaisa'] as num?)?.toInt() ?? 0,
      taxAmountPaisa: (json['taxAmountPaisa'] as num?)?.toInt() ?? 0,
      currency: json['currency'] as String? ?? 'INR',
      paymentStatus: json['paymentStatus'] as String? ?? 'SUCCESS',
      paymentGateway: json['paymentGateway'] as String? ?? 'MOCK',
      gatewayPaymentId: json['gatewayPaymentId'] as String?,
      paidAt: json['paidAt'] != null ? DateTime.tryParse(json['paidAt'] as String) : null,
      items: rawItems
          .map((e) => PaymentSummaryItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'paymentId': paymentId,
      'bookingId': bookingId,
      'bookingNumber': bookingNumber,
      'serviceName': serviceName,
      if (providerBusinessName != null) 'providerBusinessName': providerBusinessName,
      'totalAmountPaisa': totalAmountPaisa,
      'baseAmountPaisa': baseAmountPaisa,
      'materialsAmountPaisa': materialsAmountPaisa,
      'platformFeePaisa': platformFeePaisa,
      'taxAmountPaisa': taxAmountPaisa,
      'currency': currency,
      'paymentStatus': paymentStatus,
      'paymentGateway': paymentGateway,
      if (gatewayPaymentId != null) 'gatewayPaymentId': gatewayPaymentId,
      if (paidAt != null) 'paidAt': paidAt!.toIso8601String(),
      'items': items.map((e) => e.toJson()).toList(),
    };
  }
}
