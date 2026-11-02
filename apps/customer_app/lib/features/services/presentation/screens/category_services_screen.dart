import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state_view.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_indicator.dart';
import '../../domain/service.dart';
import '../controllers/catalog_providers.dart';

class CategoryServicesScreen extends ConsumerStatefulWidget {
  final String categoryId;

  const CategoryServicesScreen({
    super.key,
    required this.categoryId,
  });

  @override
  ConsumerState<CategoryServicesScreen> createState() =>
      _CategoryServicesScreenState();
}

class _CategoryServicesScreenState
    extends ConsumerState<CategoryServicesScreen> {
  String _searchFilter = '';
  String? _selectedSubcategoryId;

  @override
  Widget build(BuildContext context) {
    final categoryAsync = ref.watch(categoryDetailProvider(widget.categoryId));

    return Scaffold(
      appBar: AppBar(
        title: categoryAsync.maybeWhen(
          data: (category) => Text(category.name),
          orElse: () => const Text('Services'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            tooltip: 'Search Services',
            onPressed: () => context.push('/search'),
          ),
        ],
      ),
      body: categoryAsync.when(
        loading: () => const LoadingIndicator(message: 'Loading services...'),
        error: (error, stack) => ErrorView(
          message: error.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.refresh(categoryDetailProvider(widget.categoryId)),
        ),
        data: (category) {
          final subcategories = category.children;
          final allServices = category.services;

          // Filter services by search text and selected subcategory
          final filteredServices = allServices.where((s) {
            final matchesSearch = _searchFilter.isEmpty ||
                s.name.toLowerCase().contains(_searchFilter.toLowerCase()) ||
                (s.description?.toLowerCase().contains(_searchFilter.toLowerCase()) ?? false);
            final matchesSubcat = _selectedSubcategoryId == null ||
                s.categoryId == _selectedSubcategoryId;
            return matchesSearch && matchesSubcat;
          }).toList();

          return CustomScrollView(
            slivers: [
              // Category Header Banner
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppTheme.deepInk,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: const [
                      BoxShadow(
                        color: Color.fromRGBO(16, 24, 40, 0.08),
                        blurRadius: 12,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppTheme.brandAccent.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.category_outlined,
                              color: AppTheme.brandAccent,
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  category.name,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                if (category.servicesCount > 0)
                                  Text(
                                    '${category.servicesCount} services available',
                                    style: TextStyle(
                                      color: Colors.grey.shade300,
                                      fontSize: 12,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      if (category.description != null &&
                          category.description!.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(
                          category.description!,
                          style: TextStyle(
                            color: Colors.grey.shade300,
                            fontSize: 13,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // Search Filter Bar within category
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0),
                  child: TextField(
                    onChanged: (val) {
                      setState(() {
                        _searchFilter = val.trim();
                      });
                    },
                    decoration: InputDecoration(
                      hintText: 'Filter ${category.name} services...',
                      hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                      prefixIcon: const Icon(Icons.search, size: 20),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade200),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade200),
                      ),
                    ),
                  ),
                ),
              ),

              // Subcategories filter chips (if any exist)
              if (subcategories.isNotEmpty)
                SliverToBoxAdapter(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        FilterChip(
                          selected: _selectedSubcategoryId == null,
                          label: const Text('All'),
                          onSelected: (_) {
                            setState(() {
                              _selectedSubcategoryId = null;
                            });
                          },
                          backgroundColor: Colors.white,
                          selectedColor: AppTheme.brandPrimary,
                          labelStyle: TextStyle(
                            color: _selectedSubcategoryId == null
                                ? Colors.white
                                : AppTheme.brandPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(width: 8),
                        ...subcategories.map((subcat) {
                          final isSelected = _selectedSubcategoryId == subcat.id;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8.0),
                            child: FilterChip(
                              selected: isSelected,
                              label: Text(subcat.name),
                              onSelected: (_) {
                                setState(() {
                                  _selectedSubcategoryId =
                                      isSelected ? null : subcat.id;
                                });
                              },
                              backgroundColor: Colors.white,
                              selectedColor: AppTheme.brandPrimary,
                              labelStyle: TextStyle(
                                color: isSelected
                                    ? Colors.white
                                    : AppTheme.brandPrimary,
                                fontWeight: FontWeight.w600,
                                fontSize: 12,
                              ),
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                ),

              // Services List or Empty State
              if (filteredServices.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: EmptyStateView(
                    icon: Icons.cleaning_services_outlined,
                    title: 'No Services Found',
                    message: _searchFilter.isNotEmpty
                        ? 'No services match "$_searchFilter" in this category.'
                        : 'No services are currently active in this category.',
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final service = filteredServices[index];
                        return _ServiceListCard(service: service);
                      },
                      childCount: filteredServices.length,
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _ServiceListCard extends StatelessWidget {
  final ServiceItem service;

  const _ServiceListCard({required this.service});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      color: Colors.white,
      child: InkWell(
        onTap: () => context.push('/service/${service.id}'),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          service.name,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.brandPrimary,
                          ),
                        ),
                        if (service.description != null &&
                            service.description!.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            service.description!,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey.shade600,
                              height: 1.3,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Icon(
                    Icons.chevron_right,
                    color: Colors.grey,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  // Price Badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: const Color(0xFFA7F3D0),
                      ),
                    ),
                    child: Text(
                      service.pricing.displayPrice,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF047857),
                      ),
                    ),
                  ),

                  // Pricing Model Label
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      service.pricing.pricingModelBadge,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade700,
                      ),
                    ),
                  ),

                  // Estimated Duration
                  if (service.formattedDuration.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.schedule,
                              size: 12, color: Colors.grey.shade600),
                          const SizedBox(width: 4),
                          Text(
                            service.formattedDuration,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Colors.grey.shade700,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
