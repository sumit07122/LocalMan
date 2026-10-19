import 'package:dio/dio.dart';
import '../storage/token_storage.dart';
import '../constants/api_constants.dart';

typedef SessionExpiredCallback = void Function();

class AuthInterceptor extends QueuedInterceptor {
  final ITokenStorage _tokenStorage;
  final Dio _refreshDio;
  final SessionExpiredCallback? onSessionExpired;

  AuthInterceptor({
    required ITokenStorage tokenStorage,
    Dio? refreshDio,
    this.onSessionExpired,
  })  : _tokenStorage = tokenStorage,
        _refreshDio = refreshDio ?? Dio();

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Skip auth header for login and OTP endpoints
    final isAuthEndpoint = options.path.contains('/auth/otp/') ||
        options.path.contains('/auth/refresh');

    if (!isAuthEndpoint) {
      final token = await _tokenStorage.getAccessToken();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }

    options.headers['Accept'] = 'application/json';
    return handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final is401 = err.response?.statusCode == 401;
    final isRefreshEndpoint = err.requestOptions.path.contains('/auth/refresh');
    final isAuthOtp = err.requestOptions.path.contains('/auth/otp/');

    // Handle 401 on an authenticated endpoint
    if (is401 && !isRefreshEndpoint && !isAuthOtp) {
      final refreshToken = await _tokenStorage.getRefreshToken();
      if (refreshToken != null && refreshToken.isNotEmpty) {
        try {
          // Attempt token refresh with dedicated clean Dio instance
          final response = await _refreshDio.post(
            ApiConstants.refresh,
            data: {'refreshToken': refreshToken},
            options: Options(headers: {'Accept': 'application/json'}),
          );

          if (response.statusCode == 200 && response.data != null) {
            final raw = response.data as Map<String, dynamic>;
            final data = (raw['data'] is Map<String, dynamic>)
                ? raw['data'] as Map<String, dynamic>
                : raw;
            final newAccessToken = data['accessToken'] as String?;
            final newRefreshToken = data['refreshToken'] as String? ?? refreshToken;

            if (newAccessToken != null) {
              await _tokenStorage.saveTokens(
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
              );

              // Retry original request with the renewed access token
              final retryOptions = err.requestOptions;
              retryOptions.headers['Authorization'] = 'Bearer $newAccessToken';

              final retryResponse = await _refreshDio.fetch(retryOptions);
              return handler.resolve(retryResponse);
            }
          }
        } catch (_) {
          // Refresh failed - session is irreversibly expired
          await _tokenStorage.clearSession();
          onSessionExpired?.call();
        }
      } else {
        // No refresh token available
        await _tokenStorage.clearSession();
        onSessionExpired?.call();
      }
    }

    return handler.next(err);
  }
}
