import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/catalog_repository.dart';
import '../../domain/category.dart';
import '../../domain/service.dart';

/// Provider for the list of active service categories (root categories with subcategories)
final categoriesFutureProvider = FutureProvider<List<ServiceCategoryItem>>((ref) async {
  final repo = ref.watch(catalogRepositoryProvider);
  return repo.getCategories();
});

/// Provider for a specific category detail (including active services) by ID or slug
final categoryDetailProvider = FutureProvider.family<ServiceCategoryItem, String>((ref, idOrSlug) async {
  final repo = ref.watch(catalogRepositoryProvider);
  return repo.getCategoryById(idOrSlug);
});

/// Provider for a specific service detail by ID or slug
final serviceDetailProvider = FutureProvider.family<ServiceItem, String>((ref, idOrSlug) async {
  final repo = ref.watch(catalogRepositoryProvider);
  return repo.getServiceById(idOrSlug);
});
