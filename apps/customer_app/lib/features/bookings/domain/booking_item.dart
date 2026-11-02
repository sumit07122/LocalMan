import 'package:flutter/material.dart';
import 'booking_snapshots.dart';

/// Public customer-facing representation of the assigned service professional.
/// Strictly sanitized: contains zero KYC documents, bank details, internal match scores, or sensitive PII.
class AssignedProviderPublic {
  final String id;
  final String businessName;
  final String? fullName;
  final String? avatarUrl;
  final double ratingAverage;
  final int ratingCount;
  final int? experienceYears;

  const AssignedProviderPublic({
    required this.id,
    required this.businessName,
    this.fullName,
    this.avatarUrl,
    this.ratingAverage = 0.0,
    this.ratingCount = 0,
    this.experienceYears,
  });

  String get displayName =>
      (fullName != null && fullName!.trim().isNotEmpty) ? fullName! : businessName;

  factory AssignedProviderPublic.fromJson(Map<String, dynamic> json) {
    return AssignedProviderPublic(
      id: json['id'] as String? ?? '',
      businessName: json['businessName'] as String? ?? 'LocalMan Professional',
      fullName: json['fullName'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      ratingAverage: (json['ratingAverage'] as num?)?.toDouble() ?? 0.0,
      ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
      experienceYears: (json['experienceYears'] as num?)?.toInt(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'businessName': businessName,
      'fullName': fullName,
      'avatarUrl': avatarUrl,
      'ratingAverage': ratingAverage,
      'ratingCount': ratingCount,
      'experienceYears': experienceYears,
    };
  }
}

/// Authoritative timeline entry derived directly from server BookingStatusHistory.
class BookingTimelineItem {
  final String id;
  final String fromState;
  final String toState;
  final String actorRole;
  final String? reason;
  final DateTime createdAt;

  const BookingTimelineItem({
    required this.id,
    required this.fromState,
    required this.toState,
    required this.actorRole,
    this.reason,
    required this.createdAt,
  });

  String get formattedToState {
    switch (toState) {
      case 'REQUESTED':
        return 'Booking Requested';
      case 'PROVIDER_ACCEPTED':
        return 'Professional Assigned';
      case 'PROVIDER_ON_THE_WAY':
        return 'Professional On The Way';
      case 'ARRIVED':
        return 'Professional Arrived';
      case 'JOB_STARTED':
        return 'Service Started';
      case 'JOB_COMPLETED':
        return 'Service Completed';
      case 'PAYMENT_PENDING':
        return 'Payment Pending';
      case 'PAYMENT_SETTLED':
        return 'Payment Settled';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return toState;
    }
  }

  factory BookingTimelineItem.fromJson(Map<String, dynamic> json) {
    return BookingTimelineItem(
      id: json['id'] as String? ?? '',
      fromState: json['fromState'] as String? ?? '',
      toState: json['toState'] as String? ?? '',
      actorRole: json['actorRole'] as String? ?? 'SYSTEM',
      reason: json['reason'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

/// Dispatch status metadata provided by backend matching engine.
class BookingDispatchStatus {
  final bool isSearching;
  final int attemptNumber;
  final bool hasActiveOffer;
  final DateTime? expiresAt;
  final String? assignedProviderId;

  const BookingDispatchStatus({
    required this.isSearching,
    required this.attemptNumber,
    required this.hasActiveOffer,
    this.expiresAt,
    this.assignedProviderId,
  });

  factory BookingDispatchStatus.fromJson(Map<String, dynamic> json) {
    return BookingDispatchStatus(
      isSearching: json['isSearching'] as bool? ?? false,
      attemptNumber: (json['attemptNumber'] as num?)?.toInt() ?? 0,
      hasActiveOffer: json['hasActiveOffer'] as bool? ?? false,
      expiresAt: json['expiresAt'] != null
          ? DateTime.tryParse(json['expiresAt'] as String)
          : null,
      assignedProviderId: json['assignedProviderId'] as String?,
    );
  }
}

class BookingItem {
  final String id;
  final String bookingNumber;
  final String customerId;
  final String? providerId;
  final String serviceId;
  final String addressId;
  final String currentStatus;
  final String pricingModel;
  final String scheduledDate;
  final String scheduledTimeSlot;
  final String? startOtp;
  final String? jobDescription;
  final String? customerNotes;
  final int baseAmountPaisa;
  final int taxAmountPaisa;
  final int totalAmountPaisa;
  final BookingAddressSnapshot? addressSnapshot;
  final BookingPricingSnapshot? pricingSnapshot;
  final BookingServiceSnapshot? serviceSnapshot;
  final List<String>? attachments;
  final AssignedProviderPublic? assignedProvider;
  final List<BookingTimelineItem> timeline;
  final BookingDispatchStatus? dispatchStatus;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  BookingItem({
    required this.id,
    this.bookingNumber = '',
    this.customerId = '',
    this.providerId,
    required this.serviceId,
    this.addressId = '',
    String currentStatus = 'REQUESTED',
    String? status,
    this.pricingModel = 'FIXED_PRICE',
    required dynamic scheduledDate,
    this.scheduledTimeSlot = '10:00 - 12:00',
    this.startOtp,
    this.jobDescription,
    this.customerNotes,
    this.baseAmountPaisa = 0,
    this.taxAmountPaisa = 0,
    this.totalAmountPaisa = 0,
    this.addressSnapshot,
    this.pricingSnapshot,
    this.serviceSnapshot,
    this.attachments,
    this.assignedProvider,
    this.timeline = const [],
    this.dispatchStatus,
    this.createdAt,
    this.updatedAt,
  })  : currentStatus = status ?? currentStatus,
        scheduledDate = scheduledDate is DateTime
            ? scheduledDate.toIso8601String()
            : scheduledDate.toString();

  // Backwards compatibility alias
  String get status => currentStatus;
  String get formattedStatus => statusLabel;
  Color get statusForegroundColor => statusColor;
  Color get statusBackgroundColor => statusColor.withOpacity(0.12);

  bool get isSearchingForProvider =>
      currentStatus == 'REQUESTED' && (dispatchStatus?.isSearching ?? true);

  bool get isProviderAssigned =>
      providerId != null || assignedProvider != null;

  String get displayTotal {
    if (pricingModel == 'CUSTOM_QUOTE' || totalAmountPaisa == 0) {
      return 'Quote Required';
    }
    if (pricingModel == 'INSPECTION_QUOTE') {
      return '₹${(totalAmountPaisa / 100).toStringAsFixed(2)} (Visiting Fee)';
    }
    return '₹${(totalAmountPaisa / 100).toStringAsFixed(2)}';
  }

  String get statusLabel {
    switch (currentStatus) {
      case 'REQUESTED':
        return 'Requested';
      case 'PROVIDER_ACCEPTED':
      case 'CONFIRMED':
        return 'Confirmed';
      case 'PROVIDER_ON_THE_WAY':
        return 'Pro On The Way';
      case 'ARRIVED':
        return 'Pro Arrived';
      case 'JOB_STARTED':
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'JOB_COMPLETED':
        return 'Completed';
      case 'PAYMENT_PENDING':
        return 'Payment Pending';
      case 'PAYMENT_SETTLED':
        return 'Paid';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return currentStatus;
    }
  }

  Color get statusColor {
    switch (currentStatus) {
      case 'REQUESTED':
        return const Color(0xFFD97706); // Amber
      case 'CONFIRMED':
      case 'PROVIDER_ACCEPTED':
        return const Color(0xFF2563EB); // Blue
      case 'JOB_STARTED':
      case 'IN_PROGRESS':
      case 'PROVIDER_ON_THE_WAY':
      case 'ARRIVED':
        return const Color(0xFF7C3AED); // Purple
      case 'JOB_COMPLETED':
      case 'PAYMENT_SETTLED':
        return const Color(0xFF16A34A); // Green
      case 'CANCELLED':
        return const Color(0xFFDC2626); // Red
      default:
        return const Color(0xFF4B5563); // Grey
    }
  }

  factory BookingItem.fromJson(Map<String, dynamic> json) {
    AssignedProviderPublic? assignedProvider;
    if (json['assignedProvider'] != null &&
        json['assignedProvider'] is Map<String, dynamic>) {
      assignedProvider = AssignedProviderPublic.fromJson(
          json['assignedProvider'] as Map<String, dynamic>);
    }

    final timelineList = <BookingTimelineItem>[];
    if (json['timeline'] is List<dynamic>) {
      for (final item in json['timeline'] as List<dynamic>) {
        if (item is Map<String, dynamic>) {
          timelineList.add(BookingTimelineItem.fromJson(item));
        }
      }
    }

    BookingDispatchStatus? dispatchStatus;
    if (json['dispatchStatus'] != null &&
        json['dispatchStatus'] is Map<String, dynamic>) {
      dispatchStatus = BookingDispatchStatus.fromJson(
          json['dispatchStatus'] as Map<String, dynamic>);
    }

    return BookingItem(
      id: json['id'] as String? ?? '',
      bookingNumber: json['bookingNumber'] as String? ?? '',
      customerId: json['customerId'] as String? ?? '',
      providerId: json['providerId'] as String?,
      serviceId: json['serviceId'] as String? ?? '',
      addressId: json['addressId'] as String? ?? '',
      currentStatus: (json['currentStatus'] ?? json['status']) as String? ?? 'REQUESTED',
      pricingModel: json['pricingModel'] as String? ??
          (json['pricingSnapshot'] is Map
              ? (json['pricingSnapshot'] as Map)['pricingModel'] as String?
              : null) ??
          'FIXED_PRICE',
      scheduledDate: json['scheduledDate'] as String? ?? '',
      scheduledTimeSlot: json['scheduledTimeSlot'] as String? ?? '',
      startOtp: json['startOtp'] as String?,
      jobDescription: json['jobDescription'] as String?,
      customerNotes: json['customerNotes'] as String?,
      baseAmountPaisa: (json['baseAmountPaisa'] as num?)?.toInt() ?? 0,
      taxAmountPaisa: (json['taxAmountPaisa'] as num?)?.toInt() ?? 0,
      totalAmountPaisa: (json['totalAmountPaisa'] as num?)?.toInt() ?? 0,
      addressSnapshot: json['addressSnapshot'] != null
          ? BookingAddressSnapshot.fromJson(
              json['addressSnapshot'] as Map<String, dynamic>)
          : null,
      pricingSnapshot: json['pricingSnapshot'] != null
          ? BookingPricingSnapshot.fromJson(
              json['pricingSnapshot'] as Map<String, dynamic>)
          : null,
      serviceSnapshot: json['serviceSnapshot'] != null
          ? BookingServiceSnapshot.fromJson(
              json['serviceSnapshot'] as Map<String, dynamic>)
          : null,
      attachments: (json['attachments'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      assignedProvider: assignedProvider,
      timeline: timelineList,
      dispatchStatus: dispatchStatus,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'] as String)
          : null,
    );
  }
}

class BookingListResult {
  final List<BookingItem> items;
  final int total;
  final int page;
  final int limit;
  final bool hasMore;

  const BookingListResult({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    this.hasMore = false,
  });

  factory BookingListResult.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return BookingListResult(
      items: rawItems.map((e) => BookingItem.fromJson(e as Map<String, dynamic>)).toList(),
      total: (json['total'] as num?)?.toInt() ?? rawItems.length,
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? rawItems.length,
      hasMore: json['hasMore'] as bool? ?? false,
    );
  }
}
