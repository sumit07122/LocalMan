import 'package:flutter_test/flutter_test.dart';
import 'package:localman_provider/shared/models/user_model.dart';
import 'package:localman_provider/shared/models/auth_session.dart';
import 'package:localman_provider/shared/models/provider_model.dart';
import 'package:localman_provider/shared/models/booking_model.dart';
import 'package:localman_provider/shared/models/wallet_model.dart';
import 'package:localman_provider/core/errors/api_error.dart';

void main() {
  group('Data Model Serialization & Calculation Tests', () {
    test('UserModel should serialize and deserialize accurately', () {
      final json = {
        'id': 'usr_999',
        'phoneNumber': '9876543210',
        'phoneCountryCode': '+91',
        'fullName': 'Suresh Verma',
        'email': 'suresh@localman.in',
        'avatarUrl': 'https://storage.localman.in/avatar.png',
        'roles': ['PROVIDER'],
        'isProfileComplete': true,
      };

      final user = UserModel.fromJson(json);
      expect(user.id, equals('usr_999'));
      expect(user.phoneNumber, equals('9876543210'));
      expect(user.fullName, equals('Suresh Verma'));
      expect(user.roles, contains('PROVIDER'));
      expect(user.isProfileComplete, isTrue);

      final output = user.toJson();
      expect(output['id'], equals('usr_999'));
      expect(output['fullName'], equals('Suresh Verma'));
    });

    test('AuthSession should parse nested user object and tokens', () {
      final json = {
        'accessToken': 'jwt_access_token_123',
        'refreshToken': 'jwt_refresh_token_456',
        'user': {
          'id': 'usr_888',
          'phoneNumber': '9123456789',
          'fullName': 'Amit Sharma',
          'roles': ['PROVIDER'],
        },
      };

      final session = AuthSession.fromJson(json);
      expect(session.accessToken, equals('jwt_access_token_123'));
      expect(session.refreshToken, equals('jwt_refresh_token_456'));
      expect(session.user.id, equals('usr_888'));
      expect(session.user.phoneNumber, equals('9123456789'));
    });

    test('ProviderProfile should parse VerificationStatus enum safely', () {
      final verifiedJson = {
        'id': 'prv_101',
        'userId': 'usr_101',
        'businessName': 'Amit Electricals',
        'verificationStatus': 'VERIFIED',
        'ratingAverage': 4.85,
        'ratingCount': 24,
        'isOnline': true,
      };

      final verifiedProfile = ProviderProfile.fromJson(verifiedJson);
      expect(verifiedProfile.verificationStatus, equals(VerificationStatus.verified));
      expect(verifiedProfile.verificationStatus.label, equals('Verified Pro'));
      expect(verifiedProfile.isOnline, isTrue);
      expect(verifiedProfile.ratingAverage, equals(4.85));

      final draftJson = {
        'id': 'prv_102',
        'userId': 'usr_102',
        'verificationStatus': 'UNKNOWN_OR_DRAFT',
      };
      final draftProfile = ProviderProfile.fromJson(draftJson);
      expect(draftProfile.verificationStatus, equals(VerificationStatus.draft));
    });

    test('Booking model should calculate Rupee conversions from authoritative Paisa amounts', () {
      final bookingJson = {
        'id': 'bkg_444',
        'bookingNumber': 'LM-20261018-T89A',
        'currentStatus': 'JOB_STARTED',
        'baseAmountPaisa': 50000, // ₹500.00
        'totalAmountPaisa': 65000, // ₹650.00
        'platformFeePaisa': 7500, // ₹75.00 (15%)
        'service': {'name': 'AC Jet Cleaning'},
        'customer': {'fullName': 'Pooja Nair', 'phoneNumber': '9898989898'},
        'address': {
          'line1': '101 Rosewood Apt',
          'city': 'Bengaluru',
          'postalCode': '560038',
        },
        'materials': [
          {
            'id': 'mat_1',
            'bookingId': 'bkg_444',
            'itemName': 'Capacitor 45uF',
            'unitPricePaisa': 15000, // ₹150.00
            'totalPricePaisa': 15000,
            'isCustomerApproved': true,
          },
          {
            'id': 'mat_2',
            'bookingId': 'bkg_444',
            'itemName': 'Unapproved Filter',
            'unitPricePaisa': 8000,
            'totalPricePaisa': 8000,
            'isCustomerApproved': false, // Not approved!
          },
        ],
      };

      final booking = Booking.fromJson(bookingJson);
      expect(booking.baseAmountRupees, equals(500.00));
      expect(booking.totalAmountRupees, equals(650.00));
      expect(booking.platformFeeRupees, equals(75.00));

      // Net payout must only include approved materials and base labor minus fee
      // Net Labor = 50000 - 7500 = 42500 Paisa (₹425.00)
      // Approved Materials = 15000 Paisa (₹150.00)
      // Net Payout = ₹425.00 + ₹150.00 = ₹575.00
      expect(booking.netPayoutRupees, equals(575.00));
    });

    test('WalletSummary should handle unavailable state gracefully', () {
      final summary = WalletSummary.unavailable();
      expect(summary.isBackendLedgerAvailable, isFalse);
      expect(summary.availableBalanceRupees, equals(0.0));
      expect(summary.recentLedger, isEmpty);
    });

    test('ApiError should handle network and timeout factories correctly', () {
      final networkErr = ApiError.network();
      expect(networkErr.statusCode, equals(0));
      expect(networkErr.errorCode, equals('NETWORK_UNAVAILABLE'));

      final timeoutErr = ApiError.timeout();
      expect(timeoutErr.statusCode, equals(408));
      expect(timeoutErr.errorCode, equals('REQUEST_TIMEOUT'));

      final serverErr = ApiError.fromJson({
        'statusCode': 422,
        'error': 'VALIDATION_ERROR',
        'message': 'Invalid OTP supplied',
      });
      expect(serverErr.statusCode, equals(422));
      expect(serverErr.errorCode, equals('VALIDATION_ERROR'));
      expect(serverErr.message, equals('Invalid OTP supplied'));
    });
  });
}
