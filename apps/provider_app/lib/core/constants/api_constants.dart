class ApiConstants {
  // Set to local host / machine IP for Android Emulator (10.0.2.2) or iOS Simulator (localhost)
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1',
  );

  // Authentication
  static const String sendOtp = '$baseUrl/auth/otp/send';
  static const String verifyOtp = '$baseUrl/auth/otp/verify';
  static const String refresh = '$baseUrl/auth/refresh';
  static const String me = '$baseUrl/auth/me';

  // Provider Profile & KYC
  static const String providerProfile = '$baseUrl/providers/profile';
  static const String submitKyc = '$baseUrl/providers/kyc/document';
  static const String toggleOnline = '$baseUrl/providers/toggle-online';
  static const String locationBeacon = '$baseUrl/providers/location/beacon';
  static const String updateAvailability = '$baseUrl/providers/availability';

  // Provider Bookings
  static const String myBookings = '$baseUrl/bookings/provider/my';
  static const String bookingDetails = '$baseUrl/bookings';
  static const String updateStatus = '$baseUrl/bookings'; // PATCH /:id/status
  static const String addMaterial = '$baseUrl/bookings';  // POST /:id/materials
}
