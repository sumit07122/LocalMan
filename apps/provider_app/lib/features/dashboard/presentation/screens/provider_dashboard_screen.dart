import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../auth/domain/auth_state.dart';
import '../../jobs/data/booking_repository.dart';
import '../../wallet/data/wallet_repository.dart';
import '../data/provider_repository.dart';
import '../data/location_service.dart';
import '../../../shared/models/dispatch_offer_model.dart';

class ProviderDashboardScreen extends ConsumerStatefulWidget {
  const ProviderDashboardScreen({super.key});

  @override
  ConsumerState<ProviderDashboardScreen> createState() => _ProviderDashboardScreenState();
}

class _ProviderDashboardScreenState extends ConsumerState<ProviderDashboardScreen> {
  bool _isOnline = false;
  bool _isTogglingOnline = false;
  int _currentNavIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadProfileData();
  }

  Future<void> _loadProfileData() async {
    try {
      final profile = await ref.read(providerRepositoryProvider).getProfile();
      if (mounted) {
        setState(() {
          _isOnline = profile.isOnline;
        });
      }
    } catch (_) {}
  }

  Future<void> _toggleDuty(bool val) async {
    setState(() => _isTogglingOnline = true);
    try {
      final repo = ref.read(providerRepositoryProvider);
      final updated = await repo.toggleOnline(val);
      if (mounted) {
        setState(() {
          _isOnline = updated;
          _isTogglingOnline = false;
        });

        // Phase 2G: Sync foreground GPS beacon tracking with online state
        if (updated) {
          ref.read(locationServiceProvider.notifier).startForegroundTracking();
        } else {
          ref.read(locationServiceProvider.notifier).stopTracking();
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(updated ? 'Duty Status: ONLINE (GPS Tracking Active)' : 'Duty Status: OFFLINE'),
            backgroundColor: updated ? const Color(0xFF10B981) : const Color(0xFF64748B),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isTogglingOnline = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  void _handleLogout() async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log Out'),
        content: const Text('Are you sure you want to log out of your LocalMan Partner session?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white),
            child: const Text('Log Out'),
          ),
        ],
      ),
    );

    if (shouldLogout == true) {
      await ref.read(authNotifierProvider.notifier).logout();
    }
  }

  Future<void> _acceptBooking(String bookingId) async {
    try {
      final repo = ref.read(bookingRepositoryProvider);
      await repo.acceptBooking(bookingId);
      ref.refresh(providerBookingsFutureProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Job accepted! Heading to job execution.'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        context.push('/job/$bookingId');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to accept: $e'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  Future<void> _rejectBooking(String bookingId) async {
    try {
      final repo = ref.read(bookingRepositoryProvider);
      await repo.rejectBooking(bookingId, reason: 'Declined by partner from dashboard');
      ref.refresh(providerBookingsFutureProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Job request declined.'),
            backgroundColor: Color(0xFF64748B),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to decline: $e'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  Future<void> _acceptDispatchOffer(DispatchOfferModel offer) async {
    try {
      final repo = ref.read(bookingRepositoryProvider);
      final result = await repo.acceptDispatchOffer(offer.id);
      ref.refresh(activeDispatchOfferFutureProvider);
      ref.refresh(providerBookingsFutureProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Dispatch offer accepted! Proceeding to job execution.'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        final bookingId = result['booking']?['id'] as String? ?? offer.bookingId;
        context.push('/job/$bookingId');
      }
    } catch (e) {
      ref.refresh(activeDispatchOfferFutureProvider);
      ref.refresh(providerBookingsFutureProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Offer unavailable: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  Future<void> _rejectDispatchOffer(DispatchOfferModel offer) async {
    try {
      final repo = ref.read(bookingRepositoryProvider);
      await repo.rejectDispatchOffer(offer.id);
      ref.refresh(activeDispatchOfferFutureProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Job offer declined.'),
            backgroundColor: Color(0xFF64748B),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not decline offer: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }


  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final walletAsync = ref.watch(walletSummaryFutureProvider);
    final bookingsAsync = ref.watch(providerBookingsFutureProvider);
    final activeOfferAsync = ref.watch(activeDispatchOfferFutureProvider);
    final activeOffer = activeOfferAsync.value;

    final user = authState.user;
    final displayName = user?.fullName?.isNotEmpty == true
        ? user!.fullName!
        : (user?.phoneNumber != null ? '+91 ${user!.phoneNumber}' : 'LocalMan Partner');

    final availableBalanceStr = walletAsync.maybeWhen(
      data: (w) => '₹${w.availableBalanceRupees.toStringAsFixed(2)}',
      orElse: () => '₹0.00',
    );

    final bookings = bookingsAsync.value ?? [];
    final activeBookings = bookings.where((b) {
      return ['REQUESTED', 'CONFIRMED', 'PROVIDER_ACCEPTED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'JOB_STARTED'].contains(b.currentStatus);
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: const Color(0xFF0F172A),
              child: Text(
                displayName.isNotEmpty ? displayName[0].toUpperCase() : 'P',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    displayName,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const Row(
                    children: [
                      Icon(Icons.shield, size: 12, color: Color(0xFF10B981)),
                      SizedBox(width: 3),
                      Text(
                        'Partner Network',
                        style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF64748B), size: 20),
            tooltip: 'Refresh',
            onPressed: () {
              _loadProfileData();
              ref.refresh(walletSummaryFutureProvider);
              ref.refresh(providerBookingsFutureProvider);
              ref.refresh(activeDispatchOfferFutureProvider);
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Color(0xFF64748B), size: 20),
            tooltip: 'Log Out',
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: RefreshIndicator(
        color: const Color(0xFFF59E0B),
        onRefresh: () async {
          _loadProfileData();
          ref.refresh(walletSummaryFutureProvider);
          ref.refresh(providerBookingsFutureProvider);
          ref.refresh(activeDispatchOfferFutureProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Duty Status Switch Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _isOnline ? const Color(0xFF0F172A) : const Color(0xFF334155),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.12),
                      blurRadius: 12,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _isOnline ? const Color(0xFF10B981) : Colors.redAccent,
                        boxShadow: [
                          if (_isOnline)
                            BoxShadow(
                              color: const Color(0xFF10B981).withOpacity(0.6),
                              blurRadius: 10,
                              spreadRadius: 2,
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _isOnline ? 'DUTY STATUS: ONLINE' : 'DUTY STATUS: OFFLINE',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _isOnline
                                ? 'Online on partner network • Location beacon active'
                                : 'You are offline. Turn on switch to indicate duty availability.',
                            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    if (_isTogglingOnline)
                      const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    else
                      Switch.adaptive(
                        value: _isOnline,
                        activeColor: const Color(0xFF10B981),
                        activeTrackColor: const Color(0xFF065F46),
                        onChanged: _toggleDuty,
                      ),
                  ],
                ),
              ),

              // Phase 2G: GPS Operational Status Banner
              if (_isOnline) ...[
                const SizedBox(height: 8),
                Consumer(
                  builder: (context, ref, _) {
                    final locState = ref.watch(locationServiceProvider);
                    if (locState.status == LocationStateStatus.serviceDisabled ||
                        locState.status == LocationStateStatus.permissionDenied ||
                        locState.status == LocationStateStatus.permissionPermanentlyDenied ||
                        locState.status == LocationStateStatus.error) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFF59E0B)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.location_off, size: 20, color: Color(0xFFD97706)),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                locState.errorMessage ?? 'GPS signal unavailable. You may not receive proximity dispatch offers.',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF92400E), fontWeight: FontWeight.w600),
                              ),
                            ),
                            TextButton(
                              onPressed: () {
                                ref.read(locationServiceProvider.notifier).acquireAndSendCurrentLocation();
                              },
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                minimumSize: Size.zero,
                              ),
                              child: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11)),
                            ),
                          ],
                        ),
                      );
                    }
                    if (locState.status == LocationStateStatus.active && locState.position != null) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.gps_fixed, size: 16, color: Color(0xFF059669)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'GPS Active • ±${locState.position!.accuracy.toStringAsFixed(0)}m accuracy • Fresh',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF065F46), fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      );
                    }
                    return const SizedBox.shrink();
                  },
                ),
              ],

              if (activeOffer != null && !activeOffer.isExpired) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFEF3C7), Color(0xFFFDE68A)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFF59E0B), width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFF59E0B).withOpacity(0.2),
                        blurRadius: 14,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFD97706),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.flash_on, size: 13, color: Colors.white),
                                SizedBox(width: 4),
                                Text(
                                  'INCOMING DISPATCH OFFER',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '${activeOffer.remainingSeconds}s remaining',
                              style: const TextStyle(
                                color: Color(0xFFB45309),
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              activeOffer.serviceName,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ),
                          Text(
                            '₹${activeOffer.basePriceRupees.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '#${activeOffer.bookingNumber} • ${activeOffer.scheduledTimeSlot}',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.location_on, size: 14, color: Color(0xFFD97706)),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              activeOffer.addressFormatted,
                              style: const TextStyle(fontSize: 12, color: Color(0xFF334155)),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => _rejectDispatchOffer(activeOffer),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: Color(0xFFD97706)),
                                foregroundColor: const Color(0xFF92400E),
                              ),
                              child: const Text('Decline'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            flex: 2,
                            child: ElevatedButton.icon(
                              onPressed: () => _acceptDispatchOffer(activeOffer),
                              icon: const Icon(Icons.check_circle, size: 18),
                              label: const Text('Accept Job Now'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF10B981),
                                foregroundColor: Colors.white,
                                elevation: 0,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 20),

              // Performance / Metrics overview
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => context.push('/wallet'),
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Settlement Balance', style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.w600)),
                                Icon(Icons.arrow_forward_ios, size: 12, color: Color(0xFF94A3B8)),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(availableBalanceStr, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                            const SizedBox(height: 4),
                            const Text('Backend Ledger Auth', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Assigned Tasks', style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 6),
                          Text('${activeBookings.length} Active', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                          const SizedBox(height: 4),
                          Text(
                            activeBookings.isNotEmpty ? 'Tasks In Progress' : 'Awaiting Dispatch',
                            style: TextStyle(
                              fontSize: 11,
                              color: activeBookings.isNotEmpty ? const Color(0xFF10B981) : const Color(0xFF0284C7),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Active & Assigned Tasks List
              const Text(
                'Active & Assigned Tasks',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 12),

              bookingsAsync.when(
                loading: () => const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24.0),
                    child: CircularProgressIndicator(color: Color(0xFFF59E0B)),
                  ),
                ),
                error: (e, _) => Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Center(
                    child: Text('Could not load bookings: $e', style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
                  ),
                ),
                data: (allBookings) {
                  if (activeBookings.isEmpty) {
                    return Container(
                      padding: const EdgeInsets.all(24),
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.assignment_outlined, size: 36, color: Color(0xFFCBD5E1)),
                          SizedBox(height: 8),
                          Text('No active bookings currently', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A))),
                          SizedBox(height: 4),
                          Text('Keep duty status online to receive dispatch assignments in your area.', style: TextStyle(color: Color(0xFF64748B), fontSize: 11), textAlign: TextAlign.center),
                        ],
                      ),
                    );
                  }

                  return Column(
                    children: activeBookings.map((b) {
                      final isRequested = b.currentStatus == 'REQUESTED';
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isRequested ? const Color(0xFFF59E0B) : const Color(0xFFE2E8F0),
                            width: isRequested ? 1.5 : 1,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  b.serviceName,
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    b.currentStatus,
                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFB45309)),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(Icons.location_on_outlined, size: 14, color: Colors.grey),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    b.addressFormatted,
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            if (isRequested)
                              Row(
                                children: [
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: () => _rejectBooking(b.id),
                                      style: OutlinedButton.styleFrom(
                                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                                      ),
                                      child: const Text('Decline'),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    flex: 2,
                                    child: ElevatedButton(
                                      onPressed: () => _acceptBooking(b.id),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF10B981),
                                        foregroundColor: Colors.white,
                                      ),
                                      child: const Text('Accept Job'),
                                    ),
                                  ),
                                ],
                              )
                            else
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton.icon(
                                  onPressed: () => context.push('/job/${b.id}'),
                                  icon: const Icon(Icons.play_arrow, size: 18),
                                  label: const Text('Execute Job'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF0F172A),
                                    foregroundColor: Colors.white,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      );
                    }).toList(),
                  );
                },
              ),

              const SizedBox(height: 24),

              // KYC Status prompt card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.verified_user_outlined, color: Color(0xFFF59E0B), size: 22),
                        SizedBox(width: 10),
                        Text(
                          'Partner Verification Checklist',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF0F172A)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Ensure your Aadhaar, PAN card, and verified payout account are current for automated daily settlements.',
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () => context.push('/kyc'),
                        child: const Text('Update Verification Details'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentNavIndex,
        selectedItemColor: const Color(0xFFF59E0B),
        unselectedItemColor: const Color(0xFF64748B),
        type: BottomNavigationBarType.fixed,
        onTap: (index) {
          setState(() => _currentNavIndex = index);
          if (index == 1) {
            context.push('/wallet');
          } else if (index == 2) {
            context.push('/kyc');
          }
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'Dashboard'),
          BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet), label: 'Wallet'),
          BottomNavigationBarItem(icon: Icon(Icons.badge), label: 'KYC & Profile'),
        ],
      ),
    );
  }
}
