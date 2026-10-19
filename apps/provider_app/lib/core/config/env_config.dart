import 'package:flutter/foundation.dart';

class EnvConfig {
  /// Base API URL. Configurable via --dart-define=API_BASE_URL=https://api.localman.in/api/v1
  static const String _configuredBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  /// Default local development URL for Android emulator (10.0.2.2) or iOS simulator/desktop (localhost)
  static String get _defaultDevUrl {
    if (kIsWeb) {
      return 'http://localhost:4000/api/v1';
    }
    // Android emulator alias for host machine localhost
    return defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:4000/api/v1'
        : 'http://localhost:4000/api/v1';
  }

  /// Resolved base URL with production HTTPS enforcement
  static String get baseUrl {
    if (_configuredBaseUrl.isNotEmpty) {
      if (kReleaseMode && !_configuredBaseUrl.startsWith('https://')) {
        throw StateError('SECURITY ALERT: Production build must use HTTPS for API_BASE_URL.');
      }
      return _configuredBaseUrl;
    }

    if (kReleaseMode) {
      throw StateError(
        'SECURITY ALERT: API_BASE_URL must be explicitly provided in release builds via --dart-define=API_BASE_URL=https://...',
      );
    }

    return _defaultDevUrl;
  }

  // Network Timeouts
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);
  static const Duration sendTimeout = Duration(seconds: 15);

  // Sensitive Field Names that must NEVER be logged in network traffic
  static const Set<String> sanitizedLogKeys = {
    'otp',
    'otpcode',
    'authorization',
    'accesstoken',
    'refreshtoken',
    'token',
    'password',
    'aadhaarnumber',
    'pannumber',
    'bankaccountnumber',
    'bankaccountnumberenc',
    'upiid',
  };
}
