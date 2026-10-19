import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state_view.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_indicator.dart';
import '../../domain/booking_item.dart';
import '../controllers/customer_bookings_provider.dart';

class BookingsListScreen extends ConsumerWidget {
  const BookingsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookingsAsync = ref.watch(customerBookingsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('My Bookings'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(customerBookingsProvider),
          ),
        ],
      ),
      body: bookingsAsync.when(
        loading: () => const Center(
          child: LoadingIndicator(message: 'Loading your bookings...'),
        ),
        error: (err, _) => ErrorView(
          message: 'Unable to load bookings: $err',
          onRetry: () => ref.invalidate(customerBookingsProvider),
          retryLabel: 'Try Again',
        ),
        data: (result) {
          final bookings = result.items;
          if (bookings.isEmpty) {
            return EmptyStateView(
              icon: Icons.receipt_long_outlined,
              title: 'No bookings yet',
              message: 'You have not booked any services yet. What do you need done around the home today?',
              actionLabel: 'Explore Services',
              onAction: () => context.go('/home'),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(customerBookingsProvider);
            },
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              itemCount: bookings.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final booking = bookings[index];
                return _BookingCard(
                  booking: booking,
                  onTap: () => context.push('/booking/${booking.id}'),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _BookingCard extends StatelessWidget {
  final BookingItem booking;
  final VoidCallback onTap;

  const _BookingCard({
    required this.booking,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final serviceName = booking.serviceSnapshot?.name ?? 'Service Booking';
    final addressLine = booking.addressSnapshot != null
        ? '${booking.addressSnapshot!.city}, ${booking.addressSnapshot!.postalCode}'
        : 'Address specified';
    final dateFormatted = booking.scheduledDate.toLocal().toString().split(' ')[0];

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    serviceName,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.brandPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: booking.statusBackgroundColor,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    booking.formattedStatus,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: booking.statusForegroundColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Booking #${booking.id.length > 8 ? booking.id.substring(0, 8) : booking.id}',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade500,
                fontFamily: 'monospace',
              ),
            ),
            const Divider(height: 20),
            Row(
              children: [
                Icon(Icons.calendar_today_outlined, size: 14, color: Colors.grey.shade600),
                const SizedBox(width: 6),
                Text(
                  dateFormatted,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
                ),
                const SizedBox(width: 16),
                Icon(Icons.location_on_outlined, size: 14, color: Colors.grey.shade600),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    addressLine,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  booking.displayTotal,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.brandPrimary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
