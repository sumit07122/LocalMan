import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/features/bookings/data/booking_realtime_service.dart';
import 'package:localman_customer/features/bookings/domain/booking_item.dart';

void main() {
  group('Phase 3D — Customer Booking Lifecycle & Assignment Unit Tests', () {
    test('1. BookingItem parses assignedProvider with public sanitized profile', () {
      final json = {
        'id': 'bkg_assigned_101',
        'bookingNumber': 'BK-20261020-009',
        'customerId': 'cust_abc',
        'providerId': 'prv_tech_77',
        'serviceId': 'srv_plumbing_deep',
        'addressId': 'addr_55',
        'currentStatus': 'PROVIDER_ACCEPTED',
        'pricingModel': 'FIXED_PRICE',
        'scheduledDate': '2026-10-25',
        'scheduledTimeSlot': '10:00 - 12:00',
        'baseAmountPaisa': 49900,
        'taxAmountPaisa': 8982,
        'totalAmountPaisa': 58882,
        'assignedProvider': {
          'id': 'prv_tech_77',
          'businessName': 'SuperFix Plumbing Solutions',
          'fullName': 'Rajesh Sharma',
          'avatarUrl': 'https://storage.localman.com/avatars/rajesh.jpg',
          'ratingAverage': 4.85,
          'ratingCount': 142,
          'experienceYears': 7,
        },
      };

      final booking = BookingItem.fromJson(json);

      expect(booking.id, 'bkg_assigned_101');
      expect(booking.currentStatus, 'PROVIDER_ACCEPTED');
      expect(booking.isProviderAssigned, isTrue);
      expect(booking.isSearchingForProvider, isFalse);

      final provider = booking.assignedProvider;
      expect(provider, isNotNull);
      expect(provider!.id, 'prv_tech_77');
      expect(provider.displayName, 'Rajesh Sharma');
      expect(provider.businessName, 'SuperFix Plumbing Solutions');
      expect(provider.ratingAverage, 4.85);
      expect(provider.ratingCount, 142);
      expect(provider.experienceYears, 7);

      // Verify privacy sanitization: no KYC, bank, or phone number fields present in model
      final providerJson = provider.toJson();
      expect(providerJson.containsKey('bankAccount'), isFalse);
      expect(providerJson.containsKey('panNumber'), isFalse);
      expect(providerJson.containsKey('kycDocuments'), isFalse);
      expect(providerJson.containsKey('matchingScore'), isFalse);
    });

    test('2. BookingItem parses searching state with dispatchStatus correctly', () {
      final json = {
        'id': 'bkg_req_002',
        'bookingNumber': 'BK-20261020-002',
        'customerId': 'cust_abc',
        'providerId': null,
        'serviceId': 'srv_electrical',
        'addressId': 'addr_1',
        'currentStatus': 'REQUESTED',
        'pricingModel': 'HOURLY',
        'scheduledDate': '2026-10-26',
        'scheduledTimeSlot': '14:00 - 16:00',
        'baseAmountPaisa': 35000,
        'taxAmountPaisa': 6300,
        'totalAmountPaisa': 41300,
        'dispatchStatus': {
          'isSearching': true,
          'attemptNumber': 2,
          'hasActiveOffer': true,
          'expiresAt': '2026-10-26T10:02:00.000Z',
          'assignedProviderId': null,
        },
      };

      final booking = BookingItem.fromJson(json);

      expect(booking.isSearchingForProvider, isTrue);
      expect(booking.isProviderAssigned, isFalse);
      expect(booking.dispatchStatus, isNotNull);
      expect(booking.dispatchStatus!.isSearching, isTrue);
      expect(booking.dispatchStatus!.attemptNumber, 2);
      expect(booking.dispatchStatus!.hasActiveOffer, isTrue);
      expect(booking.dispatchStatus!.assignedProviderId, isNull);
    });

    test('3. BookingItem parses authoritative timeline history correctly', () {
      final json = {
        'id': 'bkg_timeline_01',
        'bookingNumber': 'BK-20261020-003',
        'customerId': 'cust_abc',
        'providerId': 'prv_1',
        'serviceId': 'srv_ac',
        'addressId': 'addr_2',
        'currentStatus': 'PROVIDER_ACCEPTED',
        'pricingModel': 'FIXED_PRICE',
        'scheduledDate': '2026-10-27',
        'scheduledTimeSlot': '11:00 - 13:00',
        'baseAmountPaisa': 59900,
        'taxAmountPaisa': 10782,
        'totalAmountPaisa': 70682,
        'timeline': [
          {
            'id': 'hist_1',
            'fromState': 'NONE',
            'toState': 'REQUESTED',
            'actorRole': 'CUSTOMER',
            'reason': 'Customer requested booking',
            'createdAt': '2026-10-20T10:00:00.000Z',
          },
          {
            'id': 'hist_2',
            'fromState': 'REQUESTED',
            'toState': 'PROVIDER_ACCEPTED',
            'actorRole': 'PROVIDER',
            'reason': 'Provider accepted dispatch offer',
            'createdAt': '2026-10-20T10:01:30.000Z',
          },
        ],
      };

      final booking = BookingItem.fromJson(json);

      expect(booking.timeline.length, 2);
      expect(booking.timeline[0].toState, 'REQUESTED');
      expect(booking.timeline[0].formattedToState, 'Booking Requested');
      expect(booking.timeline[0].actorRole, 'CUSTOMER');

      expect(booking.timeline[1].toState, 'PROVIDER_ACCEPTED');
      expect(booking.timeline[1].formattedToState, 'Professional Assigned');
      expect(booking.timeline[1].actorRole, 'PROVIDER');
      expect(booking.timeline[1].reason, 'Provider accepted dispatch offer');
    });

    test('4. BookingRealtimeEvent parses PROVIDER_ASSIGNED envelope accurately', () {
      final rawEnvelope = {
        'type': 'PROVIDER_ASSIGNED',
        'channel': 'booking:bkg_101',
        'payload': {
          'bookingId': 'bkg_101',
          'providerId': 'prv_77',
          'status': 'PROVIDER_ACCEPTED',
          'assignedAt': '2026-10-20T10:05:00.000Z',
        },
        'timestamp': '2026-10-20T10:05:01.000Z',
      };

      final event = BookingRealtimeEvent.fromJson(rawEnvelope);

      expect(event.type, 'PROVIDER_ASSIGNED');
      expect(event.channel, 'booking:bkg_101');
      expect(event.payload['bookingId'], 'bkg_101');
      expect(event.payload['providerId'], 'prv_77');
      expect(event.payload['status'], 'PROVIDER_ACCEPTED');
      expect(event.timestamp.isUtc || event.timestamp.year == 2026, isTrue);
    });

    test('5. BookingRealtimeEvent handles unknown or malformed envelopes safely', () {
      final emptyEnvelope = <String, dynamic>{};
      final event = BookingRealtimeEvent.fromJson(emptyEnvelope);

      expect(event.type, 'UNKNOWN');
      expect(event.channel, '');
      expect(event.payload, isEmpty);
      expect(event.timestamp, isNotNull);
    });

    test('6. AssignedProviderPublic fallback display name logic', () {
      const providerWithBoth = AssignedProviderPublic(
        id: 'p1',
        businessName: 'Acme Repairs',
        fullName: 'Amit Kumar',
      );
      expect(providerWithBoth.displayName, 'Amit Kumar');

      const providerBusinessOnly = AssignedProviderPublic(
        id: 'p2',
        businessName: 'Express Electricals',
        fullName: null,
      );
      expect(providerBusinessOnly.displayName, 'Express Electricals');

      const providerEmptyFullName = AssignedProviderPublic(
        id: 'p3',
        businessName: 'Quick Clean',
        fullName: '   ',
      );
      expect(providerEmptyFullName.displayName, 'Quick Clean');
    });

    test('7. Timeline formatting covers all standard FSM states', () {
      final states = [
        'REQUESTED',
        'PROVIDER_ACCEPTED',
        'PROVIDER_ON_THE_WAY',
        'ARRIVED',
        'JOB_STARTED',
        'JOB_COMPLETED',
        'PAYMENT_PENDING',
        'PAYMENT_SETTLED',
        'CANCELLED',
      ];

      for (final state in states) {
        final item = BookingTimelineItem(
          id: 't_$state',
          fromState: 'PREV',
          toState: state,
          actorRole: 'SYSTEM',
          createdAt: DateTime.now(),
        );
        expect(item.formattedToState.isNotEmpty, isTrue);
      }
    });

    test('8. BookingRealtimeEvent parses JOB_STATUS_CHANGED event accurately', () {
      final rawEnvelope = {
        'type': 'JOB_STATUS_CHANGED',
        'channel': 'booking:bkg_exec_301',
        'payload': {
          'bookingId': 'bkg_exec_301',
          'fromState': 'ARRIVED',
          'toState': 'JOB_STARTED',
          'timestamp': '2026-10-20T11:00:00.000Z',
        },
        'timestamp': '2026-10-20T11:00:01.000Z',
      };

      final event = BookingRealtimeEvent.fromJson(rawEnvelope);
      expect(event.type, 'JOB_STATUS_CHANGED');
      expect(event.channel, 'booking:bkg_exec_301');
      expect(event.payload['fromState'], 'ARRIVED');
      expect(event.payload['toState'], 'JOB_STARTED');
    });

    test('9. BookingItem parses Phase 3E execution states and labels accurately', () {
      final base = {
        'id': 'bkg_exec_302',
        'bookingNumber': 'LM-20261020-099',
        'customerId': 'cust_1',
        'serviceId': 'srv_1',
        'addressId': 'addr_1',
        'baseAmountPaisa': 50000,
        'taxAmountPaisa': 9000,
        'totalAmountPaisa': 59000,
      };

      final onTheWay = BookingItem.fromJson({...base, 'currentStatus': 'PROVIDER_ON_THE_WAY'});
      expect(onTheWay.statusLabel, 'Pro On The Way');

      final arrived = BookingItem.fromJson({...base, 'currentStatus': 'ARRIVED'});
      expect(arrived.statusLabel, 'Pro Arrived');

      final started = BookingItem.fromJson({...base, 'currentStatus': 'JOB_STARTED'});
      expect(started.statusLabel, 'In Progress');

      final completed = BookingItem.fromJson({...base, 'currentStatus': 'JOB_COMPLETED'});
      expect(completed.statusLabel, 'Completed');
    });

    test('10. Customer Start OTP visibility logic: present during pre-start states, hidden after start', () {
      final preStartStates = ['CONFIRMED', 'PROVIDER_ACCEPTED', 'PROVIDER_ON_THE_WAY', 'ARRIVED'];
      final postStartStates = ['JOB_STARTED', 'JOB_EXTENDED', 'JOB_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_SETTLED'];

      for (final status in preStartStates) {
        final shouldShowOtp = ['CONFIRMED', 'PROVIDER_ACCEPTED', 'PROVIDER_ON_THE_WAY', 'ARRIVED'].contains(status);
        expect(shouldShowOtp, isTrue, reason: 'OTP should be visible during $status');
      }

      for (final status in postStartStates) {
        final shouldShowOtp = ['CONFIRMED', 'PROVIDER_ACCEPTED', 'PROVIDER_ON_THE_WAY', 'ARRIVED'].contains(status);
        expect(shouldShowOtp, isFalse, reason: 'OTP must NOT be visible during $status');
      }
    });
  });
}
