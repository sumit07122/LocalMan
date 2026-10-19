/// Production-grade customer quote models for LocalMan Phase 3H.
/// Encapsulates quote proposals, itemized breakdowns, provider summaries,
/// and acceptance/rejection actions.
///
/// Adheres strictly to security and privacy guidelines:
/// - Provider commission rates and banking details are NEVER modeled or exposed.
/// - Integer paisa accounting is strictly maintained.

class QuoteItem {
  final String title;
  final String? description;
  final int quantity;
  final int unitPricePaisa;
  final int totalPaisa;
  final String type; // 'LABOR' | 'MATERIAL' | 'EQUIPMENT' | 'OTHER'

  const QuoteItem({
    required this.title,
    this.description,
    this.quantity = 1,
    required this.unitPricePaisa,
    required this.totalPaisa,
    this.type = 'LABOR',
  });

  factory QuoteItem.fromJson(Map<String, dynamic> json) {
    return QuoteItem(
      title: json['title'] as String? ?? 'Service Item',
      description: json['description'] as String?,
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      unitPricePaisa: (json['unitPricePaisa'] as num?)?.toInt() ?? 0,
      totalPaisa: (json['totalPaisa'] as num?)?.toInt() ?? 0,
      type: json['type'] as String? ?? 'LABOR',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      if (description != null) 'description': description,
      'quantity': quantity,
      'unitPricePaisa': unitPricePaisa,
      'totalPaisa': totalPaisa,
      'type': type,
    };
  }

  double get totalRupees => totalPaisa / 100.0;
  String get formattedTotal => '₹${totalRupees.toStringAsFixed(2)}';
}

class QuoteProviderSummary {
  final String id;
  final String businessName;
  final String name;
  final String? avatarUrl;
  final double rating;
  final int completedBookingsCount;

  const QuoteProviderSummary({
    required this.id,
    required this.businessName,
    required this.name,
    this.avatarUrl,
    this.rating = 5.0,
    this.completedBookingsCount = 0,
  });

  factory QuoteProviderSummary.fromJson(Map<String, dynamic> json) {
    return QuoteProviderSummary(
      id: json['id'] as String? ?? '',
      businessName: json['businessName'] as String? ?? '',
      name: json['name'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      rating: (json['rating'] as num?)?.toDouble() ?? 5.0,
      completedBookingsCount: (json['completedBookingsCount'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'businessName': businessName,
      'name': name,
      if (avatarUrl != null) 'avatarUrl': avatarUrl,
      'rating': rating,
      'completedBookingsCount': completedBookingsCount,
    };
  }
}

class CustomerQuote {
  final String id;
  final String bookingId;
  final String providerId;
  final String status; // 'REQUESTED' | 'SUBMITTED' | 'UPDATED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN' | 'SUPERSEDED'
  final int totalAmountPaisa;
  final int subtotalPaisa;
  final int materialsPaisa;
  final int taxPaisa;
  final int? estimatedDurationMinutes;
  final String? breakdownNotes;
  final DateTime? validUntil;
  final int version;
  final bool isExpired;
  final List<QuoteItem> items;
  final QuoteProviderSummary? provider;
  final DateTime createdAt;
  final DateTime? acceptedAt;
  final DateTime? rejectedAt;

  const CustomerQuote({
    required this.id,
    required this.bookingId,
    required this.providerId,
    required this.status,
    required this.totalAmountPaisa,
    required this.subtotalPaisa,
    required this.materialsPaisa,
    required this.taxPaisa,
    this.estimatedDurationMinutes,
    this.breakdownNotes,
    this.validUntil,
    this.version = 1,
    this.isExpired = false,
    this.items = const [],
    this.provider,
    required this.createdAt,
    this.acceptedAt,
    this.rejectedAt,
  });

  factory CustomerQuote.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return CustomerQuote(
      id: json['id'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? '',
      providerId: json['providerId'] as String? ?? '',
      status: json['status'] as String? ?? 'SUBMITTED',
      totalAmountPaisa: (json['totalAmountPaisa'] as num?)?.toInt() ?? (json['quoteAmountPaisa'] as num?)?.toInt() ?? 0,
      subtotalPaisa: (json['subtotalPaisa'] as num?)?.toInt() ?? 0,
      materialsPaisa: (json['materialsPaisa'] as num?)?.toInt() ?? 0,
      taxPaisa: (json['taxPaisa'] as num?)?.toInt() ?? 0,
      estimatedDurationMinutes: (json['estimatedDurationMinutes'] as num?)?.toInt(),
      breakdownNotes: json['breakdownNotes'] as String?,
      validUntil: json['validUntil'] != null ? DateTime.tryParse(json['validUntil'] as String) : null,
      version: (json['version'] as num?)?.toInt() ?? 1,
      isExpired: json['isExpired'] as bool? ?? false,
      items: rawItems.map((item) => QuoteItem.fromJson(item as Map<String, dynamic>)).toList(),
      provider: json['provider'] != null
          ? QuoteProviderSummary.fromJson(json['provider'] as Map<String, dynamic>)
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      acceptedAt: json['acceptedAt'] != null ? DateTime.tryParse(json['acceptedAt'] as String) : null,
      rejectedAt: json['rejectedAt'] != null ? DateTime.tryParse(json['rejectedAt'] as String) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'bookingId': bookingId,
      'providerId': providerId,
      'status': status,
      'totalAmountPaisa': totalAmountPaisa,
      'subtotalPaisa': subtotalPaisa,
      'materialsPaisa': materialsPaisa,
      'taxPaisa': taxPaisa,
      if (estimatedDurationMinutes != null) 'estimatedDurationMinutes': estimatedDurationMinutes,
      if (breakdownNotes != null) 'breakdownNotes': breakdownNotes,
      if (validUntil != null) 'validUntil': validUntil!.toIso8601String(),
      'version': version,
      'isExpired': isExpired,
      'items': items.map((i) => i.toJson()).toList(),
      if (provider != null) 'provider': provider!.toJson(),
      'createdAt': createdAt.toIso8601String(),
      if (acceptedAt != null) 'acceptedAt': acceptedAt!.toIso8601String(),
      if (rejectedAt != null) 'rejectedAt': rejectedAt!.toIso8601String(),
    };
  }

  double get totalRupees => totalAmountPaisa / 100.0;
  String get formattedTotal => '₹${totalRupees.toStringAsFixed(2)}';

  double get subtotalRupees => subtotalPaisa / 100.0;
  String get formattedSubtotal => '₹${subtotalRupees.toStringAsFixed(2)}';

  double get materialsRupees => materialsPaisa / 100.0;
  String get formattedMaterials => '₹${materialsRupees.toStringAsFixed(2)}';

  double get taxRupees => taxPaisa / 100.0;
  String get formattedTax => '₹${taxRupees.toStringAsFixed(2)}';

  String get formattedDuration {
    if (estimatedDurationMinutes == null || estimatedDurationMinutes == 0) return 'Not specified';
    final hours = estimatedDurationMinutes! ~/ 60;
    final mins = estimatedDurationMinutes! % 60;
    if (hours > 0 && mins > 0) return '${hours}h ${mins}m';
    if (hours > 0) return '${hours}h';
    return '${mins}m';
  }

  bool get canBeAccepted {
    if (isExpired) return false;
    if (validUntil != null && validUntil!.isBefore(DateTime.now())) return false;
    return status == 'SUBMITTED' || status == 'UPDATED';
  }

  bool get isAccepted => status == 'ACCEPTED';
  bool get isRejected => status == 'REJECTED';
}

class CustomerQuoteListResponse {
  final List<CustomerQuote> quotes;
  final String bookingId;
  final String pricingModel;
  final String? acceptedQuoteId;

  const CustomerQuoteListResponse({
    required this.quotes,
    required this.bookingId,
    required this.pricingModel,
    this.acceptedQuoteId,
  });

  factory CustomerQuoteListResponse.fromJson(Map<String, dynamic> json) {
    final rawQuotes = json['quotes'] as List<dynamic>? ?? [];
    return CustomerQuoteListResponse(
      quotes: rawQuotes.map((q) => CustomerQuote.fromJson(q as Map<String, dynamic>)).toList(),
      bookingId: json['bookingId'] as String? ?? '',
      pricingModel: json['pricingModel'] as String? ?? 'CUSTOM_QUOTE',
      acceptedQuoteId: json['acceptedQuoteId'] as String?,
    );
  }

  CustomerQuote? get acceptedQuote {
    if (acceptedQuoteId == null) return null;
    return quotes.firstWhere(
      (q) => q.id == acceptedQuoteId,
      orElse: () => quotes.firstWhere(
        (q) => q.isAccepted,
        orElse: () => CustomerQuote(
          id: acceptedQuoteId!,
          bookingId: bookingId,
          providerId: '',
          status: 'ACCEPTED',
          totalAmountPaisa: 0,
          subtotalPaisa: 0,
          materialsPaisa: 0,
          taxPaisa: 0,
          createdAt: DateTime.now(),
        ),
      ),
    );
  }

  List<CustomerQuote> get activeQuotes => quotes.where((q) => q.canBeAccepted).toList();
}
