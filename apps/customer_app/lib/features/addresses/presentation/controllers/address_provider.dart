import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/address_repository.dart';
import '../../domain/address.dart';

class AddressState {
  final bool isLoading;
  final List<Address> addresses;
  final Address? selectedAddress;
  final String? errorMessage;

  const AddressState({
    this.isLoading = false,
    this.addresses = const [],
    this.selectedAddress,
    this.errorMessage,
  });

  Address? get defaultAddress {
    try {
      return addresses.firstWhere((a) => a.isDefault);
    } catch (_) {
      return addresses.isNotEmpty ? addresses.first : null;
    }
  }

  AddressState copyWith({
    bool? isLoading,
    List<Address>? addresses,
    Address? selectedAddress,
    String? errorMessage,
  }) {
    return AddressState(
      isLoading: isLoading ?? this.isLoading,
      addresses: addresses ?? this.addresses,
      selectedAddress: selectedAddress ?? this.selectedAddress,
      errorMessage: errorMessage,
    );
  }
}

class AddressNotifier extends StateNotifier<AddressState> {
  final IAddressRepository _addressRepository;

  AddressNotifier({required IAddressRepository addressRepository})
      : _addressRepository = addressRepository,
        super(const AddressState()) {
    loadAddresses();
  }

  Future<void> loadAddresses() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final list = await _addressRepository.listAddresses();
      final defaultAddr = list.any((a) => a.isDefault)
          ? list.firstWhere((a) => a.isDefault)
          : (list.isNotEmpty ? list.first : null);

      state = state.copyWith(
        isLoading: false,
        addresses: list,
        selectedAddress: state.selectedAddress ?? defaultAddr,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  void selectAddress(Address address) {
    state = state.copyWith(selectedAddress: address);
  }

  Future<bool> createAddress({
    required String label,
    required String addressLine1,
    String? addressLine2,
    String? landmark,
    required String city,
    required String stateName,
    required String postalCode,
    required double latitude,
    required double longitude,
    bool isDefault = false,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final created = await _addressRepository.createAddress(
        label: label,
        addressLine1: addressLine1,
        addressLine2: addressLine2,
        landmark: landmark,
        city: city,
        state: stateName,
        postalCode: postalCode,
        latitude: latitude,
        longitude: longitude,
        isDefault: isDefault,
      );

      // Reload full list to reflect default un-sets
      await loadAddresses();
      state = state.copyWith(selectedAddress: created);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> updateAddress(
    String id, {
    String? label,
    String? addressLine1,
    String? addressLine2,
    String? landmark,
    String? city,
    String? stateName,
    String? postalCode,
    double? latitude,
    double? longitude,
    bool? isDefault,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _addressRepository.updateAddress(
        id,
        label: label,
        addressLine1: addressLine1,
        addressLine2: addressLine2,
        landmark: landmark,
        city: city,
        state: stateName,
        postalCode: postalCode,
        latitude: latitude,
        longitude: longitude,
        isDefault: isDefault,
      );

      await loadAddresses();
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> setDefaultAddress(String id) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final updated = await _addressRepository.setDefaultAddress(id);
      await loadAddresses();
      state = state.copyWith(selectedAddress: updated);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> deleteAddress(String id) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _addressRepository.deleteAddress(id);
      await loadAddresses();
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
      return false;
    }
  }
}

final addressProvider = StateNotifierProvider<AddressNotifier, AddressState>((ref) {
  final repo = ref.watch(addressRepositoryProvider);
  return AddressNotifier(addressRepository: repo);
});
