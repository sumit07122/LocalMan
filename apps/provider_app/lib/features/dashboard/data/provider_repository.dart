import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/constants/api_constants.dart';
import '../../reviews/domain/provider_reputation_models.dart';

class ProviderProfileData {
  final String id;
  final String verificationStatus;
  final String? rejectionReason;
  final bool isOnline;
  final String? businessName;
  final String? bankAccountHolder;
  final String? bankAccountNumberEnc;
  final String? bankIfscCode;
  final String? upiId;

  const ProviderProfileData({
    required this.id,
    required this.verificationStatus,
    this.rejectionReason,
    required this.isOnline,
    this.businessName,
    this.bankAccountHolder,
    this.bankAccountNumberEnc,
    this.bankIfscCode,
    this.upiId,
  });

  factory ProviderProfileData.fromJson(Map<String, dynamic> json) {
    return ProviderProfileData(
      id: json['id'] as String? ?? '',
      verificationStatus: json['verificationStatus'] as String? ?? 'DRAFT',
      rejectionReason: json['rejectionReason'] as String?,
      isOnline: json['isOnline'] as bool? ?? false,
      businessName: json['businessName'] as String?,
      bankAccountHolder: json['bankAccountHolder'] as String?,
      bankAccountNumberEnc: json['bankAccountNumberEnc'] as String?,
      bankIfscCode: json['bankIfscCode'] as String?,
      upiId: json['upiId'] as String?,
    );
  }
}

abstract class IProviderRepository {
  Future<ProviderProfileData> getProfile();
  Future<bool> toggleOnline(bool isOnline);
  Future<dynamic> submitKycDocument({
    required String documentType,
    required String documentNumber,
    String? fileUrl,
  });
  Future<ProviderProfileData> updateProfile({
    String? businessName,
    String? bio,
    int? experienceYears,
    String? bankAccountHolder,
    String? bankAccountNumber,
    String? bankIfscCode,
    String? upiId,
  });
  // Phase 3J Reputation & Reviews
  Future<ProviderReputation> getReputation([String? providerId]);
  Future<List<ProviderReviewItem>> getReviews({int page = 1, int limit = 20});
  Future<bool> respondToReview(String reviewId, String responseText);
}

class ProviderRepository implements IProviderRepository {
  final ApiClient _apiClient;

  ProviderRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  @override
  Future<ProviderProfileData> getProfile() async {
    final response = await _apiClient.get(ApiConstants.providerProfile);
    final raw = response.data;
    Map<String, dynamic> data = {};
    if (raw is Map<String, dynamic>) {
      if (raw['data'] is Map<String, dynamic>) {
        data = raw['data'] as Map<String, dynamic>;
      } else {
        data = raw;
      }
    }
    return ProviderProfileData.fromJson(data);
  }

  @override
  Future<bool> toggleOnline(bool isOnline) async {
    final response = await _apiClient.post(
      ApiConstants.toggleOnline,
      data: {'isOnline': isOnline},
    );
    final raw = response.data;
    Map<String, dynamic> data = {};
    if (raw is Map<String, dynamic>) {
      if (raw['data'] is Map<String, dynamic>) {
        data = raw['data'] as Map<String, dynamic>;
      } else {
        data = raw;
      }
    }
    return data['isOnline'] as bool? ?? isOnline;
  }

  @override
  Future<dynamic> submitKycDocument({
    required String documentType,
    required String documentNumber,
    String? fileUrl,
  }) async {
    final response = await _apiClient.post(
      ApiConstants.submitKyc,
      data: {
        'documentType': documentType,
        'documentNumber': documentNumber,
        if (fileUrl != null) 'fileUrl': fileUrl,
      },
    );
    return response.data;
  }

  @override
  Future<ProviderProfileData> updateProfile({
    String? businessName,
    String? bio,
    int? experienceYears,
    String? bankAccountHolder,
    String? bankAccountNumber,
    String? bankIfscCode,
    String? upiId,
  }) async {
    final response = await _apiClient.put(
      ApiConstants.providerProfile,
      data: {
        if (businessName != null) 'businessName': businessName,
        if (bio != null) 'bio': bio,
        if (experienceYears != null) 'experienceYears': experienceYears,
        if (bankAccountHolder != null) 'bankAccountHolder': bankAccountHolder,
        if (bankAccountNumber != null) 'bankAccountNumber': bankAccountNumber,
        if (bankIfscCode != null) 'bankIfscCode': bankIfscCode,
        if (upiId != null) 'upiId': upiId,
      },
    );
    final raw = response.data;
    Map<String, dynamic> data = {};
    if (raw is Map<String, dynamic>) {
      if (raw['data'] is Map<String, dynamic>) {
        data = raw['data'] as Map<String, dynamic>;
      } else {
        data = raw;
      }
    }
    return ProviderProfileData.fromJson(data);
  }

  // Phase 3J Implementation
  @override
  Future<ProviderReputation> getReputation([String? providerId]) async {
    final endpoint = providerId != null
        ? ApiConstants.providerReputation(providerId)
        : ApiConstants.providerOwnReviews; // Fallback or own profile
    try {
      final response = await _apiClient.get(endpoint);
      final raw = response.data;
      Map<String, dynamic> data = {};
      if (raw is Map<String, dynamic>) {
        if (raw['data'] is Map<String, dynamic>) {
          data = raw['data'] as Map<String, dynamic>;
        } else {
          data = raw;
        }
      }
      return ProviderReputation.fromJson(data);
    } catch (_) {
      return const ProviderReputation(
        averageRating: 5.0,
        totalReviews: 0,
        countsByRating: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
      );
    }
  }

  @override
  Future<List<ProviderReviewItem>> getReviews({int page = 1, int limit = 20}) async {
    try {
      final response = await _apiClient.get(
        ApiConstants.providerOwnReviews,
        queryParameters: {'page': page, 'limit': limit},
      );
      final raw = response.data;
      List<dynamic> items = [];
      if (raw is Map<String, dynamic>) {
        if (raw['data'] is List<dynamic>) {
          items = raw['data'] as List<dynamic>;
        } else if (raw['data'] is Map<String, dynamic> && raw['data']['items'] is List<dynamic>) {
          items = raw['data']['items'] as List<dynamic>;
        }
      }
      return items.map((e) => ProviderReviewItem.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  @override
  Future<bool> respondToReview(String reviewId, String responseText) async {
    final response = await _apiClient.post(
      ApiConstants.reviewResponse(reviewId),
      data: {'response': responseText},
    );
    final raw = response.data;
    if (raw is Map<String, dynamic>) {
      return raw['success'] as bool? ?? true;
    }
    return true;
  }
}

final providerRepositoryProvider = Provider<IProviderRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return ProviderRepository(apiClient: apiClient);
});

final providerProfileFutureProvider = FutureProvider.autoDispose<ProviderProfileData>((ref) async {
  final repo = ref.watch(providerRepositoryProvider);
  return repo.getProfile();
});

final providerReviewsFutureProvider = FutureProvider.autoDispose<List<ProviderReviewItem>>((ref) async {
  final repo = ref.watch(providerRepositoryProvider);
  return repo.getReviews();
});

final providerReputationFutureProvider = FutureProvider.autoDispose<ProviderReputation>((ref) async {
  final repo = ref.watch(providerRepositoryProvider);
  return repo.getReputation();
});
