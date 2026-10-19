class ApiError {
  final int statusCode;
  final String errorCode;
  final String message;
  final dynamic details;

  const ApiError({
    required this.statusCode,
    required this.errorCode,
    required this.message,
    this.details,
  });

  factory ApiError.fromJson(Map<String, dynamic> json, [int fallbackStatusCode = 500]) {
    final status = json['statusCode'] as int? ?? fallbackStatusCode;
    final code = json['error'] as String? ?? json['errorCode'] as String? ?? 'INTERNAL_SERVER_ERROR';
    final msg = json['message'] as String? ?? 'An unexpected server error occurred.';
    return ApiError(
      statusCode: status,
      errorCode: code,
      message: msg,
      details: json['details'],
    );
  }

  factory ApiError.network([String message = 'Unable to connect to LocalMan server. Please check your internet connection.']) {
    return ApiError(
      statusCode: 0,
      errorCode: 'NETWORK_UNAVAILABLE',
      message: message,
    );
  }

  factory ApiError.timeout([String message = 'The request timed out. Please try again.']) {
    return ApiError(
      statusCode: 408,
      errorCode: 'REQUEST_TIMEOUT',
      message: message,
    );
  }

  factory ApiError.unauthorized([String message = 'Session expired. Please log in again.']) {
    return ApiError(
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: message,
    );
  }

  Map<String, dynamic> toJson() => {
    'statusCode': statusCode,
    'errorCode': errorCode,
    'message': message,
    'details': details,
  };

  @override
  String toString() => 'ApiError(statusCode: $statusCode, errorCode: $errorCode, message: $message)';
}
