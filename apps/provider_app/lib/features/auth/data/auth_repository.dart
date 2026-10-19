import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/storage/token_storage.dart';
import '../../../shared/models/auth_session.dart';
import '../../../shared/models/user_model.dart';

abstract class IAuthRepository {
  Future<Map<String, dynamic>> sendOtp({
    required String phoneNumber,
    String phoneCountryCode = '+91',
    String role = 'PROVIDER',
  });

  Future<AuthSession> verifyOtp({
    required String phoneNumber,
    required String otp,
    String phoneCountryCode = '+91',
    String role = 'PROVIDER',
  });

  Future<UserModel> getCurrentUser();

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
  Future<Map<String, dynamic>> sendOtp({
    required String phoneNumber,
    String phoneCountryCode = '+91',
    String role = 'PROVIDER',
  }) async {
    final response = await _apiClient.post(
      ApiConstants.sendOtp,
      data: {
        'phoneNumber': phoneNumber,
        'phoneCountryCode': phoneCountryCode,
        'role': role,
      },
    );

    return (response.data as Map<String, dynamic>?) ?? {};
  }

  @override
  Future<AuthSession> verifyOtp({
    required String phoneNumber,
    required String otp,
    String phoneCountryCode = '+91',
    String role = 'PROVIDER',
  }) async {
    final response = await _apiClient.post(
      ApiConstants.verifyOtp,
      data: {
        'phoneNumber': phoneNumber,
        'phoneCountryCode': phoneCountryCode,
        'otp': otp,
        'role': role,
      },
    );

    final data = (response.data as Map<String, dynamic>?) ?? {};
    final session = AuthSession.fromJson(data);

    // Persist session tokens securely
    await _tokenStorage.saveTokens(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      userId: session.user.id,
    );

    return session;
  }

  @override
  Future<UserModel> getCurrentUser() async {
    final response = await _apiClient.get(ApiConstants.me);
    final data = (response.data as Map<String, dynamic>?) ?? {};
    return UserModel.fromJson(data);
  }

  @override
  Future<void> logout() async {
    final refreshToken = await _tokenStorage.getRefreshToken();
    if (refreshToken != null && refreshToken.isNotEmpty) {
      try {
        await _apiClient.post(
          ApiConstants.logout,
          data: {'refreshToken': refreshToken},
        );
      } catch (_) {
        // Proceed with local logout regardless of network state
      }
    }
    await _tokenStorage.clearSession();
  }
}

final authRepositoryProvider = Provider<IAuthRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  final tokenStorage = ref.watch(tokenStorageProvider);
  return AuthRepository(apiClient: apiClient, tokenStorage: tokenStorage);
});
