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
            if (sanitizedData != null) {
              debugPrint('   Response: $sanitizedData');
            }
            return handler.next(response);
          },
          onError: (DioException error, handler) {
            debugPrint('❌ [HTTP ERROR ${error.response?.statusCode}] ${error.requestOptions.uri}');
            debugPrint('   Message: ${error.message}');
            if (error.response?.data != null) {
              debugPrint('   Error Data: ${error.response?.data}');
            }
            return handler.next(error);
          },
        ),
      );
    }
  }

  Dio get dio => _dio;

  // Sanitizes any map by replacing sensitive keys with [REDACTED]
  static Map<String, dynamic> _sanitizeMap(Map<String, dynamic> input) {
    final sanitized = <String, dynamic>{};
    for (final entry in input.entries) {
      final keyLower = entry.key.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
      if (EnvConfig.sanitizedLogKeys.contains(keyLower)) {
        sanitized[entry.key] = '[REDACTED]';
      } else if (entry.value is Map<String, dynamic>) {
        sanitized[entry.key] = _sanitizeMap(entry.value as Map<String, dynamic>);
      } else {
        sanitized[entry.key] = entry.value;
      }
    }
    return sanitized;
  }

  // GET
  Future<dynamic> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      final response = await _dio.get(
        path,
        queryParameters: queryParameters,
        options: options,
      );
      return _extractData(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  // POST
  Future<dynamic> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      final response = await _dio.post(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
      return _extractData(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  // PUT
  Future<dynamic> put(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      final response = await _dio.put(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
      return _extractData(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  // PATCH
  Future<dynamic> patch(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      final response = await _dio.patch(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
      return _extractData(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  // DELETE
  Future<dynamic> delete(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      final response = await _dio.delete(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
      return _extractData(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  dynamic _extractData(Response response) {
    if (response.data is Map<String, dynamic>) {
      final map = response.data as Map<String, dynamic>;
      if (map.containsKey('data')) {
        return map['data'];
      }
    }
    return response.data;
  }

  AppException _handleDioError(DioException error) {
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return NetworkException(
        'Request timed out. Please check your internet connection.',
        ApiError.timeout(),
      );
    }

    if (error.type == DioExceptionType.connectionError) {
      return NetworkException(
        'Unable to connect to LocalMan server. Please verify network access.',
        ApiError.network(),
      );
    }

    final response = error.response;
    if (response != null && response.data is Map<String, dynamic>) {
      final apiError = ApiError.fromJson(
        response.data as Map<String, dynamic>,
        response.statusCode ?? 500,
      );

      switch (response.statusCode) {
        case 401:
          return UnauthorizedException(apiError.message, apiError);
        case 400:
        case 422:
          return ValidationException(apiError.message, error: apiError);
        case 403:
          return UnauthorizedException(apiError.message, apiError);
        case 500:
        default:
          return ServerException(apiError.message, apiError);
      }
    }

    return ServerException(
      error.message ?? 'An unexpected network error occurred.',
      ApiError(
        statusCode: error.response?.statusCode ?? 500,
        errorCode: 'UNKNOWN_ERROR',
        message: error.message ?? 'An unexpected error occurred.',
      ),
    );
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(tokenStorageProvider);
  return ApiClient(tokenStorage: storage);
});
