import 'service.dart';

class CatalogPagination {
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  const CatalogPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  bool get hasMore => page < totalPages;
  int get totalItems => total;

  factory CatalogPagination.fromJson(Map<String, dynamic> json) {
    return CatalogPagination(
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 20,
      total: (json['total'] as num?)?.toInt() ??
          (json['totalItems'] as num?)?.toInt() ??
          0,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
    );
  }

  Map<String, dynamic> toJson() => {
    'page': page,
    'limit': limit,
    'total': total,
    'totalPages': totalPages,
  };
}

class ServiceSearchResult {
  final List<ServiceItem> services;
  final CatalogPagination pagination;

  const ServiceSearchResult({
    required this.services,
    required this.pagination,
  });
}
