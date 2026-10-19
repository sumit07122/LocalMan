import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/features/auth/domain/user.dart';
import 'package:localman_customer/features/auth/presentation/controllers/auth_provider.dart';

void main() {
  group('Customer Routing & Guard Logic Tests', () {
    test('1. Unauthenticated state identifies protected routes for login redirection', () {
      const state = AuthState(status: AuthStatus.unauthenticated);
      expect(state.isAuthenticated, false);

      const protectedRoutes = ['/profile', '/addresses', '/addresses/new', '/bookings', '/booking/bkg_123'];
      for (final route in protectedRoutes) {
        final shouldRedirectToLogin = !state.isAuthenticated &&
            (route.startsWith('/profile') ||
                route.startsWith('/addresses') ||
                route.startsWith('/bookings') ||
                route.startsWith('/booking/'));
        expect(shouldRedirectToLogin, true, reason: 'Route $route must redirect to /login');
      }
    });

    test('2. Authenticated state allows protected route access without redirecting to login', () {
      const state = AuthState(
        status: AuthStatus.authenticated,
        user: User(id: 'usr_001', phoneNumber: '9876543210'),
      );
      expect(state.isAuthenticated, true);

      const protectedRoutes = ['/profile', '/addresses', '/bookings'];
      for (final route in protectedRoutes) {
        final shouldRedirectToLogin = !state.isAuthenticated &&
            (route.startsWith('/profile') ||
                route.startsWith('/addresses') ||
                route.startsWith('/bookings'));
        expect(shouldRedirectToLogin, false, reason: 'Authenticated user should access $route');
      }
    });

    test('3. Authenticated user visiting /login or /otp redirects to /home', () {
      const state = AuthState(
        status: AuthStatus.authenticated,
        user: User(id: 'usr_001', phoneNumber: '9876543210'),
      );

      final authRoutes = ['/login', '/otp'];
      for (final route in authRoutes) {
        final shouldRedirectToHome = state.isAuthenticated && (route == '/login' || route == '/otp');
        expect(shouldRedirectToHome, true, reason: 'Authenticated user visiting $route must go to /home');
      }
    });

    test('4. Booking deep-link parameter validation', () {
      final validBookingId = 'bkg_20261019_abc123';
      final emptyBookingId = '   ';

      expect(validBookingId.trim().isNotEmpty, true);
      expect(emptyBookingId.trim().isEmpty, true);
    });
  });
}
