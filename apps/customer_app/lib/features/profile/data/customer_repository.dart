import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../domain/customer_profile.dart';

abstract class ICustomerRepository {
  Future<CustomerProfile> getProfile();
  Future<CustomerProfile> updateProfile({
    String? fullName,
    String? email,
    String? preferredLanguage,
  });
}

class CustomerRepository implements ICustomerRepository {
  final ApiClient _apiClient;

  CustomerRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  @override
  Future<CustomerProfile> getProfile() async {
    final response = await _apiClient.get(ApiConstants.me);
    final raw = response as Map<String, dynamic>;
    return CustomerProfile.fromJson(raw);
  }

  @override
  Future<CustomerProfile> updateProfile({
    String? fullName,
    String? email,
    String? preferredLanguage,
  }) async {
    final payload = <String, dynamic>{};
    if (fullName != null) payload['fullName'] = fullName;
    if (email != null) payload['email'] = email;
    if (preferredLanguage != null) payload['preferredLanguage'] = preferredLanguage;

    final response = await _apiClient.put(
      ApiConstants.profile,
      data: payload,
    );
    final raw = response as Map<String, dynamic>;
    return CustomerProfile.fromJson(raw);
  }
}

final customerRepositoryProvider = Provider<ICustomerRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return CustomerRepository(apiClient: apiClient);
});
