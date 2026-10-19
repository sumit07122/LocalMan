import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/features/bookings/domain/chat_models.dart';

void main() {
  group('Phase 3I — Flutter Customer Chat & Messaging Tests', () {
    test('1. ChatMessage parses incoming text message with sender attribution', () {
      final json = {
        'id': 'msg_001',
        'conversationId': 'conv_001',
        'bookingId': 'bkg_001',
        'senderUserId': 'usr_pro_01',
        'senderRole': 'PROVIDER',
        'senderName': 'Ramesh Electricals',
        'clientMessageId': 'client_pro_101',
        'messageType': 'TEXT',
        'body': 'I will arrive at your location in 15 minutes.',
        'isSender': false,
        'createdAt': '2026-10-20T10:00:00.000Z',
      };

      final msg = ChatMessage.fromJson(json);
      expect(msg.id, 'msg_001');
      expect(msg.senderRole, 'PROVIDER');
      expect(msg.body, 'I will arrive at your location in 15 minutes.');
      expect(msg.isSender, isFalse);
      expect(msg.isSystem, isFalse);
      expect(msg.deliveryStatus, MessageDeliveryStatus.sent);
    });

    test('2. ChatMessage parses system message correctly and identifies isSystem flag', () {
      final json = {
        'id': 'msg_sys_001',
        'conversationId': 'conv_001',
        'bookingId': 'bkg_001',
        'senderUserId': null,
        'senderRole': 'SYSTEM',
        'senderName': 'System',
        'clientMessageId': 'sys_event_102',
        'messageType': 'SYSTEM',
        'body': 'Provider Ramesh has arrived at the service address.',
        'isSender': false,
        'createdAt': '2026-10-20T10:15:00.000Z',
      };

      final msg = ChatMessage.fromJson(json);
      expect(msg.id, 'msg_sys_001');
      expect(msg.senderUserId, isNull);
      expect(msg.isSystem, isTrue);
      expect(msg.deliveryStatus, MessageDeliveryStatus.sent);
    });

    test('3. Privacy verification: ChatMessage does not expose sensitive financial/KYC data', () {
      final json = {
        'id': 'msg_safe_01',
        'conversationId': 'conv_001',
        'bookingId': 'bkg_001',
        'senderRole': 'CUSTOMER',
        'clientMessageId': 'c_1',
        'messageType': 'TEXT',
        'body': 'Please ring the doorbell when you reach.',
        'isSender': true,
        'createdAt': '2026-10-20T10:02:00.000Z',
      };

      final msg = ChatMessage.fromJson(json);
      final map = msg.toJson();

      // Ensure no financial/KYC leak in model or serialization
      expect(map.containsKey('bankAccount'), isFalse);
      expect(map.containsKey('commissionRate'), isFalse);
      expect(map.containsKey('platformCommissionPercent'), isFalse);
      expect(map.containsKey('tdsPercent'), isFalse);
      expect(map.containsKey('panNumber'), isFalse);
      expect(map.containsKey('aadhaarNumber'), isFalse);
    });

    test('4. ChatMessage.createPending creates optimistic message with sending state', () {
      final pending = ChatMessage.createPending(
        bookingId: 'bkg_pending_01',
        conversationId: 'conv_pending_01',
        clientMessageId: 'c_local_999',
        body: 'Can you bring extra 16A sockets?',
      );

      expect(pending.id, 'pending_c_local_999');
      expect(pending.clientMessageId, 'c_local_999');
      expect(pending.body, 'Can you bring extra 16A sockets?');
      expect(pending.isSender, isTrue);
      expect(pending.deliveryStatus, MessageDeliveryStatus.sending);
    });

    test('5. Reconciling pending message with server confirmed message replaces optimistic entry', () {
      final pending = ChatMessage.createPending(
        bookingId: 'bkg_reconcile_01',
        conversationId: 'conv_01',
        clientMessageId: 'c_rec_1',
        body: 'Hello provider',
      );

      final list = <ChatMessage>[pending];

      // Server returns confirmed message with same clientMessageId
      final serverConfirmed = ChatMessage.fromJson({
        'id': 'msg_srv_real_id',
        'conversationId': 'conv_01',
        'bookingId': 'bkg_reconcile_01',
        'senderRole': 'CUSTOMER',
        'clientMessageId': 'c_rec_1',
        'messageType': 'TEXT',
        'body': 'Hello provider',
        'isSender': true,
        'createdAt': '2026-10-20T10:05:00.000Z',
      });

      final idx = list.indexWhere((m) => m.clientMessageId == serverConfirmed.clientMessageId);
      expect(idx, 0);
      list[idx] = serverConfirmed;

      expect(list.length, 1);
      expect(list[0].id, 'msg_srv_real_id');
      expect(list[0].deliveryStatus, MessageDeliveryStatus.sent);
    });

    test('6. Deduplication logic prevents duplicate bubble on reconnect/realtime replay', () {
      final existingMessages = [
        ChatMessage.fromJson({
          'id': 'msg_01',
          'conversationId': 'conv_01',
          'bookingId': 'bkg_01',
          'senderRole': 'CUSTOMER',
          'clientMessageId': 'c_1',
          'messageType': 'TEXT',
          'body': 'First message',
          'isSender': true,
          'createdAt': '2026-10-20T10:00:00.000Z',
        }),
      ];

      // Incoming realtime event with duplicate id or clientMessageId
      final incoming = ChatMessage.fromJson({
        'id': 'msg_01',
        'conversationId': 'conv_01',
        'bookingId': 'bkg_01',
        'senderRole': 'CUSTOMER',
        'clientMessageId': 'c_1',
        'messageType': 'TEXT',
        'body': 'First message',
        'isSender': true,
        'createdAt': '2026-10-20T10:00:00.000Z',
      });

      final isDuplicate = existingMessages.any(
        (m) => m.id == incoming.id || m.clientMessageId == incoming.clientMessageId,
      );
      expect(isDuplicate, isTrue);
    });

    test('7. ChatConversation model parses unread counters and read marker', () {
      final json = {
        'id': 'conv_meta_01',
        'bookingId': 'bkg_meta_01',
        'status': 'ACTIVE',
        'unreadCount': 3,
        'lastMessageAt': '2026-10-20T10:20:00.000Z',
        'lastReadAt': '2026-10-20T10:10:00.000Z',
        'participantRole': 'CUSTOMER',
      };

      final conv = ChatConversation.fromJson(json);
      expect(conv.id, 'conv_meta_01');
      expect(conv.bookingId, 'bkg_meta_01');
      expect(conv.unreadCount, 3);
      expect(conv.isActive, isTrue);
      expect(conv.participantRole, 'CUSTOMER');
      expect(conv.lastReadAt, isNotNull);
    });

    test('8. ChatMessagesPage parses cursor pagination response', () {
      final json = {
        'messages': [
          {
            'id': 'msg_pg_1',
            'conversationId': 'conv_01',
            'bookingId': 'bkg_01',
            'senderRole': 'CUSTOMER',
            'clientMessageId': 'c_pg_1',
            'messageType': 'TEXT',
            'body': 'Page message 1',
            'isSender': true,
            'createdAt': '2026-10-20T10:00:00.000Z',
          },
          {
            'id': 'msg_pg_2',
            'conversationId': 'conv_01',
            'bookingId': 'bkg_01',
            'senderRole': 'PROVIDER',
            'clientMessageId': 'p_pg_2',
            'messageType': 'TEXT',
            'body': 'Page message 2',
            'isSender': false,
            'createdAt': '2026-10-20T10:01:00.000Z',
          },
        ],
        'nextCursor': 'msg_pg_2',
        'hasMore': true,
        'conversation': {
          'id': 'conv_01',
          'bookingId': 'bkg_01',
          'status': 'ACTIVE',
          'unreadCount': 0,
          'participantRole': 'CUSTOMER',
        },
      };

      final page = ChatMessagesPage.fromJson(json);
      expect(page.messages.length, 2);
      expect(page.hasMore, isTrue);
      expect(page.nextCursor, 'msg_pg_2');
      expect(page.conversation?.id, 'conv_01');
    });

    test('9. Send failure and retry transition lifecycle', () {
      var msg = ChatMessage.createPending(
        bookingId: 'bkg_retry_01',
        conversationId: 'conv_01',
        clientMessageId: 'c_fail_1',
        body: 'Network issue test',
      );
      expect(msg.deliveryStatus, MessageDeliveryStatus.sending);

      // Transition to failed
      msg = msg.copyWith(deliveryStatus: MessageDeliveryStatus.failed);
      expect(msg.deliveryStatus, MessageDeliveryStatus.failed);

      // User hits retry -> sending
      msg = msg.copyWith(deliveryStatus: MessageDeliveryStatus.sending);
      expect(msg.deliveryStatus, MessageDeliveryStatus.sending);

      // Server returns confirmed -> sent
      msg = msg.copyWith(
        id: 'msg_confirmed_01',
        deliveryStatus: MessageDeliveryStatus.sent,
      );
      expect(msg.deliveryStatus, MessageDeliveryStatus.sent);
      expect(msg.id, 'msg_confirmed_01');
    });
  });
}
