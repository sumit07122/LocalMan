/// Domain models representing media attachments for job execution
/// Designed for field technicians on low-end smartphones (clear icons, plain language, big touch buttons).

class ProviderJobMediaAttachment {
  final String id;
  final String purpose;
  final String fileUrl;
  final String? storageKey;
  final String? caption;
  final String? contentType;
  final int? fileSizeBytes;
  final String? uploaderRole;
  final DateTime? createdAt;

  const ProviderJobMediaAttachment({
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

  bool get isBeforePhoto => purpose == 'JOB_BEFORE_WORK';
  bool get isAfterPhoto => purpose == 'JOB_AFTER_WORK';

  String get simpleStatusLabel {
    if (isBeforePhoto) return 'Work Start Proof (Before)';
    if (isAfterPhoto) return 'Work Completion Proof (After)';
    return 'Photo Proof';
  }

  factory ProviderJobMediaAttachment.fromJson(Map<String, dynamic> json) {
    return ProviderJobMediaAttachment(
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

class ProviderJobMediaListResult {
  final String bookingId;
  final List<ProviderJobMediaAttachment> beforeWorkPhotos;
  final List<ProviderJobMediaAttachment> afterWorkPhotos;
  final List<ProviderJobMediaAttachment> problemPhotos;
  final int totalCount;

  const ProviderJobMediaListResult({
    required this.bookingId,
    this.beforeWorkPhotos = const [],
    this.afterWorkPhotos = const [],
    this.problemPhotos = const [],
    this.totalCount = 0,
  });

  factory ProviderJobMediaListResult.fromJson(Map<String, dynamic> json) {
    List<ProviderJobMediaAttachment> parseList(dynamic raw) {
      if (raw is! List<dynamic>) return [];
      return raw
          .whereType<Map<String, dynamic>>()
          .map((item) => ProviderJobMediaAttachment.fromJson(item))
          .toList();
    }

    final before = parseList(json['beforeWorkPhotos']);
    final after = parseList(json['afterWorkPhotos']);
    final problems = parseList(json['problemPhotos']);

    return ProviderJobMediaListResult(
      bookingId: json['bookingId'] as String? ?? '',
      beforeWorkPhotos: before,
      afterWorkPhotos: after,
      problemPhotos: problems,
      totalCount: (json['totalCount'] as num?)?.toInt() ??
          (before.length + after.length + problems.length),
    );
  }
}
