import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/storage/token_storage.dart';

/// Typed representation of a realtime event received over the booking SSE stream.
class BookingRealtimeEvent {
  final String type;
  final String channel;
  final Map<String, dynamic> payload;
  final DateTime timestamp;

  const BookingRealtimeEvent({
    required this.type,
    required this.channel,
    required this.payload,
    required this.timestamp,
  });

  factory BookingRealtimeEvent.fromJson(Map<String, dynamic> json) {
    return BookingRealtimeEvent(
      type: json['type'] as String? ?? 'UNKNOWN',
      channel: json['channel'] as String? ?? '',
      payload: (json['payload'] as Map<String, dynamic>?) ?? {},
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

/// Status of the Server-Sent Events realtime connection.
enum RealtimeConnectionStatus {
  disconnected,
  connecting,
  connected,
  reconnecting,
  error,
}

abstract class IBookingRealtimeService {
  Stream<BookingRealtimeEvent> subscribeBooking(String bookingId);
  void disconnectBooking(String bookingId);
  void dispose();
}

class BookingRealtimeService implements IBookingRealtimeService {
  final ITokenStorage _tokenStorage;
  final Dio _dio;

  final Map<String, StreamController<BookingRealtimeEvent>> _controllers = {};
  final Map<String, CancelToken> _cancelTokens = {};
  final Map<String, bool> _activeSubscriptions = {};

  BookingRealtimeService({
    required ITokenStorage tokenStorage,
    Dio? dio,
  })  : _tokenStorage = tokenStorage,
        _dio = dio ?? Dio();

  @override
  Stream<BookingRealtimeEvent> subscribeBooking(String bookingId) {
    if (_controllers.containsKey(bookingId)) {
      return _controllers[bookingId]!.stream;
    }

    final controller = StreamController<BookingRealtimeEvent>.broadcast();
    _controllers[bookingId] = controller;
    _activeSubscriptions[bookingId] = true;

    _startSseStream(bookingId, controller);

    controller.onCancel = () {
      disconnectBooking(bookingId);
    };

    return controller.stream;
  }

  Future<void> _startSseStream(
    String bookingId,
    StreamController<BookingRealtimeEvent> controller, [
    int retryAttempt = 0,
  ]) async {
    if (!(_activeSubscriptions[bookingId] ?? false) || controller.isClosed) {
      return;
    }

    final cancelToken = CancelToken();
    _cancelTokens[bookingId] = cancelToken;

    try {
      final token = await _tokenStorage.getAccessToken();
      final streamUrl = ApiConstants.bookingStream(bookingId);

      final response = await _dio.get<ResponseBody>(
        streamUrl,
        cancelToken: cancelToken,
        options: Options(
          responseType: ResponseType.stream,
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          },
        ),
      );

      final responseStream = response.data?.stream;
      if (responseStream == null) {
        throw Exception('SSE response body stream is null');
      }

      // Reset retry attempt on successful connection establishment
      retryAttempt = 0;

      String currentEventType = 'message';
      final buffer = StringBuffer();

      await for (final chunk in responseStream) {
        if (!(_activeSubscriptions[bookingId] ?? false) || controller.isClosed) {
          break;
        }

        final text = utf8.decode(chunk, allowMalformed: true);
        final lines = text.split('\n');

        for (final rawLine in lines) {
          final line = rawLine.trim();
          if (line.isEmpty) {
            // End of an SSE message block
            if (buffer.isNotEmpty) {
              final dataStr = buffer.toString().trim();
              buffer.clear();
              try {
                final jsonMap = jsonDecode(dataStr) as Map<String, dynamic>;
                final event = BookingRealtimeEvent.fromJson(jsonMap);
                if (!controller.isClosed) {
                  controller.add(event);
                }
              } catch (e) {
                debugPrint('[SSE] Error decoding event payload: $e | Raw: $dataStr');
              }
            }
            currentEventType = 'message';
          } else if (line.startsWith('event:')) {
            currentEventType = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            final dataContent = line.substring(5).trim();
            buffer.writeln(dataContent);
          }
        }
      }
    } catch (e) {
      if (cancelToken.isCancelled) {
        // Normal cancellation on navigation away
        return;
      }
      debugPrint('[SSE] Stream disconnected: $e. Reconnecting in background...');
    } finally {
      // Reconnection with exponential backoff if subscription is still marked active
      if ((_activeSubscriptions[bookingId] ?? false) && !controller.isClosed) {
        final backoffSeconds = _calculateBackoff(retryAttempt);
        await Future.delayed(Duration(seconds: backoffSeconds));
        if ((_activeSubscriptions[bookingId] ?? false) && !controller.isClosed) {
          _startSseStream(bookingId, controller, retryAttempt + 1);
        }
      }
    }
  }

  int _calculateBackoff(int attempt) {
    if (attempt <= 0) return 2;
    if (attempt == 1) return 4;
    if (attempt == 2) return 8;
    return 15; // Max backoff capped at 15s
  }

  @override
  void disconnectBooking(String bookingId) {
    _activeSubscriptions[bookingId] = false;
    _cancelTokens[bookingId]?.cancel('Client unsubscribed');
    _cancelTokens.remove(bookingId);

    final controller = _controllers.remove(bookingId);
    if (controller != null && !controller.isClosed) {
      controller.close();
    }
  }

  @override
  void dispose() {
    for (final id in _activeSubscriptions.keys.toList()) {
      disconnectBooking(id);
    }
  }
}

final bookingRealtimeServiceProvider = Provider<IBookingRealtimeService>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  final service = BookingRealtimeService(tokenStorage: tokenStorage);
  ref.onDispose(() => service.dispose());
  return service;
});

/// StreamProvider listening to the live SSE stream for a specific booking.
/// Automatically handles subscription and cleanup.
final bookingStreamProvider =
    StreamProvider.family.autoDispose<BookingRealtimeEvent, String>((ref, bookingId) {
  final realtimeService = ref.watch(bookingRealtimeServiceProvider);
  return realtimeService.subscribeBooking(bookingId);
});
