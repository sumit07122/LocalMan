import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/customer_repository.dart';
import '../../domain/customer_profile.dart';
import '../../../auth/presentation/controllers/auth_provider.dart';

class ProfileState {
  final bool isLoading;
  final CustomerProfile? profile;
  final String? errorMessage;

  const ProfileState({
    this.isLoading = false,
    this.profile,
    this.errorMessage,
  });

  ProfileState copyWith({
    bool? isLoading,
    CustomerProfile? profile,
    String? errorMessage,
  }) {
    return ProfileState(
      isLoading: isLoading ?? this.isLoading,
      profile: profile ?? this.profile,
      errorMessage: errorMessage,
    );
  }
}

class ProfileNotifier extends StateNotifier<ProfileState> {
  final ICustomerRepository _customerRepository;
  final Ref _ref;

  ProfileNotifier({
    required ICustomerRepository customerRepository,
    required Ref ref,
  })  : _customerRepository = customerRepository,
        _ref = ref,
        super(const ProfileState()) {
    loadProfile();
  }

  Future<void> loadProfile() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final profile = await _customerRepository.getProfile();
      state = state.copyWith(isLoading: false, profile: profile);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  Future<bool> updateProfile({
    String? fullName,
    String? email,
    String? preferredLanguage,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final updated = await _customerRepository.updateProfile(
        fullName: fullName,
        email: email,
        preferredLanguage: preferredLanguage,
      );
      state = state.copyWith(isLoading: false, profile: updated);

      // Sync with global auth user state
      final currentUser = _ref.read(authProvider).user;
      if (currentUser != null) {
        _ref.read(authProvider.notifier).updateUser(
              currentUser.copyWith(
                fullName: updated.fullName,
                email: updated.email,
                preferredLanguage: updated.preferredLanguage,
                isProfileComplete: updated.isProfileComplete,
              ),
            );
      }
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
      return false;
    }
  }
}

final profileProvider = StateNotifierProvider<ProfileNotifier, ProfileState>((ref) {
  final repo = ref.watch(customerRepositoryProvider);
  return ProfileNotifier(customerRepository: repo, ref: ref);
});
