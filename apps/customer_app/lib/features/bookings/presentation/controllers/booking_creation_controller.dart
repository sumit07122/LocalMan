import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../addresses/domain/address.dart';
import '../../domain/booking_item.dart';
import '../../domain/booking_request.dart';
import '../../data/booking_repository.dart';
import '../../../services/domain/service.dart';
import '../../../services/domain/service_pricing.dart';

class BookingCreationState {
  final ServiceItem? service;
  final Address? selectedAddress;
  final DateTime? scheduledDate;
  final String? selectedTimeSlot;
  final String jobDescription;
  final int hours;
  final String customerNotes;
  final List<String> attachments;
  final bool isLoading;
  final String? errorMessage;
  final BookingItem? createdBooking;

  const BookingCreationState({
    this.service,
    this.selectedAddress,
    this.scheduledDate,
    this.selectedTimeSlot,
    this.jobDescription = '',
    this.hours = 1,
    this.customerNotes = '',
    this.attachments = const [],
    this.isLoading = false,
    this.errorMessage,
    this.createdBooking,
  });

  bool get isValid =>
      service != null &&
      selectedAddress != null &&
      scheduledDate != null &&
      selectedTimeSlot != null &&
      jobDescription.trim().length >= 10;

  int get estimatedTotalPaisa {
    if (service == null) return 0;
    const gstRate = 0.18;

    switch (service!.pricing.pricingModel) {
      case PricingModelType.fixedPrice: {
        final base = service!.pricing.basePricePaisa;
        final tax = (base * gstRate).round();
        return base + tax;
      }
      case PricingModelType.hourly: {
        final rate = service!.pricing.hourlyRatePaisa ?? service!.pricing.basePricePaisa;
        final base = rate * hours;
        final tax = (base * gstRate).round();
        return base + tax;
      }
      case PricingModelType.inspectionQuote: {
        final base = service!.pricing.inspectionFeePaisa ?? 0;
        final tax = (base * gstRate).round();
        return base + tax;
      }
      case PricingModelType.customQuote:
        return 0;
    }
  }

  String get displayEstimatedPrice {
    if (service == null) return '₹0';
    if (service!.pricing.pricingModel == PricingModelType.customQuote) {
      return 'Quote Required';
    }
    if (service!.pricing.pricingModel == PricingModelType.inspectionQuote) {
      return '₹${(estimatedTotalPaisa / 100).toStringAsFixed(0)} (Visiting Fee)';
    }
    return '₹${(estimatedTotalPaisa / 100).toStringAsFixed(0)}';
  }

  BookingCreationState copyWith({
    ServiceItem? service,
    Address? selectedAddress,
    DateTime? scheduledDate,
    String? selectedTimeSlot,
    String? jobDescription,
    int? hours,
    String? customerNotes,
    List<String>? attachments,
    bool? isLoading,
    String? errorMessage,
    BookingItem? createdBooking,
  }) {
    return BookingCreationState(
      service: service ?? this.service,
      selectedAddress: selectedAddress ?? this.selectedAddress,
      scheduledDate: scheduledDate ?? this.scheduledDate,
      selectedTimeSlot: selectedTimeSlot ?? this.selectedTimeSlot,
      jobDescription: jobDescription ?? this.jobDescription,
      hours: hours ?? this.hours,
      customerNotes: customerNotes ?? this.customerNotes,
      attachments: attachments ?? this.attachments,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      createdBooking: createdBooking ?? this.createdBooking,
    );
  }
}

class BookingCreationNotifier extends StateNotifier<BookingCreationState> {
  final IBookingRepository _repository;
  String? _idempotencyKey;

  BookingCreationNotifier({required IBookingRepository repository})
      : _repository = repository,
        super(const BookingCreationState());

  void init(ServiceItem service, Address? initialAddress) {
    state = state.copyWith(
      service: service,
      selectedAddress: initialAddress,
      scheduledDate: DateTime.now().add(const Duration(days: 1)),
      selectedTimeSlot: '10:00 AM - 12:00 PM',
      hours: 1,
    );
  }

  void setAddress(Address address) {
    state = state.copyWith(selectedAddress: address, errorMessage: null);
  }

  void setDate(DateTime date) {
    state = state.copyWith(scheduledDate: date, errorMessage: null);
  }

  void setTimeSlot(String slot) {
    state = state.copyWith(selectedTimeSlot: slot, errorMessage: null);
  }

  void setJobDescription(String description) {
    state = state.copyWith(jobDescription: description, errorMessage: null);
  }

  void setHours(int hours) {
    if (hours < 1 || hours > 24) return;
    state = state.copyWith(hours: hours);
  }

  void setCustomerNotes(String notes) {
    state = state.copyWith(customerNotes: notes);
  }

  Future<BookingItem?> submitBooking() async {
    if (!state.isValid) {
      if (state.selectedAddress == null) {
        state = state.copyWith(errorMessage: 'Please select a service delivery address.');
      } else if (state.jobDescription.trim().length < 10) {
        state = state.copyWith(errorMessage: 'Please provide at least 10 characters describing the job.');
      } else {
        state = state.copyWith(errorMessage: 'Please fill all required booking details.');
      }
      return null;
    }

    state = state.copyWith(isLoading: true, errorMessage: null);

    // Generate or reuse client idempotency key for safe double-tap retry
    _idempotencyKey ??=
        'idem_${DateTime.now().millisecondsSinceEpoch}_${state.service!.id}';

    try {
      final formattedDate =
          '${state.scheduledDate!.year.toString().padLeft(4, '0')}-'
          '${state.scheduledDate!.month.toString().padLeft(2, '0')}-'
          '${state.scheduledDate!.day.toString().padLeft(2, '0')}';

      final request = CreateBookingRequest(
        serviceId: state.service!.id,
        addressId: state.selectedAddress!.id,
        jobDescription: state.jobDescription.trim(),
        scheduledDate: formattedDate,
        scheduledTimeSlot: state.selectedTimeSlot!,
        pricingModel: state.service!.pricing.pricingModelKey,
        hours: state.service!.pricing.pricingModel == PricingModelType.hourly ? state.hours : null,
        customerNotes: state.customerNotes.trim().isNotEmpty
            ? state.customerNotes.trim()
            : null,
        attachments: state.attachments.isNotEmpty ? state.attachments : null,
        idempotencyKey: _idempotencyKey,
      );

      final booking = await _repository.createBooking(request);

      state = state.copyWith(
        isLoading: false,
        createdBooking: booking,
        errorMessage: null,
      );

      return booking;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
      return null;
    }
  }
}

final bookingCreationProvider =
    StateNotifierProvider.autoDispose<BookingCreationNotifier, BookingCreationState>(
        (ref) {
  final repo = ref.watch(bookingRepositoryProvider);
  return BookingCreationNotifier(repository: repo);
});
