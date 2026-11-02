import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state_view.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_indicator.dart';
import '../../domain/service.dart';
import '../controllers/catalog_providers.dart';
import '../controllers/service_search_controller.dart';

class ServiceSearchScreen extends ConsumerStatefulWidget {
  final String? initialCategoryId;

  const ServiceSearchScreen({
    super.key,
    this.initialCategoryId,
  });

  @override
  ConsumerState<ServiceSearchScreen> createState() =>
      _ServiceSearchScreenState();
}

class _ServiceSearchScreenState extends ConsumerState<ServiceSearchScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    if (widget.initialCategoryId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref
            .read(serviceSearchProvider.notifier)
            .setCategory(widget.initialCategoryId);
      });
    }

    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(serviceSearchProvider.notifier).loadMore();
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final searchState = ref.watch(serviceSearchProvider);
    final searchNotifier = ref.read(serviceSearchProvider.notifier);
    final categoriesAsync = ref.watch(categoriesFutureProvider);

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _textController,
          autofocus: true,
          onChanged: searchNotifier.onQueryChanged,
          decoration: InputDecoration(
            hintText: 'Search plumbing, AC, electrical...',
            hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 15),
            border: InputBorder.none,
            suffixIcon: _textController.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, size: 18),
                    onPressed: () {
                      _textController.clear();
                      searchNotifier.onQueryChanged('');
                    },
                  )
                : null,
          ),
          style: const TextStyle(
            fontSize: 16,
            color: AppTheme.brandPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: Column(
        children: [
          // Filter Chips Section: Category & Pricing Model
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Category Filter Chips
                categoriesAsync.when(
                  data: (categories) => SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: [
                        FilterChip(
                          selected: searchState.categoryId == null,
                          label: const Text('All Categories'),
                          onSelected: (_) => searchNotifier.setCategory(null),
                          backgroundColor: Colors.grey.shade100,
                          selectedColor: AppTheme.brandPrimary,
                          labelStyle: TextStyle(
                            color: searchState.categoryId == null
                                ? Colors.white
                                : AppTheme.brandPrimary,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 8),
                        ...categories.map((cat) {
                          final isSelected = searchState.categoryId == cat.id;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8.0),
                            child: FilterChip(
                              selected: isSelected,
                              label: Text(cat.name),
                              onSelected: (_) => searchNotifier.setCategory(
                                isSelected ? null : cat.id,
                              ),
                              backgroundColor: Colors.grey.shade100,
                              selectedColor: AppTheme.brandPrimary,
                              labelStyle: TextStyle(
                                color: isSelected
                                    ? Colors.white
                                    : AppTheme.brandPrimary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                ),

                const SizedBox(height: 6),

                // Pricing Model Quick Filters
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      _PricingModelChip(
                        label: 'All Pricing',
                        isSelected: searchState.pricingModel == null,
                        onTap: () => searchNotifier.setPricingModel(null),
                      ),
                      const SizedBox(width: 6),
                      _PricingModelChip(
                        label: 'Fixed Price',
                        isSelected: searchState.pricingModel == 'FIXED_PRICE',
                        onTap: () => searchNotifier.setPricingModel(
                          searchState.pricingModel == 'FIXED_PRICE'
                              ? null
                              : 'FIXED_PRICE',
                        ),
                      ),
                      const SizedBox(width: 6),
                      _PricingModelChip(
                        label: 'Hourly Rate',
                        isSelected: searchState.pricingModel == 'HOURLY',
                        onTap: () => searchNotifier.setPricingModel(
                          searchState.pricingModel == 'HOURLY' ? null : 'HOURLY',
                        ),
                      ),
                      const SizedBox(width: 6),
                      _PricingModelChip(
                        label: 'Inspection Quote',
                        isSelected:
                            searchState.pricingModel == 'INSPECTION_QUOTE',
                        onTap: () => searchNotifier.setPricingModel(
                          searchState.pricingModel == 'INSPECTION_QUOTE'
                              ? null
                              : 'INSPECTION_QUOTE',
                        ),
                      ),
                      const SizedBox(width: 6),
                      _PricingModelChip(
                        label: 'Custom Quote',
                        isSelected:
                            searchState.pricingModel == 'CUSTOM_QUOTE',
                        onTap: () => searchNotifier.setPricingModel(
                          searchState.pricingModel == 'CUSTOM_QUOTE'
                              ? null
                              : 'CUSTOM_QUOTE',
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1, thickness: 1),

          // Search Results View
          Expanded(
            child: _buildResultsView(searchState, searchNotifier),
          ),
        ],
      ),
    );
  }

  Widget _buildResultsView(
    ServiceSearchState state,
    ServiceSearchNotifier notifier,
  ) {
    if (state.isLoading) {
      return const LoadingIndicator(message: 'Searching services...');
    }

    if (state.errorMessage != null) {
      return ErrorView(
        message: state.errorMessage!,
        onRetry: notifier.refresh,
      );
    }

    if (state.isEmpty) {
      return EmptyStateView(
        icon: Icons.search_off_rounded,
        title: 'No Services Found',
        message: state.query.isNotEmpty
            ? 'No services match "${state.query}". Try a different keyword or filter.'
            : 'No services match the selected filters.',
      );
    }

    return RefreshIndicator(
      onRefresh: notifier.refresh,
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        itemCount: state.services.length + (state.isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == state.services.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            );
          }

          final service = state.services[index];
          return _SearchResultCard(service: service);
        },
      ),
    );
  }
}

class _PricingModelChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _PricingModelChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.brandAccent.withOpacity(0.2)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? AppTheme.brandAccent : Colors.grey.shade300,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? const Color(0xFFB45309) : Colors.grey.shade700,
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _SearchResultCard extends StatelessWidget {
  final ServiceItem service;

  const _SearchResultCard({required this.service});

  @override
  Widget build(BuildContext context) {
    final description = service.description;
    final duration = service.formattedDuration;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      color: Colors.white,
      child: InkWell(
        onTap: () => context.push('/service/${service.id}'),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
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
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.brandPrimary,
                          ),
                        ),
                        if (description != null && description.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            description,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                              height: 1.3,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  // Price Badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(6),
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
                  // Model Badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      service.pricing.pricingModelBadge,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade700,
                      ),
                    ),
                  ),
                  if (duration != null && duration.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        duration,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Colors.grey.shade700,
                        ),
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
