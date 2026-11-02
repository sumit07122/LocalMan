import 'api_error.dart';

abstract class AppException implements Exception {
  final String message;
  final ApiError? apiError;

  const AppException(this.message, [this.apiError]);

  @override
  String toString() => message;
}

class ApiValidationError {
  final String field;
  final String message;
  const ApiValidationError({required this.field, required this.message});
}

class NetworkException extends AppException {
  final int? statusCode;
  const NetworkException([String message = 'Network connection unavailable', ApiError? error, this.statusCode])
      : super(message, error);
}

class UnauthorizedException extends AppException {
  const UnauthorizedException([String message = 'Unauthorized access', ApiError? error])
      : super(message, error);
}

class ForbiddenException extends AppException {
  final int statusCode;
  const ForbiddenException([String message = 'Forbidden', ApiError? error])
      : statusCode = 403,
        super(message, error);
}

class ConflictException extends AppException {
  final int statusCode;
  const ConflictException([String message = 'Conflict', ApiError? error])
      : statusCode = 409,
        super(message, error);
}

class ValidationException extends AppException {
  final List<ApiValidationError>? errors;
  const ValidationException(String message, {this.errors, ApiError? error})
      : super(message, error);
}

class NotFoundException extends AppException {
  final int statusCode;
  const NotFoundException([String message = 'Resource not found', ApiError? error])
      : statusCode = 404,
        super(message, error);
}

class ApiException extends AppException {
  final int? statusCode;
  final String? code;

  const ApiException({
    required String message,
    this.statusCode,
    this.code,
    ApiError? apiError,
  }) : super(message, apiError);
}

class ServerException extends AppException {
  const ServerException([String message = 'Internal server error', ApiError? error])
      : super(message, error);
}

class SessionExpiredException extends AppException {
  const SessionExpiredException([String message = 'Session has expired. Please log in again.'])
      : super(message);
}
