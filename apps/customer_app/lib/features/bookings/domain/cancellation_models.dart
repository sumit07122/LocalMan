class CancelBookingRequest {
  final String reason;
  final String? notes;
  final String? idempotencyKey;

  const CancelBookingRequest({
    required this.reason,
    this.notes,
    this.idempotencyKey,
  });

  Map<String, dynamic> toJson() => {
        'reason': reason,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
        if (idempotencyKey != null && idempotencyKey!.isNotEmpty)
          'idempotencyKey': idempotencyKey,
      };
}

class CancellationResult {
  final String bookingId;
  final String previousStatus;
  final String newStatus;
  final int cancellationFeePaisa;
  final int refundAmountPaisa;
  final String refundStatus;
  final String policyExplanation;
  final bool isRedispatched;

  const CancellationResult({
    required this.bookingId,
    required this.previousStatus,
    required this.newStatus,
    required this.cancellationFeePaisa,
    required this.refundAmountPaisa,
    required this.refundStatus,
    required this.policyExplanation,
    required this.isRedispatched,
  });

  factory CancellationResult.fromJson(Map<String, dynamic> json) {
    return CancellationResult(
      bookingId: json['bookingId'] as String? ?? '',
      previousStatus: json['previousStatus'] as String? ?? '',
      newStatus: json['newStatus'] as String? ?? '',
      cancellationFeePaisa: (json['cancellationFeePaisa'] as num?)?.toInt() ?? 0,
      refundAmountPaisa: (json['refundAmountPaisa'] as num?)?.toInt() ?? 0,
      refundStatus: json['refundStatus'] as String? ?? 'NOT_REQUIRED',
      policyExplanation: json['policyExplanation'] as String? ?? '',
      isRedispatched: json['isRedispatched'] as bool? ?? false,
    );
  }
}

class NoShowRequest {
  final String reason;
  final int? waitingMinutes;
  final String? notes;

  const NoShowRequest({
    required this.reason,
    this.waitingMinutes,
    this.notes,
  });

  Map<String, dynamic> toJson() => {
        'reason': reason,
        if (waitingMinutes != null) 'waitingMinutes': waitingMinutes,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}

class NoShowResult {
  final String bookingId;
  final String previousStatus;
  final String newStatus;
  final int feePaisa;
  final int refundAmountPaisa;
  final String refundStatus;
  final String policyExplanation;

  const NoShowResult({
    required this.bookingId,
    required this.previousStatus,
    required this.newStatus,
    required this.feePaisa,
    required this.refundAmountPaisa,
    required this.refundStatus,
    required this.policyExplanation,
  });

  factory NoShowResult.fromJson(Map<String, dynamic> json) {
    return NoShowResult(
      bookingId: json['bookingId'] as String? ?? '',
      previousStatus: json['previousStatus'] as String? ?? '',
      newStatus: json['newStatus'] as String? ?? '',
      feePaisa: (json['feePaisa'] as num?)?.toInt() ?? 0,
      refundAmountPaisa: (json['refundAmountPaisa'] as num?)?.toInt() ?? 0,
      refundStatus: json['refundStatus'] as String? ?? 'NOT_REQUIRED',
      policyExplanation: json['policyExplanation'] as String? ?? '',
    );
  }
}

class CreateDisputeRequest {
  final String reason;
  final String description;
  final int? disputedAmountPaisa;

  const CreateDisputeRequest({
    required this.reason,
    required this.description,
    this.disputedAmountPaisa,
  });

  Map<String, dynamic> toJson() => {
        'reason': reason,
        'description': description,
        if (disputedAmountPaisa != null)
          'disputedAmountPaisa': disputedAmountPaisa,
      };
}

class DisputeItem {
  final String id;
  final String ticketNumber;
  final String bookingId;
  final String raisedBy;
  final String actorRole;
  final String category;
  final String description;
  final String priority;
  final String status;
  final String? assignedTo;
  final String? resolutionNotes;
  final DateTime? resolvedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const DisputeItem({
    required this.id,
    required this.ticketNumber,
    required this.bookingId,
    required this.raisedBy,
    required this.actorRole,
    required this.category,
    required this.description,
    required this.priority,
    required this.status,
    this.assignedTo,
    this.resolutionNotes,
    this.resolvedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory DisputeItem.fromJson(Map<String, dynamic> json) {
    return DisputeItem(
      id: json['id'] as String? ?? '',
      ticketNumber: json['ticketNumber'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? '',
      raisedBy: json['raisedBy'] as String? ?? '',
      actorRole: json['actorRole'] as String? ?? 'CUSTOMER',
      category: json['category'] as String? ?? '',
      description: json['description'] as String? ?? '',
      priority: json['priority'] as String? ?? 'HIGH',
      status: json['status'] as String? ?? 'OPEN',
      assignedTo: json['assignedTo'] as String?,
      resolutionNotes: json['resolutionNotes'] as String?,
      resolvedAt: json['resolvedAt'] != null
          ? DateTime.tryParse(json['resolvedAt'] as String)
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}
