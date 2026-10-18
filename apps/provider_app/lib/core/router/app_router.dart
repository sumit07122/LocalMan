import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/dashboard/presentation/screens/provider_dashboard_screen.dart';
import '../../features/auth/presentation/screens/provider_login_screen.dart';
import '../../features/auth/presentation/screens/provider_otp_screen.dart';
import '../../features/kyc/presentation/screens/provider_kyc_screen.dart';
import '../../features/jobs/presentation/screens/active_job_execution_screen.dart';
import '../../features/wallet/presentation/screens/provider_wallet_screen.dart';

final providerRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
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
          final phone = extra['phone'] as String? ?? '9876543210';
          final trade = extra['trade'] as String? ?? 'AC Repair';
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
          final id = state.pathParameters['id'] ?? 'LM-20261017-X82A';
          return ActiveJobExecutionScreen(bookingId: id);
        },
      ),
      GoRoute(
        path: '/wallet',
        name: 'wallet',
        builder: (context, state) => const ProviderWalletScreen(),
      ),
    ],
  );
});
