enum PricingModelType {
  hourly,
  fixedPrice,
  inspectionQuote,
  customQuote,
}

class ServicePricing {
  final PricingModelType pricingModel;
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
  }) : pricingModel = _parseModel(pricingModel);

  factory ServicePricing.fromJson(Map<String, dynamic> json) {
    return ServicePricing(
      pricingModel: json['pricingModel'],
      basePricePaisa: (json['basePricePaisa'] as num?)?.toInt() ?? 0,
      hourlyRatePaisa: (json['hourlyRatePaisa'] as num?)?.toInt(),
      inspectionFeePaisa: (json['inspectionFeePaisa'] as num?)?.toInt(),
      minimumHours: (json['minimumHours'] as num?)?.toInt(),
      isMaterialAllowed: json['isMaterialAllowed'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'pricingModel': pricingModelKey,
    'basePricePaisa': basePricePaisa,
    if (hourlyRatePaisa != null) 'hourlyRatePaisa': hourlyRatePaisa,
    if (inspectionFeePaisa != null) 'inspectionFeePaisa': inspectionFeePaisa,
    'isMaterialAllowed': isMaterialAllowed,
  };

  String get pricingModelKey {
    switch (pricingModel) {
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
    switch (pricingModel) {
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
    switch (pricingModel) {
      case PricingModelType.fixedPrice:
        final rupees = (basePricePaisa / 100).round();
        return '₹$rupees';
      case PricingModelType.hourly:
        final base = (basePricePaisa / 100).round();
        final hourly = hourlyRatePaisa != null ? (hourlyRatePaisa! / 100).round() : null;
        if (hourly != null && hourly != base) {
          return '₹$base for 1st hr (₹$hourly/hr thereafter)';
        }
        return '₹$base/hr';
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
    switch (pricingModel) {
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

  bool get isFixedPrice => pricingModel == PricingModelType.fixedPrice;
  bool get isHourly => pricingModel == PricingModelType.hourly;
  bool get isInspectionQuote => pricingModel == PricingModelType.inspectionQuote;
  bool get isCustomQuote => pricingModel == PricingModelType.customQuote;
  String get displayPrice {
    switch (pricingModel) {
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
