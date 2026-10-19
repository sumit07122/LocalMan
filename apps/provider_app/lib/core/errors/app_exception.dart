import 'api_error.dart';

abstract class AppException implements Exception {
  final String message;
  final ApiError? apiError;

  const AppException(this.message, [this.apiError]);

  @override
  String toString() => message;
}

class NetworkException extends AppException {
  const NetworkException([String message = 'Network connection unavailable', ApiError? error])
      : super(message, error);
}

class UnauthorizedException extends AppException {
  const UnauthorizedException([String message = 'Unauthorized access', ApiError? error])
      : super(message, error);
}

class ValidationException extends AppException {
  const ValidationException(String message, [ApiError? error])
      : super(message, error);
}

class ServerException extends AppException {
  const ServerException([String message = 'Internal server error', ApiError? error])
      : super(message, error);
}

class SessionExpiredException extends AppException {
  const SessionExpiredException([String message = 'Session has expired. Please log in again.'])
      : super(message);
}
