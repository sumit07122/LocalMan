/// Domain models for Provider Reputation and Reviews.

class ProviderReputation {
  final double averageRating;
  final int totalReviews;
  final Map<int, int> countsByRating;

  const ProviderReputation({
    required this.averageRating,
    required this.totalReviews,
    required this.countsByRating,
  });

  factory ProviderReputation.fromJson(Map<String, dynamic> json) {
    final countsMap = <int, int>{
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    final rawCounts = json['countsByRating'] as Map<String, dynamic>?;
    if (rawCounts != null) {
      for (int i = 1; i <= 5; i++) {
        final val = rawCounts[i.toString()];
        if (val is num) {
          countsMap[i] = val.toInt();
        }
      }
    }

    return ProviderReputation(
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0.0,
      totalReviews: (json['totalReviews'] as num?)?.toInt() ?? 0,
      countsByRating: countsMap,
    );
  }

  double percentageForStar(int star) {
    if (totalReviews == 0) return 0.0;
    final count = countsByRating[star] ?? 0;
    return (count / totalReviews).clamp(0.0, 1.0);
  }
}

class ProviderReviewItem {
  final String id;
  final String bookingId;
  final int rating;
  final String? title;
  final String? comment;
  final String status;
  final String? customerName;
  final String? providerResponse;
  final DateTime? providerRespondedAt;
  final DateTime createdAt;

  const ProviderReviewItem({
    required this.id,
    required this.bookingId,
    required this.rating,
    this.title,
    this.comment,
    required this.status,
    this.customerName,
    this.providerResponse,
    this.providerRespondedAt,
    required this.createdAt,
  });

  bool get hasResponse => providerResponse != null && providerResponse!.trim().isNotEmpty;

  factory ProviderReviewItem.fromJson(Map<String, dynamic> json) {
    return ProviderReviewItem(
      id: json['id'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? '',
      rating: (json['rating'] as num?)?.toInt() ?? 5,
      title: json['title'] as String?,
      comment: (json['comment'] ?? json['body']) as String?,
      status: json['status'] as String? ?? 'PUBLISHED',
      customerName: json['customerName'] as String? ?? 'Verified Customer',
      providerResponse: (json['providerResponse'] ?? json['providerReply']) as String?,
      providerRespondedAt: json['providerRespondedAt'] != null
          ? DateTime.tryParse(json['providerRespondedAt'] as String)
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}
