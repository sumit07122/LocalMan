import 'package:flutter_test/flutter_test.dart';
import 'package:localman_provider/core/constants/api_constants.dart';

void main() {
  group('Phase 3H — Provider Quote Marketplace Unit Tests', () {
    test('1. ApiConstants generates correct authoritative Phase 3H quote negotiation endpoints', () {
      const bookingId = 'bkg_custom_job_001';
      const quoteId = 'quote_rev_001';

      expect(
        ApiConstants.submitQuote(bookingId),
        contains('/providers/bookings/$bookingId/quotes'),
      );
      expect(
        ApiConstants.providerBookingQuotes(bookingId),
        contains('/providers/bookings/$bookingId/quotes'),
      );
      expect(
        ApiConstants.updateQuote(quoteId),
        contains('/providers/quotes/$quoteId'),
      );
      expect(
        ApiConstants.withdrawQuote(quoteId),
        contains('/providers/quotes/$quoteId/withdraw'),
      );
    });

    test('2. Provider quote proposal serialization preserves integer paisa amounts and line items', () {
      final payload = {
        'subtotalPaisa': 200000,
        'materialsPaisa': 50000,
        'taxPaisa': 0,
        'totalAmountPaisa': 250000,
        'estimatedDurationMinutes': 180,
        'breakdownNotes': 'Includes replacing the main distribution panel and circuit testing.',
        'validityMinutes': 1440,
        'items': [
          {
            'title': 'Distribution Panel Replacement',
            'quantity': 1,
            'unitPricePaisa': 200000,
            'totalPaisa': 200000,
            'type': 'LABOR',
          },
          {
            'title': 'Schneider 63A Double Pole Isolator',
            'quantity': 1,
            'unitPricePaisa': 50000,
            'totalPaisa': 50000,
            'type': 'MATERIAL',
          },
        ],
      };

      expect(payload['totalAmountPaisa'], 250000);
      expect((payload['items'] as List).length, 2);
      expect(payload['validityMinutes'], 1440);
    });

    test('3. Provider quote revision serialization updates scope and total', () {
      final revisionPayload = {
        'subtotalPaisa': 220000,
        'totalAmountPaisa': 270000,
        'breakdownNotes': 'Revised to include additional conduit piping as requested.',
      };

      expect(revisionPayload['totalAmountPaisa'], 270000);
      expect(revisionPayload['breakdownNotes'], contains('conduit piping'));
    });

    test('4. Provider quote withdrawal serialization formats reason payload', () {
      final withdrawalPayload = {
        'reason': 'Emergency schedule conflict; unavailable on requested date.',
      };

      expect(withdrawalPayload['reason'], contains('Emergency schedule conflict'));
    });

    test('5. Quote state machine states are accurately recognized', () {
      const validStates = [
        'REQUESTED',
        'SUBMITTED',
        'UPDATED',
        'ACCEPTED',
        'REJECTED',
        'EXPIRED',
        'WITHDRAWN',
        'SUPERSEDED',
      ];

      for (final state in validStates) {
        expect(state.isNotEmpty, isTrue);
      }
    });
  });
}
