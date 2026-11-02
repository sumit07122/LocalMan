/// Domain models representing media attachments for bookings (Photos & Documents)
/// Adheres to low-end phone accessibility: plain language, readable labels, and large touch targets.

class BookingMediaAttachment {
  final String id;
  final String purpose;
  final String fileUrl;
  final String? storageKey;
  final String? caption;
  final String? contentType;
  final int? fileSizeBytes;
  final String? uploaderRole;
  final DateTime? createdAt;

  const BookingMediaAttachment({
    required this.id,
    required this.purpose,
    required this.fileUrl,
    this.storageKey,
    this.caption,
    this.contentType,
    this.fileSizeBytes,
    this.uploaderRole,
    this.createdAt,
  });

  /// Plain English, non-technical title suitable for low-end phone UI
  String get displayTitle {
    switch (purpose) {
      case 'JOB_BEFORE_WORK':
        return 'Before Work Photo';
      case 'JOB_AFTER_WORK':
        return 'After Work Completed';
      case 'BOOKING_PROBLEM_PHOTO':
        return 'Problem / Issue Photo';
      case 'REVIEW_PHOTO':
        return 'Review Photo';
      case 'KYC_DOCUMENT':
        return 'Verification Document';
      default:
        return 'Job Attachment';
    }
  }

  /// Plain English description of who provided the photo
  String get uploaderLabel {
    if (uploaderRole == 'PROVIDER') return 'Uploaded by Professional';
    if (uploaderRole == 'CUSTOMER') return 'Uploaded by Customer';
    if (uploaderRole == 'ADMIN') return 'Uploaded by LocalMan Support';
    return 'Uploaded';
  }

  factory BookingMediaAttachment.fromJson(Map<String, dynamic> json) {
    return BookingMediaAttachment(
      id: json['id'] as String? ?? '',
      purpose: json['purpose'] as String? ?? 'JOB_BEFORE_WORK',
      fileUrl: json['fileUrl'] as String? ?? '',
      storageKey: json['storageKey'] as String?,
      caption: json['caption'] as String?,
      contentType: json['contentType'] as String?,
      fileSizeBytes: (json['fileSizeBytes'] as num?)?.toInt(),
      uploaderRole: json['uploaderRole'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'purpose': purpose,
    'fileUrl': fileUrl,
    'storageKey': storageKey,
    'caption': caption,
    'contentType': contentType,
    'fileSizeBytes': fileSizeBytes,
    'uploaderRole': uploaderRole,
    'createdAt': createdAt?.toIso8601String(),
  };
}

/// Categorized collection of booking media returned by GET /api/v1/bookings/:id/media
class BookingMediaListResult {
  final String bookingId;
  final List<BookingMediaAttachment> beforeWorkPhotos;
  final List<BookingMediaAttachment> afterWorkPhotos;
  final List<BookingMediaAttachment> problemPhotos;
  final int totalCount;

  const BookingMediaListResult({
    required this.bookingId,
    this.beforeWorkPhotos = const [],
    this.afterWorkPhotos = const [],
    this.problemPhotos = const [],
    this.totalCount = 0,
  });

  bool get isEmpty => totalCount == 0;
  bool get hasBeforeAndAfter => beforeWorkPhotos.isNotEmpty && afterWorkPhotos.isNotEmpty;

  factory BookingMediaListResult.fromJson(Map<String, dynamic> json) {
    List<BookingMediaAttachment> parseList(dynamic raw) {
      if (raw is! List<dynamic>) return [];
      return raw
          .whereType<Map<String, dynamic>>()
          .map((item) => BookingMediaAttachment.fromJson(item))
          .toList();
    }

    final before = parseList(json['beforeWorkPhotos']);
    final after = parseList(json['afterWorkPhotos']);
    final problems = parseList(json['problemPhotos']);

    return BookingMediaListResult(
      bookingId: json['bookingId'] as String? ?? '',
      beforeWorkPhotos: before,
      afterWorkPhotos: after,
      problemPhotos: problems,
      totalCount: (json['totalCount'] as num?)?.toInt() ??
          (before.length + after.length + problems.length),
    );
  }

  Map<String, dynamic> toJson() => {
    'bookingId': bookingId,
    'beforeWorkPhotos': beforeWorkPhotos.map((e) => e.toJson()).toList(),
    'afterWorkPhotos': afterWorkPhotos.map((e) => e.toJson()).toList(),
    'problemPhotos': problemPhotos.map((e) => e.toJson()).toList(),
    'totalCount': totalCount,
  };
}
