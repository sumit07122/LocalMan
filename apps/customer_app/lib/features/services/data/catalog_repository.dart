import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../domain/category.dart';
import '../domain/service.dart';
import '../domain/catalog_pagination.dart';

abstract class ICatalogRepository {
  Future<List<ServiceCategoryItem>> getCategories();
  Future<ServiceCategoryItem> getCategoryById(String idOrSlug);
  Future<ServiceSearchResult> searchServices({
    String? query,
    String? categoryId,
    String? pricingModel,
    String? sort,
    int page = 1,
    int limit = 20,
  });
  Future<ServiceItem> getServiceById(String idOrSlug);
}

class CatalogRepository implements ICatalogRepository {
  final ApiClient _apiClient;

  CatalogRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  @override
  Future<List<ServiceCategoryItem>> getCategories() async {
    final response = await _apiClient.get(ApiConstants.categories);
    if (response is List) {
      return response
          .map((item) => ServiceCategoryItem.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  @override
  Future<ServiceCategoryItem> getCategoryById(String idOrSlug) async {
    final response = await _apiClient.get(ApiConstants.categoryById(idOrSlug));
    return ServiceCategoryItem.fromJson(response as Map<String, dynamic>);
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
    final queryParams = <String, dynamic>{
      'page': page,
      'limit': limit,
    };
    if (query != null && query.trim().isNotEmpty) {
      queryParams['query'] = query.trim();
    }
    if (categoryId != null && categoryId.trim().isNotEmpty) {
      queryParams['categoryId'] = categoryId.trim();
    }
    if (pricingModel != null && pricingModel.isNotEmpty) {
      queryParams['pricingModel'] = pricingModel;
    }
    if (sort != null && sort.isNotEmpty) {
      queryParams['sort'] = sort;
    }

    final rawResponse = await _apiClient.dio.get(
      ApiConstants.services,
      queryParameters: queryParams,
    );

    final body = rawResponse.data as Map<String, dynamic>;
    final dataList = (body['data'] as List<dynamic>?) ?? [];
    final services = dataList
        .map((item) => ServiceItem.fromJson(item as Map<String, dynamic>))
        .toList();

    final meta = (body['meta'] as Map<String, dynamic>?) ?? {};
    final total = (meta['total'] as num?)?.toInt() ?? services.length;
    final totalPages = (total / limit).ceil();

    final pagination = CatalogPagination(
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages > 0 ? totalPages : 1,
    );

    return ServiceSearchResult(
      services: services,
      pagination: pagination,
    );
  }

  @override
  Future<ServiceItem> getServiceById(String idOrSlug) async {
    final response = await _apiClient.get(ApiConstants.serviceById(idOrSlug));
    return ServiceItem.fromJson(response as Map<String, dynamic>);
  }
}

final catalogRepositoryProvider = Provider<ICatalogRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return CatalogRepository(apiClient: client);
});
