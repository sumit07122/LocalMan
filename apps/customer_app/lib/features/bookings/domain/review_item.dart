/// Domain model representing a customer review for a completed booking.
class ReviewItem {
  final String id;
  final String bookingId;
  final String customerId;
  final String providerId;
  final int rating;
  final String? title;
  final String? comment;
  final String status;
  final String? providerResponse;
  final DateTime? providerRespondedAt;
  final List<String> photos;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ReviewItem({
    required this.id,
    required this.bookingId,
    required this.customerId,
    required this.providerId,
    required this.rating,
    this.title,
    this.comment,
    required this.status,
    this.providerResponse,
    this.providerRespondedAt,
    this.photos = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  /// 48-Hour Review Edit Policy check
  bool get canEdit {
    final diff = DateTime.now().difference(createdAt);
    return diff.inHours < 48 && status != 'REMOVED';
  }

  int get hoursRemainingToEdit {
    final diff = DateTime.now().difference(createdAt);
    final remaining = 48 - diff.inHours;
    return remaining > 0 ? remaining : 0;
  }

  factory ReviewItem.fromJson(Map<String, dynamic> json) {
    return ReviewItem(
      id: json['id'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? '',
      customerId: json['customerId'] as String? ?? '',
      providerId: json['providerId'] as String? ?? '',
      rating: (json['rating'] as num?)?.toInt() ?? 5,
      title: json['title'] as String?,
      comment: (json['comment'] ?? json['body']) as String?,
      status: json['status'] as String? ?? 'PUBLISHED',
      providerResponse: (json['providerResponse'] ?? json['providerReply']) as String?,
      providerRespondedAt: json['providerRespondedAt'] != null
          ? DateTime.tryParse(json['providerRespondedAt'] as String)
          : null,
      photos: (json['photos'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'bookingId': bookingId,
      'customerId': customerId,
      'providerId': providerId,
      'rating': rating,
      'title': title,
      'comment': comment,
      'status': status,
      'providerResponse': providerResponse,
      'providerRespondedAt': providerRespondedAt?.toIso8601String(),
      'photos': photos,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}
