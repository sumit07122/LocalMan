import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../domain/booking_item.dart';
import '../domain/booking_request.dart';
import '../domain/payment_models.dart';
import '../domain/cancellation_models.dart';
import '../domain/quote_models.dart';
import '../domain/chat_models.dart';
import '../domain/review_item.dart';
import '../domain/live_map_state.dart';

abstract class IBookingRepository {
  Future<BookingItem> createBooking(CreateBookingRequest request);
  Future<BookingListResult> listBookings({
    int page = 1,
    int limit = 20,
    String? status,
  });
  Future<BookingItem> getBookingDetails(String bookingId);
  Future<PaymentCheckoutResponse> createPaymentCheckout(
    String bookingId, {
    String? idempotencyKey,
  });
  Future<bool> verifyPayment({
    required String bookingId,
    String? paymentId,
    String? gatewayOrderId,
    String? gatewayPaymentId,
    String? gatewaySignature,
  });
  Future<PaymentSummary> getPaymentSummary(String bookingId);
  Future<CancellationResult> cancelBooking(
    String bookingId,
    CancelBookingRequest request,
  );
  Future<NoShowResult> recordNoShow(
    String bookingId,
    NoShowRequest request,
  );
  Future<DisputeItem> openDispute(
    String bookingId,
    CreateDisputeRequest request,
  );
  Future<List<DisputeItem>> getDisputesForBooking(String bookingId);
  Future<DisputeItem> getDisputeById(String disputeId);
  Future<CustomerQuoteListResponse> getQuotesForBooking(String bookingId);
  Future<CustomerQuote> getQuoteById(String bookingId, String quoteId);
  Future<BookingItem> acceptQuote(String bookingId, String quoteId);
  Future<CustomerQuote> rejectQuote(String bookingId, String quoteId, {String? reason});

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

  // Phase 3J Review methods
  Future<ReviewItem?> getBookingReview(String bookingId);
  Future<ReviewItem> submitBookingReview(
    String bookingId, {
    required int rating,
    String? title,
    String? comment,
  });
  Future<ReviewItem> updateBookingReview(
    String bookingId, {
    int? rating,
    String? title,
    String? comment,
  });
  Future<bool> reportReview(
    String reviewId, {
    required String reason,
    String? details,
  });

  // Phase 3K Live Maps & ETA
  Future<LiveMapStateModel> getBookingMapState(String bookingId);
}

class BookingRepository implements IBookingRepository {
  final ApiClient _apiClient;

  BookingRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  @override
  Future<BookingItem> createBooking(CreateBookingRequest request) async {
    final headers = <String, dynamic>{};
    if (request.idempotencyKey != null &&
        request.idempotencyKey!.trim().isNotEmpty) {
      headers['Idempotency-Key'] = request.idempotencyKey!.trim();
    }

    final response = await _apiClient.dio.post(
      ApiConstants.bookings,
      data: request.toJson(),
      options: Options(headers: headers),
    );

    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return BookingItem.fromJson(data);
  }

  @override
  Future<BookingListResult> listBookings({
    int page = 1,
    int limit = 20,
    String? status,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'limit': limit,
    };
    if (status != null && status.isNotEmpty) {
      queryParams['status'] = status;
    }

    final rawResponse = await _apiClient.dio.get(
      ApiConstants.bookings,
      queryParameters: queryParams,
    );

    final body = rawResponse.data as Map<String, dynamic>;
    final data = body['data'];

    if (data is Map<String, dynamic>) {
      final itemsList = (data['items'] as List<dynamic>?) ?? [];
      final items = itemsList
          .map((item) => BookingItem.fromJson(item as Map<String, dynamic>))
          .toList();
      final total = (data['total'] as num?)?.toInt() ?? items.length;
      return BookingListResult(
        items: items,
        total: total,
        page: page,
        limit: limit,
      );
    } else if (data is List<dynamic>) {
      final items = data
          .map((item) => BookingItem.fromJson(item as Map<String, dynamic>))
          .toList();
      return BookingListResult(
        items: items,
        total: items.length,
        page: page,
        limit: limit,
      );
    }

    return BookingListResult(
      items: const [],
      total: 0,
      page: page,
      limit: limit,
    );
  }

  @override
  Future<BookingItem> getBookingDetails(String bookingId) async {
    final response = await _apiClient.get(ApiConstants.bookingById(bookingId));
    final data = (response as Map<String, dynamic>?) ?? {};
    return BookingItem.fromJson(data);
  }

  @override
  Future<PaymentCheckoutResponse> createPaymentCheckout(
    String bookingId, {
    String? idempotencyKey,
  }) async {
    final headers = <String, dynamic>{};
    if (idempotencyKey != null && idempotencyKey.trim().isNotEmpty) {
      headers['Idempotency-Key'] = idempotencyKey.trim();
    }

    final response = await _apiClient.dio.post(
      ApiConstants.bookingCheckout(bookingId),
      options: Options(headers: headers),
    );

    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return PaymentCheckoutResponse.fromJson(data);
  }

  @override
  Future<bool> verifyPayment({
    required String bookingId,
    String? paymentId,
    String? gatewayOrderId,
    String? gatewayPaymentId,
    String? gatewaySignature,
  }) async {
    final payload = <String, dynamic>{
      'bookingId': bookingId,
      if (paymentId != null) 'paymentId': paymentId,
      if (gatewayOrderId != null) 'gatewayOrderId': gatewayOrderId,
      if (gatewayPaymentId != null) 'gatewayPaymentId': gatewayPaymentId,
      if (gatewaySignature != null) 'gatewaySignature': gatewaySignature,
    };

    final response = await _apiClient.dio.post(
      ApiConstants.bookingVerifyPayment(bookingId),
      data: payload,
    );

    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return data['settled'] == true || data['success'] == true;
  }

  @override
  Future<PaymentSummary> getPaymentSummary(String bookingId) async {
    final response = await _apiClient.get(ApiConstants.bookingPaymentSummary(bookingId));
    final data = (response as Map<String, dynamic>?) ?? {};
    return PaymentSummary.fromJson(data);
  }

  @override
  Future<CancellationResult> cancelBooking(
    String bookingId,
    CancelBookingRequest request,
  ) async {
    final response = await _apiClient.dio.post(
      ApiConstants.bookingCancel(bookingId),
      data: request.toJson(),
    );
    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return CancellationResult.fromJson(data);
  }

  @override
  Future<NoShowResult> recordNoShow(
    String bookingId,
    NoShowRequest request,
  ) async {
    final response = await _apiClient.dio.post(
      ApiConstants.bookingNoShow(bookingId),
      data: request.toJson(),
    );
    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return NoShowResult.fromJson(data);
  }

  @override
  Future<DisputeItem> openDispute(
    String bookingId,
    CreateDisputeRequest request,
  ) async {
    final response = await _apiClient.dio.post(
      ApiConstants.bookingDisputes(bookingId),
      data: request.toJson(),
    );
    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return DisputeItem.fromJson(data);
  }

  @override
  Future<List<DisputeItem>> getDisputesForBooking(String bookingId) async {
    final response = await _apiClient.get(ApiConstants.bookingDisputes(bookingId));
    final body = response as Map<String, dynamic>;
    final list = (body['data'] as List<dynamic>?) ?? [];
    return list.map((e) => DisputeItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<DisputeItem> getDisputeById(String disputeId) async {
    final response = await _apiClient.get(ApiConstants.disputeById(disputeId));
    final body = response as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return DisputeItem.fromJson(data);
  }

  @override
  Future<CustomerQuoteListResponse> getQuotesForBooking(String bookingId) async {
    final response = await _apiClient.dio.get(ApiConstants.bookingQuotes(bookingId));
    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return CustomerQuoteListResponse.fromJson(data);
  }

  @override
  Future<CustomerQuote> getQuoteById(String bookingId, String quoteId) async {
    final response = await _apiClient.dio.get(ApiConstants.bookingQuoteById(bookingId, quoteId));
    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return CustomerQuote.fromJson(data);
  }

  @override
  Future<BookingItem> acceptQuote(String bookingId, String quoteId) async {
    final response = await _apiClient.dio.post(
      ApiConstants.acceptQuote(bookingId, quoteId),
      data: {},
    );
    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    final bookingData = (data['booking'] as Map<String, dynamic>?) ?? data;
    return BookingItem.fromJson(bookingData);
  }

  @override
  Future<CustomerQuote> rejectQuote(String bookingId, String quoteId, {String? reason}) async {
    final response = await _apiClient.dio.post(
      ApiConstants.rejectQuote(bookingId, quoteId),
      data: {if (reason != null) 'reason': reason},
    );
    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return CustomerQuote.fromJson(data);
  }

  @override
  Future<ChatConversation> getBookingConversation(String bookingId) async {
    final response = await _apiClient.dio.get(ApiConstants.bookingConversation(bookingId));
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

    final response = await _apiClient.dio.get(
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

    final response = await _apiClient.dio.post(
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

    final response = await _apiClient.dio.post(
      ApiConstants.bookingMessageRead(bookingId),
      data: payload,
    );
    final body = response.data as Map<String, dynamic>;
    return body['success'] as bool? ?? true;
  }

  // Phase 3J Review Implementation
  @override
  Future<ReviewItem?> getBookingReview(String bookingId) async {
    try {
      final response = await _apiClient.dio.get(ApiConstants.bookingReview(bookingId));
      final body = response.data as Map<String, dynamic>;
      final data = (body['data'] as Map<String, dynamic>?) ?? body;
      if (data.isEmpty || data['id'] == null) return null;
      return ReviewItem.fromJson(data);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<ReviewItem> submitBookingReview(
    String bookingId, {
    required int rating,
    String? title,
    String? comment,
  }) async {
    final payload = <String, dynamic>{
      'rating': rating,
      if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
      if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
    };

    final response = await _apiClient.dio.post(
      ApiConstants.bookingReview(bookingId),
      data: payload,
    );
    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return ReviewItem.fromJson(data);
  }

  @override
  Future<ReviewItem> updateBookingReview(
    String bookingId, {
    int? rating,
    String? title,
    String? comment,
  }) async {
    final payload = <String, dynamic>{
      if (rating != null) 'rating': rating,
      if (title != null) 'title': title.trim(),
      if (comment != null) 'comment': comment.trim(),
    };

    final response = await _apiClient.dio.patch(
      ApiConstants.bookingReview(bookingId),
      data: payload,
    );
    final body = response.data as Map<String, dynamic>;
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return ReviewItem.fromJson(data);
  }

  @override
  Future<bool> reportReview(
    String reviewId, {
    required String reason,
    String? details,
  }) async {
    final payload = <String, dynamic>{
      'reason': reason,
      if (details != null && details.trim().isNotEmpty) 'details': details.trim(),
    };

    final response = await _apiClient.dio.post(
      ApiConstants.reviewReport(reviewId),
      data: payload,
    );
    final body = response.data as Map<String, dynamic>;
    return body['success'] as bool? ?? true;
  }

  @override
  Future<LiveMapStateModel> getBookingMapState(String bookingId) async {
    final response = await _apiClient.get(ApiConstants.bookingMapState(bookingId));
    final body = (response as Map<String, dynamic>?) ?? {};
    final data = (body['data'] as Map<String, dynamic>?) ?? body;
    return LiveMapStateModel.fromJson(data);
  }
}

final bookingRepositoryProvider = Provider<IBookingRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return BookingRepository(apiClient: apiClient);
});
