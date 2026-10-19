import 'package:flutter_test/flutter_test.dart';
import 'package:localman_provider/core/constants/api_constants.dart';
import 'package:localman_provider/shared/models/booking_model.dart';

void main() {
  group('Phase 3E — Provider Job Execution Lifecycle Unit Tests', () {
    test('1. ApiConstants generates correct authoritative Phase 3E operational URLs', () {
      const bookingId = 'bkg_operational_001';
      expect(
        ApiConstants.startTravel(bookingId),
        contains('/providers/bookings/$bookingId/on-the-way'),
      );
      expect(
        ApiConstants.markArrived(bookingId),
        contains('/providers/bookings/$bookingId/arrived'),
      );
      expect(
        ApiConstants.startJob(bookingId),
        contains('/providers/bookings/$bookingId/start'),
      );
      expect(
        ApiConstants.completeJob(bookingId),
        contains('/providers/bookings/$bookingId/complete'),
      );
    });

    test('2. Booking model parses PROVIDER_ACCEPTED state and preserves integer paisa calculations', () {
      final json = {
        'id': 'bkg_accepted_1',
        'bookingNumber': 'LM-20261020-001',
        'currentStatus': 'PROVIDER_ACCEPTED',
        'baseAmountPaisa': 75000,
        'totalAmountPaisa': 88500,
        'platformFeePaisa': 11250,
        'service': {'name': 'Washing Machine Repair'},
        'customer': {'fullName': 'Anjali Gupta', 'phoneNumber': '9876543210'},
        'address': {
          'line1': 'Flat 402, Sunshine Heights',
          'city': 'Bengaluru',
          'postalCode': '560001',
        },
        'materials': [],
      };

      final booking = Booking.fromJson(json);
      expect(booking.id, equals('bkg_accepted_1'));
      expect(booking.currentStatus, equals('PROVIDER_ACCEPTED'));
      expect(booking.serviceName, equals('Washing Machine Repair'));
      expect(booking.customerName, equals('Anjali Gupta'));
      expect(booking.totalAmountRupees, equals(885.0));
      expect(booking.baseAmountRupees, equals(750.0));
      expect(booking.platformFeeRupees, equals(112.5));
    });

    test('3. Booking model parses PROVIDER_ON_THE_WAY and ARRIVED transit states', () {
      final onTheWayJson = {
        'id': 'bkg_transit_1',
        'bookingNumber': 'LM-20261020-002',
        'currentStatus': 'PROVIDER_ON_THE_WAY',
        'baseAmountPaisa': 45000,
        'totalAmountPaisa': 53100,
        'platformFeePaisa': 6750,
        'service': {'name': 'Ceiling Fan Installation'},
        'customer': {'fullName': 'Kavita Menon', 'phoneNumber': '9123456780'},
        'address': {'line1': '12 MG Road', 'city': 'Bengaluru', 'postalCode': '560025'},
        'materials': [],
      };

      final arrivedJson = {
        ...onTheWayJson,
        'id': 'bkg_transit_2',
        'currentStatus': 'ARRIVED',
      };

      final onTheWay = Booking.fromJson(onTheWayJson);
      expect(onTheWay.currentStatus, equals('PROVIDER_ON_THE_WAY'));

      final arrived = Booking.fromJson(arrivedJson);
      expect(arrived.currentStatus, equals('ARRIVED'));
    });

    test('4. Booking model parses JOB_STARTED with materials requiring customer approval', () {
      final json = {
        'id': 'bkg_started_1',
        'bookingNumber': 'LM-20261020-003',
        'currentStatus': 'JOB_STARTED',
        'baseAmountPaisa': 50000,
        'totalAmountPaisa': 75000,
        'platformFeePaisa': 7500,
        'service': {'name': 'AC Servicing'},
        'customer': {'fullName': 'Vikas Roy', 'phoneNumber': '9988776655'},
        'address': {'line1': '45 Indiranagar 100ft Rd', 'city': 'Bengaluru', 'postalCode': '560038'},
        'materials': [
          {
            'id': 'mat_101',
            'bookingId': 'bkg_started_1',
            'itemName': 'Capacitor 45uF',
            'unitPricePaisa': 20000,
            'quantity': 1,
            'isCustomerApproved': true,
          },
          {
            'id': 'mat_102',
            'bookingId': 'bkg_started_1',
            'itemName': 'AC Gas R32 Refill (1kg)',
            'unitPricePaisa': 5000,
            'quantity': 1,
            'isCustomerApproved': false,
          },
        ],
      };

      final booking = Booking.fromJson(json);
      expect(booking.currentStatus, equals('JOB_STARTED'));
      expect(booking.materials.length, equals(2));
      expect(booking.materials[0].itemName, equals('Capacitor 45uF'));
      expect(booking.materials[0].isCustomerApproved, isTrue);
      expect(booking.materials[0].totalPriceRupees, equals(200.0));
      expect(booking.materials[1].itemName, equals('AC Gas R32 Refill (1kg)'));
      expect(booking.materials[1].isCustomerApproved, isFalse);
      expect(booking.materials[1].totalPriceRupees, equals(50.0));
    });

    test('5. Booking model parses JOB_COMPLETED state safely', () {
      final json = {
        'id': 'bkg_completed_1',
        'bookingNumber': 'LM-20261020-004',
        'currentStatus': 'JOB_COMPLETED',
        'baseAmountPaisa': 60000,
        'totalAmountPaisa': 60000,
        'platformFeePaisa': 9000,
        'service': {'name': 'Carpentry Door Repair'},
        'customer': {'fullName': 'Sunil Joshi', 'phoneNumber': '9876501234'},
        'address': {'line1': '77 Koramangala 4th Block', 'city': 'Bengaluru', 'postalCode': '560034'},
        'materials': [],
      };

      final booking = Booking.fromJson(json);
      expect(booking.currentStatus, equals('JOB_COMPLETED'));
      expect(booking.totalAmountRupees, equals(600.0));
    });

    test('6. Security audit: Start OTP is never exposed in provider booking model', () {
      final rawBackendResponse = {
        'id': 'bkg_sec_1',
        'bookingNumber': 'LM-20261020-005',
        'currentStatus': 'ARRIVED',
        'baseAmountPaisa': 50000,
        'totalAmountPaisa': 50000,
        'platformFeePaisa': 7500,
        'service': {'name': 'Plumbing Inspection'},
        'customer': {'fullName': 'Deepa Nair', 'phoneNumber': '9876543211'},
        'address': {'line1': '3 Whitefield', 'city': 'Bengaluru', 'postalCode': '560066'},
        'materials': [],
        // Malicious or leaked backend field if not sanitized
        'startOtp': '482910',
      };

      // Provider Booking model does not define or serialize startOtp
      final booking = Booking.fromJson(rawBackendResponse);
      final serialized = booking.toJson();
      expect(serialized.containsKey('startOtp'), isFalse);
    });
  });
}
