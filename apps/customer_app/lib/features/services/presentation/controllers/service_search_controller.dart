import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/catalog_repository.dart';
import '../../domain/catalog_pagination.dart';
import '../../domain/service.dart';

class ServiceSearchState {
  final String query;
  final String? categoryId;
  final String? pricingModel;
  final String sortBy;
  final bool isLoading;
  final bool isLoadingMore;
  final List<ServiceItem> services;
  final CatalogPagination? pagination;
  final String? errorMessage;

  const ServiceSearchState({
    this.query = '',
    this.categoryId,
    this.pricingModel,
    this.sortBy = 'name_asc',
    this.isLoading = false,
    this.isLoadingMore = false,
    this.services = const [],
    this.pagination,
    this.errorMessage,
  });

  bool get hasMore =>
      pagination != null && pagination!.page < pagination!.totalPages;

  bool get isEmpty => !isLoading && services.isEmpty && errorMessage == null;

  ServiceSearchState copyWith({
    String? query,
    String? categoryId,
    bool clearCategory = false,
    String? pricingModel,
    bool clearPricingModel = false,
    String? sortBy,
    bool? isLoading,
    bool? isLoadingMore,
    List<ServiceItem>? services,
    CatalogPagination? pagination,
    String? errorMessage,
  }) {
    return ServiceSearchState(
      query: query ?? this.query,
      categoryId: clearCategory ? null : (categoryId ?? this.categoryId),
      pricingModel:
          clearPricingModel ? null : (pricingModel ?? this.pricingModel),
      sortBy: sortBy ?? this.sortBy,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      services: services ?? this.services,
      pagination: pagination ?? this.pagination,
      errorMessage: errorMessage,
    );
  }
}

class ServiceSearchNotifier extends StateNotifier<ServiceSearchState> {
  final ICatalogRepository _repository;
  Timer? _debounceTimer;
  int _latestRequestId = 0;

  ServiceSearchNotifier({required ICatalogRepository repository})
      : _repository = repository,
        super(const ServiceSearchState()) {
    // Initial fetch of active services
    search();
  }

  void onQueryChanged(String newQuery) {
    if (newQuery == state.query) return;

    _debounceTimer?.cancel();
    state = state.copyWith(query: newQuery);

    _debounceTimer = Timer(const Duration(milliseconds: 350), () {
      search();
    });
  }

  void setCategory(String? categoryId) {
    if (categoryId == state.categoryId) return;
    state = state.copyWith(
      categoryId: categoryId,
      clearCategory: categoryId == null,
    );
    search();
  }

  void setPricingModel(String? pricingModel) {
    if (pricingModel == state.pricingModel) return;
    state = state.copyWith(
      pricingModel: pricingModel,
      clearPricingModel: pricingModel == null,
    );
    search();
  }

  void setSortBy(String sortBy) {
    if (sortBy == state.sortBy) return;
    state = state.copyWith(sortBy: sortBy);
    search();
  }

  Future<void> search({int page = 1}) async {
    final requestId = ++_latestRequestId;

    state = state.copyWith(
      isLoading: page == 1,
      isLoadingMore: page > 1,
      errorMessage: null,
    );

    try {
      final result = await _repository.searchServices(
        query: state.query.trim().isEmpty ? null : state.query.trim(),
        categoryId: state.categoryId,
        pricingModel: state.pricingModel,
        sort: state.sortBy,
        page: page,
        limit: 20,
      );

      // Protect against out-of-order stale responses
      if (requestId != _latestRequestId) return;

      final updatedServices = page == 1
          ? result.services
          : [...state.services, ...result.services];

      state = state.copyWith(
        isLoading: false,
        isLoadingMore: false,
        services: updatedServices,
        pagination: result.pagination,
        errorMessage: null,
      );
    } catch (e) {
      if (requestId != _latestRequestId) return;

      state = state.copyWith(
        isLoading: false,
        isLoadingMore: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> loadMore() async {
    if (state.isLoading || state.isLoadingMore || !state.hasMore) return;
    final nextPage = (state.pagination?.page ?? 1) + 1;
    await search(page: nextPage);
  }

  Future<void> refresh() async {
    await search(page: 1);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    super.dispose();
  }
}

final serviceSearchProvider =
    StateNotifierProvider<ServiceSearchNotifier, ServiceSearchState>((ref) {
  final repo = ref.watch(catalogRepositoryProvider);
  return ServiceSearchNotifier(repository: repo);
});
