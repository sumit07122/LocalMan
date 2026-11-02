import '../config/env_config.dart';

class ApiConstants {
  static String get baseUrl => EnvConfig.baseUrl;

  // Authentication endpoints
  static String get sendOtp => '$baseUrl/auth/otp/send';
  static String get verifyOtp => '$baseUrl/auth/otp/verify';
  static String get refresh => '$baseUrl/auth/refresh';
  static String get me => '$baseUrl/auth/me';
  static String get logout => '$baseUrl/auth/logout';

  // Provider profile & KYC
  static String get providerProfile => '$baseUrl/providers/profile';
  static String get submitKyc => '$baseUrl/providers/kyc/document';
  static String get toggleOnline => '$baseUrl/providers/toggle-online';
  static String get locationBeacon => '$baseUrl/providers/location/beacon';
  static String get updateAvailability => '$baseUrl/providers/availability';

  // Provider Bookings (Phase 2A canonical endpoints)
  static String get providerBookings => '$baseUrl/providers/bookings';
  static String providerBookingDetails(String id) => '$baseUrl/providers/bookings/$id';
  static String acceptBooking(String id) => '$baseUrl/providers/bookings/$id/accept';
  static String rejectBooking(String id) => '$baseUrl/providers/bookings/$id/reject';

  // Phase 2C & 2E: Job Execution & Wallet endpoints
  static String updateJobStatus(String id) => '$baseUrl/providers/bookings/$id/job-status';
  static String startTravel(String id) => '$baseUrl/providers/bookings/$id/on-the-way';
  static String markArrived(String id) => '$baseUrl/providers/bookings/$id/arrived';
  static String startJob(String id) => '$baseUrl/providers/bookings/$id/start';
  static String completeJob(String id) => '$baseUrl/providers/bookings/$id/complete';
  static String get providerWallet => '$baseUrl/providers/wallet';
  static String get requestPayout => '$baseUrl/providers/wallet/payouts';
  static String get providerLedger => '$baseUrl/providers/wallet/ledger';

  // Phase 2F: Real-Time Marketplace Dispatch
  static String get dispatchOffers => '$baseUrl/providers/dispatch/offers';
  static String get activeDispatchOffer => '$baseUrl/providers/dispatch/offers/active';
  static String acceptDispatchOffer(String id) => '$baseUrl/providers/dispatch/offers/$id/accept';
  static String rejectDispatchOffer(String id) => '$baseUrl/providers/dispatch/offers/$id/reject';
  static String get dispatchStream => '$baseUrl/providers/dispatch/stream';

  // Legacy aliases
  static String get myBookings => providerBookings;
  static String bookingDetails(String id) => providerBookingDetails(id);
  static String updateStatus(String id) => '$baseUrl/bookings/$id/status';
  static String addMaterial(String id) => '$baseUrl/bookings/$id/materials';

  // Phase 3H: Provider Quote Marketplace endpoints
  static String submitQuote(String bookingId) => '$baseUrl/providers/bookings/$bookingId/quotes';
  static String providerBookingQuotes(String bookingId) => '$baseUrl/providers/bookings/$bookingId/quotes';
  static String updateQuote(String quoteId) => '$baseUrl/providers/quotes/$quoteId';
  static String withdrawQuote(String quoteId) => '$baseUrl/providers/quotes/$quoteId/withdraw';

  // Phase 3I: Provider Chat & Messaging endpoints
  static String bookingConversation(String bookingId) => '$baseUrl/bookings/$bookingId/messages/conversation';
  static String bookingMessages(String bookingId) => '$baseUrl/bookings/$bookingId/messages';
  static String bookingMessageRead(String bookingId) => '$baseUrl/bookings/$bookingId/messages/read';
  static String bookingMessageStream(String bookingId) => '$baseUrl/bookings/$bookingId/messages/stream';

  // Phase 3J: Provider Reputation & Reviews endpoints
  static String get providerOwnReviews => '$baseUrl/providers/reviews';
  static String providerReviews(String providerId) => '$baseUrl/providers/$providerId/reviews';
  static String providerReputation(String providerId) => '$baseUrl/providers/$providerId/reputation';
  static String reviewResponse(String reviewId) => '$baseUrl/reviews/$reviewId/response';
}
