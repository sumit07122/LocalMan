import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_indicator.dart';
import '../controllers/customer_bookings_provider.dart';

class BookingConfirmationScreen extends ConsumerWidget {
  final String bookingId;

  const BookingConfirmationScreen({
    super.key,
    required this.bookingId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (bookingId.trim().isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Confirmation')),
        body: ErrorView(
          message: 'Invalid booking reference.',
          onRetry: () => context.go('/home'),
          retryLabel: 'Return Home',
        ),
      );
    }

    final bookingAsync = ref.watch(bookingDetailProvider(bookingId));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Booking Request Submitted'),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.close),
            tooltip: 'Home',
            onPressed: () => context.go('/home'),
          ),
        ],
      ),
      body: bookingAsync.when(
        loading: () => const Center(
          child: LoadingIndicator(message: 'Loading booking confirmation...'),
        ),
        error: (err, _) => ErrorView(
          message: 'Could not load booking details: $err',
          onRetry: () => ref.invalidate(bookingDetailProvider(bookingId)),
          retryLabel: 'Retry',
        ),
        data: (booking) {
          final serviceName = booking.serviceSnapshot?.name ?? 'Service Request';
          final addressSummary = booking.addressSnapshot != null
              ? '${booking.addressSnapshot!.addressLine1}, ${booking.addressSnapshot!.city}'
              : 'Service Address';
          final scheduleFormatted = booking.scheduledDate.toLocal().toString().split('.')[0];

          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Top Success Header
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.shade200),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withOpacity(0.12),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.check_circle_rounded,
                          size: 48,
                          color: Color(0xFF10B981),
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Request Submitted!',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.brandPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Booking #${booking.id.length > 8 ? booking.id.substring(0, 8) : booking.id}',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0284C7).withOpacity(0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          'STATUS: ${booking.formattedStatus}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0369A1),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Next Step Notice (Truthful Phase 3C boundary)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.info_outline_rounded, color: Color(0xFF1D4ED8), size: 22),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'What happens next?',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF1E3A8A),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Your request has been submitted. LocalMan will verify requirements and search for an eligible, verified service professional in your area.',
                              style: TextStyle(
                                fontSize: 13,
                                height: 1.4,
                                color: Colors.blue.shade900,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Booking Summary Card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Booking Overview',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.brandPrimary,
                        ),
                      ),
                      const Divider(height: 24),
                      _SummaryRow(
                        icon: Icons.build_outlined,
                        label: 'Service',
                        value: serviceName,
                      ),
                      const SizedBox(height: 12),
                      _SummaryRow(
                        icon: Icons.calendar_today_outlined,
                        label: 'Schedule',
                        value: scheduleFormatted,
                      ),
                      const SizedBox(height: 12),
                      _SummaryRow(
                        icon: Icons.location_on_outlined,
                        label: 'Location',
                        value: addressSummary,
                      ),
                      if (booking.jobDescription != null && booking.jobDescription!.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        _SummaryRow(
                          icon: Icons.notes_outlined,
                          label: 'Notes',
                          value: booking.jobDescription!,
                        ),
                      ],
                      const Divider(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Estimated Total',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.brandPrimary,
                            ),
                          ),
                          Text(
                            booking.displayTotal,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.brandPrimary,
                            ),
                          ),
                        ],
                      ),
                      if (booking.pricingSnapshot?.pricingModel != 'FIXED_PRICE')
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            booking.pricingSnapshot?.pricingModel == 'INSPECTION_QUOTE'
                                ? 'Final price confirmed after on-site inspection.'
                                : 'Final price determined upon job review.',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),

                const SizedBox(height: 28),

                // Actions
                ElevatedButton(
                  onPressed: () => context.go('/booking/${booking.id}'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.brandPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'View Booking Details',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => context.go('/home'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Return to Home',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.brandPrimary,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _SummaryRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: Colors.grey.shade600),
        const SizedBox(width: 10),
        SizedBox(
          width: 70,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey.shade600,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppTheme.brandPrimary,
            ),
          ),
        ),
      ],
    );
  }
}
