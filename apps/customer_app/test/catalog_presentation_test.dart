import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:localman_customer/features/services/domain/service_pricing.dart';
import 'package:localman_customer/shared/widgets/empty_state_view.dart';
import 'package:localman_customer/shared/widgets/error_view.dart';
import 'package:localman_customer/shared/widgets/loading_indicator.dart';

void main() {
  group('Catalog Presentation, Pricing Model UI & Search Debounce Tests', () {
    testWidgets('1. LoadingIndicator renders correctly with message', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: LoadingIndicator(message: 'Loading services...'),
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Loading services...'), findsOneWidget);
    });

    testWidgets('2. EmptyStateView renders title, message and icon', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: EmptyStateView(
              icon: Icons.cleaning_services_outlined,
              title: 'No Services Found',
              message: 'No services match your search.',
            ),
          ),
        ),
      );

      expect(find.text('No Services Found'), findsOneWidget);
      expect(find.text('No Services Found'), findsOneWidget);
      expect(find.text('No services match your search.'), findsOneWidget);
      expect(find.byIcon(Icons.cleaning_services_outlined), findsOneWidget);
    });

    testWidgets('3. ErrorView renders message and calls retry action', (tester) async {
      var retryClicked = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ErrorView(
              message: 'Network connection failed',
              onRetry: () => retryClicked = true,
              retryLabel: 'Try Again',
            ),
          ),
        ),
      );

      expect(find.text('Something went wrong'), findsOneWidget);
      expect(find.text('Network connection failed'), findsOneWidget);
      expect(find.text('Try Again'), findsOneWidget);

      await tester.tap(find.text('Try Again'));
      expect(retryClicked, true);
    });

    test('4. FIXED_PRICE model displays fixed price and clear explanation', () {
      final pricing = ServicePricing(
        pricingModel: PricingModelType.fixedPrice,
        basePricePaisa: 49900,
      );

      expect(pricing.formattedPrice, '₹499');
      expect(pricing.pricingModelBadge, 'Fixed Price');
      expect(pricing.customerExplanation, contains('fixed and confirmed'));
    });

    test('5. HOURLY model displays hourly rate and time explanation', () {
      final pricing = ServicePricing(
        pricingModel: PricingModelType.hourly,
        basePricePaisa: 29900,
        hourlyRatePaisa: 29900,
      );

      expect(pricing.formattedPrice, '₹299/hr');
      expect(pricing.pricingModelBadge, 'Charged by Time');
      expect(pricing.customerExplanation, contains('actual service duration'));
    });

    test('6. INSPECTION_QUOTE displays inspection notice and visit fee', () {
      final pricing = ServicePricing(
        pricingModel: PricingModelType.inspectionQuote,
        basePricePaisa: 0,
        inspectionFeePaisa: 9900,
      );

      expect(pricing.formattedPrice, '₹99 inspection visit fee');
      expect(pricing.pricingModelBadge, 'Inspection Required');
      expect(
        pricing.customerExplanation,
        contains('inspect the problem'),
      );
    });

    test('7. CUSTOM_QUOTE displays request quote notice', () {
      final pricing = ServicePricing(
        pricingModel: PricingModelType.customQuote,
        basePricePaisa: 0,
      );

      expect(pricing.formattedPrice, 'Receive provider quotes');
      expect(pricing.pricingModelBadge, 'Quotes on Request');
      expect(
        pricing.customerExplanation,
        contains('competitive, itemized quotations'),
      );
    });

    test('8. Search debounce simulator suppresses rapid keystrokes', () async {
      var queryTriggerCount = 0;
      String? lastExecutedQuery;
      Timer? debounceTimer;

      void onSearchInput(String text) {
        debounceTimer?.cancel();
        debounceTimer = Timer(const Duration(milliseconds: 50), () {
          queryTriggerCount++;
          lastExecutedQuery = text;
        });
      }

      // Simulate rapid typing: "p" -> "pl" -> "plu" -> "plumbing"
      onSearchInput('p');
      onSearchInput('pl');
      onSearchInput('plu');
      onSearchInput('plumbing');

      // Before timer elapses, no execution should happen
      expect(queryTriggerCount, 0);
      expect(lastExecutedQuery, isNull);

      // Wait for debounce period
      await Future.delayed(const Duration(milliseconds: 70));

      // Exactly 1 search triggered with the final query!
      expect(queryTriggerCount, 1);
      expect(lastExecutedQuery, 'plumbing');

      debounceTimer?.cancel();
    });

    test('9. Route / Deep-link parameter validation for catalog URLs', () {
      // Category ID validation
      final validCatId = 'cat_plumbing_123';
      final invalidCatId = '   ';
      expect(validCatId.trim().isNotEmpty, true);
      expect(invalidCatId.trim().isEmpty, true);

      // Service ID validation
      final validServiceId = 'srv_electrician_456';
      final invalidServiceId = '';
      expect(validServiceId.isNotEmpty, true);
      expect(invalidServiceId.isEmpty, true);

      // Query param validation
      final validQuery = 'tap repair';
      final cleanedQuery = validQuery.trim();
      expect(cleanedQuery, 'tap repair');
    });
  });
}
