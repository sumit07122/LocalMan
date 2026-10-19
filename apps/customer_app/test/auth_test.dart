import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/core/storage/token_storage.dart';
import 'package:localman_customer/features/auth/data/auth_repository.dart';
import 'package:localman_customer/features/auth/domain/auth_session.dart';
import 'package:localman_customer/features/auth/domain/user.dart';
import 'package:localman_customer/features/auth/presentation/controllers/auth_provider.dart';

class MockTokenStorage implements ITokenStorage {
  String? accessToken;
  String? refreshToken;
  String? userId;

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    String? userId,
  }) async {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.userId = userId;
  }

  @override
  Future<String?> getAccessToken() async => accessToken;

  @override
  Future<String?> getRefreshToken() async => refreshToken;

  @override
  Future<String?> getUserId() async => userId;

  @override
  Future<bool> hasValidSession() async => accessToken != null && accessToken!.isNotEmpty;

  @override
  Future<void> clearSession() async {
    accessToken = null;
    refreshToken = null;
    userId = null;
  }
}

class MockAuthRepository implements IAuthRepository {
  bool otpSent = false;
  bool shouldFail = false;
  String? lastPhoneNumber;
  String? lastOtp;

  final testUser = const User(
    id: 'usr_cust_001',
    phoneNumber: '9876543210',
    fullName: 'Ananya Sharma',
    email: 'ananya@example.com',
    roles: ['CUSTOMER'],
    isProfileComplete: true,
  );

  @override
  Future<void> sendOtp(String phoneNumber) async {
    if (shouldFail) throw Exception('SMS gateway rate limit exceeded');
    lastPhoneNumber = phoneNumber;
    otpSent = true;
  }

  @override
  Future<AuthSession> verifyOtp(String phoneNumber, String otp) async {
    if (shouldFail) throw Exception('Invalid OTP code');
    lastPhoneNumber = phoneNumber;
    lastOtp = otp;
    return AuthSession(
      accessToken: 'jwt_mock_access_token_123',
      refreshToken: 'jwt_mock_refresh_token_456',
      user: testUser,
    );
  }

  @override
  Future<User> getCurrentUser() async {
    if (shouldFail) throw Exception('Session expired');
    return testUser;
  }

  @override
  Future<void> logout() async {
    // remote revocation
  }
}

void main() {
  group('Auth Lifecycle & State Notifier Tests', () {
    late MockAuthRepository mockAuthRepo;
    late MockTokenStorage mockTokenStorage;
    late AuthNotifier authNotifier;

    setUp(() {
      mockAuthRepo = MockAuthRepository();
      mockTokenStorage = MockTokenStorage();
      authNotifier = AuthNotifier(
        authRepository: mockAuthRepo,
        tokenStorage: mockTokenStorage,
      );
    });

    test('1. sendOtp updates tempPhoneNumber on success', () async {
      final success = await authNotifier.sendOtp('9876543210');
      expect(success, true);
      expect(authNotifier.state.tempPhoneNumber, '9876543210');
      expect(mockAuthRepo.otpSent, true);
    });

    test('2. verifyOtp sets authenticated state and populates user', () async {
      await authNotifier.sendOtp('9876543210');
      final success = await authNotifier.verifyOtp('123456');

      expect(success, true);
      expect(authNotifier.state.status, AuthStatus.authenticated);
      expect(authNotifier.state.isAuthenticated, true);
      expect(authNotifier.state.user?.id, 'usr_cust_001');
      expect(authNotifier.state.user?.fullName, 'Ananya Sharma');
    });

    test('3. verifyOtp persists tokens to secure storage', () async {
      await authNotifier.sendOtp('9876543210');
      await authNotifier.verifyOtp('123456');

      expect(mockTokenStorage.accessToken, 'jwt_mock_access_token_123');
      expect(mockTokenStorage.refreshToken, 'jwt_mock_refresh_token_456');
      expect(mockTokenStorage.userId, 'usr_cust_001');
    });

    test('4. restoreSession restores user when valid token exists', () async {
      mockTokenStorage.accessToken = 'valid_token';
      mockTokenStorage.refreshToken = 'valid_refresh';

      await authNotifier.restoreSession();

      expect(authNotifier.state.status, AuthStatus.authenticated);
      expect(authNotifier.state.user?.id, 'usr_cust_001');
    });

    test('5. restoreSession clears tokens when remote verification fails', () async {
      mockTokenStorage.accessToken = 'expired_token';
      mockAuthRepo.shouldFail = true;

      await authNotifier.restoreSession();

      expect(authNotifier.state.status, AuthStatus.unauthenticated);
      expect(authNotifier.state.user, isNull);
      expect(mockTokenStorage.accessToken, isNull);
    });

    test('6. logout clears secure storage and resets state to unauthenticated', () async {
      mockTokenStorage.accessToken = 'valid_token';
      await authNotifier.restoreSession();

      await authNotifier.logout();

      expect(authNotifier.state.status, AuthStatus.unauthenticated);
      expect(authNotifier.state.user, isNull);
      expect(mockTokenStorage.accessToken, isNull);
    });
  });
}
