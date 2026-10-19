import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_indicator.dart';
import '../../data/booking_realtime_service.dart';
import '../../data/booking_repository.dart';
import '../../domain/booking_item.dart';
import '../../domain/payment_models.dart';
import '../controllers/customer_bookings_provider.dart';
import 'booking_chat_screen.dart';

class BookingDetailsScreen extends ConsumerStatefulWidget {
  final String bookingId;

  const BookingDetailsScreen({
    super.key,
    required this.bookingId,
  });

  @override
  ConsumerState<BookingDetailsScreen> createState() => _BookingDetailsScreenState();
}

class _BookingDetailsScreenState extends ConsumerState<BookingDetailsScreen> {
  bool _isProcessingPayment = false;
  String? _paymentErrorMessage;
  PaymentSummary? _paymentSummary;
  bool _isLoadingSummary = false;
  @override
  Widget build(BuildContext context) {
    if (widget.bookingId.trim().isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Booking Details')),
        body: ErrorView(
          message: 'Invalid booking identifier provided.',
          onRetry: () => context.go('/bookings'),
          retryLabel: 'Back to Bookings',
        ),
      );
    }

    // Connect to SSE stream for live updates.
    // Safe reconciliation rule: Realtime is notification only.
    // When an event arrives, invalidate the detail provider to fetch authoritative backend state.
    ref.listen<AsyncValue<BookingRealtimeEvent>>(
      bookingStreamProvider(widget.bookingId),
      (previous, next) {
        next.whenData((event) {
          debugPrint('[BookingDetails] Received realtime event: ${event.type}. Reconciling with backend...');
          ref.invalidate(bookingDetailProvider(widget.bookingId));
        });
      },
    );

    final bookingAsync = ref.watch(bookingDetailProvider(widget.bookingId));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'Booking #${widget.bookingId.length > 8 ? widget.bookingId.substring(0, 8) : widget.bookingId}',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.chat_bubble_outline),
            tooltip: 'Chat with Provider',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => BookingChatScreen(
                    bookingId: widget.bookingId,
                  ),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(bookingDetailProvider(widget.bookingId)),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          return ref.refresh(bookingDetailProvider(widget.bookingId).future).then((_) {});
        },
        child: bookingAsync.when(
          loading: () => const Center(
            child: LoadingIndicator(message: 'Loading booking information...'),
          ),
          error: (err, _) => ErrorView(
            message: 'Unable to retrieve booking details: $err',
            onRetry: () => ref.invalidate(bookingDetailProvider(widget.bookingId)),
            retryLabel: 'Retry',
          ),
          data: (booking) => _buildBookingContent(context, booking),
        ),
      ),
    );
  }

  Widget _buildBookingContent(BuildContext context, BookingItem booking) {
    final serviceName = booking.serviceSnapshot?.name ?? 'Service';
    final scheduleFormatted = '${booking.scheduledDate} (${booking.scheduledTimeSlot})';

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Status Header Card
          _buildStatusHeaderCard(booking),

          const SizedBox(height: 16),

          // 2. Dispatch / Matching State Card OR Assigned Provider Card
          if (booking.isSearchingForProvider)
            _buildSearchingCard(booking)
          else if (booking.isProviderAssigned && booking.assignedProvider != null)
            _buildAssignedProviderCard(booking.assignedProvider!)
          else if (booking.isProviderAssigned)
            _buildAssignedProviderFallbackCard(),

          const SizedBox(height: 16),

          // 3. Start OTP Security Card (show only prior to JOB_STARTED)
          if (booking.startOtp != null &&
              booking.startOtp!.isNotEmpty &&
              (booking.currentStatus == 'CONFIRMED' ||
                  booking.currentStatus == 'PROVIDER_ACCEPTED' ||
                  booking.currentStatus == 'PROVIDER_ON_THE_WAY' ||
                  booking.currentStatus == 'ARRIVED')) ...[
            _buildStartOtpCard(booking.startOtp!),
            const SizedBox(height: 16),
          ],

          // 4. Authoritative Timeline Card
          _buildTimelineCard(booking),

          const SizedBox(height: 16),

          // 5. Service & Schedule Card
          _buildServiceDetailsCard(booking, serviceName, scheduleFormatted),

          const SizedBox(height: 16),

          // 6. Address Snapshot Card
          _buildAddressSnapshotCard(booking),

          const SizedBox(height: 16),

          // 7. Customer Payment & Settlement Card (Phase 3F)
          _buildPaymentCard(booking),

          const SizedBox(height: 16),

          // 8. Authoritative Price Breakdown Card
          _buildPricingCard(booking),

          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Future<void> _handlePayNow(BookingItem booking) async {
    setState(() {
      _isProcessingPayment = true;
      _paymentErrorMessage = null;
    });

    try {
      final repo = ref.read(bookingRepositoryProvider);
      final checkout = await repo.createPaymentCheckout(
        booking.id,
        idempotencyKey: 'cust_pay_${booking.id}_${DateTime.now().millisecondsSinceEpoch}',
      );

      // Verify payment with gateway mock/signature
      final verified = await repo.verifyPayment(
        bookingId: booking.id,
        paymentId: checkout.paymentId,
        gatewayOrderId: checkout.gatewayOrderId,
        gatewayPaymentId: 'pay_mock_${DateTime.now().millisecondsSinceEpoch}',
        gatewaySignature: 'sig_mock_valid',
      );

      if (verified) {
        // Authoritative reconciliation: Refresh server booking state
        ref.invalidate(bookingDetailProvider(widget.bookingId));
        // Fetch server-authoritative payment summary
        try {
          final summary = await repo.getPaymentSummary(booking.id);
          if (mounted) {
            setState(() {
              _paymentSummary = summary;
            });
          }
        } catch (_) {}
      } else {
        if (mounted) {
          setState(() {
            _paymentErrorMessage = 'Payment verification could not be confirmed by gateway.';
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _paymentErrorMessage = 'Payment Failed — Try Again: ${e.toString()}';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isProcessingPayment = false;
        });
      }
    }
  }

  Widget _buildPaymentCard(BookingItem booking) {
    final isPayable = booking.currentStatus == 'JOB_COMPLETED' ||
        booking.currentStatus == 'PAYMENT_PENDING';
    final isSettled = booking.currentStatus == 'PAYMENT_SETTLED';

    if (!isPayable && !isSettled) {
      return const SizedBox.shrink();
    }

    if (isSettled) {
      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFBBF7D0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    color: Color(0xFF16A34A),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Payment Successful',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF15803D),
                        ),
                      ),
                      Text(
                        'Settled & server-verified. Thank you!',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF166534),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'PAID',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF15803D),
                    ),
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Amount Paid',
                  style: TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.w600),
                ),
                Text(
                  booking.displayTotal,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF15803D),
                  ),
                ),
              ],
            ),
            if (_paymentSummary != null) ...[
              const SizedBox(height: 12),
              ..._paymentSummary!.items.map((item) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      item.description,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                    ),
                    Text(
                      '₹${(item.amountPaisa / 100).toStringAsFixed(2)}',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade800),
                    ),
                  ],
                ),
              )),
              if (_paymentSummary!.gatewayPaymentId != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Ref: ${_paymentSummary!.gatewayPaymentId}',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                ),
              ],
            ] else ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                icon: const Icon(Icons.receipt_long, size: 16),
                label: Text(_isLoadingSummary ? 'Loading...' : 'View Payment Receipt'),
                onPressed: _isLoadingSummary ? null : () async {
                  setState(() => _isLoadingSummary = true);
                  try {
                    final summary = await ref.read(bookingRepositoryProvider).getPaymentSummary(booking.id);
                    if (mounted) setState(() => _paymentSummary = summary);
                  } catch (_) {}
                  if (mounted) setState(() => _isLoadingSummary = false);
                },
              ),
            ],
          ],
        ),
      );
    }

    // isPayable (JOB_COMPLETED or PAYMENT_PENDING)
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF6366F1).withOpacity(0.4)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6366F1).withOpacity(0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFF4F46E5).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.payment, color: Color(0xFF4F46E5), size: 20),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Service Completed',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1E1B4B),
                      ),
                    ),
                    Text(
                      'Payment is now due for completed work.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'PENDING',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFD97706),
                  ),
                ),
              ),
            ],
          ),
          const Divider(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Total Payable Amount',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF374151)),
              ),
              Text(
                booking.displayTotal,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1E1B4B),
                ),
              ),
            ],
          ),
          if (_paymentErrorMessage != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, size: 16, color: Color(0xFFDC2626)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _paymentErrorMessage!,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFDC2626),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          if (_isProcessingPayment)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  ),
                  SizedBox(width: 12),
                  Text(
                    'Payment Processing...',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF374151),
                    ),
                  ),
                ],
              ),
            )
          else
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 2,
              ),
              onPressed: () => _handlePayNow(booking),
              child: Text(
                _paymentErrorMessage != null ? 'Payment Failed — Try Again' : 'Pay Now',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStatusHeaderCard(BookingItem booking) {
    return Container(
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
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Current Status',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                booking.formattedStatus,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: booking.statusForegroundColor,
                ),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: booking.statusBackgroundColor,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              booking.currentStatus,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: booking.statusForegroundColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchingCard(BookingItem booking) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFFEFF6FF),
            Colors.blue.shade50.withOpacity(0.8),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFF2563EB),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Finding a verified professional',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1E3A8A),
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Matching with top-rated, KYC-verified partners...',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF3B82F6),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.9),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFDBEAFE)),
            ),
            child: Row(
              children: [
                const Icon(Icons.shield_outlined, size: 16, color: Color(0xFF2563EB)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Your booking is securely queued. Offers are actively being reviewed by verified local experts.',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.blueGrey.shade800,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAssignedProviderCard(AssignedProviderPublic provider) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF93C5FD)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2563EB).withOpacity(0.06),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.verified, size: 14, color: Color(0xFF16A34A)),
                    SizedBox(width: 4),
                    Text(
                      'Assigned Professional',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF15803D),
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              const Text(
                'KYC VERIFIED',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF16A34A),
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: const Color(0xFF0F172A),
                child: Text(
                  provider.displayName.isNotEmpty
                      ? provider.displayName[0].toUpperCase()
                      : 'P',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      provider.displayName,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    if (provider.businessName.isNotEmpty &&
                        provider.businessName != provider.displayName) ...[
                      const SizedBox(height: 2),
                      Text(
                        provider.businessName,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.star, size: 15, color: Color(0xFFF59E0B)),
                        const SizedBox(width: 4),
                        Text(
                          provider.ratingAverage > 0
                              ? provider.ratingAverage.toStringAsFixed(1)
                              : 'New Pro',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        if (provider.ratingCount > 0) ...[
                          const SizedBox(width: 4),
                          Text(
                            '(${provider.ratingCount} jobs)',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                        if (provider.experienceYears != null) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '${provider.experienceYears}y exp',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: Colors.grey.shade700,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.chat_bubble_outline, size: 18),
              label: const Text('Chat with Provider'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF1E88E5),
                side: const BorderSide(color: Color(0xFF1E88E5)),
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => BookingChatScreen(
                      bookingId: widget.bookingId,
                      providerBusinessName: provider.businessName.isNotEmpty
                          ? provider.businessName
                          : provider.displayName,
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAssignedProviderFallbackCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF93C5FD)),
      ),
      child: const Row(
        children: [
          Icon(Icons.check_circle, color: Color(0xFF2563EB), size: 24),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'A verified service professional has accepted your booking.',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1E3A8A),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimelineCard(BookingItem booking) {
    final timeline = booking.timeline;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.timeline, size: 18, color: AppTheme.brandPrimary),
              SizedBox(width: 8),
              Text(
                'Authoritative Timeline',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.brandPrimary,
                ),
              ),
            ],
          ),
          const Divider(height: 20),
          if (timeline.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  const Icon(Icons.circle, size: 10, color: Color(0xFF2563EB)),
                  const SizedBox(width: 10),
                  Text(
                    'Booking Placed (${booking.currentStatus})',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            )
          else
            ...List.generate(timeline.length, (index) {
              final item = timeline[index];
              final isLast = index == timeline.length - 1;
              final timeFormatted =
                  '${item.createdAt.hour.toString().padLeft(2, '0')}:${item.createdAt.minute.toString().padLeft(2, '0')}';

              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      children: [
                        Icon(
                          isLast ? Icons.check_circle : Icons.circle,
                          size: isLast ? 14 : 10,
                          color: isLast ? const Color(0xFF16A34A) : Colors.grey.shade400,
                        ),
                      ],
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.formattedToState,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: isLast ? FontWeight.w700 : FontWeight.w500,
                              color: isLast ? const Color(0xFF0F172A) : Colors.grey.shade700,
                            ),
                          ),
                          if (item.reason != null && item.reason!.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              item.reason!,
                              style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                            ),
                          ],
                        ],
                      ),
                    ),
                    Text(
                      timeFormatted,
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildStartOtpCard(String startOtp) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.lock_clock, color: Color(0xFF92400E), size: 20),
              SizedBox(width: 8),
              Text(
                'Service Start OTP',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF92400E),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Share this code with your verified professional ONLY after they arrive at your location to begin work:',
            style: TextStyle(
              fontSize: 12,
              color: Colors.brown.shade800,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFFCD34D)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  startOtp,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 4,
                    color: AppTheme.brandPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildServiceDetailsCard(
    BookingItem booking,
    String serviceName,
    String scheduleFormatted,
  ) {
    return Container(
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
            'Service Details',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppTheme.brandPrimary,
            ),
          ),
          const Divider(height: 24),
          _DetailTile(
            icon: Icons.home_repair_service_outlined,
            label: 'Service',
            value: serviceName,
          ),
          const SizedBox(height: 12),
          _DetailTile(
            icon: Icons.calendar_today_outlined,
            label: 'Scheduled For',
            value: scheduleFormatted,
          ),
          if (booking.jobDescription != null && booking.jobDescription!.isNotEmpty) ...[
            const SizedBox(height: 12),
            _DetailTile(
              icon: Icons.notes_outlined,
              label: 'Instructions',
              value: booking.jobDescription!,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAddressSnapshotCard(BookingItem booking) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.location_on_outlined, size: 20, color: AppTheme.brandPrimary),
              SizedBox(width: 8),
              Text(
                'Service Location Snapshot',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.brandPrimary,
                ),
              ),
            ],
          ),
          const Divider(height: 24),
          if (booking.addressSnapshot != null) ...[
            Text(
              booking.addressSnapshot!.label ?? 'Primary Address',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppTheme.brandPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              booking.addressSnapshot!.addressLine1,
              style: TextStyle(fontSize: 13, color: Colors.grey.shade800),
            ),
            if (booking.addressSnapshot!.addressLine2 != null &&
                booking.addressSnapshot!.addressLine2!.isNotEmpty)
              Text(
                booking.addressSnapshot!.addressLine2!,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade800),
              ),
            if (booking.addressSnapshot!.landmark != null &&
                booking.addressSnapshot!.landmark!.isNotEmpty)
              Text(
                'Landmark: ${booking.addressSnapshot!.landmark!}',
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
              ),
            Text(
              '${booking.addressSnapshot!.city}, ${booking.addressSnapshot!.state} — ${booking.addressSnapshot!.postalCode}',
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade700,
                fontWeight: FontWeight.w500,
              ),
            ),
          ] else ...[
            Text(
              'Address preserved in backend database.',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPricingCard(BookingItem booking) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Price Breakdown',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.brandPrimary,
                ),
              ),
              if (booking.pricingSnapshot != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    booking.pricingSnapshot!.pricingModel,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Colors.blue.shade800,
                    ),
                  ),
                ),
            ],
          ),
          const Divider(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Authoritative Amount',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.brandPrimary,
                ),
              ),
              Text(
                booking.displayTotal,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.brandPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            _pricingDisclaimer(booking),
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey.shade600,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
      ),
    );
  }

  String _pricingDisclaimer(BookingItem booking) {
    final model = booking.pricingSnapshot?.pricingModel;
    switch (model) {
      case 'FIXED_PRICE':
        return 'Fixed price confirmed by service catalog. Taxes & platform fees included.';
      case 'HOURLY':
        return 'Billed based on actual service duration recorded by the professional.';
      case 'INSPECTION_QUOTE':
        return 'Initial inspection fee shown. The final service price will be quoted after on-site review.';
      case 'CUSTOM_QUOTE':
        return 'Custom quote required. Partner will provide quote on visit.';
      default:
        return 'Final payment settlement occurs upon service completion.';
    }
  }
}

class _DetailTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailTile({
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
          width: 90,
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
