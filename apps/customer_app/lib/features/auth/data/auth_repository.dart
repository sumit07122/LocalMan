import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../domain/auth_session.dart';
import '../domain/user.dart';

abstract class IAuthRepository {
  Future<void> sendOtp(String phoneNumber);
  Future<AuthSession> verifyOtp(String phoneNumber, String otp);
  Future<User> getCurrentUser();
  Future<void> logout();
}

class AuthRepository implements IAuthRepository {
  final ApiClient _apiClient;
  final ITokenStorage _tokenStorage;

  AuthRepository({
    required ApiClient apiClient,
    required ITokenStorage tokenStorage,
  })  : _apiClient = apiClient,
        _tokenStorage = tokenStorage;

  @override
  Future<void> sendOtp(String phoneNumber) async {
    await _apiClient.post(
      ApiConstants.sendOtp,
      data: {
        'phoneNumber': phoneNumber,
        'role': 'CUSTOMER',
      },
    );
  }

  @override
  Future<AuthSession> verifyOtp(String phoneNumber, String otp) async {
    final response = await _apiClient.post(
      ApiConstants.verifyOtp,
      data: {
        'phoneNumber': phoneNumber,
        'otp': otp,
        'role': 'CUSTOMER',
      },
    );

    final raw = response as Map<String, dynamic>;
    final session = AuthSession.fromJson(raw);

    // Persist securely to device keychain / encrypted preferences
    await _tokenStorage.saveTokens(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      userId: session.user.id,
    );

    return session;
  }

  @override
  Future<User> getCurrentUser() async {
    final response = await _apiClient.get(ApiConstants.me);
    final raw = response as Map<String, dynamic>;
    return User.fromJson(raw);
  }

  @override
  Future<void> logout() async {
    try {
      final refreshToken = await _tokenStorage.getRefreshToken();
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _apiClient.post(
          ApiConstants.logout,
          data: {'refreshToken': refreshToken},
        );
      }
    } catch (_) {
      // Best-effort remote revocation; always proceed to clear local secure tokens
    } finally {
      await _tokenStorage.clearSession();
    }
  }
}

final authRepositoryProvider = Provider<IAuthRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  final tokenStorage = ref.watch(tokenStorageProvider);
  return AuthRepository(apiClient: apiClient, tokenStorage: tokenStorage);
});
