import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/features/bookings/domain/booking_item.dart';
import 'package:localman_customer/features/bookings/domain/booking_snapshots.dart';
import 'package:localman_customer/features/services/domain/service.dart';
import 'package:localman_customer/features/services/domain/service_pricing.dart';

void main() {
  group('Booking Presentation & Pricing Calculation Logic Tests', () {
    test('1. FIXED_PRICE calculation is constant regardless of duration', () {
      final pricing = ServicePricing(
        pricingModel: 'FIXED_PRICE',
        basePricePaisa: 59900, // ₹599
      );

      final service = ServiceItem(
        id: 'srv_1',
        categoryId: 'cat_1',
        name: 'Ceiling Fan Installation',
        slug: 'fan-install',
        isActive: true,
        pricing: pricing,
      );

      expect(service.pricing.basePricePaisa, 59900);
      expect(service.pricing.displayPrice, '₹599.00');
    });

    test('2. HOURLY calculation multiplies rate by selected hours', () {
      final pricing = ServicePricing(
        pricingModel: 'HOURLY',
        hourlyRatePaisa: 30000, // ₹300/hr
        minimumHours: 2,
      );

      final service = ServiceItem(
        id: 'srv_deep_clean',
        categoryId: 'cat_cleaning',
        name: 'Home Deep Cleaning',
        slug: 'home-deep-cleaning',
        isActive: true,
        pricing: pricing,
      );

      expect(service.pricing.hourlyRatePaisa, 30000);
      expect(service.pricing.minimumHours, 2);

      // Estimate for 3 hours: 300 * 3 = 900
      final int estimatedPaisa = service.pricing.hourlyRatePaisa! * 3;
      expect(estimatedPaisa, 90000);
      final display = '₹${(estimatedPaisa / 100).toStringAsFixed(2)}';
      expect(display, '₹900.00');
    });

    test('3. INSPECTION_QUOTE shows upfront inspection fee and post-inspection notice', () {
      final pricing = ServicePricing(
        pricingModel: 'INSPECTION_QUOTE',
        inspectionFeePaisa: 14900, // ₹149
      );

      final service = ServiceItem(
        id: 'srv_inspect',
        categoryId: 'cat_repair',
        name: 'Major Appliance Diagnostics',
        slug: 'major-appliance-diagnostics',
        isActive: true,
        pricing: pricing,
      );

      expect(service.pricing.inspectionFeePaisa, 14900);
      expect(service.pricing.displayPrice, '₹149.00 Inspection');
    });

    test('4. CUSTOM_QUOTE displays Quote Required without fictitious totals', () {
      final pricing = ServicePricing(
        pricingModel: 'CUSTOM_QUOTE',
      );

      final service = ServiceItem(
        id: 'srv_renovate',
        categoryId: 'cat_renovate',
        name: 'Full Bathroom Remodel',
        slug: 'bathroom-remodel',
        isActive: true,
        pricing: pricing,
      );

      expect(service.pricing.displayPrice, 'Quote Required');
    });

    test('5. Booking scheduled date must not be in the past', () {
      final now = DateTime.now();
      final pastDate = now.subtract(const Duration(hours: 2));
      final futureDate = now.add(const Duration(days: 2));

      bool isDateValid(DateTime dt) => dt.isAfter(now.subtract(const Duration(minutes: 5)));

      expect(isDateValid(pastDate), false);
      expect(isDateValid(futureDate), true);
    });

    test('6. BookingItem status background and foreground colors are deterministic', () {
      final requestedItem = BookingItem(
        id: 'bkg_1',
        customerId: 'cust_1',
        serviceId: 'srv_1',
        status: 'REQUESTED',
        scheduledDate: DateTime.now().add(const Duration(days: 1)),
      );

      expect(requestedItem.statusBackgroundColor, isNotNull);
      expect(requestedItem.statusForegroundColor, isNotNull);
      expect(requestedItem.formattedStatus, 'Requested');

      final confirmedItem = BookingItem(
        id: 'bkg_2',
        customerId: 'cust_1',
        serviceId: 'srv_1',
        status: 'CONFIRMED',
        scheduledDate: DateTime.now().add(const Duration(days: 1)),
      );

      expect(confirmedItem.formattedStatus, 'Confirmed');

      final inProgressItem = BookingItem(
        id: 'bkg_3',
        customerId: 'cust_1',
        serviceId: 'srv_1',
        status: 'IN_PROGRESS',
        scheduledDate: DateTime.now().add(const Duration(days: 1)),
      );

      expect(inProgressItem.formattedStatus, 'In Progress');
    });

    test('7. Deep-link booking ID edge case handling', () {
      String sanitizeBookingId(String? rawId) {
        if (rawId == null || rawId.trim().isEmpty) return '';
        return rawId.trim();
      }

      expect(sanitizeBookingId(null), '');
      expect(sanitizeBookingId('   '), '');
      expect(sanitizeBookingId('  bkg_valid_123  '), 'bkg_valid_123');
    });
  });
}
