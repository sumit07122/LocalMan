import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/storage/token_storage.dart';
import '../../data/auth_repository.dart';
import '../../domain/user.dart';

enum AuthStatus {
  initial,
  loading,
  authenticated,
  unauthenticated,
  error,
}

class AuthState {
  final AuthStatus status;
  final User? user;
  final String? errorMessage;
  final String? tempPhoneNumber;

  const AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.errorMessage,
    this.tempPhoneNumber,
  });

  bool get isAuthenticated => status == AuthStatus.authenticated && user != null;
  bool get isLoading => status == AuthStatus.loading;

  AuthState copyWith({
    AuthStatus? status,
    User? user,
    String? errorMessage,
    String? tempPhoneNumber,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      errorMessage: errorMessage,
      tempPhoneNumber: tempPhoneNumber ?? this.tempPhoneNumber,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final IAuthRepository _authRepository;
  final ITokenStorage _tokenStorage;

  AuthNotifier({
    required IAuthRepository authRepository,
    required ITokenStorage tokenStorage,
  })  : _authRepository = authRepository,
        _tokenStorage = tokenStorage,
        super(const AuthState()) {
    restoreSession();
  }

  /// Restores session on app startup if secure tokens exist
  Future<void> restoreSession() async {
    final hasSession = await _tokenStorage.hasValidSession();
    if (!hasSession) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
      return;
    }

    state = state.copyWith(status: AuthStatus.loading);
    try {
      final user = await _authRepository.getCurrentUser();
      state = state.copyWith(
        status: AuthStatus.authenticated,
        user: user,
      );
    } catch (_) {
      // Remote token validation failed or expired
      await _tokenStorage.clearSession();
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        user: null,
      );
    }
  }

  /// Requests OTP for phone number
  Future<bool> sendOtp(String phoneNumber) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      await _authRepository.sendOtp(phoneNumber);
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        tempPhoneNumber: phoneNumber,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  /// Verifies OTP and persists authenticated session
  Future<bool> verifyOtp(String otp) async {
    final phone = state.tempPhoneNumber;
    if (phone == null || phone.isEmpty) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: 'Mobile number missing. Please start login again.',
      );
      return false;
    }

    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final session = await _authRepository.verifyOtp(phone, otp);
      await _tokenStorage.saveTokens(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        userId: session.user.id,
      );
      state = state.copyWith(
        status: AuthStatus.authenticated,
        user: session.user,
        tempPhoneNumber: null,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  /// Logs out user and clears local tokens
  Future<void> logout() async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      await _authRepository.logout();
    } finally {
      await _tokenStorage.clearSession();
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  /// Updates authenticated user in local state (e.g. after profile update)
  void updateUser(User updated) {
    if (state.isAuthenticated) {
      state = state.copyWith(user: updated);
    }
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final authRepo = ref.watch(authRepositoryProvider);
  final tokenStorage = ref.watch(tokenStorageProvider);
  return AuthNotifier(authRepository: authRepo, tokenStorage: tokenStorage);
});
