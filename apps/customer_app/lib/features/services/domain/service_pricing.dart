enum PricingModelType {
  hourly,
  fixedPrice,
  inspectionQuote,
  customQuote,
}

class ServicePricing {
  final PricingModelType pricingModelType;
  final int basePricePaisa;
  final int? hourlyRatePaisa;
  final int? inspectionFeePaisa;
  final int? minimumHours;
  final bool isMaterialAllowed;

  static PricingModelType _parseModel(dynamic model) {
    if (model is PricingModelType) return model;
    final str = (model?.toString() ?? 'FIXED_PRICE').toUpperCase();
    switch (str) {
      case 'HOURLY':
        return PricingModelType.hourly;
      case 'INSPECTION_QUOTE':
        return PricingModelType.inspectionQuote;
      case 'CUSTOM_QUOTE':
      case 'CUSTOMER_REQUEST_QUOTE':
        return PricingModelType.customQuote;
      case 'FIXED_PRICE':
      case 'FIXED':
      default:
        return PricingModelType.fixedPrice;
    }
  }

  ServicePricing({
    required dynamic pricingModel,
    this.basePricePaisa = 0,
    this.hourlyRatePaisa,
    this.inspectionFeePaisa,
    this.minimumHours,
    this.isMaterialAllowed = true,
  }) : pricingModelType = _parseModel(pricingModel);

  factory ServicePricing.fromJson(Map<String, dynamic> json) {
    final raw = json['pricing'] is Map ? (json['pricing'] as Map<String, dynamic>) : json;
    return ServicePricing(
      pricingModel: raw['pricingModel'],
      basePricePaisa: (raw['basePricePaisa'] as num?)?.toInt() ?? 0,
      hourlyRatePaisa: (raw['hourlyRatePaisa'] as num?)?.toInt(),
      inspectionFeePaisa: (raw['inspectionFeePaisa'] as num?)?.toInt(),
      minimumHours: (raw['minimumHours'] as num?)?.toInt(),
      isMaterialAllowed: raw['isMaterialAllowed'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'pricingModel': pricingModelKey,
    'basePricePaisa': basePricePaisa,
    if (hourlyRatePaisa != null) 'hourlyRatePaisa': hourlyRatePaisa,
    if (inspectionFeePaisa != null) 'inspectionFeePaisa': inspectionFeePaisa,
    'isMaterialAllowed': isMaterialAllowed,
  };

  String get pricingModel => pricingModelKey;

  String get pricingModelKey {
    switch (pricingModelType) {
      case PricingModelType.hourly:
        return 'HOURLY';
      case PricingModelType.inspectionQuote:
        return 'INSPECTION_QUOTE';
      case PricingModelType.customQuote:
        return 'CUSTOM_QUOTE';
      case PricingModelType.fixedPrice:
        return 'FIXED_PRICE';
    }
  }

  String get pricingModelBadge {
    switch (pricingModelType) {
      case PricingModelType.fixedPrice:
        return 'Fixed Price';
      case PricingModelType.hourly:
        return 'Charged by Time';
      case PricingModelType.inspectionQuote:
        return 'Inspection Required';
      case PricingModelType.customQuote:
        return 'Quotes on Request';
    }
  }

  /// Formatted rupee presentation for catalog cards and headers
  String get formattedPrice {
    switch (pricingModelType) {
      case PricingModelType.fixedPrice:
        final rupees = (basePricePaisa / 100).round();
        return '₹$rupees';
      case PricingModelType.hourly:
        final base = (basePricePaisa / 100).round();
        final hourly = hourlyRatePaisa != null ? (hourlyRatePaisa! / 100).round() : null;
        if (hourly != null && base > 0 && hourly != base) {
          return '₹$base for 1st hr (₹$hourly/hr thereafter)';
        }
        final rate = hourly ?? base;
        return '₹$rate/hr';
      case PricingModelType.inspectionQuote:
        final fee = inspectionFeePaisa != null
            ? (inspectionFeePaisa! / 100).round()
            : (basePricePaisa / 100).round();
        if (fee > 0) {
          return '₹$fee inspection visit fee';
        }
        return 'Free inspection & quote';
      case PricingModelType.customQuote:
        return 'Receive provider quotes';
    }
  }

  /// Detailed customer explanation of how pricing works for this service
  String get customerExplanation {
    switch (pricingModelType) {
      case PricingModelType.fixedPrice:
        return 'The job price is fixed and confirmed upfront. Any replacement materials or parts requested will require your prior approval.';
      case PricingModelType.hourly:
        return 'You will be billed for actual service duration. The first hour is fixed at ₹${(basePricePaisa / 100).round()}, and subsequent hours are billed transparently.';
      case PricingModelType.inspectionQuote:
        return 'A certified pro visits to inspect the problem and provide an accurate quote before starting work. The inspection fee is adjusted against final job charges where applicable.';
      case PricingModelType.customQuote:
        return 'Describe your requirement and verified local service partners will send competitive, itemized quotations for your review.';
    }
  }

  bool get isFixedPrice => pricingModelType == PricingModelType.fixedPrice;
  bool get isHourly => pricingModelType == PricingModelType.hourly;
  bool get isInspectionQuote => pricingModelType == PricingModelType.inspectionQuote;
  bool get isCustomQuote => pricingModelType == PricingModelType.customQuote;

  String get displayPrice {
    switch (pricingModelType) {
      case PricingModelType.fixedPrice:
        return '₹${(basePricePaisa / 100).toStringAsFixed(2)}';
      case PricingModelType.hourly:
        final rate = hourlyRatePaisa ?? basePricePaisa;
        return '₹${(rate / 100).toStringAsFixed(2)}/hr';
      case PricingModelType.inspectionQuote:
        final fee = inspectionFeePaisa ?? basePricePaisa;
        return '₹${(fee / 100).toStringAsFixed(2)} Inspection';
      case PricingModelType.customQuote:
        return 'Quote Required';
    }
  }

  String get explanation => customerExplanation;
}
