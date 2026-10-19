import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/features/bookings/domain/quote_models.dart';

void main() {
  group('Phase 3H — Flutter Customer Quote Marketplace Tests', () {
    test('1. QuoteItem parses correctly and computes integer paisa to rupee formatting', () {
      final json = {
        'title': 'Heavy Duty Copper Wiring (30m)',
        'description': 'Finolex 2.5 sq mm fire-resistant wire',
        'quantity': 2,
        'unitPricePaisa': 45000,
        'totalPaisa': 90000,
        'type': 'MATERIAL',
      };

      final item = QuoteItem.fromJson(json);
      expect(item.title, 'Heavy Duty Copper Wiring (30m)');
      expect(item.quantity, 2);
      expect(item.unitPricePaisa, 45000);
      expect(item.totalPaisa, 90000);
      expect(item.totalRupees, 900.0);
      expect(item.formattedTotal, '₹900.00');
      expect(item.type, 'MATERIAL');
    });

    test('2. QuoteProviderSummary exposes public trust metrics without banking or commission data', () {
      final json = {
        'id': 'prv_trusted_01',
        'businessName': 'Bright Sparks Electricals',
        'name': 'Ramesh Kumar',
        'avatarUrl': 'https://cdn.localman.in/avatars/ramesh.jpg',
        'rating': 4.85,
        'completedBookingsCount': 142,
      };

      final summary = QuoteProviderSummary.fromJson(json);
      expect(summary.id, 'prv_trusted_01');
      expect(summary.businessName, 'Bright Sparks Electricals');
      expect(summary.name, 'Ramesh Kumar');
      expect(summary.rating, 4.85);
      expect(summary.completedBookingsCount, 142);

      // Verify serialized map does not contain commission or financial account details
      final map = summary.toJson();
      expect(map.containsKey('bankAccount'), isFalse);
      expect(map.containsKey('commissionRateOverride'), isFalse);
      expect(map.containsKey('platformCommissionPercent'), isFalse);
    });

    test('3. CustomerQuote parses comprehensive quotation breakdown and estimates', () {
      final json = {
        'id': 'quote_full_01',
        'bookingId': 'bkg_custom_001',
        'providerId': 'prv_001',
        'status': 'SUBMITTED',
        'totalAmountPaisa': 250000,
        'subtotalPaisa': 180000,
        'materialsPaisa': 50000,
        'taxPaisa': 20000,
        'estimatedDurationMinutes': 150,
        'breakdownNotes': 'Includes full replacement of 3 MCBs and earthing wire.',
        'version': 1,
        'isExpired': false,
        'validUntil': DateTime.now().add(const Duration(hours: 24)).toIso8601String(),
        'items': [
          {
            'title': 'MCB Replacement Labor',
            'quantity': 3,
            'unitPricePaisa': 60000,
            'totalPaisa': 180000,
            'type': 'LABOR',
          },
          {
            'title': 'Havells 32A MCB Units',
            'quantity': 3,
            'unitPricePaisa': 16666,
            'totalPaisa': 50000,
            'type': 'MATERIAL',
          },
        ],
        'provider': {
          'id': 'prv_001',
          'businessName': 'City Electric Pro',
          'name': 'Sunil Verma',
          'rating': 4.9,
          'completedBookingsCount': 89,
        },
        'createdAt': DateTime.now().toIso8601String(),
      };

      final quote = CustomerQuote.fromJson(json);
      expect(quote.id, 'quote_full_01');
      expect(quote.totalAmountPaisa, 250000);
      expect(quote.formattedTotal, '₹2500.00');
      expect(quote.subtotalRupees, 1800.0);
      expect(quote.materialsRupees, 500.0);
      expect(quote.taxRupees, 200.0);
      expect(quote.items.length, 2);
      expect(quote.provider?.businessName, 'City Electric Pro');
      expect(quote.formattedDuration, '2h 30m');
      expect(quote.canBeAccepted, isTrue);
    });

    test('4. Expiration engine correctly flags expired quotes and disables acceptance', () {
      final expiredJson = {
        'id': 'quote_expired_01',
        'bookingId': 'bkg_custom_002',
        'providerId': 'prv_002',
        'status': 'SUBMITTED',
        'totalAmountPaisa': 120000,
        'subtotalPaisa': 120000,
        'materialsPaisa': 0,
        'taxPaisa': 0,
        'isExpired': true,
        'validUntil': DateTime.now().subtract(const Duration(minutes: 10)).toIso8601String(),
        'createdAt': DateTime.now().subtract(const Duration(hours: 25)).toIso8601String(),
      };

      final quote = CustomerQuote.fromJson(expiredJson);
      expect(quote.isExpired, isTrue);
      expect(quote.canBeAccepted, isFalse);
    });

    test('5. CustomerQuoteListResponse filters active quotes and identifies accepted winner', () {
      final json = {
        'bookingId': 'bkg_multi_quotes',
        'pricingModel': 'CUSTOM_QUOTE',
        'acceptedQuoteId': 'quote_winner_02',
        'quotes': [
          {
            'id': 'quote_loser_01',
            'bookingId': 'bkg_multi_quotes',
            'providerId': 'prv_01',
            'status': 'REJECTED',
            'totalAmountPaisa': 150000,
            'subtotalPaisa': 150000,
            'materialsPaisa': 0,
            'taxPaisa': 0,
            'createdAt': DateTime.now().toIso8601String(),
          },
          {
            'id': 'quote_winner_02',
            'bookingId': 'bkg_multi_quotes',
            'providerId': 'prv_02',
            'status': 'ACCEPTED',
            'totalAmountPaisa': 135000,
            'subtotalPaisa': 135000,
            'materialsPaisa': 0,
            'taxPaisa': 0,
            'createdAt': DateTime.now().toIso8601String(),
          },
        ],
      };

      final response = CustomerQuoteListResponse.fromJson(json);
      expect(response.quotes.length, 2);
      expect(response.acceptedQuoteId, 'quote_winner_02');
      expect(response.acceptedQuote?.id, 'quote_winner_02');
      expect(response.acceptedQuote?.formattedTotal, '₹1350.00');
      // Accepted and rejected quotes cannot be accepted again
      expect(response.activeQuotes.length, 0);
    });
  });
}
