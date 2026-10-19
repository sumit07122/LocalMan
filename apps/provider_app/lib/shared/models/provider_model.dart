enum VerificationStatus {
  draft,
  submitted,
  underReview,
  verified,
  rejected,
  suspended;

  static VerificationStatus fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'SUBMITTED':
        return VerificationStatus.submitted;
      case 'UNDER_REVIEW':
        return VerificationStatus.underReview;
      case 'VERIFIED':
        return VerificationStatus.verified;
      case 'REJECTED':
        return VerificationStatus.rejected;
      case 'SUSPENDED':
        return VerificationStatus.suspended;
      case 'DRAFT':
      default:
        return VerificationStatus.draft;
    }
  }

  String get label {
    switch (this) {
      case VerificationStatus.draft:
        return 'Draft Profile';
      case VerificationStatus.submitted:
        return 'Documents Submitted';
      case VerificationStatus.underReview:
        return 'Under Review';
      case VerificationStatus.verified:
        return 'Verified Pro';
      case VerificationStatus.rejected:
        return 'Verification Rejected';
      case VerificationStatus.suspended:
        return 'Account Suspended';
    }
  }
}

class ProviderProfile {
  final String id;
  final String userId;
  final String? businessName;
  final String? bio;
  final int experienceYears;
  final VerificationStatus verificationStatus;
  final String? rejectionReason;
  final bool isOnline;
  final double? currentLatitude;
  final double? currentLongitude;
  final double ratingAverage;
  final int ratingCount;
  final String? bankAccountHolder;
  final String? bankIfscCode;
  final String? upiId;

  const ProviderProfile({
    required this.id,
    required this.userId,
    this.businessName,
    this.bio,
    this.experienceYears = 0,
    this.verificationStatus = VerificationStatus.draft,
    this.rejectionReason,
    this.isOnline = false,
    this.currentLatitude,
    this.currentLongitude,
    this.ratingAverage = 5.0,
    this.ratingCount = 0,
    this.bankAccountHolder,
    this.bankIfscCode,
    this.upiId,
  });

  factory ProviderProfile.fromJson(Map<String, dynamic> json) {
    return ProviderProfile(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      businessName: json['businessName'] as String?,
      bio: json['bio'] as String?,
      experienceYears: json['experienceYears'] as int? ?? 0,
      verificationStatus: VerificationStatus.fromString(json['verificationStatus'] as String?),
      rejectionReason: json['rejectionReason'] as String?,
      isOnline: json['isOnline'] as bool? ?? false,
      currentLatitude: (json['currentLatitude'] as num?)?.toDouble(),
      currentLongitude: (json['currentLongitude'] as num?)?.toDouble(),
      ratingAverage: (json['ratingAverage'] as num?)?.toDouble() ?? 5.0,
      ratingCount: json['ratingCount'] as int? ?? 0,
      bankAccountHolder: json['bankAccountHolder'] as String?,
      bankIfscCode: json['bankIfscCode'] as String?,
      upiId: json['upiId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'userId': userId,
    'businessName': businessName,
    'bio': bio,
    'experienceYears': experienceYears,
    'verificationStatus': verificationStatus.name.toUpperCase(),
    'rejectionReason': rejectionReason,
    'isOnline': isOnline,
    'currentLatitude': currentLatitude,
    'currentLongitude': currentLongitude,
    'ratingAverage': ratingAverage,
    'ratingCount': ratingCount,
    'bankAccountHolder': bankAccountHolder,
    'bankIfscCode': bankIfscCode,
    'upiId': upiId,
  };
}
