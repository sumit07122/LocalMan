import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/env_config.dart';
import '../errors/api_error.dart';
import '../errors/app_exception.dart';
import '../storage/token_storage.dart';
import 'auth_interceptor.dart';

class ApiClient {
  late final Dio _dio;

  ApiClient({
    required ITokenStorage tokenStorage,
    Dio? customDio,
    SessionExpiredCallback? onSessionExpired,
  }) {
    _dio = customDio ??
        Dio(
          BaseOptions(
            baseUrl: EnvConfig.baseUrl,
            connectTimeout: EnvConfig.connectTimeout,
            receiveTimeout: EnvConfig.receiveTimeout,
            sendTimeout: EnvConfig.sendTimeout,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          ),
        );

    _dio.interceptors.add(
      AuthInterceptor(
        tokenStorage: tokenStorage,
        onSessionExpired: onSessionExpired,
      ),
    );

    // Logging ONLY in non-release mode with strict PII sanitization
    if (!kReleaseMode) {
      _dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            final sanitizedHeaders = _sanitizeMap(options.headers);
            final sanitizedData = options.data is Map<String, dynamic>
                ? _sanitizeMap(options.data as Map<String, dynamic>)
                : options.data;

            debugPrint('🌐 [HTTP] ${options.method} ${options.uri}');
            debugPrint('   Headers: $sanitizedHeaders');
            if (sanitizedData != null) {
              debugPrint('   Body: $sanitizedData');
            }
            return handler.next(options);
          },
          onResponse: (response, handler) {
            final sanitizedData = response.data is Map<String, dynamic>
                ? _sanitizeMap(response.data as Map<String, dynamic>)
                : response.data;
            debugPrint('✅ [HTTP ${response.statusCode}] ${response.requestOptions.uri}');
            debugPrint('   Response: $sanitizedData');
            return handler.next(response);
          },
          onError: (DioException err, handler) {
            debugPrint('❌ [HTTP ERROR ${err.response?.statusCode}] ${err.requestOptions.uri}');
            debugPrint('   Message: ${err.message}');
            return handler.next(err);
          },
        ),
      );
    }
  }

  Dio get rawDio => _dio;

  /// Sanitizes sensitive keys before printing to developer debug console
  static Map<String, dynamic> _sanitizeMap(Map<String, dynamic> source) {
    final sanitized = <String, dynamic>{};
    for (final entry in source.entries) {
      final keyLower = entry.key.toLowerCase().replaceAll(RegExp(r'[-_]'), '');
      if (EnvConfig.sanitizedLogKeys.contains(keyLower)) {
        sanitized[entry.key] = '[REDACTED_SENSITIVE]';
      } else if (entry.value is Map<String, dynamic>) {
        sanitized[entry.key] = _sanitizeMap(entry.value as Map<String, dynamic>);
      } else {
        sanitized[entry.key] = entry.value;
      }
    }
    return sanitized;
  }

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.get<T>(
        path,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.post<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.patch<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.put<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  AppException _handleDioError(DioException error) {
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return NetworkException('Connection timed out. Please try again.', ApiError.timeout());
    }

    if (error.type == DioExceptionType.connectionError) {
      return NetworkException(
        'Server unreachable. Please check your network or try again later.',
        ApiError.network(),
      );
    }

    final response = error.response;
    if (response != null && response.data != null && response.data is Map<String, dynamic>) {
      final apiErr = ApiError.fromJson(
        response.data as Map<String, dynamic>,
        response.statusCode ?? 500,
      );

      if (response.statusCode == 401) {
        return UnauthorizedException(apiErr.message, apiErr);
      }
      if (response.statusCode == 400 || response.statusCode == 422) {
        return ValidationException(apiErr.message, apiErr);
      }
      return ServerException(apiErr.message, apiErr);
    }

    return ServerException(
      error.message ?? 'An unexpected network error occurred.',
      ApiError(
        statusCode: response?.statusCode ?? 500,
        errorCode: 'UNKNOWN_ERROR',
        message: error.message ?? 'Unknown error',
      ),
    );
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  return ApiClient(tokenStorage: tokenStorage);
});
