import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/constants/api_constants.dart';
import '../../../shared/models/booking_model.dart';
import '../../../shared/models/dispatch_offer_model.dart';
import '../../../shared/models/chat_model.dart';

abstract class IBookingRepository {
  Future<List<Booking>> getProviderBookings();
  Future<Booking> getBookingDetails(String id);
  Future<Booking> acceptBooking(String id);
  Future<Booking> rejectBooking(String id, {String? reason});
  Future<Booking> updateJobStatus(String id, {required String status, String? startOtp, String? reason});
  Future<Booking> startTravel(String id);
  Future<Booking> markArrived(String id);
  Future<Booking> startJob(String id, {required String startOtp});
  Future<Booking> completeJob(String id, {String? notes});
  Future<BookingMaterial> addMaterial(
    String bookingId, {
    required String itemName,
    required int quantity,
    required int unitPricePaisa,
    String? receiptPhotoUrl,
  });
  Future<DispatchOfferModel?> getActiveDispatchOffer();
  Future<Map<String, dynamic>> acceptDispatchOffer(String offerId);
  Future<Map<String, dynamic>> rejectDispatchOffer(String offerId, {String? reason});

  // Phase 3I Chat & Messaging methods
  Future<ChatConversation> getBookingConversation(String bookingId);
  Future<ChatMessagesPage> getBookingMessages(
    String bookingId, {
    String? cursor,
    int limit = 50,
    String direction = 'before',
  });
  Future<ChatMessage> sendBookingMessage(
    String bookingId, {
    required String clientMessageId,
    required String body,
    String? replyToMessageId,
  });
  Future<bool> markBookingMessagesRead(
    String bookingId, {
    String? messageId,
  });
}

class BookingRepository implements IBookingRepository {
  final ApiClient _apiClient;

  BookingRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  @override
  Future<List<Booking>> getProviderBookings() async {
    final response = await _apiClient.get(ApiConstants.providerBookings);
    final raw = response.data;
    List<dynamic> items = [];

    if (raw is Map<String, dynamic>) {
      if (raw['data'] is List<dynamic>) {
        items = raw['data'] as List<dynamic>;
      }
    } else if (raw is List<dynamic>) {
      items = raw;
    }

    return items
        .map((item) => Booking.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<Booking> getBookingDetails(String id) async {
    final response = await _apiClient.get(ApiConstants.providerBookingDetails(id));
    final data = (response.data as Map<String, dynamic>?) ?? {};
    return Booking.fromJson(data);
  }

  @override
  Future<Booking> acceptBooking(String id) async {
    final response = await _apiClient.post(ApiConstants.acceptBooking(id));
    final data = (response.data as Map<String, dynamic>?) ?? {};
    return Booking.fromJson(data);
  }

  @override
  Future<Booking> rejectBooking(String id, {String? reason}) async {
    final payload = reason != null ? {'reason': reason} : null;
    final response = await _apiClient.post(
      ApiConstants.rejectBooking(id),
      data: payload,
    );
    final data = (response.data as Map<String, dynamic>?) ?? {};
    return Booking.fromJson(data);
  }

  @override
  Future<Booking> startTravel(String id) async {
    final response = await _apiClient.post(ApiConstants.startTravel(id));
    final raw = response.data;
    Map<String, dynamic> data = {};
    if (raw is Map<String, dynamic>) {
      if (raw['data'] is Map<String, dynamic>) {
        data = raw['data'] as Map<String, dynamic>;
      } else {
        data = raw;
      }
    }
    return Booking.fromJson(data);
  }

  @override
  Future<Booking> markArrived(String id) async {
    final response = await _apiClient.post(ApiConstants.markArrived(id));
    final raw = response.data;
    Map<String, dynamic> data = {};
    if (raw is Map<String, dynamic>) {
      if (raw['data'] is Map<String, dynamic>) {
        data = raw['data'] as Map<String, dynamic>;
      } else {
        data = raw;
      }
    }
    return Booking.fromJson(data);
  }

  @override
  Future<Booking> startJob(String id, {required String startOtp}) async {
    final response = await _apiClient.post(
      ApiConstants.startJob(id),
      data: {'startOtp': startOtp},
    );
    final raw = response.data;
    Map<String, dynamic> data = {};
    if (raw is Map<String, dynamic>) {
      if (raw['data'] is Map<String, dynamic>) {
        data = raw['data'] as Map<String, dynamic>;
      } else {
        data = raw;
      }
    }
    return Booking.fromJson(data);
  }

  @override
  Future<Booking> completeJob(String id, {String? notes}) async {
    final response = await _apiClient.post(
      ApiConstants.completeJob(id),
      data: notes != null ? {'notes': notes} : <String, dynamic>{},
    );
    final raw = response.data;
    Map<String, dynamic> data = {};
    if (raw is Map<String, dynamic>) {
      if (raw['data'] is Map<String, dynamic>) {
        data = raw['data'] as Map<String, dynamic>;
      } else {
        data = raw;
      }
    }
    return Booking.fromJson(data);
  }

  @override
  Future<Booking> updateJobStatus(
    String id, {
    required String status,
    String? startOtp,
    String? reason,
  }) async {
    if (status == 'PROVIDER_ON_THE_WAY') {
      return startTravel(id);
    } else if (status == 'ARRIVED') {
      return markArrived(id);
    } else if (status == 'JOB_STARTED') {
      return startJob(id, startOtp: startOtp ?? '');
    } else if (status == 'JOB_COMPLETED') {
      return completeJob(id, notes: reason);
    }

    final payload = <String, dynamic>{
      'status': status,
      if (startOtp != null) 'startOtp': startOtp,
      if (reason != null) 'reason': reason,
    };
    final response = await _apiClient.patch(
      ApiConstants.updateJobStatus(id),
      data: payload,
    );
    final data = (response.data as Map<String, dynamic>?) ?? {};
    return Booking.fromJson(data);
  }

  @override
  Future<BookingMaterial> addMaterial(
    String bookingId, {
    required String itemName,
    required int quantity,
    required int unitPricePaisa,
    String? receiptPhotoUrl,
  }) async {
    final payload = <String, dynamic>{
      'itemName': itemName,
      'quantity': quantity,
      'unitPricePaisa': unitPricePaisa,
      if (receiptPhotoUrl != null) 'receiptPhotoUrl': receiptPhotoUrl,
    };
    final response = await _apiClient.post(
      '${ApiConstants.providerBookings}/$bookingId/materials',
      data: payload,
    );
    final raw = response.data;
    Map<String, dynamic> data = {};
    if (raw is Map<String, dynamic>) {
      if (raw['data'] is Map<String, dynamic>) {
        data = raw['data'] as Map<String, dynamic>;
      } else {
        data = raw;
      }
    }
    return BookingMaterial.fromJson(data);
  }

  @override
  Future<DispatchOfferModel?> getActiveDispatchOffer() async {
    final response = await _apiClient.get(ApiConstants.activeDispatchOffer);
    final raw = response.data;
    Map<String, dynamic>? data;
    if (raw is Map<String, dynamic>) {
      if (raw['data'] is Map<String, dynamic>) {
        data = raw['data'] as Map<String, dynamic>;
      } else if (raw['data'] == null) {
        return null;
      } else {
        data = raw;
      }
    }
    if (data == null || data.isEmpty) return null;
    return DispatchOfferModel.fromJson(data);
  }

  @override
  Future<Map<String, dynamic>> acceptDispatchOffer(String offerId) async {
    final response = await _apiClient.post(ApiConstants.acceptDispatchOffer(offerId));
    final raw = response.data;
    if (raw is Map<String, dynamic> && raw['data'] is Map<String, dynamic>) {
      return raw['data'] as Map<String, dynamic>;
    }
    return (raw as Map<String, dynamic>?) ?? {};
  }

  @override
  Future<Map<String, dynamic>> rejectDispatchOffer(String offerId, {String? reason}) async {
    final response = await _apiClient.post(
      ApiConstants.rejectDispatchOffer(offerId),
      data: {'reason': reason ?? 'Declined by partner from app'},
    );
    final raw = response.data;
    if (raw is Map<String, dynamic> && raw['data'] is Map<String, dynamic>) {
      return raw['data'] as Map<String, dynamic>;
    }
    return (raw as Map<String, dynamic>?) ?? {};
  }

  @override
  Future<ChatConversation> getBookingConversation(String bookingId) async {
    final response = await _apiClient.get(ApiConstants.bookingConversation(bookingId));
    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return ChatConversation.fromJson(data);
  }

  @override
  Future<ChatMessagesPage> getBookingMessages(
    String bookingId, {
    String? cursor,
    int limit = 50,
    String direction = 'before',
  }) async {
    final queryParams = <String, dynamic>{
      'limit': limit,
      'direction': direction,
    };
    if (cursor != null) queryParams['cursor'] = cursor;

    final response = await _apiClient.get(
      ApiConstants.bookingMessages(bookingId),
      queryParameters: queryParams,
    );
    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return ChatMessagesPage.fromJson(data);
  }

  @override
  Future<ChatMessage> sendBookingMessage(
    String bookingId, {
    required String clientMessageId,
    required String body,
    String? replyToMessageId,
  }) async {
    final payload = <String, dynamic>{
      'clientMessageId': clientMessageId,
      'messageType': 'TEXT',
      'body': body,
    };
    if (replyToMessageId != null) {
      payload['replyToMessageId'] = replyToMessageId;
    }

    final response = await _apiClient.post(
      ApiConstants.bookingMessages(bookingId),
      data: payload,
    );
    final responseBody = response.data as Map<String, dynamic>;
    final data = (responseBody['data'] as Map<String, dynamic>?) ?? responseBody;
    return ChatMessage.fromJson(data);
  }

  @override
  Future<bool> markBookingMessagesRead(
    String bookingId, {
    String? messageId,
  }) async {
    final payload = <String, dynamic>{};
    if (messageId != null) payload['messageId'] = messageId;

    final response = await _apiClient.post(
      ApiConstants.bookingMessageRead(bookingId),
      data: payload,
    );
    final body = response.data as Map<String, dynamic>;
    return body['success'] as bool? ?? true;
  }
}

final bookingRepositoryProvider = Provider<IBookingRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return BookingRepository(apiClient: apiClient);
});

final providerBookingsFutureProvider = FutureProvider.autoDispose<List<Booking>>((ref) async {
  final repo = ref.watch(bookingRepositoryProvider);
  return repo.getProviderBookings();
});

final activeDispatchOfferFutureProvider = FutureProvider.autoDispose<DispatchOfferModel?>((ref) async {
  final repo = ref.watch(bookingRepositoryProvider);
  return repo.getActiveDispatchOffer();
});
