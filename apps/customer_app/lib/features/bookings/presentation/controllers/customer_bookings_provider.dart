import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/booking_repository.dart';
import '../../domain/booking_item.dart';

final customerBookingsProvider = FutureProvider<List<BookingItem>>((ref) async {
  final repo = ref.watch(bookingRepositoryProvider);
  final result = await repo.listBookings(page: 1, limit: 50);
  return result.items;
});

final bookingDetailProvider =
    FutureProvider.family<BookingItem, String>((ref, bookingId) async {
  final repo = ref.watch(bookingRepositoryProvider);
  return repo.getBookingDetails(bookingId);
});
