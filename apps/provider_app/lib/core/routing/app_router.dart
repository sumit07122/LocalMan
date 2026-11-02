import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/domain/auth_state.dart';
import '../../features/auth/presentation/screens/provider_login_screen.dart';
import '../../features/auth/presentation/screens/provider_otp_screen.dart';
import '../../features/dashboard/presentation/screens/provider_dashboard_screen.dart';
import '../../features/jobs/presentation/screens/active_job_execution_screen.dart';
import '../../features/kyc/presentation/screens/provider_kyc_screen.dart';
import '../../features/wallet/presentation/screens/provider_wallet_screen.dart';
import '../../features/reviews/presentation/screens/provider_reputation_screen.dart';

final providerRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authNotifierProvider);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: GoRouterRefreshStream(ref.watch(authNotifierProvider.notifier).stream),
    redirect: (context, state) {
      final isAuth = authState.isAuthenticated;
      final isLoggingIn = state.matchedLocation == '/login' || state.matchedLocation == '/otp';

      // 1. If auth state is still initializing, don't redirect yet
      if (authState.status == AuthStatus.initial) {
        return null;
      }

      // 2. Unauthenticated users cannot access protected routes
      if (!isAuth && !isLoggingIn) {
        return '/login';
      }

      // 3. Authenticated users should not see the login/otp screens
      if (isAuth && isLoggingIn) {
        return '/';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        name: 'dashboard',
        builder: (context, state) => const ProviderDashboardScreen(),
      ),
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const ProviderLoginScreen(),
      ),
      GoRoute(
        path: '/otp',
        name: 'otp',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          final phone = extra['phone'] as String? ?? '';
          final trade = extra['trade'] as String? ?? 'Professional';
          return ProviderOtpScreen(phoneNumber: phone, trade: trade);
        },
      ),
      GoRoute(
        path: '/kyc',
        name: 'kyc',
        builder: (context, state) => const ProviderKycScreen(),
      ),
      GoRoute(
        path: '/job/:id',
        name: 'job-execution',
        builder: (context, state) {
          final id = state.pathParameters['id'];
          if (id == null || id.isEmpty) {
            return const Scaffold(
              body: Center(child: Text('Invalid Job ID specified.')),
            );
          }
          return ActiveJobExecutionScreen(bookingId: id);
        },
      ),
      GoRoute(
        path: '/wallet',
        name: 'wallet',
        builder: (context, state) => const ProviderWalletScreen(),
      ),
      GoRoute(
        path: '/reputation',
        name: 'reputation',
        builder: (context, state) => const ProviderReputationScreen(),
      ),
    ],
  );
});

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final dynamic _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
