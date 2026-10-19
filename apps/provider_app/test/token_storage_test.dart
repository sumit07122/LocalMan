import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:localman_provider/core/storage/token_storage.dart';

// Fake FlutterSecureStorage in-memory implementation for testing
class MockFlutterSecureStorage extends FlutterSecureStorage {
  final Map<String, String> _data = {};

  MockFlutterSecureStorage() : super();

  @override
  Future<void> write({
    required String key,
    required String? value,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (value != null) {
      _data[key] = value;
    } else {
      _data.remove(key);
    }
  }

  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    return _data[key];
  }

  @override
  Future<void> delete({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    _data.remove(key);
  }
}

void main() {
  group('TokenStorage Foundation Tests', () {
    late TokenStorage storage;
    late MockFlutterSecureStorage mockSecureStorage;

    setUp(() {
      mockSecureStorage = MockFlutterSecureStorage();
      storage = TokenStorage(storage: mockSecureStorage);
    });

    test('should report false for hasValidSession when no token is stored', () async {
      final isValid = await storage.hasValidSession();
      expect(isValid, isFalse);
      expect(await storage.getAccessToken(), isNull);
      expect(await storage.getRefreshToken(), isNull);
    });

    test('should save access and refresh tokens securely and report valid session', () async {
      await storage.saveTokens(
        accessToken: 'mock_jwt_access_token_xyz',
        refreshToken: 'mock_jwt_refresh_token_abc',
        userId: 'usr_test_123',
      );

      expect(await storage.hasValidSession(), isTrue);
      expect(await storage.getAccessToken(), equals('mock_jwt_access_token_xyz'));
      expect(await storage.getRefreshToken(), equals('mock_jwt_refresh_token_abc'));
      expect(await storage.getUserId(), equals('usr_test_123'));
    });

    test('should clear session completely on logout', () async {
      await storage.saveTokens(
        accessToken: 'access_123',
        refreshToken: 'refresh_456',
        userId: 'usr_123',
      );

      expect(await storage.hasValidSession(), isTrue);

      await storage.clearSession();

      expect(await storage.hasValidSession(), isFalse);
      expect(await storage.getAccessToken(), isNull);
      expect(await storage.getRefreshToken(), isNull);
      expect(await storage.getUserId(), isNull);
    });
  });
}
