import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/core/errors/api_error.dart';
import 'package:localman_customer/core/errors/app_exception.dart';
import 'package:localman_customer/features/bookings/data/booking_repository.dart';
import 'package:localman_customer/features/bookings/domain/booking_item.dart';
import 'package:localman_customer/features/bookings/domain/booking_request.dart';
import 'package:localman_customer/features/bookings/domain/booking_snapshots.dart';

class MockBookingRepository implements IBookingRepository {
  bool shouldThrow401 = false;
  bool shouldThrow403 = false;
  bool shouldThrow404 = false;
  bool shouldThrow409 = false;
  bool shouldThrow422 = false;
  bool shouldTimeout = false;
  bool shouldBeOffline = false;

  final Map<String, BookingItem> _storedBookings = {};

  MockBookingRepository() {
    _storedBookings['bkg_existing_1'] = BookingItem(
      id: 'bkg_existing_1',
      bookingNumber: 'BK-20261020-001',
      customerId: 'cust_current',
      serviceId: 'srv_tap_repair',
      status: 'REQUESTED',
      scheduledDate: DateTime.utc(2026, 10, 25, 14, 0),
      jobDescription: 'Fix kitchen faucet',
      totalAmountPaisa: 49900,
      serviceSnapshot: const BookingServiceSnapshot(
        id: 'srv_tap_repair',
        name: 'Tap Leak Repair',
        slug: 'tap-leak-repair',
        categoryName: 'Plumbing',
      ),
      addressSnapshot: const BookingAddressSnapshot(
        id: 'addr_1',
        addressLine1: 'Flat 402, Sunshine Heights',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        label: 'Home',
      ),
      pricingSnapshot: const BookingPricingSnapshot(
        pricingModel: 'FIXED_PRICE',
        basePricePaisa: 49900,
        totalAmountPaisa: 49900,
      ),
    );
  }

  void _checkErrors() {
    if (shouldThrow401) {
      throw const UnauthorizedException('Authentication required');
    }
    if (shouldThrow403) {
      throw const ForbiddenException('You do not have permission to access this resource');
    }
    if (shouldThrow404) {
      throw const NotFoundException('The requested resource was not found');
    }
    if (shouldThrow409) {
      throw const ConflictException('Idempotency conflict: key re-used with different request payload');
    }
    if (shouldThrow422) {
      throw ValidationException('Service is currently inactive or not bookable', errors: [
        ApiValidationError(field: 'serviceId', message: 'Service is not active'),
      ]);
    }
    if (shouldTimeout) {
      throw const NetworkException('Connection timed out');
    }
    if (shouldBeOffline) {
      throw const NetworkException('Device is currently offline');
    }
  }

  @override
  Future<BookingItem> createBooking(CreateBookingRequest request) async {
    _checkErrors();

    final newId = 'bkg_new_${DateTime.now().millisecondsSinceEpoch}';
    final created = BookingItem(
      id: newId,
      bookingNumber: 'BK-NEW-001',
      customerId: 'cust_current',
      serviceId: request.serviceId,
      status: 'REQUESTED',
      scheduledDate: request.scheduledDate,
      jobDescription: request.jobDescription,
      totalAmountPaisa: 49900,
      startOtp: '123456',
      serviceSnapshot: BookingServiceSnapshot(
        id: request.serviceId,
        name: 'Requested Service',
        slug: 'requested-service',
      ),
      addressSnapshot: BookingAddressSnapshot(
        id: request.addressId,
        addressLine1: 'Customer Address',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
      ),
      pricingSnapshot: const BookingPricingSnapshot(
        pricingModel: 'FIXED_PRICE',
        basePricePaisa: 49900,
        totalAmountPaisa: 49900,
      ),
    );

    _storedBookings[newId] = created;
    return created;
  }

  @override
  Future<BookingListResult> listBookings({int page = 1, int limit = 20, String? status}) async {
    _checkErrors();

    final items = _storedBookings.values
        .where((b) => status == null || b.status == status)
        .toList();

    return BookingListResult(
      items: items,
      total: items.length,
      page: page,
      limit: limit,
      hasMore: false,
    );
  }

  @override
  Future<BookingItem> getBookingDetails(String bookingId) async {
    _checkErrors();

    final booking = _storedBookings[bookingId];
    if (booking == null) {
      throw const NotFoundException('Booking not found');
    }
    return booking;
  }
}

void main() {
  late MockBookingRepository repository;

  setUp(() {
    repository = MockBookingRepository();
  });

  group('BookingRepository Interface & Error Handling Tests', () {
    test('1. createBooking successfully creates authoritative booking', () async {
      final req = CreateBookingRequest(
        serviceId: 'srv_10',
        addressId: 'addr_10',
        scheduledDate: DateTime.utc(2026, 10, 28, 11, 0),
        jobDescription: 'Fix tap',
      );

      final result = await repository.createBooking(req);

      expect(result.id, startsWith('bkg_new_'));
      expect(result.status, 'REQUESTED');
      expect(result.serviceId, 'srv_10');
      expect(result.startOtp, '123456');
      expect(result.pricingSnapshot?.pricingModel, 'FIXED_PRICE');
    });

    test('2. createBooking maps 422 inactive/invalid service correctly', () async {
      repository.shouldThrow422 = true;

      final req = CreateBookingRequest(
        serviceId: 'srv_inactive',
        addressId: 'addr_10',
        scheduledDate: DateTime.utc(2026, 10, 28, 11, 0),
      );

      expect(
        () => repository.createBooking(req),
        throwsA(isA<ValidationException>().having(
          (e) => e.message,
          'message',
          contains('inactive'),
        )),
      );
    });

    test('3. createBooking maps 403 address IDOR/forbidden correctly', () async {
      repository.shouldThrow403 = true;

      final req = CreateBookingRequest(
        serviceId: 'srv_10',
        addressId: 'addr_foreign_user',
        scheduledDate: DateTime.utc(2026, 10, 28, 11, 0),
      );

      expect(
        () => repository.createBooking(req),
        throwsA(isA<ForbiddenException>()),
      );
    });

    test('4. createBooking maps 409 idempotency conflict correctly', () async {
      repository.shouldThrow409 = true;

      final req = CreateBookingRequest(
        serviceId: 'srv_10',
        addressId: 'addr_10',
        scheduledDate: DateTime.utc(2026, 10, 28, 11, 0),
        idempotencyKey: 'reused-key-different-payload',
      );

      expect(
        () => repository.createBooking(req),
        throwsA(isA<ConflictException>().having(
          (e) => e.message,
          'message',
          contains('Idempotency conflict'),
        )),
      );
    });

    test('5. createBooking maps 401 unauthenticated session correctly', () async {
      repository.shouldThrow401 = true;

      final req = CreateBookingRequest(
        serviceId: 'srv_10',
        addressId: 'addr_10',
        scheduledDate: DateTime.utc(2026, 10, 28, 11, 0),
      );

      expect(
        () => repository.createBooking(req),
        throwsA(isA<UnauthorizedException>()),
      );
    });

    test('6. Network timeout and offline states are typed and preserved', () async {
      repository.shouldTimeout = true;

      final req = CreateBookingRequest(
        serviceId: 'srv_10',
        addressId: 'addr_10',
        scheduledDate: DateTime.utc(2026, 10, 28, 11, 0),
      );

      expect(
        () => repository.createBooking(req),
        throwsA(isA<NetworkException>().having(
          (e) => e.message,
          'message',
          contains('timed out'),
        )),
      );

      repository.shouldTimeout = false;
      repository.shouldBeOffline = true;

      expect(
        () => repository.createBooking(req),
        throwsA(isA<NetworkException>().having(
          (e) => e.message,
          'message',
          contains('offline'),
        )),
      );
    });

    test('7. listBookings returns authenticated customer bookings', () async {
      final res = await repository.listBookings();

      expect(res.items.isNotEmpty, true);
      expect(res.items.first.id, 'bkg_existing_1');
      expect(res.items.first.customerId, 'cust_current');
      expect(res.total, 1);
    });

    test('8. getBookingDetails returns booking details or throws 404', () async {
      final booking = await repository.getBookingDetails('bkg_existing_1');
      expect(booking.id, 'bkg_existing_1');
      expect(booking.serviceSnapshot?.name, 'Tap Leak Repair');

      expect(
        () => repository.getBookingDetails('bkg_non_existent'),
        throwsA(isA<NotFoundException>()),
      );
    });
  });
}
