import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_indicator.dart';
import '../../../addresses/presentation/controllers/address_provider.dart';
import '../../domain/service.dart';
import '../../domain/service_pricing.dart';
import '../controllers/catalog_providers.dart';

class ServiceDetailScreen extends ConsumerWidget {
  final String serviceId;

  const ServiceDetailScreen({
    super.key,
    required this.serviceId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final serviceAsync = ref.watch(serviceDetailProvider(serviceId));
    final addressState = ref.watch(addressProvider);
    final deliveryAddress =
        addressState.selectedAddress ?? addressState.defaultAddress;

    return Scaffold(
      appBar: AppBar(
        title: serviceAsync.maybeWhen(
          data: (s) => Text(s.name),
          orElse: () => const Text('Service Details'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined),
            tooltip: 'Share',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Service link copied to clipboard'),
                  duration: Duration(seconds: 1),
                ),
              );
            },
          ),
        ],
      ),
      body: serviceAsync.when(
        loading: () =>
            const LoadingIndicator(message: 'Loading service details...'),
        error: (error, stack) => ErrorView(
          message: error.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.refresh(serviceDetailProvider(serviceId)),
        ),
        data: (service) {
          final duration = service.formattedDuration;
          return Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16.0, vertical: 16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Category Tag & Service Title
                      if (service.category != null) ...[
                        GestureDetector(
                          onTap: () => context.push(
                              '/category/${service.category!.id}'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppTheme.brandPrimary.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.category_outlined,
                                  size: 13,
                                  color: AppTheme.brandPrimary,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  service.category?.name ?? '',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.brandPrimary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],

                      Text(
                        service.name,
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.brandPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),

                      const SizedBox(height: 12),

                      // Quick Attributes (Duration & Model Badges)
                      Row(
                        children: [
                          if (duration != null && duration.isNotEmpty) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.schedule,
                                      size: 14, color: Colors.grey.shade700),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Est. $duration',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.grey.shade800,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                          ],
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: AppTheme.brandAccent.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              service.pricing.pricingModelBadge,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFB45309),
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 20),

                      // Authoritative Pricing Breakdown Card
                      _PricingBreakdownCard(pricing: service.pricing),

                      const SizedBox(height: 20),

                      // Service Description
                      if (service.description != null &&
                          service.description!.isNotEmpty) ...[
                        const Text(
                          'Overview',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.brandPrimary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          service.description!,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey.shade700,
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // What is Included & Material Charges Card
                      _ServiceInclusionsCard(service: service),

                      const SizedBox(height: 16),

                      // Delivery Address Context (Phase 3A integration)
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.location_on_outlined,
                              color: AppTheme.brandAccent,
                              size: 20,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    deliveryAddress != null
                                        ? 'Service Address: ${deliveryAddress.label}'
                                        : 'Service Address',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                      color: AppTheme.brandPrimary,
                                    ),
                                  ),
                                  Text(
                                    deliveryAddress != null
                                        ? '${deliveryAddress.addressLine1}, ${deliveryAddress.city}'
                                        : 'Select an address during booking',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            TextButton(
                              onPressed: () => context.push('/addresses'),
                              child: const Text('Change',
                                  style: TextStyle(fontSize: 12)),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),

              // Bottom CTA Bar: Controlled Phase 3C Booking Placeholder
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 10,
                      offset: const Offset(0, -4),
                    ),
                  ],
                ),
                child: SafeArea(
                  top: false,
                  child: Row(
                    children: [
                      // Pricing summary on bottom bar
                      Expanded(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Total Price',
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            Text(
                              service.pricing.displayPrice,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: AppTheme.brandPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Booking CTA (Phase 3C Customer Booking Flow)
                      ElevatedButton(
                        onPressed: () {
                          context.push('/book-service?serviceId=${service.id}');
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.brandAccent,
                          foregroundColor: AppTheme.brandPrimary,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 24, vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Book Service',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                              ),
                            ),
                            SizedBox(width: 6),
                            Icon(Icons.arrow_forward, size: 18),
                          ],
                        ),
                      ),
                    ],
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

class _PricingBreakdownCard extends StatelessWidget {
  final ServicePricing pricing;

  const _PricingBreakdownCard({required this.pricing});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Pricing Details',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.brandPrimary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.brandPrimary.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  pricing.pricingModelBadge,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.brandPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Big Price Display
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                pricing.displayPrice,
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.brandPrimary,
                ),
              ),
              if (pricing.pricingModel == 'HOURLY') ...[
                const SizedBox(width: 4),
                Text(
                  ' billed per recorded hour',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ],
          ),

          const SizedBox(height: 8),

          // Authoritative Explanation of the Pricing Model
          Text(
            pricing.explanation,
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey.shade700,
              height: 1.4,
            ),
          ),

          // Inspection Fee note if applicable
          if (pricing.pricingModel == 'INSPECTION_QUOTE' &&
              pricing.inspectionFeePaisa != null &&
              pricing.inspectionFeePaisa! > 0) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, size: 14, color: Colors.amber.shade900),
                  const SizedBox(width: 6),
                  Text(
                    'Visiting / Inspection fee: ₹${(pricing.inspectionFeePaisa! / 100).toStringAsFixed(0)}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.amber.shade900,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ServiceInclusionsCard extends StatelessWidget {
  final ServiceItem service;

  const _ServiceInclusionsCard({required this.service});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'What is Included',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppTheme.brandPrimary,
            ),
          ),
          const SizedBox(height: 10),
          _InclusionRow(
            icon: Icons.check_circle_outline,
            iconColor: Colors.green.shade600,
            title: 'Verified Local Professional',
            description: 'Police & Aadhaar-verified background checked expert.',
          ),
          const SizedBox(height: 8),
          _InclusionRow(
            icon: Icons.check_circle_outline,
            iconColor: Colors.green.shade600,
            title: 'Standard Service Execution',
            description: 'Complete inspection and execution of the requested service.',
          ),
          const SizedBox(height: 8),
          _InclusionRow(
            icon: Icons.check_circle_outline,
            iconColor: Colors.green.shade600,
            title: 'Job Start Protection',
            description: 'Work only begins after you share the secure 6-digit start code.',
          ),
          const Divider(height: 24),
          const Text(
            'Materials & Additional Work',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.brandPrimary,
            ),
          ),
          const SizedBox(height: 8),
          _InclusionRow(
            icon: Icons.info_outline,
            iconColor: Colors.orange.shade700,
            title: 'Replacement Parts & Materials',
            description:
                'Spare parts or supplies are not included in service labor and require your explicit in-app approval before purchase.',
          ),
        ],
      ),
    );
  }
}

class _InclusionRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String description;

  const _InclusionRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: iconColor),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: AppTheme.brandPrimary,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                description,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
