import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/auth_repository.dart';
import '../../../core/storage/token_storage.dart';
import '../../../shared/models/auth_session.dart';
import '../../../shared/models/user_model.dart';
import '../../../core/errors/app_exception.dart';

enum AuthStatus {
  initial,
  unauthenticated,
  authenticating,
  authenticated,
}

class AuthState {
  final AuthStatus status;
  final AuthSession? session;
  final UserModel? user;
  final String? errorMessage;
  final bool isLoading;

  const AuthState({
    this.status = AuthStatus.initial,
    this.session,
    this.user,
    this.errorMessage,
    this.isLoading = false,
  });

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    UserModel? user,
    String? errorMessage,
    bool? isLoading,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: session ?? this.session,
      user: user ?? this.user,
      errorMessage: errorMessage,
      isLoading: isLoading ?? this.isLoading,
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
    checkInitialAuth();
  }

  Future<void> checkInitialAuth() async {
    final hasSession = await _tokenStorage.hasValidSession();
    if (!hasSession) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
      return;
    }

    try {
      final user = await _authRepository.getCurrentUser();
      state = state.copyWith(
        status: AuthStatus.authenticated,
        user: user,
      );
    } catch (_) {
      // If token is rejected or network invalid, clear session
      await _tokenStorage.clearSession();
      state = state.copyWith(status: AuthStatus.unauthenticated);
    }
  }

  Future<bool> sendOtp(String phoneNumber) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _authRepository.sendOtp(phoneNumber: phoneNumber);
      state = state.copyWith(isLoading: false);
      return true;
    } on AppException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.message);
      return false;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to send OTP. Please check your network connection.',
      );
      return false;
    }
  }

  Future<bool> verifyOtp({
    required String phoneNumber,
    required String otp,
  }) async {
    state = state.copyWith(
      status: AuthStatus.authenticating,
      isLoading: true,
      errorMessage: null,
    );
    try {
      final session = await _authRepository.verifyOtp(
        phoneNumber: phoneNumber,
        otp: otp,
      );

      state = state.copyWith(
        status: AuthStatus.authenticated,
        session: session,
        user: session.user,
        isLoading: false,
      );
      return true;
    } on AppException catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        errorMessage: e.message,
      );
      return false;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        errorMessage: 'Verification failed. Please check the OTP code.',
      );
      return false;
    }
  }

  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    try {
      await _authRepository.logout();
    } finally {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }
}

final authNotifierProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  final storage = ref.watch(tokenStorageProvider);
  return AuthNotifier(authRepository: repo, tokenStorage: storage);
});
