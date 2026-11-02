import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_indicator.dart';
import '../../../addresses/domain/address.dart';
import '../../../addresses/presentation/controllers/address_provider.dart';
import '../../../services/domain/service.dart';
import '../../../services/presentation/controllers/catalog_providers.dart';
import '../controllers/booking_creation_controller.dart';

class BookingCreationScreen extends ConsumerStatefulWidget {
  final String serviceId;

  const BookingCreationScreen({
    super.key,
    required this.serviceId,
  });

  @override
  ConsumerState<BookingCreationScreen> createState() =>
      _BookingCreationScreenState();
}

class _BookingCreationScreenState extends ConsumerState<BookingCreationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _descController = TextEditingController();
  final _notesController = TextEditingController();
  bool _isInitialized = false;

  final List<String> _timeSlots = [
    '09:00 AM - 11:00 AM',
    '11:00 AM - 01:00 PM',
    '02:00 PM - 04:00 PM',
    '04:00 PM - 06:00 PM',
    '06:00 PM - 08:00 PM',
  ];

  @override
  void dispose() {
    _descController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _initBooking(ServiceItem service) {
    if (_isInitialized) return;
    _isInitialized = true;

    final addressState = ref.read(addressProvider);
    final initialAddress =
        addressState.selectedAddress ?? addressState.defaultAddress;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref
          .read(bookingCreationProvider.notifier)
          .init(service, initialAddress);
    });
  }

  Future<void> _selectDate(BuildContext context) async {
    final now = DateTime.now();
    final firstDate = now.add(const Duration(days: 0));
    final lastDate = now.add(const Duration(days: 60));

    final picked = await showDatePicker(
      context: context,
      initialDate: firstDate,
      firstDate: firstDate,
      lastDate: lastDate,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppTheme.brandPrimary,
              onPrimary: Colors.white,
              onSurface: AppTheme.brandPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      ref.read(bookingCreationProvider.notifier).setDate(picked);
    }
  }

  void _showAddressSelector(BuildContext context) {
    final addressState = ref.read(addressProvider);

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 20.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Select Service Address',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.brandPrimary,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      context.push('/addresses/new');
                    },
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Add New'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (addressState.addresses.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24.0),
                  child: Center(
                    child: Text('No saved addresses. Please add one.'),
                  ),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: addressState.addresses.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final addr = addressState.addresses[index];
                      return ListTile(
                        leading: const Icon(Icons.location_on_outlined,
                            color: AppTheme.brandAccent),
                        title: Text(
                          addr.label,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        subtitle: Text(
                          '${addr.addressLine1}, ${addr.city}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        onTap: () {
                          ref
                              .read(bookingCreationProvider.notifier)
                              .setAddress(addr);
                          Navigator.pop(context);
                        },
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final serviceAsync = ref.watch(serviceDetailProvider(widget.serviceId));
    final bookingState = ref.watch(bookingCreationProvider);
    final bookingNotifier = ref.read(bookingCreationProvider.notifier);

    return serviceAsync.when(
      loading: () => const Scaffold(
        body: LoadingIndicator(message: 'Loading service details...'),
      ),
      error: (error, stack) => Scaffold(
        appBar: AppBar(title: const Text('Book Service')),
        body: ErrorView(
          message: error.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.refresh(serviceDetailProvider(widget.serviceId)),
        ),
      ),
      data: (service) {
        _initBooking(service);

        return Scaffold(
          appBar: AppBar(
            title: const Text('Book Service'),
          ),
          body: Form(
            key: _formKey,
            child: Column(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // 1. Service Overview Card
                        _ServiceOverviewCard(service: service),

                        const SizedBox(height: 16),

                        // 2. Service Address Card
                        _AddressSelectionCard(
                          address: bookingState.selectedAddress,
                          onChange: () => _showAddressSelector(context),
                        ),

                        const SizedBox(height: 16),

                        // 3. Scheduling Section
                        _SchedulingCard(
                          scheduledDate: bookingState.scheduledDate,
                          selectedSlot: bookingState.selectedTimeSlot,
                          timeSlots: _timeSlots,
                          onPickDate: () => _selectDate(context),
                          onSelectSlot: bookingNotifier.setTimeSlot,
                        ),

                        const SizedBox(height: 16),

                        // 4. Hourly Duration Selector (if applicable)
                        if (service.pricing.pricingModel == 'HOURLY') ...[
                          _HourlyDurationCard(
                            hours: bookingState.hours,
                            hourlyRatePaisa:
                                service.pricing.hourlyRatePaisa ??
                                    service.pricing.basePricePaisa,
                            onHoursChanged: bookingNotifier.setHours,
                          ),
                          const SizedBox(height: 16),
                        ],

                        // 5. Job Description Input
                        _JobDescriptionCard(
                          controller: _descController,
                          onChanged: bookingNotifier.setJobDescription,
                        ),

                        const SizedBox(height: 16),

                        // 6. Photo Attachments Notice
                        _AttachmentsNoticeCard(),

                        const SizedBox(height: 16),

                        // 7. Authoritative Pricing Summary Card
                        _PricingSummaryCard(
                          service: service,
                          state: bookingState,
                        ),

                        if (bookingState.errorMessage != null) ...[
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.red.shade50,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: Colors.red.shade200),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.error_outline,
                                    color: Colors.red.shade700, size: 20),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    bookingState.errorMessage!,
                                    style: TextStyle(
                                      color: Colors.red.shade800,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),

                // Bottom Sticky Submission Bar
                _BottomSubmitBar(
                  displayTotal: bookingState.displayEstimatedPrice,
                  isLoading: bookingState.isLoading,
                  onSubmit: () async {
                    if (_formKey.currentState?.validate() ?? false) {
                      bookingNotifier.setJobDescription(_descController.text);
                      final booking = await bookingNotifier.submitBooking();
                      if (booking != null && mounted) {
                        context.go('/booking-confirmation/${booking.id}',
                            extra: booking);
                      }
                    }
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ServiceOverviewCard extends StatelessWidget {
  final ServiceItem service;

  const _ServiceOverviewCard({required this.service});

  @override
  Widget build(BuildContext context) {
    final duration = service.formattedDuration;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.brandPrimary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.home_repair_service_outlined,
              color: AppTheme.brandPrimary,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  service.name,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.brandPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppTheme.brandAccent.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        service.pricing.pricingModelBadge,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFB45309),
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
                          '⏱ $duration',
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
        ],
      ),
    );
  }
}

class _AddressSelectionCard extends StatelessWidget {
  final Address? address;
  final VoidCallback onChange;

  const _AddressSelectionCard({
    required this.address,
    required this.onChange,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.location_on_outlined,
                      size: 18, color: AppTheme.brandAccent),
                  SizedBox(width: 6),
                  Text(
                    'Service Address',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.brandPrimary,
                    ),
                  ),
                ],
              ),
              TextButton(
                onPressed: onChange,
                child: Text(address != null ? 'Change' : 'Select'),
              ),
            ],
          ),
          if (address != null) ...[
            const SizedBox(height: 4),
            Text(
              address!.label,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 14,
                color: AppTheme.brandPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              address!.formattedAddress,
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade700,
                height: 1.3,
              ),
            ),
          ] else ...[
            const SizedBox(height: 6),
            Text(
              'No address selected. Please choose a delivery address.',
              style: TextStyle(
                fontSize: 13,
                color: Colors.red.shade700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SchedulingCard extends StatelessWidget {
  final DateTime? scheduledDate;
  final String? selectedSlot;
  final List<String> timeSlots;
  final VoidCallback onPickDate;
  final ValueChanged<String> onSelectSlot;

  const _SchedulingCard({
    required this.scheduledDate,
    required this.selectedSlot,
    required this.timeSlots,
    required this.onPickDate,
    required this.onSelectSlot,
  });

  @override
  Widget build(BuildContext context) {
    final dateStr = scheduledDate != null
        ? '${scheduledDate!.day} ${_monthName(scheduledDate!.month)} ${scheduledDate!.year}'
        : 'Select Date';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.calendar_today_outlined,
                      size: 18, color: AppTheme.brandPrimary),
                  SizedBox(width: 6),
                  Text(
                    'Preferred Schedule',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.brandPrimary,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: onPickDate,
                icon: const Icon(Icons.edit_calendar, size: 14),
                label: Text(dateStr, style: const TextStyle(fontSize: 12)),
                style: OutlinedButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Text(
            'Select Arrival Time Window',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: timeSlots.map((slot) {
              final isSelected = selectedSlot == slot;
              return ChoiceChip(
                label: Text(slot),
                selected: isSelected,
                onSelected: (_) => onSelectSlot(slot),
                selectedColor: AppTheme.brandPrimary,
                labelStyle: TextStyle(
                  color: isSelected ? Colors.white : AppTheme.brandPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  static String _monthName(int month) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return months[month - 1];
  }
}

class _HourlyDurationCard extends StatelessWidget {
  final int hours;
  final int hourlyRatePaisa;
  final ValueChanged<int> onHoursChanged;

  const _HourlyDurationCard({
    required this.hours,
    required this.hourlyRatePaisa,
    required this.onHoursChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Estimated Work Hours',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.brandPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '₹${(hourlyRatePaisa / 100).toStringAsFixed(0)} / recorded hour',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                ),
              ),
            ],
          ),
          Row(
            children: [
              IconButton(
                onPressed: hours > 1 ? () => onHoursChanged(hours - 1) : null,
                icon: const Icon(Icons.remove_circle_outline),
                color: hours > 1 ? AppTheme.brandPrimary : Colors.grey,
              ),
              Text(
                '$hours hr',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.brandPrimary,
                ),
              ),
              IconButton(
                onPressed: hours < 24 ? () => onHoursChanged(hours + 1) : null,
                icon: const Icon(Icons.add_circle_outline),
                color: hours < 24 ? AppTheme.brandPrimary : Colors.grey,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _JobDescriptionCard extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  const _JobDescriptionCard({
    required this.controller,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Describe the Issue / Scope',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.brandPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Provide details so the service professional brings the appropriate tools.',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: controller,
            maxLines: 4,
            maxLength: 1000,
            onChanged: onChanged,
            validator: (value) {
              if (value == null || value.trim().length < 10) {
                return 'Please describe the issue in at least 10 characters.';
              }
              return null;
            },
            decoration: InputDecoration(
              hintText: 'e.g., Tap under the kitchen sink is leaking steadily, dripping into the lower cabinet...',
              hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
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
        ],
      ),
    );
  }
}

class _AttachmentsNoticeCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.photo_camera_outlined,
              size: 20, color: Colors.grey.shade700),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Photos and videos can be shared directly with the assigned professional during on-site arrival.',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade700,
                height: 1.3,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PricingSummaryCard extends StatelessWidget {
  final ServiceItem service;
  final BookingCreationState state;

  const _PricingSummaryCard({
    required this.service,
    required this.state,
  });

  @override
  Widget build(BuildContext context) {
    final pricing = service.pricing;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Authoritative Price Preview',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.brandPrimary,
            ),
          ),
          const SizedBox(height: 12),
          if (pricing.pricingModel == 'CUSTOM_QUOTE') ...[
            Text(
              'This service requires a custom quote. Verified professionals will submit quotes for your review.',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
            ),
          ] else ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  pricing.pricingModel == 'HOURLY'
                      ? 'Labor (${state.hours} hr × ₹${((pricing.hourlyRatePaisa ?? pricing.basePricePaisa) / 100).toStringAsFixed(0)})'
                      : (pricing.pricingModel == 'INSPECTION_QUOTE'
                          ? 'Visiting / Inspection Fee'
                          : 'Service Base Price'),
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                ),
                Text(
                  pricing.pricingModel == 'HOURLY'
                      ? '₹${(((pricing.hourlyRatePaisa ?? pricing.basePricePaisa) * state.hours) / 100).toStringAsFixed(0)}'
                      : (pricing.pricingModel == 'INSPECTION_QUOTE'
                          ? '₹${((pricing.inspectionFeePaisa ?? 0) / 100).toStringAsFixed(0)}'
                          : '₹${(pricing.basePricePaisa / 100).toStringAsFixed(0)}'),
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'GST (18% Statutory Tax)',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                ),
                Text(
                  '₹${((state.estimatedTotalPaisa - (pricing.pricingModel == 'HOURLY' ? (pricing.hourlyRatePaisa ?? pricing.basePricePaisa) * state.hours : (pricing.pricingModel == 'INSPECTION_QUOTE' ? (pricing.inspectionFeePaisa ?? 0) : pricing.basePricePaisa))) / 100).toStringAsFixed(0)}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const Divider(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Estimated Total',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.brandPrimary,
                  ),
                ),
                Text(
                  state.displayEstimatedPrice,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.brandPrimary,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _BottomSubmitBar extends StatelessWidget {
  final String displayTotal;
  final bool isLoading;
  final VoidCallback onSubmit;

  const _BottomSubmitBar({
    required this.displayTotal,
    required this.isLoading,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Total Payable',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    displayTotal,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.brandPrimary,
                    ),
                  ),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: isLoading ? null : onSubmit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.brandAccent,
                foregroundColor: AppTheme.brandPrimary,
                padding:
                    const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppTheme.brandPrimary,
                      ),
                    )
                  : const Text(
                      'Request Service',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
