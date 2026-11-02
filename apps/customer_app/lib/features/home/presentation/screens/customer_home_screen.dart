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
    final s = slug.toLowerCase();
    if (s.contains('plumb')) return Icons.plumbing_outlined;
    if (s.contains('electr')) return Icons.bolt_outlined;
    if (s.contains('clean')) return Icons.cleaning_services_outlined;
    if (s.contains('ac') || s.contains('appliance')) return Icons.ac_unit_outlined;
    if (s.contains('carpen')) return Icons.carpenter_outlined;
    if (s.contains('paint')) return Icons.format_paint_outlined;
    if (s.contains('pest')) return Icons.pest_control_outlined;
    if (s.contains('pack') || s.contains('mov')) return Icons.local_shipping_outlined;
    return Icons.handyman_outlined;
  }

  Color _getCategoryColor(int index) {
    const colors = [
      Color(0xFF315EFB), // Primary Blue
      Color(0xFF12A879), // Success Emerald
      Color(0xFFF5A524), // Amber Warmth
      Color(0xFF8B5CF6), // Royal Purple
      Color(0xFF0EA5E9), // Sky Blue
      Color(0xFFEC4899), // Pink
      Color(0xFF10B981), // Mint
      Color(0xFF6366F1), // Indigo
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
      backgroundColor: AppTheme.softBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        title: InkWell(
          onTap: () => context.push('/addresses'),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 2.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.near_me_outlined,
                      color: AppTheme.primaryBlue,
                      size: 15,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        selectedAddress != null
                            ? '${selectedAddress.label} • ${selectedAddress.city}'
                            : 'Select Service Location',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.primaryText,
                          letterSpacing: -0.01,
                        ),
                      ),
                    ),
                    const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 18,
                      color: AppTheme.secondaryText,
                    ),
                  ],
                ),
                Text(
                  selectedAddress != null
                      ? selectedAddress.addressLine1
                      : 'Connaught Place, New Delhi',
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppTheme.secondaryText,
                    fontSize: 11,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.receipt_long_outlined, size: 22),
            tooltip: 'My Bookings',
            onPressed: () => context.push('/bookings'),
          ),
          IconButton(
            icon: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: authState.isAuthenticated ? AppTheme.primaryBlue : Colors.grey.shade200,
              ),
              child: Icon(
                Icons.person_outline,
                size: 18,
                color: authState.isAuthenticated ? Colors.white : AppTheme.secondaryText,
              ),
            ),
            tooltip: 'Profile',
            onPressed: () {
              if (authState.isAuthenticated) {
                context.push('/profile');
              } else {
                context.push('/login');
              }
            },
          ),
          const SizedBox(width: 6),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: 0,
        onTap: (index) {
          if (index == 0) return;
          if (index == 1) context.push('/search');
          if (index == 2) context.push('/bookings');
          if (index == 3) context.push('/support');
          if (index == 4) {
            if (authState.isAuthenticated) {
              context.push('/profile');
            } else {
              context.push('/login');
            }
          }
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_filled),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.search),
            label: 'Search',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.calendar_month_outlined),
            label: 'Bookings',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.headset_mic_outlined),
            label: 'Support',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            label: 'Profile',
          ),
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
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. HERO SEARCH BANNER
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppTheme.deepInk,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: const [
                      BoxShadow(
                        color: Color.fromRGBO(16, 24, 40, 0.08),
                        blurRadius: 16,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Verified Tag
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.verified, color: AppTheme.primaryBlue, size: 14),
                                SizedBox(width: 5),
                                Text(
                                  'VERIFIED HOME PROFESSIONALS',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'What do you\nneed done today?',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          height: 1.2,
                          letterSpacing: -0.02,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Upfront pricing, certified technicians & 6-digit OTP security.',
                        style: TextStyle(
                          color: Color(0xFFD0D5DD),
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Interactive Search Field -> /search
                      InkWell(
                        onTap: () => context.push('/search'),
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.search, color: AppTheme.primaryBlue, size: 20),
                              SizedBox(width: 10),
                              Text(
                                'Search plumbing, AC repair, cleaning...',
                                style: TextStyle(
                                  color: AppTheme.secondaryText,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w400,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 14),

                // 2. EMERGENCY RAPID REPAIR SHORTCUT
                InkWell(
                  onTap: () => context.push('/search'),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.bolt, color: AppTheme.warningAmber, size: 20),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '⚡ 30-Min Rapid Response for pipe bursts & power trips',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF92400E),
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, size: 12, color: Color(0xFFB45309)),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 22),

                // 3. EXPLORE CATEGORIES HEADER
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Explore Services',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.primaryText,
                        letterSpacing: -0.02,
                      ),
                    ),
                    TextButton(
                      onPressed: () => context.push('/search'),
                      style: TextButton.styleFrom(
                        foregroundColor: AppTheme.primaryBlue,
                        padding: EdgeInsets.zero,
                        visualDensity: VisualDensity.compact,
                      ),
                      child: const Row(
                        children: [
                          Text(
                            'View All',
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          Icon(Icons.chevron_right, size: 16),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Authoritative Category Grid from Backend
                categoriesAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 36.0),
                    child: Center(
                      child: CircularProgressIndicator(
                        color: AppTheme.primaryBlue,
                        strokeWidth: 2.5,
                      ),
                    ),
                  ),
                  error: (err, _) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16.0),
                    child: ErrorView(
                      message: 'Unable to load service categories. Tap below to retry.',
                      onRetry: () => ref.refresh(categoriesFutureProvider),
                    ),
                  ),
                  data: (categories) {
                    if (categories.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 20.0),
                        child: EmptyStateView(
                          icon: Icons.category_outlined,
                          title: 'No Categories Available',
                          message: 'Service catalog is being updated. Please check back shortly.',
                        ),
                      );
                    }

                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: categories.length,
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 4,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 10,
                        childAspectRatio: 0.82,
                      ),
                      itemBuilder: (context, index) {
                        final cat = categories[index];
                        final color = _getCategoryColor(index);
                        final icon = _getCategoryIcon(cat.icon, cat.slug);

                        return InkWell(
                          onTap: () => context.push('/category/${cat.id}'),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppTheme.subtleBorder),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: color.withOpacity(0.08),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Icon(icon, color: color, size: 24),
                                ),
                                const SizedBox(height: 6),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 4.0),
                                  child: Text(
                                    cat.name,
                                    textAlign: TextAlign.center,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: AppTheme.primaryText,
                                      height: 1.2,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),

                const SizedBox(height: 24),

                // 4. POPULAR PACKAGES
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Popular Near You',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.primaryText,
                        letterSpacing: -0.02,
                      ),
                    ),
                    TextButton(
                      onPressed: () => context.push('/search'),
                      child: const Text('See All', style: TextStyle(color: AppTheme.primaryBlue, fontSize: 13)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Curated Service Cards
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _PopularServiceCard(
                        title: 'AC Deep Jet Wash',
                        category: 'AC Care',
                        price: '₹499',
                        rating: '4.8 ★',
                        onTap: () => context.push('/search'),
                      ),
                      const SizedBox(width: 12),
                      _PopularServiceCard(
                        title: 'Master Electrician',
                        category: 'Electrical',
                        price: '₹149/hr',
                        rating: '4.9 ★',
                        onTap: () => context.push('/search'),
                      ),
                      const SizedBox(width: 12),
                      _PopularServiceCard(
                        title: 'Leak Repair & Pipe',
                        category: 'Plumbing',
                        price: '₹199 onwards',
                        rating: '4.7 ★',
                        onTap: () => context.push('/search'),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // 5. LOCALMAN SAFETY GUARANTEE
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppTheme.subtleBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.shield_outlined, color: AppTheme.primaryBlue, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'The LocalMan Trust Guarantee',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.primaryText,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      const _TrustItem(
                        icon: Icons.verified_user_outlined,
                        title: 'Police & Aadhaar-Verified Pros',
                        desc: 'Every service partner undergoes 3-step KYC verification.',
                      ),
                      Divider(height: 18, color: Colors.grey.shade100),
                      const _TrustItem(
                        icon: Icons.currency_rupee_outlined,
                        title: 'Transparent Upfront Pricing',
                        desc: 'Standardized rate cards. No surprise surge charges.',
                      ),
                      Divider(height: 18, color: Colors.grey.shade100),
                      const _TrustItem(
                        icon: Icons.pin_outlined,
                        title: 'Secure OTP Handover',
                        desc: 'Job commences only after you give the 6-digit start code.',
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PopularServiceCard extends StatelessWidget {
  final String title;
  final String category;
  final String price;
  final String rating;
  final VoidCallback onTap;

  const _PopularServiceCard({
    required this.title,
    required this.category,
    required this.price,
    required this.rating,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 170,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.subtleBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryBlue.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    category,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primaryBlue,
                    ),
                  ),
                ),
                Text(
                  rating,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFD97706),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppTheme.primaryText,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              price,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: AppTheme.successGreen,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TrustItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String desc;

  const _TrustItem({
    required this.icon,
    required this.title,
    required this.desc,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppTheme.primaryBlue),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: AppTheme.primaryText,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                desc,
                style: const TextStyle(
                  color: AppTheme.secondaryText,
                  fontSize: 11,
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
