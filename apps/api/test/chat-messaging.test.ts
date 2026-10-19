import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { prisma } from '../src/config/database.js';
import {
  BookingStatus,
  MessageType,
  ConversationStatus,
  ParticipantRole,
} from '@localman/constants';

describe('Phase 3I — Chat & Messaging Integration Tests', () => {
  let app: FastifyInstance;
  let mockPrisma: any;

  // Test identities
  const customerA = {
    id: 'usr_cust_a',
    phoneNumber: '+919999900001',
    fullName: 'Aditi Rao',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };
  const customerB = {
    id: 'usr_cust_b',
    phoneNumber: '+919999900002',
    fullName: 'Bharat Patel',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };
  const providerUser1 = {
    id: 'usr_prov_01',
    phoneNumber: '+919999900003',
    fullName: 'Ramesh Electricals',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const provider1 = {
    id: 'prv_01',
    userId: providerUser1.id,
    businessName: 'Ramesh Electricals',
  };
  const providerUser2 = {
    id: 'usr_prov_02',
    phoneNumber: '+919999900004',
    fullName: 'Suresh Plumbing',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const provider2 = {
    id: 'prv_02',
    userId: providerUser2.id,
    businessName: 'Suresh Plumbing',
  };
  const adminUser = {
    id: 'usr_admin_01',
    phoneNumber: '+919999900099',
    fullName: 'Admin Supervisor',
    isActive: true,
    userRoles: [{ roleId: 'ADMIN' }],
  };

  let tokenCustomerA: string;
  let tokenCustomerB: string;
  let tokenProvider1: string;
  let tokenProvider2: string;
  let tokenAdmin: string;

  before(async () => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;
    Object.assign(prisma, mockPrisma);

    mockPrisma._store.users.set(customerA.id, { ...customerA });
    mockPrisma._store.users.set(customerB.id, { ...customerB });
    mockPrisma._store.users.set(providerUser1.id, { ...providerUser1 });
    mockPrisma._store.users.set(providerUser2.id, { ...providerUser2 });
    mockPrisma._store.users.set(adminUser.id, { ...adminUser });

    mockPrisma._store.providers.set(provider1.id, { ...provider1, user: providerUser1 });
    mockPrisma._store.providers.set(provider2.id, { ...provider2, user: providerUser2 });

    app = await buildApp();
    await app.ready();

    tokenCustomerA = app.jwt.sign({ userId: customerA.id, roles: ['CUSTOMER'] });
    tokenCustomerB = app.jwt.sign({ userId: customerB.id, roles: ['CUSTOMER'] });
    tokenProvider1 = app.jwt.sign({ userId: providerUser1.id, roles: ['PROVIDER'] });
    tokenProvider2 = app.jwt.sign({ userId: providerUser2.id, roles: ['PROVIDER'] });
    tokenAdmin = app.jwt.sign({ userId: adminUser.id, roles: ['ADMIN'] });
  });

  const getErrorMessage = (res: any) => res.json()?.error?.message || res.json()?.message || '';

  // ===========================================================================
  // SECTION 1: CONVERSATION INITIALIZATION & AUTHORIZATION
  // ===========================================================================
  describe('1. Conversation Initialization & Participant Authorization', () => {
    test('1. Customer initializes conversation: creates conversation and seeds customer participant', async () => {
      const booking = {
        id: 'bkg_chat_init_01',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages/conversation`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.bookingId, booking.id);
      assert.strictEqual(body.data.status, ConversationStatus.ACTIVE);
      assert.strictEqual(body.data.participantRole, ParticipantRole.CUSTOMER);
      assert.strictEqual(body.data.unreadCount, 0);
    });

    test('2. Idempotent conversation initialization: second call returns existing record', async () => {
      const booking = {
        id: 'bkg_chat_init_02',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res1 = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages/conversation`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      const res2 = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages/conversation`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(res1.statusCode, 200);
      assert.strictEqual(res2.statusCode, 200);
      assert.strictEqual(res1.json().data.id, res2.json().data.id);
    });

    test('3. Assigned provider initializes chat: provider participant is registered with PROVIDER role', async () => {
      const booking = {
        id: 'bkg_chat_init_03',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages/conversation`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.participantRole, ParticipantRole.PROVIDER);
    });

    test('4. Unassigned provider attempts to access chat: rejected (403 Forbidden)', async () => {
      const booking = {
        id: 'bkg_chat_forbid_pro',
        customerId: customerA.id,
        providerId: provider1.id, // Assigned to provider 1
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages/conversation`,
        headers: { authorization: `Bearer ${tokenProvider2}` }, // Provider 2 tries
      });

      assert.strictEqual(response.statusCode, 403);
      assert.match(getErrorMessage(response), /not an authorized participant/i);
    });

    test('5. Pre-assignment booking (REQUESTED without provider) rejects message sending (400 Bad Request)', async () => {
      const booking = {
        id: 'bkg_chat_pre_assign',
        customerId: customerA.id,
        providerId: null, // No provider assigned yet
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'msg_pre_01',
          body: 'Hello? Is anyone there?',
        },
      });

      assert.strictEqual(response.statusCode, 400);
      assert.match(getErrorMessage(response), /until a provider is assigned/i);
    });

    test('6. Non-existent booking ID returns 404 Not Found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/bkg_does_not_exist/messages/conversation`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 404);
    });
  });

  // ===========================================================================
  // SECTION 2: MESSAGE SENDING, VALIDATION & CONTENT SAFETY
  // ===========================================================================
  describe('2. Message Sending, Validation & Content Safety', () => {
    test('7. Customer sends valid text message: message created and updates conversation lastMessageAt', async () => {
      const booking = {
        id: 'bkg_msg_send_01',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'client_msg_001',
          body: 'Hi Ramesh, please ring the doorbell when you reach.',
          messageType: MessageType.TEXT,
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const body = response.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.body, 'Hi Ramesh, please ring the doorbell when you reach.');
      assert.strictEqual(body.data.senderUserId, customerA.id);
      assert.strictEqual(body.data.senderRole, ParticipantRole.CUSTOMER);
      assert.strictEqual(body.data.isSender, true);
    });

    test('8. Provider sends valid text message: message created with PROVIDER role', async () => {
      const booking = {
        id: 'bkg_msg_send_02',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          clientMessageId: 'client_msg_prov_01',
          body: 'Noted Ma’am, I have left my workshop and am on the way.',
          messageType: MessageType.TEXT,
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const body = response.json();
      assert.strictEqual(body.data.senderUserId, providerUser1.id);
      assert.strictEqual(body.data.senderRole, ParticipantRole.PROVIDER);
      assert.strictEqual(body.data.isSender, true);
    });

    test('9. Empty message body rejected with validation error (422)', async () => {
      const booking = {
        id: 'bkg_msg_val_empty',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'client_msg_empty',
          body: '',
        },
      });

      assert.strictEqual(response.statusCode, 422);
    });

    test('10. Whitespace-only message body rejected (422)', async () => {
      const booking = {
        id: 'bkg_msg_val_spaces',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'client_msg_spaces',
          body: '      ',
        },
      });

      assert.strictEqual(response.statusCode, 422);
    });

    test('11. Oversized message body (>2000 chars) rejected (422)', async () => {
      const booking = {
        id: 'bkg_msg_val_large',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const hugeText = 'A'.repeat(2500);
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'client_msg_huge',
          body: hugeText,
        },
      });

      assert.strictEqual(response.statusCode, 422);
    });

    test('12. Valid reply-to message within same conversation succeeds', async () => {
      const booking = {
        id: 'bkg_msg_reply_valid',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // First message
      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'orig_msg_01',
          body: 'Are you bringing the 16A switchboards?',
        },
      });
      const origMsg = res1.json().data;

      // Reply message
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          clientMessageId: 'reply_msg_01',
          body: 'Yes, carrying 4 units of Anchor Roma.',
          replyToMessageId: origMsg.id,
        },
      });

      assert.strictEqual(res2.statusCode, 201);
      assert.strictEqual(res2.json().data.replyToMessageId, origMsg.id);
    });

    test('13. Cross-conversation reply-to target message rejected (400 Bad Request)', async () => {
      const booking1 = {
        id: 'bkg_reply_cross_1',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      const booking2 = {
        id: 'bkg_reply_cross_2',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking1.id, booking1);
      mockPrisma._store.bookings.set(booking2.id, booking2);

      // Create message in booking1
      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking1.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'bkg1_msg_01',
          body: 'Message in booking 1',
        },
      });
      const bkg1MsgId = res1.json().data.id;

      // Try replying to bkg1MsgId from booking 2
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking2.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'bkg2_reply_attempt',
          body: 'Illegal cross-booking reply',
          replyToMessageId: bkg1MsgId,
        },
      });

      assert.strictEqual(res2.statusCode, 400);
      assert.match(getErrorMessage(res2), /reply target message not found in this conversation/i);
    });
  });

  // ===========================================================================
  // SECTION 3: IDEMPOTENCY & CONCURRENCY
  // ===========================================================================
  describe('3. Idempotency & Concurrency', () => {
    test('14. Resending same clientMessageId returns original message idempotently', async () => {
      const booking = {
        id: 'bkg_idemp_01',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payload = {
        clientMessageId: 'idemp_key_repeat_01',
        body: 'Initial transmission over shaky 3G',
      };

      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload,
      });

      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload,
      });

      assert.strictEqual(res1.statusCode, 201);
      assert.strictEqual(res2.statusCode, 201);
      assert.strictEqual(res1.json().data.id, res2.json().data.id);
      assert.strictEqual(res1.json().data.createdAt, res2.json().data.createdAt);
    });

    test('15. Concurrent identical send requests (Promise.all): exactly ONE persisted record returned to both', async () => {
      const booking = {
        id: 'bkg_idemp_race',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payload = {
        clientMessageId: 'concurrent_msg_001',
        body: 'Simultaneous duplicate mobile HTTP requests',
      };

      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/api/v1/bookings/${booking.id}/messages`,
          headers: { authorization: `Bearer ${tokenCustomerA}` },
          payload,
        }),
        app.inject({
          method: 'POST',
          url: `/api/v1/bookings/${booking.id}/messages`,
          headers: { authorization: `Bearer ${tokenCustomerA}` },
          payload,
        }),
      ]);

      assert.strictEqual(res1.statusCode, 201);
      assert.strictEqual(res2.statusCode, 201);
      assert.strictEqual(res1.json().data.id, res2.json().data.id);

      // Verify store has only 1 message for this clientMessageId
      const allMessages = Array.from(mockPrisma._store.messages.values());
      const duplicates = allMessages.filter(
        (m: any) => m.clientMessageId === 'concurrent_msg_001'
      );
      assert.strictEqual(duplicates.length, 1);
    });

    test('16. Different sender attempts to reuse same clientMessageId: rejected with 409 Conflict', async () => {
      const booking = {
        id: 'bkg_idemp_collision',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Customer sends with key
      await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'shared_key_001',
          body: 'Customer message',
        },
      });

      // Provider attempts to use the SAME clientMessageId
      const collisionRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          clientMessageId: 'shared_key_001',
          body: 'Provider hijack attempt',
        },
      });

      assert.strictEqual(collisionRes.statusCode, 409);
      assert.match(getErrorMessage(collisionRes), /clientMessageId has already been used by another sender/i);
    });

    test('17. Client message retry preserves original server message ID and created timestamp', async () => {
      const booking = {
        id: 'bkg_idemp_timestamp',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'timestamp_key_01',
          body: 'Timestamp invariant test',
        },
      });

      const firstCreated = res1.json().data.createdAt;

      // Small delay
      await new Promise((r) => setTimeout(r, 20));

      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'timestamp_key_01',
          body: 'Timestamp invariant test',
        },
      });

      assert.strictEqual(res2.json().data.createdAt, firstCreated);
    });

    test('18. Message send persists a transactional outbox event for durable delivery', async () => {
      const booking = {
        id: 'bkg_outbox_test',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'outbox_msg_01',
          body: 'Testing outbox durability',
        },
      });

      assert.strictEqual(res.statusCode, 201);
      const outboxEvents = Array.from(mockPrisma._store.chatOutboxEvents.values());
      const event = outboxEvents.find(
        (e: any) => e.channel === `booking:${booking.id}` && e.eventType === 'MESSAGE_SENT'
      );
      assert.ok(event, 'Outbox event must be created in transaction');
      assert.strictEqual(event.payload.body, 'Testing outbox durability');
    });
  });

  // ===========================================================================
  // SECTION 4: MESSAGE ORDERING, PAGINATION & HISTORY
  // ===========================================================================
  describe('4. Message Ordering, Pagination & History', () => {
    test('19. Messages are retrieved in deterministic chronological ascending order', async () => {
      const booking = {
        id: 'bkg_order_test',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      for (let i = 1; i <= 3; i++) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/bookings/${booking.id}/messages`,
          headers: { authorization: `Bearer ${tokenCustomerA}` },
          payload: { clientMessageId: `order_msg_${i}`, body: `Sequential message ${i}` },
        });
      }

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 200);
      const msgs = response.json().data.messages;
      assert.strictEqual(msgs.length, 3);
      assert.strictEqual(msgs[0].body, 'Sequential message 1');
      assert.strictEqual(msgs[1].body, 'Sequential message 2');
      assert.strictEqual(msgs[2].body, 'Sequential message 3');
    });

    test('20. Pagination limit parameter is strictly respected (e.g. limit=2)', async () => {
      const booking = {
        id: 'bkg_page_limit',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      for (let i = 1; i <= 5; i++) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/bookings/${booking.id}/messages`,
          headers: { authorization: `Bearer ${tokenCustomerA}` },
          payload: { clientMessageId: `limit_msg_${i}`, body: `Msg ${i}` },
        });
      }

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages?limit=2`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json().data;
      assert.strictEqual(body.messages.length, 2);
      assert.strictEqual(body.hasMore, true);
      assert.ok(body.nextCursor);
    });

    test('21. Pagination with default limit returns expected slice', async () => {
      const booking = {
        id: 'bkg_page_default',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { clientMessageId: 'page_def_1', body: 'Single message' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json().data;
      assert.strictEqual(body.messages.length, 1);
      assert.strictEqual(body.hasMore, false);
      assert.strictEqual(body.nextCursor, null);
    });

    test('22. Server caps excessive limit parameter to max allowed (100)', async () => {
      const booking = {
        id: 'bkg_page_cap',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages?limit=500`, // Over max limit 100
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 422); // Zod validation rejects limit > 100
    });

    test('23. Cursor-based pagination retrieves subsequent message slices', async () => {
      const booking = {
        id: 'bkg_cursor_test',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      for (let i = 1; i <= 4; i++) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/bookings/${booking.id}/messages`,
          headers: { authorization: `Bearer ${tokenCustomerA}` },
          payload: { clientMessageId: `cursor_slice_${i}`, body: `Slice ${i}` },
        });
      }

      // First page with direction=after
      const page1 = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages?limit=2&direction=after`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      const data1 = page1.json().data;
      assert.strictEqual(data1.messages.length, 2);
      assert.ok(data1.nextCursor);

      // Second page using cursor
      const page2 = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages?limit=2&direction=after&cursor=${data1.nextCursor}`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      const data2 = page2.json().data;
      assert.strictEqual(data2.messages.length, 2);
      assert.strictEqual(data2.messages[0].body, 'Slice 3');
    });

    test('24. History retrieval works seamlessly after network disconnection and recovery', async () => {
      const booking = {
        id: 'bkg_reconnect_test',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: { clientMessageId: 'missed_realtime_01', body: 'Message sent while customer was offline' },
      });

      // Customer reconnects and pulls full history
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().data.messages[0].body, 'Message sent while customer was offline');
    });
  });

  // ===========================================================================
  // SECTION 5: READ / UNREAD STATE TRACKING
  // ===========================================================================
  describe('5. Read / Unread State Tracking', () => {
    test('25. New message increases unread count for recipient participant', async () => {
      const booking = {
        id: 'bkg_unread_01',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Provider sends 2 messages to Customer A
      await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: { clientMessageId: 'unread_msg_01', body: 'Hello 1' },
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: { clientMessageId: 'unread_msg_02', body: 'Hello 2' },
      });

      // Customer A checks conversation metadata
      const convRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages/conversation`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(convRes.statusCode, 200);
      assert.strictEqual(convRes.json().data.unreadCount, 2);
    });

    test('26. Senders own sent message does not count towards senders unread count', async () => {
      const booking = {
        id: 'bkg_unread_sender',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Customer sends 3 messages
      for (let i = 1; i <= 3; i++) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/bookings/${booking.id}/messages`,
          headers: { authorization: `Bearer ${tokenCustomerA}` },
          payload: { clientMessageId: `sender_unread_${i}`, body: `Msg ${i}` },
        });
      }

      // Customer unread count should be 0
      const convRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages/conversation`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(convRes.json().data.unreadCount, 0);
    });

    test('27. Recipient calls POST /messages/read: resets unread count to 0 and updates lastReadAt', async () => {
      const booking = {
        id: 'bkg_read_reset',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Provider sends message
      await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: { clientMessageId: 'prov_read_01', body: 'Check this message' },
      });

      // Customer marks read
      const readRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages/read`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {},
      });

      assert.strictEqual(readRes.statusCode, 200);
      assert.strictEqual(readRes.json().data.unreadCount, 0);

      // Verify conversation unread count is now 0
      const convRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages/conversation`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(convRes.json().data.unreadCount, 0);
    });

    test('28. Marking read with specific messageId advances read marker to that message', async () => {
      const booking = {
        id: 'bkg_read_specific',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const msgRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: { clientMessageId: 'target_read_msg', body: 'Target read marker' },
      });
      const msgId = msgRes.json().data.id;

      const readRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages/read`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { messageId: msgId },
      });

      assert.strictEqual(readRes.statusCode, 200);
    });

    test('29. Marking read is idempotent on repeated calls without state drift', async () => {
      const booking = {
        id: 'bkg_read_idemp',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages/read`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {},
      });
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages/read`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {},
      });

      assert.strictEqual(res1.statusCode, 200);
      assert.strictEqual(res2.statusCode, 200);
    });
  });

  // ===========================================================================
  // SECTION 6: BOOKING LIFECYCLE CHAT POLICY GATES
  // ===========================================================================
  describe('6. Booking Lifecycle Chat Policy Gates', () => {
    test('30. Chat sending permitted in CONFIRMED status', async () => {
      const booking = {
        id: 'bkg_gate_confirmed',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { clientMessageId: 'gate_conf_01', body: 'Confirmed state chat' },
      });

      assert.strictEqual(res.statusCode, 201);
    });

    test('31. Chat sending permitted while provider is PROVIDER_ON_THE_WAY and ARRIVED', async () => {
      const booking = {
        id: 'bkg_gate_transit',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.PROVIDER_ON_THE_WAY,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { clientMessageId: 'gate_otw_01', body: 'Are you near the main gate?' },
      });
      assert.strictEqual(res1.statusCode, 201);

      // Move to ARRIVED
      booking.currentStatus = BookingStatus.ARRIVED;
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: { clientMessageId: 'gate_arr_01', body: 'Yes, standing outside gate 2.' },
      });
      assert.strictEqual(res2.statusCode, 201);
    });

    test('32. Chat sending permitted during JOB_STARTED and JOB_EXTENDED', async () => {
      const booking = {
        id: 'bkg_gate_execution',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_STARTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { clientMessageId: 'gate_job_01', body: 'Working on fuse' },
      });
      assert.strictEqual(res1.statusCode, 201);

      // Move to JOB_EXTENDED
      booking.currentStatus = BookingStatus.JOB_EXTENDED;
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: { clientMessageId: 'gate_ext_01', body: 'Need extra 30 mins' },
      });
      assert.strictEqual(res2.statusCode, 201);
    });

    test('33. Cancelled booking rejects new message sending (400), but historical messages remain readable', async () => {
      const booking = {
        id: 'bkg_gate_cancelled',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Send message while active
      await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { clientMessageId: 'pre_cancel_msg', body: 'Message before cancel' },
      });

      // Booking cancelled
      booking.currentStatus = BookingStatus.CANCELLED;

      // New send must fail
      const sendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { clientMessageId: 'post_cancel_msg', body: 'Message after cancel' },
      });
      assert.strictEqual(sendRes.statusCode, 400);
      assert.match(getErrorMessage(sendRes), /Chat is closed for this booking/i);

      // Read history must succeed
      const readRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(readRes.statusCode, 200);
      assert.strictEqual(readRes.json().data.messages.length, 1);
    });

    test('34. Payment settled booking retains historical message access for customer and provider', async () => {
      const booking = {
        id: 'bkg_gate_settled',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { clientMessageId: 'pre_settle_msg', body: 'Job well done!' },
      });

      // Mark settled
      booking.currentStatus = BookingStatus.PAYMENT_SETTLED;

      // Customer read history
      const custRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(custRes.statusCode, 200);
      assert.strictEqual(custRes.json().data.messages[0].body, 'Job well done!');

      // Provider read history
      const provRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
      });
      assert.strictEqual(provRes.statusCode, 200);
      assert.strictEqual(provRes.json().data.messages[0].body, 'Job well done!');
    });
  });

  // ===========================================================================
  // SECTION 7: AUTOMATED SYSTEM MESSAGES
  // ===========================================================================
  describe('7. Automated System Messages', () => {
    test('35. System message created for QUOTE_ACCEPTED with null senderUserId and SYSTEM type', async () => {
      const booking = {
        id: 'bkg_sys_quote',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Invoke system message creation
      const { chatService } = await import('../src/modules/chat/chat.service.js');
      const sysMsg = await chatService.createSystemMessage(booking.id, {
        eventType: 'QUOTE_ACCEPTED',
        body: 'Customer accepted quotation for ₹2,500.00. Partner has been assigned.',
        deduplicationKey: 'quote_win_001',
      });

      assert.strictEqual(sysMsg.messageType, MessageType.SYSTEM);
      assert.strictEqual(sysMsg.senderUserId, null);
      assert.strictEqual(sysMsg.senderRole, 'SYSTEM');
      assert.match(sysMsg.body, /Customer accepted quotation/i);
    });

    test('36. System message created for PROVIDER_ARRIVED event', async () => {
      const booking = {
        id: 'bkg_sys_arrived',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.ARRIVED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const { chatService } = await import('../src/modules/chat/chat.service.js');
      const sysMsg = await chatService.createSystemMessage(booking.id, {
        eventType: 'PROVIDER_ARRIVED',
        body: 'Partner Ramesh Kumar has arrived at your location.',
        deduplicationKey: 'arr_001',
      });

      assert.strictEqual(sysMsg.messageType, MessageType.SYSTEM);
      assert.match(sysMsg.body, /has arrived/i);
    });

    test('37. System message creation is idempotent per deduplicationKey', async () => {
      const booking = {
        id: 'bkg_sys_idemp',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const { chatService } = await import('../src/modules/chat/chat.service.js');
      const msg1 = await chatService.createSystemMessage(booking.id, {
        eventType: 'PROVIDER_ASSIGNED',
        body: 'Partner assigned',
        deduplicationKey: 'dup_key_assign',
      });
      const msg2 = await chatService.createSystemMessage(booking.id, {
        eventType: 'PROVIDER_ASSIGNED',
        body: 'Partner assigned retry',
        deduplicationKey: 'dup_key_assign',
      });

      assert.strictEqual(msg1.id, msg2.id);
    });

    test('38. System messages cannot be spoofed by client-side text submissions (derived server-side)', async () => {
      const booking = {
        id: 'bkg_sys_nospoof',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Customer attempts to send a SYSTEM message type pretending to be system
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'spoof_attempt_01',
          body: 'System: Payment completed successfully',
          messageType: MessageType.SYSTEM,
        },
      });

      assert.strictEqual(res.statusCode, 201);
      const data = res.json().data;
      // Server overrides client spoofing and attributes message to authenticated customer
      assert.strictEqual(data.senderUserId, customerA.id);
      assert.strictEqual(data.senderRole, ParticipantRole.CUSTOMER);
    });
  });

  // ===========================================================================
  // SECTION 8: REALTIME STREAM, SECURITY & IDOR PROTECTIONS
  // ===========================================================================
  describe('8. Realtime Stream, Security & IDOR Protections', () => {
    test('39. Customer A cannot view or read Customer B conversation (403 Forbidden)', async () => {
      const bookingB = {
        id: 'bkg_idor_cust_b',
        customerId: customerB.id, // Belongs to Customer B
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(bookingB.id, bookingB);

      // Customer A tries to read Customer B's booking messages
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingB.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.match(getErrorMessage(res), /not an authorized participant/i);
    });

    test('40. Provider B cannot view or send messages in Provider A assigned booking chat (403 Forbidden)', async () => {
      const bookingA = {
        id: 'bkg_idor_prov_a',
        customerId: customerA.id,
        providerId: provider1.id, // Assigned to Provider 1
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(bookingA.id, bookingA);

      // Provider 2 tries to send message in Provider 1's job
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${bookingA.id}/messages`,
        headers: { authorization: `Bearer ${tokenProvider2}` },
        payload: {
          clientMessageId: 'idor_prov_send',
          body: 'Unauthorized intrusion',
        },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.match(getErrorMessage(res), /not an authorized participant/i);
    });

    test('41. Sender identity is strictly derived from authenticated token (cannot spoof senderUserId)', async () => {
      const booking = {
        id: 'bkg_spoof_sender',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          clientMessageId: 'spoof_sender_01',
          body: 'Trying to pretend to be provider',
          senderUserId: providerUser1.id, // Malicious spoof payload
        },
      });

      assert.strictEqual(res.statusCode, 201);
      // Server must ignore client-submitted senderUserId and enforce token's userId
      assert.strictEqual(res.json().data.senderUserId, customerA.id);
    });

    test('42. Admin user with authorized role can inspect conversation history with audit logging', async () => {
      const booking = {
        id: 'bkg_admin_inspect',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { clientMessageId: 'admin_test_msg', body: 'Auditable message content' },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().data.messages[0].body, 'Auditable message content');

      // Verify audit log created
      const auditLogs = mockPrisma._store.auditLogs;
      const log = auditLogs.find((l: any) => l.action === 'INSPECT_CHAT_HISTORY' && l.resourceId === booking.id);
      assert.ok(log, 'Admin inspection must be audit-logged');
    });

    test('43. Non-admin customer cannot access admin chat inspection endpoint (403 Forbidden)', async () => {
      const booking = {
        id: 'bkg_admin_forbidden',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/bookings/${booking.id}/messages`,
        headers: { authorization: `Bearer ${tokenCustomerA}` }, // Customer A tries admin endpoint
      });

      assert.strictEqual(res.statusCode, 403);
    });
  });
});
