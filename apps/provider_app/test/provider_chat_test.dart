import 'package:flutter_test/flutter_test.dart';
import 'package:localman_provider/core/constants/api_constants.dart';
import 'package:localman_provider/shared/models/chat_model.dart';

void main() {
  group('Phase 3I — Provider Chat & Messaging Unit Tests', () {
    test('1. ApiConstants generates correct booking-scoped chat endpoints', () {
      const bookingId = 'bkg_pro_chat_001';

      expect(
        ApiConstants.bookingConversation(bookingId),
        contains('/bookings/$bookingId/messages/conversation'),
      );
      expect(
        ApiConstants.bookingMessages(bookingId),
        contains('/bookings/$bookingId/messages'),
      );
      expect(
        ApiConstants.bookingMessageRead(bookingId),
        contains('/bookings/$bookingId/messages/read'),
      );
      expect(
        ApiConstants.bookingMessageStream(bookingId),
        contains('/bookings/$bookingId/messages/stream'),
      );
    });

    test('2. ChatMessage parses customer message incoming to provider app', () {
      final json = {
        'id': 'msg_cust_01',
        'conversationId': 'conv_01',
        'bookingId': 'bkg_01',
        'senderUserId': 'usr_cust_01',
        'senderRole': 'CUSTOMER',
        'senderName': 'Aditi Rao',
        'clientMessageId': 'c_msg_101',
        'messageType': 'TEXT',
        'body': 'Please let me know once you are near the gate.',
        'isSender': false,
        'createdAt': '2026-10-20T10:30:00.000Z',
      };

      final msg = ChatMessage.fromJson(json);
      expect(msg.id, 'msg_cust_01');
      expect(msg.senderRole, 'CUSTOMER');
      expect(msg.body, 'Please let me know once you are near the gate.');
      expect(msg.isSender, isFalse);
      expect(msg.isSystem, isFalse);
      expect(msg.deliveryStatus, MessageDeliveryStatus.sent);
    });

    test('3. ChatMessage parses system events and preserves system attribution', () {
      final json = {
        'id': 'msg_sys_02',
        'conversationId': 'conv_01',
        'bookingId': 'bkg_01',
        'senderUserId': null,
        'senderRole': 'SYSTEM',
        'senderName': 'System',
        'clientMessageId': 'sys_assign_01',
        'messageType': 'SYSTEM',
        'body': 'Booking confirmed and assigned to partner.',
        'isSender': false,
        'createdAt': '2026-10-20T10:00:00.000Z',
      };

      final msg = ChatMessage.fromJson(json);
      expect(msg.id, 'msg_sys_02');
      expect(msg.isSystem, isTrue);
      expect(msg.senderUserId, isNull);
    });

    test('4. Privacy verification: Provider chat message does not leak sensitive payment secrets', () {
      final json = {
        'id': 'msg_pro_01',
        'conversationId': 'conv_01',
        'bookingId': 'bkg_01',
        'senderRole': 'PROVIDER',
        'clientMessageId': 'p_101',
        'messageType': 'TEXT',
        'body': 'I am on the way, estimated arrival in 10 minutes.',
        'isSender': true,
        'createdAt': '2026-10-20T10:32:00.000Z',
      };

      final msg = ChatMessage.fromJson(json);
      final map = msg.toJson();

      // Ensure no payment secret or sensitive banking tokens are in payload
      expect(map.containsKey('paymentToken'), isFalse);
      expect(map.containsKey('gatewaySignature'), isFalse);
      expect(map.containsKey('bankAccount'), isFalse);
      expect(map.containsKey('otpSecret'), isFalse);
    });

    test('5. Provider ChatMessage.createPending creates optimistic message with sending status', () {
      final pending = ChatMessage.createPending(
        bookingId: 'bkg_pro_01',
        conversationId: 'conv_pro_01',
        clientMessageId: 'p_pending_01',
        body: 'Reached the service location.',
      );

      expect(pending.id, 'pending_p_pending_01');
      expect(pending.clientMessageId, 'p_pending_01');
      expect(pending.senderRole, 'PROVIDER');
      expect(pending.isSender, isTrue);
      expect(pending.deliveryStatus, MessageDeliveryStatus.sending);
    });

    test('6. Reconciling pending provider message with server response replaces optimistic message', () {
      final pending = ChatMessage.createPending(
        bookingId: 'bkg_01',
        conversationId: 'conv_01',
        clientMessageId: 'p_rec_1',
        body: 'Ready to begin work',
      );

      final list = <ChatMessage>[pending];

      final serverConfirmed = ChatMessage.fromJson({
        'id': 'msg_confirmed_pro_01',
        'conversationId': 'conv_01',
        'bookingId': 'bkg_01',
        'senderRole': 'PROVIDER',
        'clientMessageId': 'p_rec_1',
        'messageType': 'TEXT',
        'body': 'Ready to begin work',
        'isSender': true,
        'createdAt': '2026-10-20T10:35:00.000Z',
      });

      final idx = list.indexWhere((m) => m.clientMessageId == serverConfirmed.clientMessageId);
      expect(idx, 0);
      list[idx] = serverConfirmed;

      expect(list.length, 1);
      expect(list[0].id, 'msg_confirmed_pro_01');
      expect(list[0].deliveryStatus, MessageDeliveryStatus.sent);
    });

    test('7. Deduplication protects against duplicate bubble rendering on realtime replay', () {
      final existingMessages = [
        ChatMessage.fromJson({
          'id': 'msg_pro_dup_1',
          'conversationId': 'conv_01',
          'bookingId': 'bkg_01',
          'senderRole': 'PROVIDER',
          'clientMessageId': 'p_dup_1',
          'messageType': 'TEXT',
          'body': 'Initial message',
          'isSender': true,
          'createdAt': '2026-10-20T10:00:00.000Z',
        }),
      ];

      final incoming = ChatMessage.fromJson({
        'id': 'msg_pro_dup_1',
        'conversationId': 'conv_01',
        'bookingId': 'bkg_01',
        'senderRole': 'PROVIDER',
        'clientMessageId': 'p_dup_1',
        'messageType': 'TEXT',
        'body': 'Initial message',
        'isSender': true,
        'createdAt': '2026-10-20T10:00:00.000Z',
      });

      final isDuplicate = existingMessages.any(
        (m) => m.id == incoming.id || m.clientMessageId == incoming.clientMessageId,
      );
      expect(isDuplicate, isTrue);
    });

    test('8. ChatConversation model parses unread counters and read status for provider', () {
      final json = {
        'id': 'conv_pro_01',
        'bookingId': 'bkg_pro_01',
        'status': 'ACTIVE',
        'unreadCount': 2,
        'lastMessageAt': '2026-10-20T10:40:00.000Z',
        'lastReadAt': '2026-10-20T10:35:00.000Z',
        'participantRole': 'PROVIDER',
      };

      final conv = ChatConversation.fromJson(json);
      expect(conv.id, 'conv_pro_01');
      expect(conv.bookingId, 'bkg_pro_01');
      expect(conv.unreadCount, 2);
      expect(conv.isActive, isTrue);
      expect(conv.participantRole, 'PROVIDER');
    });

    test('9. ChatMessagesPage parses cursor pagination slice for provider', () {
      final json = {
        'messages': [
          {
            'id': 'msg_sl_1',
            'conversationId': 'conv_01',
            'bookingId': 'bkg_01',
            'senderRole': 'CUSTOMER',
            'clientMessageId': 'c_sl_1',
            'messageType': 'TEXT',
            'body': 'Hi, is there parking?',
            'isSender': false,
            'createdAt': '2026-10-20T10:00:00.000Z',
          },
        ],
        'nextCursor': null,
        'hasMore': false,
        'conversation': {
          'id': 'conv_01',
          'bookingId': 'bkg_01',
          'status': 'ACTIVE',
          'unreadCount': 0,
          'participantRole': 'PROVIDER',
        },
      };

      final page = ChatMessagesPage.fromJson(json);
      expect(page.messages.length, 1);
      expect(page.hasMore, isFalse);
      expect(page.nextCursor, isNull);
    });
  });
}
