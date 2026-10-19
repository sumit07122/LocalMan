import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../shared/models/booking_model.dart';
import '../../data/booking_repository.dart';
import '../../dashboard/data/location_service.dart';

class ActiveJobExecutionScreen extends ConsumerStatefulWidget {
  final String bookingId;

  const ActiveJobExecutionScreen({
    super.key,
    required this.bookingId,
  });

  @override
  ConsumerState<ActiveJobExecutionScreen> createState() => _ActiveJobExecutionScreenState();
}

class _ActiveJobExecutionScreenState extends ConsumerState<ActiveJobExecutionScreen> {
  Booking? _booking;
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;

  final _otpController = TextEditingController();
  final List<BookingMaterial> _addedMaterials = [];

  @override
  void initState() {
    super.initState();
    _fetchBookingDetails();
  }

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _fetchBookingDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(bookingRepositoryProvider);
      final booking = await repo.getBookingDetails(widget.bookingId);
      if (mounted) {
        setState(() {
          _booking = booking;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _transitionStatus(String newStatus, {String? otp}) async {
    setState(() => _isSubmitting = true);
    try {
      final repo = ref.read(bookingRepositoryProvider);
      final updated = await repo.updateJobStatus(
        widget.bookingId,
        status: newStatus,
        startOtp: otp,
      );
      if (mounted) {
        setState(() {
          _booking = updated;
          _isSubmitting = false;
        });
        if (newStatus == 'PROVIDER_ON_THE_WAY') {
          ref.read(locationServiceProvider.notifier).acquireAndSendCurrentLocation(activeBookingId: widget.bookingId);
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Status updated: $newStatus'),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update status: ${e.toString()}'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  void _verifyStartOtp() {
    _otpController.clear();
    showDialog(
      context: context,
      barrierDismissible: !_isSubmitting,
      builder: (ctx) => AlertDialog(
        title: const Text('Enter Customer Start OTP', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Ask the customer for their 6-digit Start OTP displayed on their screen.',
              style: TextStyle(fontSize: 13, color: Colors.black87),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _otpController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 8),
              decoration: InputDecoration(
                hintText: '••••••',
                counterText: '',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final otp = _otpController.text.trim();
              if (otp.length != 6 || !RegExp(r'^\d{6}$').hasMatch(otp)) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Please enter a valid 6-digit numeric OTP.'),
                    backgroundColor: Colors.redAccent,
                  ),
                );
                return;
              }

              Navigator.pop(ctx);
              _transitionStatus('JOB_STARTED', otp: otp);
            },
            child: const Text('Start Job'),
          ),
        ],
      ),
    );
  }

  void _showAddMaterialModal() {
    final itemController = TextEditingController();
    final priceController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Spare Part / Material', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: itemController,
              decoration: const InputDecoration(labelText: 'Item Name (e.g. Copper Pipe 2ft)'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: priceController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Price (₹)', prefixText: '₹ '),
            ),
            const SizedBox(height: 8),
            const Text(
              'Notice: Added items require customer in-app approval before being added to the final invoice.',
              style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final name = itemController.text.trim();
              final priceDouble = double.tryParse(priceController.text.trim());

              if (name.isNotEmpty && priceDouble != null && priceDouble > 0) {
                final pricePaisa = (priceDouble * 100).round();
                Navigator.pop(ctx);
                setState(() => _isSubmitting = true);
                try {
                  final repo = ref.read(bookingRepositoryProvider);
                  final material = await repo.addMaterial(
                    widget.bookingId,
                    itemName: name,
                    quantity: 1,
                    unitPricePaisa: pricePaisa,
                  );
                  await _fetchBookingDetails();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Added "${material.itemName}" for customer approval.'),
                        backgroundColor: const Color(0xFF10B981),
                      ),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    setState(() => _isSubmitting = false);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to add material: $e'), backgroundColor: Colors.redAccent),
                    );
                  }
                }
              }
            },
            child: const Text('Add Item'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: Text('Active Job • ${widget.bookingId}')),
        body: const Center(
          child: CircularProgressIndicator(color: Color(0xFFF59E0B)),
        ),
      );
    }

    if (_errorMessage != null || _booking == null) {
      return Scaffold(
        appBar: AppBar(title: Text('Active Job • ${widget.bookingId}')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
                const SizedBox(height: 16),
                const Text('Could not load booking details', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 8),
                Text(_errorMessage ?? 'Booking not found', style: const TextStyle(color: Color(0xFF64748B), fontSize: 12), textAlign: TextAlign.center),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: _fetchBookingDetails,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final booking = _booking!;
    final jobState = booking.currentStatus;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('Active Job • ${booking.bookingNumber.isNotEmpty ? booking.bookingNumber : widget.bookingId}'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            } else {
              context.go('/');
            }
          },
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Job Details',
            onPressed: _fetchBookingDetails,
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // State Banner
              _buildStateBanner(jobState),

              const SizedBox(height: 20),

              // Booking Details Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Service & Location', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        const Icon(Icons.handyman, size: 18, color: Color(0xFF0F172A)),
                        const SizedBox(width: 8),
                        Text(booking.serviceName, style: const TextStyle(fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.location_on_outlined, size: 18, color: Colors.grey),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            booking.addressFormatted,
                            style: const TextStyle(fontSize: 13, color: Colors.black87),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.person_outline, size: 18, color: Colors.grey),
                        const SizedBox(width: 8),
                        Text(
                          '${booking.customerName} (${booking.customerPhone})',
                          style: const TextStyle(fontSize: 13, color: Colors.black87),
                        ),
                      ],
                    ),
                    if (jobState == 'PROVIDER_ON_THE_WAY') ...[
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {
                                ref
                                    .read(locationServiceProvider.notifier)
                                    .acquireAndSendCurrentLocation(activeBookingId: widget.bookingId);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Syncing live GPS beacon with server...'),
                                    duration: Duration(seconds: 1),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.my_location, size: 16),
                              label: const Text('Update Live GPS', style: TextStyle(fontSize: 12)),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                side: const BorderSide(color: Color(0xFF0F172A)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                    const Divider(height: 20),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Financial Authority:', style: TextStyle(color: Colors.grey, fontSize: 13)),
                        Text('Calculated by Server on Completion', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF0F172A), fontSize: 12)),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Materials Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Spare Parts & Materials', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  if (jobState == 'JOB_STARTED' || jobState == 'JOB_EXTENDED')
                    TextButton.icon(
                      onPressed: _showAddMaterialModal,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Add Part'),
                    ),
                ],
              ),
              const SizedBox(height: 8),

              if (booking.materials.isEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Center(
                    child: Text('No extra materials added yet.', style: TextStyle(color: Colors.grey, fontSize: 13)),
                  ),
                )
              else
                ...booking.materials.map(
                  (m) => Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(m.itemName, style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text(
                              m.isCustomerApproved ? 'Customer Approved ✓' : 'Pending Customer Approval',
                              style: TextStyle(
                                fontSize: 11,
                                color: m.isCustomerApproved ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        Text('₹${m.totalPriceRupees.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                ),

              const SizedBox(height: 32),

              // Action Trigger Button based on current server status
              if (_isSubmitting)
                const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)))
              else
                _buildActionButtons(jobState),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStateBanner(String state) {
    Color bg;
    Color border;
    IconData icon;
    String title;
    String subtitle;

    switch (state) {
      case 'CONFIRMED':
      case 'PROVIDER_ACCEPTED':
        bg = const Color(0xFFEFF6FF);
        border = const Color(0xFF3B82F6);
        icon = Icons.assignment_turned_in;
        title = 'PROVIDER ACCEPTED';
        subtitle = 'Booking accepted. Tap below when ready to travel.';
        break;
      case 'PROVIDER_ON_THE_WAY':
        bg = const Color(0xFFFEF3C7);
        border = const Color(0xFFF59E0B);
        icon = Icons.directions_car;
        title = 'ON THE WAY';
        subtitle = 'Heading to customer location. Update status upon arrival.';
        break;
      case 'ARRIVED':
        bg = const Color(0xFFFEF3C7);
        border = const Color(0xFFF59E0B);
        icon = Icons.location_on;
        title = 'ARRIVED AT CUSTOMER ADDRESS';
        subtitle = 'Verify 6-digit Start OTP with customer before starting work.';
        break;
      case 'JOB_STARTED':
      case 'JOB_EXTENDED':
        bg = const Color(0xFFECFDF5);
        border = const Color(0xFF10B981);
        icon = Icons.timer;
        title = state == 'JOB_EXTENDED' ? 'JOB EXTENDED (PARTS ADDED)' : 'JOB IN PROGRESS';
        subtitle = 'Service in progress. Collect customer approval for extra materials.';
        break;
      case 'JOB_COMPLETED':
      case 'COMPLETED':
        bg = const Color(0xFFF0FDF4);
        border = Colors.green;
        icon = Icons.check_circle;
        title = 'JOB COMPLETED';
        subtitle = 'Job marked completed. Settlement will be processed by server.';
        break;
      default:
        bg = const Color(0xFFF8FAFC);
        border = const Color(0xFFCBD5E1);
        icon = Icons.info_outline;
        title = 'STATUS: $state';
        subtitle = 'Current booking status on server.';
        break;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Row(
        children: [
          Icon(icon, color: border, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: border),
                ),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF334155))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(String state) {
    if (state == 'CONFIRMED' || state == 'PROVIDER_ACCEPTED') {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton.icon(
          onPressed: () => _transitionStatus('PROVIDER_ON_THE_WAY'),
          icon: const Icon(Icons.navigation),
          label: const Text('Start Travel'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF2563EB),
            foregroundColor: Colors.white,
            textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      );
    } else if (state == 'PROVIDER_ON_THE_WAY') {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton.icon(
          onPressed: () => _transitionStatus('ARRIVED'),
          icon: const Icon(Icons.pin_drop),
          label: const Text('I Have Arrived at Location'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFF59E0B),
            foregroundColor: const Color(0xFF0F172A),
            textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      );
    } else if (state == 'ARRIVED') {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton.icon(
          onPressed: _verifyStartOtp,
          icon: const Icon(Icons.key),
          label: const Text('Enter Customer Start OTP'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFF59E0B),
            foregroundColor: const Color(0xFF0F172A),
            textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      );
    } else if (state == 'JOB_STARTED' || state == 'JOB_EXTENDED') {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton.icon(
          onPressed: () => _transitionStatus('JOB_COMPLETED'),
          icon: const Icon(Icons.check_circle_outline),
          label: const Text('Complete Job & Request Settlement'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF10B981),
            foregroundColor: Colors.white,
            textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      );
    } else {
      return Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF10B981)),
            ),
            child: const Center(
              child: Text(
                'Job marked completed. Settlement is processed automatically once customer payment is captured.',
                style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF047857)),
                textAlign: TextAlign.center,
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton(
              onPressed: () => context.go('/'),
              child: const Text('Back to Dashboard'),
            ),
          ),
        ],
      );
    }
  }
}
