import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/core/errors/api_error.dart';
import 'package:localman_customer/core/errors/app_exception.dart';
import 'package:localman_customer/features/services/data/catalog_repository.dart';
import 'package:localman_customer/features/services/domain/category.dart';
import 'package:localman_customer/features/services/domain/service.dart';
import 'package:localman_customer/features/services/domain/catalog_pagination.dart';

class MockCatalogRepository implements ICatalogRepository {
  bool shouldThrow401 = false;
  bool shouldThrow422 = false;
  bool shouldTimeout = false;
  bool shouldBeOffline = false;

  final List<ServiceCategoryItem> mockCategories = [
    const ServiceCategoryItem(
      id: 'cat_plumbing',
      name: 'Plumbing',
      slug: 'plumbing',
      description: 'Pipes and taps repair',
      isActive: true,
      sortOrder: 1,
      servicesCount: 2,
    ),
    const ServiceCategoryItem(
      id: 'cat_electrician',
      name: 'Electrician',
      slug: 'electrician',
      description: 'Switches and wiring',
      isActive: true,
      sortOrder: 2,
      servicesCount: 1,
    ),
  ];

  final List<ServiceItem> mockServices = [
    ServiceItem.fromJson({
      'id': 'srv_tap_01',
      'categoryId': 'cat_plumbing',
      'name': 'Tap Leak Repair',
      'slug': 'tap-leak-repair',
      'description': 'Standard tap repair',
      'estimatedDurationMinutes': 45,
      'pricing': {
        'pricingModel': 'FIXED_PRICE',
        'basePricePaisa': 49900,
      },
    }),
    ServiceItem.fromJson({
      'id': 'srv_drain_01',
      'categoryId': 'cat_plumbing',
      'name': 'Drain Unclogging',
      'slug': 'drain-unclogging',
      'description': 'Clearing clogged kitchen or bathroom drains',
      'estimatedDurationMinutes': 60,
      'pricing': {
        'pricingModel': 'HOURLY',
        'hourlyRatePaisa': 34900,
        'minimumHours': 1,
      },
    }),
  ];

  void _checkErrors() {
    if (shouldThrow401) {
      throw ApiException(
        message: 'Authentication session expired',
        statusCode: 401,
        errorCode: 'UNAUTHORIZED',
      );
    }
    if (shouldThrow422) {
      throw ApiException(
        message: 'Invalid category filter parameter',
        statusCode: 422,
        errorCode: 'VALIDATION_ERROR',
        details: {'field': 'categoryId'},
      );
    }
    if (shouldTimeout) {
      throw const NetworkException(
        message: 'The request timed out. Please check your connection.',
        statusCode: 408,
      );
    }
    if (shouldBeOffline) {
      throw const NetworkException(
        message: 'No internet connection. Please verify your network.',
        statusCode: 0,
      );
    }
  }

  @override
  Future<List<ServiceCategoryItem>> getCategories() async {
    _checkErrors();
    return List.from(mockCategories);
  }

  @override
  Future<ServiceCategoryItem> getCategoryById(String idOrSlug) async {
    _checkErrors();
    final cat = mockCategories.firstWhere(
      (c) => c.id == idOrSlug || c.slug == idOrSlug,
      orElse: () => throw const NotFoundException('Category not found'),
    );
    final catServices = mockServices.where((s) => s.categoryId == cat.id).toList();
    return cat.copyWith(services: catServices);
  }

  @override
  Future<ServiceSearchResult> searchServices({
    String? query,
    String? categoryId,
    String? pricingModel,
    String? sort,
    int page = 1,
    int limit = 20,
  }) async {
    _checkErrors();
    var filtered = List<ServiceItem>.from(mockServices);

    if (query != null && query.isNotEmpty) {
      filtered = filtered
          .where((s) =>
              s.name.toLowerCase().contains(query.toLowerCase()) ||
              (s.description?.toLowerCase().contains(query.toLowerCase()) ?? false))
          .toList();
    }
    if (categoryId != null && categoryId.isNotEmpty) {
      filtered = filtered.where((s) => s.categoryId == categoryId).toList();
    }
    if (pricingModel != null && pricingModel.isNotEmpty) {
      filtered = filtered.where((s) => s.pricing.pricingModel == pricingModel).toList();
    }

    return ServiceSearchResult(
      services: filtered,
      pagination: CatalogPagination(
        page: page,
        limit: limit,
        total: filtered.length,
        totalPages: 1,
      ),
    );
  }

  @override
  Future<ServiceItem> getServiceById(String idOrSlug) async {
    _checkErrors();
    return mockServices.firstWhere(
      (s) => s.id == idOrSlug || s.slug == idOrSlug,
      orElse: () => throw const NotFoundException('Service not found'),
    );
  }
}

void main() {
  group('Catalog Repository Success, Error, and Network Handling Tests', () {
    late MockCatalogRepository repository;

    setUp(() {
      repository = MockCatalogRepository();
    });

    test('1. getCategories returns active categories successfully', () async {
      final categories = await repository.getCategories();
      expect(categories.length, 2);
      expect(categories[0].name, 'Plumbing');
      expect(categories[1].name, 'Electrician');
    });

    test('2. getCategoryById returns category with active services', () async {
      final category = await repository.getCategoryById('cat_plumbing');
      expect(category.id, 'cat_plumbing');
      expect(category.services, isNotNull);
      expect(category.services!.length, 2);
      expect(category.services![0].name, 'Tap Leak Repair');
    });

    test('3. searchServices filters by text query and category', () async {
      final result = await repository.searchServices(query: 'Tap', categoryId: 'cat_plumbing');
      expect(result.services.length, 1);
      expect(result.services.first.name, 'Tap Leak Repair');
      expect(result.pagination.total, 1);
    });

    test('4. searchServices filters by pricing model', () async {
      final result = await repository.searchServices(pricingModel: 'HOURLY');
      expect(result.services.length, 1);
      expect(result.services.first.pricing.pricingModel, 'HOURLY');
      expect(result.services.first.name, 'Drain Unclogging');
    });

    test('5. getServiceById returns specific service detail', () async {
      final service = await repository.getServiceById('srv_tap_01');
      expect(service.id, 'srv_tap_01');
      expect(service.name, 'Tap Leak Repair');
      expect(service.pricing.displayPrice, '₹499');
    });

    test('6. Repository handles 401 Unauthorized correctly', () async {
      repository.shouldThrow401 = true;

      expect(
        () => repository.getCategories(),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 401)),
      );
    });

    test('7. Repository handles 422 Validation Error correctly', () async {
      repository.shouldThrow422 = true;

      expect(
        () => repository.searchServices(categoryId: 'invalid_id'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 422)),
      );
    });

    test('8. Repository handles Network Timeout (408)', () async {
      repository.shouldTimeout = true;

      expect(
        () => repository.getCategories(),
        throwsA(isA<NetworkException>().having((e) => e.statusCode, 'statusCode', 408)),
      );
    });

    test('9. Repository handles Offline Network Unavailable (0)', () async {
      repository.shouldBeOffline = true;

      expect(
        () => repository.getCategories(),
        throwsA(isA<NetworkException>().having((e) => e.statusCode, 'statusCode', 0)),
      );
    });
  });
}
