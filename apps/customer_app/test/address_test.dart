import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/features/addresses/data/address_repository.dart';
import 'package:localman_customer/features/addresses/domain/address.dart';
import 'package:localman_customer/features/addresses/presentation/controllers/address_provider.dart';

class MockAddressRepository implements IAddressRepository {
  final List<Address> mockStore = [];
  bool shouldFail = false;

  @override
  Future<List<Address>> listAddresses() async {
    if (shouldFail) throw Exception('Failed to fetch addresses');
    return List.from(mockStore);
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
    if (shouldFail) throw Exception('Validation error on create');

    final shouldBeDefault = isDefault || mockStore.isEmpty;
    if (shouldBeDefault) {
      for (var i = 0; i < mockStore.length; i++) {
        mockStore[i] = mockStore[i].copyWith(isDefault: false);
      }
    }

    final addr = Address(
      id: 'addr_${DateTime.now().millisecondsSinceEpoch}',
      userId: 'usr_test_cust',
      label: label,
      addressLine1: addressLine1,
      addressLine2: addressLine2,
      landmark: landmark,
      city: city,
      state: state,
      postalCode: postalCode,
      latitude: latitude,
      longitude: longitude,
      isDefault: shouldBeDefault,
    );
    mockStore.add(addr);
    return addr;
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
    final index = mockStore.indexWhere((a) => a.id == id);
    if (index == -1) throw Exception('Address not found');

    if (isDefault == true) {
      for (var i = 0; i < mockStore.length; i++) {
        mockStore[i] = mockStore[i].copyWith(isDefault: false);
      }
    }

    final updated = mockStore[index].copyWith(
      label: label,
      addressLine1: addressLine1,
      addressLine2: addressLine2,
      landmark: landmark,
      city: city,
      state: state,
      postalCode: postalCode,
      latitude: latitude,
      longitude: longitude,
      isDefault: isDefault,
    );
    mockStore[index] = updated;
    return updated;
  }

  @override
  Future<Address> setDefaultAddress(String id) async {
    for (var i = 0; i < mockStore.length; i++) {
      mockStore[i] = mockStore[i].copyWith(isDefault: mockStore[i].id == id);
    }
    return mockStore.firstWhere((a) => a.id == id);
  }

  @override
  Future<void> deleteAddress(String id) async {
    final deleted = mockStore.firstWhere((a) => a.id == id);
    mockStore.removeWhere((a) => a.id == id);

    // If default was deleted and items remain, promote first
    if (deleted.isDefault && mockStore.isNotEmpty) {
      mockStore[0] = mockStore[0].copyWith(isDefault: true);
    }
  }
}

void main() {
  group('Address Management & State Notifier Tests', () {
    late MockAddressRepository mockRepo;
    late AddressNotifier notifier;

    setUp(() {
      mockRepo = MockAddressRepository();
      notifier = AddressNotifier(addressRepository: mockRepo);
    });

    test('1. Initial state is empty with no selected address', () async {
      await notifier.loadAddresses();
      expect(notifier.state.addresses, isEmpty);
      expect(notifier.state.selectedAddress, isNull);
    });

    test('2. First created address automatically becomes default', () async {
      final success = await notifier.createAddress(
        label: 'Home',
        addressLine1: 'Villa 12, Palm Meadows',
        city: 'Bengaluru',
        stateName: 'Karnataka',
        postalCode: '560066',
        latitude: 12.9698,
        longitude: 77.7499,
      );

      expect(success, true);
      expect(notifier.state.addresses.length, 1);
      expect(notifier.state.addresses.first.isDefault, true);
      expect(notifier.state.selectedAddress?.isDefault, true);
    });

    test('3. Creating second address with isDefault: true unsets first address', () async {
      await notifier.createAddress(
        label: 'Home',
        addressLine1: 'Villa 12, Palm Meadows',
        city: 'Bengaluru',
        stateName: 'Karnataka',
        postalCode: '560066',
        latitude: 12.9698,
        longitude: 77.7499,
      );

      await notifier.createAddress(
        label: 'Office',
        addressLine1: 'Floor 5, Tech Park',
        city: 'Bengaluru',
        stateName: 'Karnataka',
        postalCode: '560103',
        latitude: 12.9260,
        longitude: 77.6762,
        isDefault: true,
      );

      expect(notifier.state.addresses.length, 2);
      final home = notifier.state.addresses.firstWhere((a) => a.label == 'Home');
      final office = notifier.state.addresses.firstWhere((a) => a.label == 'Office');

      expect(home.isDefault, false);
      expect(office.isDefault, true);
    });

    test('4. setDefaultAddress marks target as default and others as non-default', () async {
      await notifier.createAddress(
        label: 'Home',
        addressLine1: 'Villa 12',
        city: 'Bengaluru',
        stateName: 'Karnataka',
        postalCode: '560066',
        latitude: 12.9698,
        longitude: 77.7499,
      );
      await notifier.createAddress(
        label: 'Office',
        addressLine1: 'Tech Park',
        city: 'Bengaluru',
        stateName: 'Karnataka',
        postalCode: '560103',
        latitude: 12.9260,
        longitude: 77.6762,
        isDefault: true,
      );

      final homeId = notifier.state.addresses.firstWhere((a) => a.label == 'Home').id;
      final success = await notifier.setDefaultAddress(homeId);

      expect(success, true);
      final refreshedHome = notifier.state.addresses.firstWhere((a) => a.label == 'Home');
      final refreshedOffice = notifier.state.addresses.firstWhere((a) => a.label == 'Office');

      expect(refreshedHome.isDefault, true);
      expect(refreshedOffice.isDefault, false);
    });

    test('5. Deleting default address promotes remaining address to default', () async {
      await notifier.createAddress(
        label: 'Home',
        addressLine1: 'Villa 12',
        city: 'Bengaluru',
        stateName: 'Karnataka',
        postalCode: '560066',
        latitude: 12.9698,
        longitude: 77.7499,
      );
      await notifier.createAddress(
        label: 'Office',
        addressLine1: 'Tech Park',
        city: 'Bengaluru',
        stateName: 'Karnataka',
        postalCode: '560103',
        latitude: 12.9260,
        longitude: 77.6762,
        isDefault: true,
      );

      final officeId = notifier.state.addresses.firstWhere((a) => a.label == 'Office').id;
      final success = await notifier.deleteAddress(officeId);

      expect(success, true);
      expect(notifier.state.addresses.length, 1);
      expect(notifier.state.addresses.first.label, 'Home');
      expect(notifier.state.addresses.first.isDefault, true);
    });
  });
}
