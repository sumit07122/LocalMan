import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/core/errors/api_error.dart';
import 'package:localman_customer/core/errors/app_exception.dart';
import 'package:localman_customer/features/auth/domain/auth_session.dart';
import 'package:localman_customer/features/auth/domain/user.dart';
import 'package:localman_customer/features/addresses/domain/address.dart';

void main() {
  group('Repository Serialization & Error Handling Tests', () {
    test('1. AuthSession parses valid response correctly', () {
      final json = {
        'accessToken': 'jwt_access_token_xyz',
        'refreshToken': 'jwt_refresh_token_abc',
        'user': {
          'id': 'usr_123',
          'phoneNumber': '9876543210',
          'fullName': 'Vikram Rathore',
          'email': 'vikram@example.com',
          'preferredLanguage': 'en',
          'roles': ['CUSTOMER'],
          'isProfileComplete': true,
        },
      };

      final session = AuthSession.fromJson(json);
      expect(session.accessToken, 'jwt_access_token_xyz');
      expect(session.refreshToken, 'jwt_refresh_token_abc');
      expect(session.user.id, 'usr_123');
      expect(session.user.fullName, 'Vikram Rathore');
      expect(session.user.isProfileComplete, true);
    });

    test('2. ApiError parses 422 validation failure correctly', () {
      final json = {
        'statusCode': 422,
        'error': 'VALIDATION_ERROR',
        'message': 'Postal code must be a valid 6-digit Indian PIN code',
        'details': {'field': 'postalCode'},
      };

      final apiError = ApiError.fromJson(json);
      expect(apiError.statusCode, 422);
      expect(apiError.errorCode, 'VALIDATION_ERROR');
      expect(apiError.message, contains('6-digit Indian PIN code'));
    });

    test('3. ApiError parses 401 unauthorized correctly', () {
      final json = {
        'statusCode': 401,
        'error': 'UNAUTHORIZED',
        'message': 'Authentication required',
      };

      final apiError = ApiError.fromJson(json);
      expect(apiError.statusCode, 401);
      expect(apiError.errorCode, 'UNAUTHORIZED');
      expect(apiError.message, 'Authentication required');
    });

    test('4. ApiError factory for network timeout', () {
      final timeoutErr = ApiError.timeout();
      expect(timeoutErr.statusCode, 408);
      expect(timeoutErr.errorCode, 'REQUEST_TIMEOUT');
    });

    test('5. ApiError factory for offline network unavailable', () {
      final netErr = ApiError.network();
      expect(netErr.statusCode, 0);
      expect(netErr.errorCode, 'NETWORK_UNAVAILABLE');
    });

    test('6. User model fallback defaults for missing optional fields', () {
      final user = User.fromJson({
        'id': 'usr_minimal',
        'phoneNumber': '9123456789',
      });

      expect(user.id, 'usr_minimal');
      expect(user.phoneNumber, '9123456789');
      expect(user.fullName, isNull);
      expect(user.email, isNull);
      expect(user.preferredLanguage, 'en');
      expect(user.roles, ['CUSTOMER']);
      expect(user.isProfileComplete, false);
    });

    test('7. Address model serialization roundtrip', () {
      final original = const Address(
        id: 'addr_001',
        userId: 'usr_001',
        label: 'Home',
        addressLine1: 'Flat 402, Green Glen',
        addressLine2: 'Bellandur',
        landmark: 'Near EcoSpace',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560103',
        latitude: 12.9260,
        longitude: 77.6762,
        isDefault: true,
      );

      final json = original.toJson();
      final reconstructed = Address.fromJson(json);

      expect(reconstructed.id, original.id);
      expect(reconstructed.label, original.label);
      expect(reconstructed.postalCode, '560103');
      expect(reconstructed.isDefault, true);
      expect(reconstructed.formattedAddress, contains('Bellandur'));
      expect(reconstructed.formattedAddress, contains('Near EcoSpace'));
    });
  });
}
