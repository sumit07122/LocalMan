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
  final bool isMaterialAllowed;

  const ServicePricing({
    required this.pricingModel,
    required this.basePricePaisa,
    this.hourlyRatePaisa,
    this.inspectionFeePaisa,
    this.isMaterialAllowed = true,
  });

  factory ServicePricing.fromJson(Map<String, dynamic> json) {
    final rawModel = (json['pricingModel'] as String? ?? 'FIXED_PRICE').toUpperCase();
    PricingModelType model;
    switch (rawModel) {
      case 'HOURLY':
        model = PricingModelType.hourly;
        break;
      case 'INSPECTION_QUOTE':
        model = PricingModelType.inspectionQuote;
        break;
      case 'CUSTOM_QUOTE':
      case 'CUSTOMER_REQUEST_QUOTE':
        model = PricingModelType.customQuote;
        break;
      case 'FIXED_PRICE':
      case 'FIXED':
      default:
        model = PricingModelType.fixedPrice;
        break;
    }

    return ServicePricing(
      pricingModel: model,
      basePricePaisa: (json['basePricePaisa'] as num?)?.toInt() ?? 0,
      hourlyRatePaisa: (json['hourlyRatePaisa'] as num?)?.toInt(),
      inspectionFeePaisa: (json['inspectionFeePaisa'] as num?)?.toInt(),
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
}
