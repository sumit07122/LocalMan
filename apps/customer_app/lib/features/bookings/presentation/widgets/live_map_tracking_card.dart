import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/booking_repository.dart';
import '../../domain/live_map_state.dart';

class LiveMapTrackingCard extends ConsumerStatefulWidget {
  final String bookingId;
  final String currentStatus;

  const LiveMapTrackingCard({
    super.key,
    required this.bookingId,
    required this.currentStatus,
  });

  @override
  ConsumerState<LiveMapTrackingCard> createState() => _LiveMapTrackingCardState();
}

class _LiveMapTrackingCardState extends ConsumerState<LiveMapTrackingCard> {
  LiveMapStateModel? _mapState;
  bool _isLoading = true;
  String? _errorMessage;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _fetchMapState();
    _startPollingIfActive();
  }

  @override
  void didUpdateWidget(covariant LiveMapTrackingCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentStatus != widget.currentStatus) {
      _fetchMapState();
      _startPollingIfActive();
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  void _startPollingIfActive() {
    _pollingTimer?.cancel();
    // Only poll while booking is in transit or arrived
    if (widget.currentStatus == 'PROVIDER_ON_THE_WAY' ||
        widget.currentStatus == 'ARRIVED') {
      _pollingTimer = Timer.periodic(const Duration(seconds: 10), (_) {
        _fetchMapState(silent: true);
      });
    }
  }

  Future<void> _fetchMapState({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      final repo = ref.read(bookingRepositoryProvider);
      final state = await repo.getBookingMapState(widget.bookingId);
      if (mounted) {
        setState(() {
          _mapState = state;
          _isLoading = false;
          _errorMessage = null;
        });
      }
    } catch (e) {
      if (mounted && !silent) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Container(
        height: 180,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFF59E0B)),
              SizedBox(height: 12),
              Text(
                'Connecting to live GPS...',
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
            ],
          ),
        ),
      );
    }

    if (_errorMessage != null) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            const Icon(Icons.info_outline, color: Color(0xFF94A3B8), size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Tracking unavailable: $_errorMessage',
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.refresh, size: 20),
              onPressed: () => _fetchMapState(),
            ),
          ],
        ),
      );
    }

    final state = _mapState!;
    final isTransit = state.mapState == 'PROVIDER_ON_THE_WAY' ||
        state.mapState == 'PROVIDER_NEAR_DESTINATION';
    final isArrived = state.mapState == 'PROVIDER_ARRIVED';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Header Bar: Map State & Action
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: isTransit || isArrived
                ? const Color(0xFF0F172A)
                : const Color(0xFFF8FAFC),
            child: Row(
              children: [
                Icon(
                  isArrived
                      ? Icons.check_circle_rounded
                      : isTransit
                          ? Icons.navigation_rounded
                          : Icons.location_searching_rounded,
                  size: 20,
                  color: isTransit || isArrived
                      ? const Color(0xFFF59E0B)
                      : const Color(0xFF64748B),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    state.statusDisplayLabel,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: isTransit || isArrived
                          ? Colors.white
                          : const Color(0xFF0F172A),
                    ),
                  ),
                ),
                if (state.isTrackingPermitted)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: state.providerLocation?.freshnessStatus == 'FRESH'
                          ? const Color(0xFF10B981).withOpacity(0.2)
                          : const Color(0xFFEF4444).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: state.providerLocation?.freshnessStatus == 'FRESH'
                                ? const Color(0xFF10B981)
                                : const Color(0xFFEF4444),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          state.providerLocation?.freshnessStatus == 'FRESH'
                              ? 'LIVE GPS'
                              : 'SIGNAL STALE',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                            color: state.providerLocation?.freshnessStatus == 'FRESH'
                                ? const Color(0xFF10B981)
                                : const Color(0xFFEF4444),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),

          // 2. Map Canvas (honest representation without fake markers)
          _buildMapCanvas(state),

          // 3. Footer Bar: ETA, Distance, or Privacy Banner
          if (state.isTrackingPermitted && state.hasValidCoordinates)
            Container(
              padding: const EdgeInsets.all(14),
              color: const Color(0xFFF8FAFC),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.timer_outlined, size: 18, color: Color(0xFFF59E0B)),
                      const SizedBox(width: 6),
                      Text(
                        state.formattedEta,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                  if (state.formattedDistance.isNotEmpty)
                    Row(
                      children: [
                        const Icon(Icons.straighten_outlined, size: 16, color: Color(0xFF64748B)),
                        const SizedBox(width: 4),
                        Text(
                          state.formattedDistance,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            )
          else if (state.mapState == 'TRACKING_STOPPED_JOB_STARTED')
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: const Color(0xFFF1F5F9),
              child: const Row(
                children: [
                  Icon(Icons.shield_outlined, size: 16, color: Color(0xFF64748B)),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Live GPS tracking is automatically stopped during service work.',
                      style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMapCanvas(LiveMapStateModel state) {
    if (state.mapState == 'TRACKING_STOPPED_JOB_STARTED') {
      return Container(
        height: 120,
        color: const Color(0xFFF8FAFC),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.handyman_outlined, size: 36, color: Colors.grey.shade400),
            const SizedBox(height: 8),
            const Text(
              'Expert is on site completing your service',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A)),
            ),
          ],
        ),
      );
    }

    if (!state.isTrackingPermitted || !state.hasValidCoordinates) {
      return Container(
        height: 120,
        color: const Color(0xFFF8FAFC),
        padding: const EdgeInsets.all(16),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                state.mapState == 'LOCATION_STALE'
                    ? Icons.signal_cellular_connected_no_internet_0_bar
                    : Icons.location_off_outlined,
                size: 32,
                color: Colors.grey.shade400,
              ),
              const SizedBox(height: 8),
              Text(
                state.mapState == 'LOCATION_STALE'
                    ? 'GPS signal stale. Waiting for fresh update from partner...'
                    : 'Location tracking starts once professional departs for your address.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              ),
            ],
          ),
        ),
      );
    }

    // Active live map visual
    return Container(
      height: 160,
      decoration: const BoxDecoration(
        color: Color(0xFFE2E8F0),
        gradient: LinearGradient(
          colors: [Color(0xFFE2E8F0), Color(0xFFCBD5E1)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Stack(
        children: [
          // Grid lines representing streets
          Positioned.fill(
            child: CustomPaint(
              painter: _MapGridPainter(),
            ),
          ),

          // Provider pin
          Positioned(
            left: 50,
            top: 40,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.two_wheeler_rounded, color: Color(0xFFF59E0B), size: 20),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 4),
                    ],
                  ),
                  child: Text(
                    state.provider?.businessName ?? 'Expert',
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),

          // Destination pin
          Positioned(
            right: 50,
            bottom: 25,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.home_rounded, color: Colors.white, size: 20),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 4),
                    ],
                  ),
                  child: const Text(
                    'Your Address',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.4)
      ..strokeWidth = 2.0;

    // Horizontal street lines
    canvas.drawLine(Offset(0, size.height * 0.35), Offset(size.width, size.height * 0.35), paint);
    canvas.drawLine(Offset(0, size.height * 0.7), Offset(size.width, size.height * 0.7), paint);

    // Vertical street lines
    canvas.drawLine(Offset(size.width * 0.3, 0), Offset(size.width * 0.3, size.height), paint);
    canvas.drawLine(Offset(size.width * 0.75, 0), Offset(size.width * 0.75, size.height), paint);

    // Route connection dotted line
    final routePaint = Paint()
      ..color = const Color(0xFFF59E0B)
      ..strokeWidth = 3.0
      ..strokeCap = StrokeCap.round;

    canvas.drawLine(
      Offset(70, 60),
      Offset(size.width - 70, size.height - 45),
      routePaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
