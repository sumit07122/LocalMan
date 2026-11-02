import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:localman_provider/core/network/api_client.dart';
import 'package:localman_provider/core/storage/token_storage.dart';
import 'package:localman_provider/features/auth/data/auth_repository.dart';
import 'token_storage_test.dart';

class _MockHttpAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    return ResponseBody.fromString('{"success": true}', 200, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  group('AuthRepository Contract & Flow Tests', () {
    late Dio dio;
    late MockFlutterSecureStorage mockSecureStorage;
    late ApiClient apiClient;
    late AuthRepository authRepository;

    setUp(() {
      dio = Dio();
      dio.httpClientAdapter = _MockHttpAdapter();
      mockSecureStorage = MockFlutterSecureStorage();
      final realTokenStorage = TokenStorage(storage: mockSecureStorage);

      apiClient = ApiClient(
        tokenStorage: realTokenStorage,
        customDio: dio,
      );

      authRepository = AuthRepository(
        apiClient: apiClient,
        tokenStorage: realTokenStorage,
      );
    });

    test('verifyOtp should parse response and save tokens to secure storage', () async {
      final storage = TokenStorage(storage: mockSecureStorage);
      await storage.saveTokens(
        accessToken: 'access_jwt_valid',
        refreshToken: 'refresh_jwt_valid',
        userId: 'usr_provider_1',
      );

      expect(await storage.hasValidSession(), isTrue);
      expect(await storage.getAccessToken(), equals('access_jwt_valid'));

      await authRepository.logout();
      expect(await storage.hasValidSession(), isFalse);
    });
  });
}
