import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/features/bookings/domain/cancellation_models.dart';

void main() {
  group('Phase 3G — Flutter Customer Cancellation, Refund & Dispute Tests', () {
    test('1. CancelBookingRequest serializes correctly with reason and idempotencyKey', () {
      const request = CancelBookingRequest(
        reason: 'CUSTOMER_CHANGED_MIND',
        notes: 'Change of schedule',
        idempotencyKey: 'idemp_cancel_test_01',
      );

      final json = request.toJson();
      expect(json['reason'], 'CUSTOMER_CHANGED_MIND');
      expect(json['notes'], 'Change of schedule');
      expect(json['idempotencyKey'], 'idemp_cancel_test_01');
    });

    test('2. CancellationResult parses authoritative server response with fee and refund', () {
      final json = {
        'bookingId': 'bkg_cancel_001',
        'previousStatus': 'PROVIDER_ON_THE_WAY',
        'newStatus': 'CANCELLED',
        'cancellationFeePaisa': 10000,
        'refundAmountPaisa': 40000,
        'refundStatus': 'SUCCEEDED',
        'policyExplanation': 'Fee deducted for en-route cancellation.',
        'isRedispatched': false,
      };

      final result = CancellationResult.fromJson(json);
      expect(result.bookingId, 'bkg_cancel_001');
      expect(result.previousStatus, 'PROVIDER_ON_THE_WAY');
      expect(result.newStatus, 'CANCELLED');
      expect(result.cancellationFeePaisa, 10000);
      expect(result.refundAmountPaisa, 40000);
      expect(result.refundStatus, 'SUCCEEDED');
      expect(result.policyExplanation, 'Fee deducted for en-route cancellation.');
      expect(result.isRedispatched, false);
    });

    test('3. NoShowRequest serializes waiting minutes and reason', () {
      const request = NoShowRequest(
        reason: 'PROVIDER_NO_SHOW',
        waitingMinutes: 30,
        notes: 'Provider did not arrive at door.',
      );

      final json = request.toJson();
      expect(json['reason'], 'PROVIDER_NO_SHOW');
      expect(json['waitingMinutes'], 30);
      expect(json['notes'], 'Provider did not arrive at door.');
    });

    test('4. NoShowResult parses server outcome correctly', () {
      final json = {
        'bookingId': 'bkg_noshow_001',
        'previousStatus': 'ARRIVED',
        'newStatus': 'NO_SHOW',
        'feePaisa': 20000,
        'refundAmountPaisa': 30000,
        'refundStatus': 'PROCESSING',
        'policyExplanation': 'Customer no-show recorded after on-site wait.',
      };

      final result = NoShowResult.fromJson(json);
      expect(result.bookingId, 'bkg_noshow_001');
      expect(result.previousStatus, 'ARRIVED');
      expect(result.newStatus, 'NO_SHOW');
      expect(result.feePaisa, 20000);
      expect(result.refundAmountPaisa, 30000);
      expect(result.refundStatus, 'PROCESSING');
    });

    test('5. CreateDisputeRequest serializes disputed amount in paisa', () {
      const request = CreateDisputeRequest(
        reason: 'job_not_completed',
        description: 'Technician left before fixing the leak.',
        disputedAmountPaisa: 25000,
      );

      final json = request.toJson();
      expect(json['reason'], 'job_not_completed');
      expect(json['description'], 'Technician left before fixing the leak.');
      expect(json['disputedAmountPaisa'], 25000);
    });

    test('6. DisputeItem correctly parses formal ticket, timestamps, and resolution', () {
      final now = DateTime.now();
      final json = {
        'id': 'cmpl_test_01',
        'ticketNumber': 'DSP-202610-099',
        'bookingId': 'bkg_dsp_001',
        'raisedBy': 'usr_cust_01',
        'actorRole': 'CUSTOMER',
        'category': 'poor_quality',
        'description': 'Wiring was left exposed.',
        'priority': 'HIGH',
        'status': 'RESOLVED_CUSTOMER',
        'resolutionNotes': 'Full goodwill refund approved by operations.',
        'resolvedAt': now.toIso8601String(),
        'createdAt': now.subtract(const Duration(hours: 2)).toIso8601String(),
        'updatedAt': now.toIso8601String(),
      };

      final dispute = DisputeItem.fromJson(json);
      expect(dispute.id, 'cmpl_test_01');
      expect(dispute.ticketNumber, 'DSP-202610-099');
      expect(dispute.bookingId, 'bkg_dsp_001');
      expect(dispute.raisedBy, 'usr_cust_01');
      expect(dispute.actorRole, 'CUSTOMER');
      expect(dispute.category, 'poor_quality');
      expect(dispute.status, 'RESOLVED_CUSTOMER');
      expect(dispute.resolutionNotes, 'Full goodwill refund approved by operations.');
      expect(dispute.resolvedAt, isNotNull);
    });
  });
}
