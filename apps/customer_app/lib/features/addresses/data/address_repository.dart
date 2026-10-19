import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../domain/address.dart';

abstract class IAddressRepository {
  Future<List<Address>> listAddresses();
  Future<Address> createAddress({
    required String label,
    required String addressLine1,
    String? addressLine2,
    String? landmark,
    required String city,
    required String state,
    required String postalCode,
    required double latitude,
    required double longitude,
    bool isDefault = false,
  });
  Future<Address> updateAddress(
    String id, {
    String? label,
    String? addressLine1,
    String? addressLine2,
    String? landmark,
    String? city,
    String? state,
    String? postalCode,
    double? latitude,
    double? longitude,
    bool? isDefault,
  });
  Future<Address> setDefaultAddress(String id);
  Future<void> deleteAddress(String id);
}

class AddressRepository implements IAddressRepository {
  final ApiClient _apiClient;

  AddressRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  @override
  Future<List<Address>> listAddresses() async {
    final response = await _apiClient.get(ApiConstants.addresses);
    if (response is List) {
      return response
          .map((item) => Address.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  @override
  Future<Address> createAddress({
    required String label,
    required String addressLine1,
    String? addressLine2,
    String? landmark,
    required String city,
    required String state,
    required String postalCode,
    required double latitude,
    required double longitude,
    bool isDefault = false,
  }) async {
    final payload = {
      'label': label,
      'addressLine1': addressLine1,
      if (addressLine2 != null) 'addressLine2': addressLine2,
      if (landmark != null) 'landmark': landmark,
      'city': city,
      'state': state,
      'postalCode': postalCode,
      'latitude': latitude,
      'longitude': longitude,
      'isDefault': isDefault,
    };

    final response = await _apiClient.post(
      ApiConstants.addresses,
      data: payload,
    );

    return Address.fromJson(response as Map<String, dynamic>);
  }

  @override
  Future<Address> updateAddress(
    String id, {
    String? label,
    String? addressLine1,
    String? addressLine2,
    String? landmark,
    String? city,
    String? state,
    String? postalCode,
    double? latitude,
    double? longitude,
    bool? isDefault,
  }) async {
    final payload = <String, dynamic>{};
    if (label != null) payload['label'] = label;
    if (addressLine1 != null) payload['addressLine1'] = addressLine1;
    if (addressLine2 != null) payload['addressLine2'] = addressLine2;
    if (landmark != null) payload['landmark'] = landmark;
    if (city != null) payload['city'] = city;
    if (state != null) payload['state'] = state;
    if (postalCode != null) payload['postalCode'] = postalCode;
    if (latitude != null) payload['latitude'] = latitude;
    if (longitude != null) payload['longitude'] = longitude;
    if (isDefault != null) payload['isDefault'] = isDefault;

    final response = await _apiClient.put(
      ApiConstants.addressById(id),
      data: payload,
    );

    return Address.fromJson(response as Map<String, dynamic>);
  }

  @override
  Future<Address> setDefaultAddress(String id) async {
    final response = await _apiClient.patch(ApiConstants.addressSetDefault(id));
    return Address.fromJson(response as Map<String, dynamic>);
  }

  @override
  Future<void> deleteAddress(String id) async {
    await _apiClient.delete(ApiConstants.addressById(id));
  }
}

final addressRepositoryProvider = Provider<IAddressRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return AddressRepository(apiClient: apiClient);
});
