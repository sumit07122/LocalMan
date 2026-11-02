import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/features/services/domain/category.dart';
import 'package:localman_customer/features/services/domain/service.dart';
import 'package:localman_customer/features/services/domain/catalog_pagination.dart';

void main() {
  group('Customer Catalog Models & DTO Parsing Tests', () {
    test('1. CategoryItem parses valid JSON with subcategories and service count', () {
      final json = {
        'id': 'cat_plumbing',
        'name': 'Plumbing Services',
        'slug': 'plumbing-services',
        'description': 'Complete home plumbing repairs and installation',
        'icon': 'plumbing',
        'isActive': true,
        'sortOrder': 1,
        'servicesCount': 8,
        'children': [
          {
            'id': 'cat_leak_repair',
            'name': 'Leak & Pipe Repair',
            'slug': 'leak-repair',
            'parentId': 'cat_plumbing',
            'isActive': true,
            'sortOrder': 1,
            'servicesCount': 3,
          }
        ],
      };

      final category = ServiceCategoryItem.fromJson(json);

      expect(category.id, 'cat_plumbing');
      expect(category.name, 'Plumbing Services');
      expect(category.slug, 'plumbing-services');
      expect(category.description, contains('Complete home plumbing'));
      expect(category.icon, 'plumbing');
      expect(category.isActive, true);
      expect(category.servicesCount, 8);
      expect(category.children, isNotNull);
      expect(category.children.length, 1);
      expect(category.children.first.id, 'cat_leak_repair');
      expect(category.children.first.parentId, 'cat_plumbing');
    });

    test('2. ServiceItem parses FIXED_PRICE model with integer paisa correctly', () {
      final json = {
        'id': 'srv_tap_repair',
        'categoryId': 'cat_plumbing',
        'name': 'Tap Leak Repair',
        'slug': 'tap-leak-repair',
        'description': 'Fix leaking taps and washers',
        'shortDescription': 'Quick tap fix',
        'estimatedDurationMinutes': 45,
        'isActive': true,
        'sortOrder': 1,
        'pricing': {
          'pricingModel': 'FIXED_PRICE',
          'basePricePaisa': 49900, // ₹499
        },
      };

      final service = ServiceItem.fromJson(json);

      expect(service.id, 'srv_tap_repair');
      expect(service.name, 'Tap Leak Repair');
      expect(service.estimatedDurationMinutes, 45);
      expect(service.formattedDuration, '45 mins');
      expect(service.pricing.pricingModel, 'FIXED_PRICE');
      expect(service.pricing.isFixedPrice, true);
      expect(service.pricing.basePricePaisa, 49900);
      expect(service.pricing.displayPrice, '₹499.00');
      expect(service.pricing.formattedPrice, '₹499');
      expect(service.pricing.pricingModelBadge, 'Fixed Price');
      expect(service.pricing.explanation, contains('fixed and confirmed'));
    });

    test('3. ServiceItem parses HOURLY pricing model correctly', () {
      final json = {
        'id': 'srv_electrician_hour',
        'categoryId': 'cat_electrician',
        'name': 'Electrician by the Hour',
        'slug': 'electrician-by-hour',
        'estimatedDurationMinutes': 60,
        'pricing': {
          'pricingModel': 'HOURLY',
          'hourlyRatePaisa': 29900, // ₹299
          'minimumHours': 1,
        },
      };

      final service = ServiceItem.fromJson(json);

      expect(service.pricing.pricingModel, 'HOURLY');
      expect(service.pricing.isHourly, true);
      expect(service.pricing.hourlyRatePaisa, 29900);
      expect(service.pricing.displayPrice, '₹299.00/hr');
      expect(service.pricing.formattedPrice, '₹299/hr');
      expect(service.pricing.pricingModelBadge, 'Charged by Time');
      expect(service.pricing.explanation, contains('actual service duration'));
    });

    test('4. ServiceItem parses INSPECTION_QUOTE model correctly', () {
      final json = {
        'id': 'srv_deep_seepage',
        'categoryId': 'cat_plumbing',
        'name': 'Wall Seepage Diagnosis',
        'slug': 'wall-seepage-diagnosis',
        'pricing': {
          'pricingModel': 'INSPECTION_QUOTE',
          'inspectionFeePaisa': 9900, // ₹99
        },
      };

      final service = ServiceItem.fromJson(json);

      expect(service.pricing.pricingModel, 'INSPECTION_QUOTE');
      expect(service.pricing.isInspectionQuote, true);
      expect(service.pricing.inspectionFeePaisa, 9900);
      expect(service.pricing.displayPrice, '₹99.00 Inspection');
      expect(service.pricing.formattedPrice, '₹99 inspection visit fee');
      expect(service.pricing.pricingModelBadge, 'Inspection Required');
      expect(
        service.pricing.explanation,
        contains('inspect the problem'),
      );
    });

    test('5. ServiceItem parses CUSTOM_QUOTE model correctly', () {
      final json = {
        'id': 'srv_whole_house_wire',
        'categoryId': 'cat_electrician',
        'name': 'Full Home Rewiring',
        'slug': 'full-home-rewiring',
        'pricing': {
          'pricingModel': 'CUSTOM_QUOTE',
        },
      };

      final service = ServiceItem.fromJson(json);

      expect(service.pricing.pricingModel, 'CUSTOM_QUOTE');
      expect(service.pricing.isCustomQuote, true);
      expect(service.pricing.displayPrice, 'Quote Required');
      expect(service.pricing.formattedPrice, 'Receive provider quotes');
      expect(service.pricing.pricingModelBadge, 'Quotes on Request');
      expect(
        service.pricing.explanation,
        contains('competitive, itemized quotations'),
      );
    });

    test('6. CatalogPagination parses pagination metadata correctly', () {
      final json = {
        'page': 2,
        'limit': 10,
        'totalItems': 35,
        'totalPages': 4,
      };

      final pagination = CatalogPagination.fromJson(json);

      expect(pagination.page, 2);
      expect(pagination.limit, 10);
      expect(pagination.totalItems, 35);
      expect(pagination.totalPages, 4);
    });

    test('7. ServiceDuration formatted correctly across different durations', () {
      expect(
        ServiceItem.fromJson({
          'id': 's1',
          'categoryId': 'c1',
          'name': 'Test',
          'slug': 'test',
          'estimatedDurationMinutes': 30,
          'pricing': {'pricingModel': 'FIXED_PRICE', 'basePricePaisa': 10000},
        }).formattedDuration,
        '30 mins',
      );

      expect(
        ServiceItem.fromJson({
          'id': 's2',
          'categoryId': 'c1',
          'name': 'Test',
          'slug': 'test',
          'estimatedDurationMinutes': 60,
          'pricing': {'pricingModel': 'FIXED_PRICE', 'basePricePaisa': 10000},
        }).formattedDuration,
        '1 hr',
      );

      expect(
        ServiceItem.fromJson({
          'id': 's3',
          'categoryId': 'c1',
          'name': 'Test',
          'slug': 'test',
          'estimatedDurationMinutes': 90,
          'pricing': {'pricingModel': 'FIXED_PRICE', 'basePricePaisa': 10000},
        }).formattedDuration,
        '1 hr 30 mins',
      );

      expect(
        ServiceItem.fromJson({
          'id': 's4',
          'categoryId': 'c1',
          'name': 'Test',
          'slug': 'test',
          'estimatedDurationMinutes': null,
          'pricing': {'pricingModel': 'FIXED_PRICE', 'basePricePaisa': 10000},
        }).formattedDuration,
        isNull,
      );
    });
  });
}
