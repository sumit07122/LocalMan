import '../config/env_config.dart';

class ApiConstants {
  static String get baseUrl => EnvConfig.baseUrl;

  // Auth endpoints
  static String get sendOtp => '$baseUrl/auth/otp/send';
  static String get verifyOtp => '$baseUrl/auth/otp/verify';
  static String get refresh => '$baseUrl/auth/refresh';
  static String get me => '$baseUrl/auth/me';
  static String get profile => '$baseUrl/auth/profile';
  static String get logout => '$baseUrl/auth/logout';

  // Address endpoints
  static String get addresses => '$baseUrl/addresses';
  static String addressById(String id) => '$baseUrl/addresses/$id';
  static String addressSetDefault(String id) => '$baseUrl/addresses/$id/default';

  // Catalog endpoints
  static String get categories => '$baseUrl/categories';
  static String categoryById(String id) => '$baseUrl/categories/$id';
  static String get services => '$baseUrl/services';
  static String serviceById(String id) => '$baseUrl/services/$id';

  // Booking endpoints
  static String get bookings => '$baseUrl/bookings';
  static String get customerBookings => '$baseUrl/bookings/customer/my';
  static String bookingById(String id) => '$baseUrl/bookings/$id';
  static String bookingStream(String id) => '$baseUrl/bookings/$id/stream';

  // Payment endpoints
  static String bookingCheckout(String id) => '$baseUrl/bookings/$id/payment/checkout';
  static String bookingVerifyPayment(String id) => '$baseUrl/bookings/$id/payment/verify';
  static String bookingPaymentSummary(String id) => '$baseUrl/bookings/$id/payment/summary';

  // Phase 3G Cancellation, No-Show & Dispute endpoints
  static String bookingCancel(String id) => '$baseUrl/bookings/$id/cancel';
  static String bookingNoShow(String id) => '$baseUrl/bookings/$id/no-show';
  static String bookingDisputes(String id) => '$baseUrl/bookings/$id/disputes';
  static String disputeById(String id) => '$baseUrl/disputes/$id';

  // Phase 3H Quote endpoints
  static String bookingQuotes(String bookingId) => '$baseUrl/bookings/$bookingId/quotes';
  static String bookingQuoteById(String bookingId, String quoteId) => '$baseUrl/bookings/$bookingId/quotes/$quoteId';
  static String acceptQuote(String bookingId, String quoteId) => '$baseUrl/bookings/$bookingId/quotes/$quoteId/accept';
  static String rejectQuote(String bookingId, String quoteId) => '$baseUrl/bookings/$bookingId/quotes/$quoteId/reject';

  // Phase 3I Chat & Messaging endpoints
  static String bookingConversation(String bookingId) => '$baseUrl/bookings/$bookingId/messages/conversation';
  static String bookingMessages(String bookingId) => '$baseUrl/bookings/$bookingId/messages';
  static String bookingMessageRead(String bookingId) => '$baseUrl/bookings/$bookingId/messages/read';
  static String bookingMessageStream(String bookingId) => '$baseUrl/bookings/$bookingId/messages/stream';
}
