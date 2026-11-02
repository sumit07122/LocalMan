import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state_view.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../addresses/presentation/controllers/address_provider.dart';
import '../../../auth/presentation/controllers/auth_provider.dart';
import '../../../services/presentation/controllers/catalog_providers.dart';

class CustomerHomeScreen extends ConsumerWidget {
  const CustomerHomeScreen({super.key});

  IconData _getCategoryIcon(String? icon, String slug) {
    if (slug.contains('plumb')) return Icons.plumbing;
    if (slug.contains('electr')) return Icons.bolt;
    if (slug.contains('clean')) return Icons.cleaning_services;
    if (slug.contains('ac') || slug.contains('appliance')) return Icons.ac_unit;
    if (slug.contains('carpen')) return Icons.carpenter;
    if (slug.contains('paint')) return Icons.format_paint;
    if (slug.contains('pest')) return Icons.pest_control;
    if (slug.contains('pack') || slug.contains('mov')) return Icons.local_shipping;
    return Icons.build_outlined;
  }

  Color _getCategoryColor(int index) {
    const colors = [
      Color(0xFF2563EB),
      Color(0xFFD97706),
      Color(0xFF0284C7),
      Color(0xFF0D9488),
      Color(0xFF78350F),
      Color(0xFF16A34A),
      Color(0xFFEA580C),
      Color(0xFF4F46E5),
    ];
    return colors[index % colors.length];
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final addressState = ref.watch(addressProvider);
    final selectedAddress =
        addressState.selectedAddress ?? addressState.defaultAddress;
    final categoriesAsync = ref.watch(categoriesFutureProvider);

    return Scaffold(
      appBar: AppBar(
        title: InkWell(
          onTap: () => context.push('/addresses'),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 2.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.location_on,
                        color: AppTheme.brandAccent, size: 18),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        selectedAddress != null
                            ? '${selectedAddress.label} • ${selectedAddress.city}'
                            : 'Select Delivery Address',
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppTheme.brandPrimary,
                            ),
                      ),
                    ),
                    const Icon(Icons.keyboard_arrow_down,
                        size: 18, color: Colors.grey),
                  ],
                ),
                Text(
                  selectedAddress != null
                      ? selectedAddress.addressLine1
                      : 'Tap to add or choose your address',
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.grey.shade600,
                        fontSize: 12,
                      ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.receipt_long_outlined),
            tooltip: 'My Bookings',
            onPressed: () => context.push('/bookings'),
          ),
          IconButton(
            icon: const Icon(Icons.account_circle_outlined, size: 26),
            tooltip: 'Profile',
            onPressed: () {
              if (authState.isAuthenticated) {
                context.push('/profile');
              } else {
                context.push('/login');
              }
            },
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(categoriesFutureProvider);
          await ref.read(categoriesFutureProvider.future);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Primary Customer Hero Banner: "What do you need done?"
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF0F172A).withOpacity(0.15),
                        blurRadius: 12,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppTheme.brandAccent.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.verified,
                                    color: AppTheme.brandAccent, size: 14),
                                SizedBox(width: 4),
                                Text(
                                  'VERIFIED LOCAL EXPERTS',
                                  style: TextStyle(
                                    color: AppTheme.brandAccent,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'What do you\nneed done?',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          height: 1.15,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Book trusted home service professionals in minutes with upfront pricing and zero hidden fees.',
                        style: TextStyle(
                            color: Colors.grey.shade300,
                            fontSize: 13,
                            height: 1.4),
                      ),
                      const SizedBox(height: 18),

                      // Interactive Search Trigger Bar -> routes to /search
                      InkWell(
                        onTap: () => context.push('/search'),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.search,
                                  color: Colors.grey, size: 22),
                              const SizedBox(width: 10),
                              Text(
                                'Search plumbing, cleaning, AC service...',
                                style: TextStyle(
                                    color: Colors.grey.shade500, fontSize: 14),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // Categories Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Explore Services',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: AppTheme.brandPrimary,
                          ),
                    ),
                    TextButton(
                      onPressed: () => context.push('/search'),
                      child: const Text('All Services'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Authoritative Category Grid from Backend
                categoriesAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32.0),
                    child: Center(
                      child: CircularProgressIndicator(
                        color: AppTheme.brandAccent,
                        strokeWidth: 3,
                      ),
                    ),
                  ),
                  error: (err, _) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16.0),
                    child: ErrorView(
                      message:
                          'Unable to load service categories. Please try again.',
                      onRetry: () => ref.refresh(categoriesFutureProvider),
                    ),
                  ),
                  data: (categories) {
                    if (categories.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 16.0),
                        child: EmptyStateView(
                          icon: Icons.category_outlined,
                          title: 'No Categories Available',
                          message:
                              'Service catalog is being updated. Please check back shortly.',
                        ),
                      );
                    }

                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: categories.length,
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 4,
                        mainAxisSpacing: 14,
                        crossAxisSpacing: 12,
                        childAspectRatio: 0.82,
                      ),
                      itemBuilder: (context, index) {
                        final cat = categories[index];
                        final color = _getCategoryColor(index);
                        final icon = _getCategoryIcon(cat.icon, cat.slug);

                        return InkWell(
                          onTap: () => context.push('/category/${cat.id}'),
                          borderRadius: BorderRadius.circular(14),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: color.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(16),
                                  border:
                                      Border.all(color: color.withOpacity(0.2)),
                                ),
                                child: Icon(
                                  icon,
                                  color: color,
                                  size: 28,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                cat.name,
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.brandPrimary,
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    );
                  },
                ),

                const SizedBox(height: 24),

                // Trust & Safety Highlights
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.shield_outlined,
                              color: AppTheme.brandPrimary, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'The LocalMan Promise',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.brandPrimary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const _PromiseItem(
                        icon: Icons.badge_outlined,
                        title: 'Police & Aadhaar-Verified Pros',
                        desc:
                            'Every service provider is strictly background-verified.',
                      ),
                      const Divider(height: 16),
                      const _PromiseItem(
                        icon: Icons.currency_rupee,
                        title: 'Transparent Pricing Guarantee',
                        desc:
                            'No sudden surges. Material approval requires your direct authorization.',
                      ),
                      const Divider(height: 16),
                      const _PromiseItem(
                        icon: Icons.lock_outline,
                        title: 'Secure OTP-Guarded Job Start',
                        desc:
                            'Job begins only when you share the unique 6-digit start code with the pro.',
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PromiseItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String desc;

  const _PromiseItem({
    required this.icon,
    required this.title,
    required this.desc,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: Colors.grey.shade700),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style:
                    const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 2),
              Text(
                desc,
                style: TextStyle(
                    color: Colors.grey.shade600, fontSize: 12, height: 1.3),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
