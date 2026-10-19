import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/features/bookings/domain/booking_request.dart';
import 'package:localman_customer/features/bookings/domain/booking_snapshots.dart';
import 'package:localman_customer/features/bookings/domain/booking_item.dart';

void main() {
  group('Customer Booking Domain Models & DTO Tests', () {
    test('1. CreateBookingRequest serializes correctly with full parameters', () {
      final scheduledDate = DateTime.utc(2026, 10, 25, 10, 0, 0);
      final req = CreateBookingRequest(
        serviceId: 'srv_123',
        addressId: 'addr_456',
        scheduledDate: scheduledDate,
        jobDescription: 'Kitchen sink pipe is leaking under cabinet.',
        hours: 3,
        attachments: ['https://storage.localman.com/leak1.jpg'],
        idempotencyKey: 'idemp-test-key-999',
      );

      final json = req.toJson();

      expect(json['serviceId'], 'srv_123');
      expect(json['addressId'], 'addr_456');
      expect(json['scheduledDate'], '2026-10-25T10:00:00.000Z');
      expect(json['jobDescription'], 'Kitchen sink pipe is leaking under cabinet.');
      expect(json['hours'], 3);
      expect(json['attachments'], ['https://storage.localman.com/leak1.jpg']);
      expect(json['idempotencyKey'], 'idemp-test-key-999');
    });

    test('2. CreateBookingRequest omits null optional parameters', () {
      final scheduledDate = DateTime.utc(2026, 10, 25, 10, 0, 0);
      final req = CreateBookingRequest(
        serviceId: 'srv_fixed',
        addressId: 'addr_main',
        scheduledDate: scheduledDate,
      );

      final json = req.toJson();

      expect(json['serviceId'], 'srv_fixed');
      expect(json['addressId'], 'addr_main');
      expect(json['scheduledDate'], '2026-10-25T10:00:00.000Z');
      expect(json.containsKey('jobDescription'), false);
      expect(json.containsKey('hours'), false);
      expect(json.containsKey('attachments'), false);
      expect(json.containsKey('idempotencyKey'), false);
    });

    test('3. BookingAddressSnapshot parses and round-trips correctly', () {
      final json = {
        'id': 'addr_1',
        'addressLine1': 'Flat 402, Sunshine Heights',
        'addressLine2': 'Opposite Metro Pillar 45',
        'landmark': 'Next to ICICI Bank',
        'city': 'Mumbai',
        'state': 'Maharashtra',
        'postalCode': '400001',
        'latitude': 19.0760,
        'longitude': 72.8777,
        'label': 'Home',
      };

      final snapshot = BookingAddressSnapshot.fromJson(json);

      expect(snapshot.id, 'addr_1');
      expect(snapshot.addressLine1, 'Flat 402, Sunshine Heights');
      expect(snapshot.city, 'Mumbai');
      expect(snapshot.postalCode, '400001');
      expect(snapshot.latitude, 19.0760);
      expect(snapshot.label, 'Home');

      final serialized = snapshot.toJson();
      expect(serialized['city'], 'Mumbai');
      expect(serialized['postalCode'], '400001');
    });

    test('4. BookingPricingSnapshot parses FIXED_PRICE model with integer paisa', () {
      final json = {
        'pricingModel': 'FIXED_PRICE',
        'basePricePaisa': 49900,
        'platformFeePaisa': 4900,
        'taxPaisa': 9882,
        'totalAmountPaisa': 64682,
      };

      final snapshot = BookingPricingSnapshot.fromJson(json);

      expect(snapshot.pricingModel, 'FIXED_PRICE');
      expect(snapshot.basePricePaisa, 49900);
      expect(snapshot.platformFeePaisa, 4900);
      expect(snapshot.totalAmountPaisa, 64682);
    });

    test('5. BookingPricingSnapshot parses HOURLY and INSPECTION_QUOTE models', () {
      final hourlyJson = {
        'pricingModel': 'HOURLY',
        'hourlyRatePaisa': 35000,
        'minimumHours': 2,
        'estimatedHours': 3,
        'totalAmountPaisa': 105000,
      };

      final hourly = BookingPricingSnapshot.fromJson(hourlyJson);
      expect(hourly.pricingModel, 'HOURLY');
      expect(hourly.hourlyRatePaisa, 35000);
      expect(hourly.minimumHours, 2);
      expect(hourly.estimatedHours, 3);
      expect(hourly.totalAmountPaisa, 105000);

      final inspectionJson = {
        'pricingModel': 'INSPECTION_QUOTE',
        'inspectionFeePaisa': 19900,
        'totalAmountPaisa': 19900,
      };

      final inspection = BookingPricingSnapshot.fromJson(inspectionJson);
      expect(inspection.pricingModel, 'INSPECTION_QUOTE');
      expect(inspection.inspectionFeePaisa, 19900);
      expect(inspection.totalAmountPaisa, 19900);
    });

    test('6. BookingServiceSnapshot parses correctly', () {
      final json = {
        'id': 'srv_ac_repair',
        'name': 'AC Deep Cleaning',
        'slug': 'ac-deep-cleaning',
        'categoryName': 'Appliance Repair',
      };

      final snapshot = BookingServiceSnapshot.fromJson(json);

      expect(snapshot.id, 'srv_ac_repair');
      expect(snapshot.name, 'AC Deep Cleaning');
      expect(snapshot.slug, 'ac-deep-cleaning');
      expect(snapshot.categoryName, 'Appliance Repair');
    });

    test('7. BookingItem parses full API response with nested snapshots and OTP', () {
      final json = {
        'id': 'bkg_xyz_789',
        'bookingNumber': 'BK-20261020-001',
        'customerId': 'cust_111',
        'providerId': null,
        'serviceId': 'srv_plumbing_01',
        'status': 'REQUESTED',
        'scheduledDate': '2026-10-25T14:30:00.000Z',
        'jobDescription': 'Replace bathroom shower faucet',
        'totalAmountPaisa': 54800,
        'startOtp': '482910',
        'createdAt': '2026-10-20T08:00:00.000Z',
        'serviceSnapshot': {
          'id': 'srv_plumbing_01',
          'name': 'Shower Faucet Replacement',
          'slug': 'shower-faucet-replacement',
          'categoryName': 'Plumbing',
        },
        'addressSnapshot': {
          'id': 'addr_10',
          'addressLine1': '12 Green Park',
          'city': 'Bengaluru',
          'state': 'Karnataka',
          'postalCode': '560001',
        },
        'pricingSnapshot': {
          'pricingModel': 'FIXED_PRICE',
          'basePricePaisa': 49900,
          'totalAmountPaisa': 54800,
        },
      };

      final item = BookingItem.fromJson(json);

      expect(item.id, 'bkg_xyz_789');
      expect(item.bookingNumber, 'BK-20261020-001');
      expect(item.status, 'REQUESTED');
      expect(item.formattedStatus, 'Requested');
      expect(item.startOtp, '482910');
      expect(item.totalAmountPaisa, 54800);
      expect(item.displayTotal, '₹548.00');
      expect(item.serviceSnapshot?.name, 'Shower Faucet Replacement');
      expect(item.addressSnapshot?.city, 'Bengaluru');
      expect(item.pricingSnapshot?.pricingModel, 'FIXED_PRICE');
    });

    test('8. BookingItem formats displayTotal for zero or quote required correctly', () {
      final zeroJson = {
        'id': 'bkg_custom_001',
        'customerId': 'cust_111',
        'serviceId': 'srv_custom_01',
        'status': 'REQUESTED',
        'scheduledDate': '2026-10-25T14:30:00.000Z',
        'totalAmountPaisa': 0,
        'pricingSnapshot': {
          'pricingModel': 'CUSTOM_QUOTE',
          'totalAmountPaisa': 0,
        },
      };

      final item = BookingItem.fromJson(zeroJson);

      expect(item.totalAmountPaisa, 0);
      expect(item.displayTotal, 'Quote Required');
    });

    test('9. BookingListResult parses paginated customer response', () {
      final json = {
        'items': [
          {
            'id': 'bkg_1',
            'customerId': 'cust_111',
            'serviceId': 'srv_1',
            'status': 'REQUESTED',
            'scheduledDate': '2026-10-25T10:00:00.000Z',
            'totalAmountPaisa': 50000,
          },
          {
            'id': 'bkg_2',
            'customerId': 'cust_111',
            'serviceId': 'srv_2',
            'status': 'CONFIRMED',
            'scheduledDate': '2026-10-26T12:00:00.000Z',
            'totalAmountPaisa': 75000,
          },
        ],
        'total': 2,
        'page': 1,
        'limit': 10,
        'hasMore': false,
      };

      final result = BookingListResult.fromJson(json);

      expect(result.items.length, 2);
      expect(result.total, 2);
      expect(result.page, 1);
      expect(result.limit, 10);
      expect(result.hasMore, false);
      expect(result.items[0].id, 'bkg_1');
      expect(result.items[1].id, 'bkg_2');
    });
  });
}
