import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/controllers/auth_provider.dart';
import '../../features/auth/presentation/screens/phone_input_screen.dart';
import '../../features/auth/presentation/screens/otp_verify_screen.dart';
import '../../features/home/presentation/screens/customer_home_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/addresses/presentation/screens/address_list_screen.dart';
import '../../features/addresses/presentation/screens/address_edit_screen.dart';
import '../../features/addresses/domain/address.dart';
import '../../features/bookings/presentation/screens/bookings_list_screen.dart';
import '../../features/bookings/presentation/screens/booking_details_screen.dart';
import '../../features/bookings/presentation/screens/booking_creation_screen.dart';
import '../../features/bookings/presentation/screens/booking_confirmation_screen.dart';
import '../../features/support/presentation/screens/support_screen.dart';
import '../../features/services/presentation/screens/category_services_screen.dart';
import '../../features/services/presentation/screens/service_search_screen.dart';
import '../../features/services/presentation/screens/service_detail_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/home',
    redirect: (BuildContext context, GoRouterState state) {
      final isAuthenticated = authState.isAuthenticated;
      final isAuthLoading = authState.isLoading && authState.status == AuthStatus.initial;
      final path = state.uri.path;

      // Do not redirect while checking initial stored credentials
      if (isAuthLoading) return null;

      final isAuthRoute = path == '/login' || path == '/otp';
      final isProtectedRoute = path.startsWith('/profile') ||
          path.startsWith('/addresses') ||
          path.startsWith('/bookings') ||
          path.startsWith('/booking/') ||
          path.startsWith('/book-service') ||
          path.startsWith('/booking-confirmation/');

      // Unauthenticated users attempting to access protected screens go to /login
      if (!isAuthenticated && isProtectedRoute) {
        return '/login';
      }

      // Authenticated users attempting to visit auth screens go to /home
      if (isAuthenticated && isAuthRoute) {
        return '/home';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        redirect: (_, __) => '/home',
      ),
      GoRoute(
        path: '/home',
        name: 'home',
        builder: (context, state) => const CustomerHomeScreen(),
      ),
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const PhoneInputScreen(),
      ),
      GoRoute(
        path: '/otp',
        name: 'otp',
        builder: (context, state) {
          final phone = state.extra as String? ?? authState.tempPhoneNumber ?? '';
          return OtpVerifyScreen(phoneNumber: phone);
        },
      ),
      GoRoute(
        path: '/profile',
        name: 'profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/addresses',
        name: 'addresses',
        builder: (context, state) => const AddressListScreen(),
        routes: [
          GoRoute(
            path: 'new',
            name: 'address-new',
            builder: (context, state) => const AddressEditScreen(),
          ),
          GoRoute(
            path: 'edit',
            name: 'address-edit',
            builder: (context, state) {
              final addr = state.extra as Address?;
              return AddressEditScreen(existingAddress: addr);
            },
          ),
        ],
      ),
      GoRoute(
        path: '/bookings',
        name: 'bookings',
        builder: (context, state) => const BookingsListScreen(),
      ),
      GoRoute(
        path: '/booking/:id',
        name: 'booking-details',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return BookingDetailsScreen(bookingId: id);
        },
      ),
      GoRoute(
        path: '/book-service',
        name: 'book-service',
        builder: (context, state) {
          final serviceId = state.uri.queryParameters['serviceId'] ?? '';
          return BookingCreationScreen(initialServiceId: serviceId);
        },
      ),
      GoRoute(
        path: '/booking-confirmation/:id',
        name: 'booking-confirmation',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return BookingConfirmationScreen(bookingId: id);
        },
      ),
      GoRoute(
        path: '/support',
        name: 'support',
        builder: (context, state) => const SupportScreen(),
      ),
      GoRoute(
        path: '/category/:id',
        name: 'category-services',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return CategoryServicesScreen(categoryId: id);
        },
      ),
      GoRoute(
        path: '/search',
        name: 'service-search',
        builder: (context, state) {
          final categoryId = state.uri.queryParameters['categoryId'];
          return ServiceSearchScreen(initialCategoryId: categoryId);
        },
      ),
      GoRoute(
        path: '/service/:id',
        name: 'service-detail',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return ServiceDetailScreen(serviceId: id);
        },
      ),
    ],
  );
});
