class ApiConstants {
  // Set to local host / machine IP for Android Emulator (10.0.2.2) or iOS Simulator (localhost)
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1',
  );

  static const String sendOtp = '$baseUrl/auth/otp/send';
  static const String verifyOtp = '$baseUrl/auth/otp/verify';
  static const String refresh = '$baseUrl/auth/refresh';
  static const String me = '$baseUrl/auth/me';

  static const String categories = '$baseUrl/catalog/categories';
  static const String services = '$baseUrl/catalog/services';

  static const String bookings = '$baseUrl/bookings';
  static const String customerBookings = '$baseUrl/bookings/customer/my';

  static const String paymentOrders = '$baseUrl/payments/orders';
}
