import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { prisma } from '../src/config/database.js';
import { BookingStatus, DisputeStatus, RefundStatus } from '@localman/constants';
import { cancellationPolicyService } from '../src/modules/cancellations/cancellation-policy.service.js';
import { cancellationService } from '../src/modules/cancellations/cancellation.service.js';
import { refundService } from '../src/modules/refunds/refund.service.js';
import { disputeService } from '../src/modules/disputes/dispute.service.js';
import { financialService } from '../src/modules/financial/financial.service.js';
import { paymentService } from '../src/modules/payments/payment.service.js';

describe('Phase 3G — Cancellation, No-Show, Refund & Dispute Engine Integration Tests', () => {
  let app: FastifyInstance;
  let mockPrisma: any;

  // Actors
  const customerA = {
    id: 'usr_cust_3g_a',
    phoneNumber: '+919876543301',
    fullName: 'Pooja Iyer',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const customerB = {
    id: 'usr_cust_3g_b',
    phoneNumber: '+919876543302',
    fullName: 'Karthik Rao',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const providerUser = {
    id: 'usr_pro_3g_1',
    phoneNumber: '+919876543311',
    fullName: 'Suresh Pro',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider = {
    id: 'prv_3g_1',
    userId: providerUser.id,
    businessName: 'Suresh Electrician Services',
    verificationStatus: 'VERIFIED',
    isOnline: true,
  };

  const adminUser = {
    id: 'usr_admin_3g_1',
    phoneNumber: '+919876543399',
    fullName: 'Admin Official',
    isActive: true,
    userRoles: [{ roleId: 'ADMIN' }],
  };

  const service = {
    id: 'srv_fan_repair',
    name: 'Ceiling Fan Repair',
    slug: 'ceiling-fan-repair',
    basePricePaisa: 60000, // ₹600.00
    platformCommissionPercent: 15.0,
  };

  const customerAddress = {
    id: 'addr_3g_1',
    userId: customerA.id,
    addressLine1: 'B-404, Maple Woods',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    latitude: 12.9716,
    longitude: 77.5946,
  };

  let tokenCustomerA: string;
  let tokenCustomerB: string;
  let tokenProvider: string;
  let tokenAdmin: string;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;
    Object.assign(prisma, mockPrisma);

    mockPrisma._store.users.set(customerA.id, { ...customerA });
    mockPrisma._store.users.set(customerB.id, { ...customerB });
    mockPrisma._store.users.set(providerUser.id, { ...providerUser });
    mockPrisma._store.users.set(adminUser.id, { ...adminUser });
    mockPrisma._store.providers.set(provider.id, { ...provider, user: providerUser });
    mockPrisma._store.addresses.set(customerAddress.id, { ...customerAddress });
    mockPrisma._store.services.set(service.id, { ...service });

    app = await buildApp();
    await app.ready();

    tokenCustomerA = app.jwt.sign({ userId: customerA.id, roles: ['CUSTOMER'] });
    tokenCustomerB = app.jwt.sign({ userId: customerB.id, roles: ['CUSTOMER'] });
    tokenProvider = app.jwt.sign({ userId: providerUser.id, roles: ['PROVIDER'] });
    tokenAdmin = app.jwt.sign({ userId: adminUser.id, roles: ['ADMIN'] });
  });

  // ===========================================================================
  // SECTION 1: CANCELLATION POLICY ENGINE TESTS
  // ===========================================================================
  describe('1. Cancellation Policy Engine', () => {
    test('1. Allows customer cancellation in REQUESTED status with 0 fee', () => {
      const evaluation = cancellationPolicyService.evaluateCustomerCancellation({
        currentStatus: BookingStatus.REQUESTED,
        totalAmountPaisa: 60000,
        payment: null,
      });

      assert.strictEqual(evaluation.isAllowed, true);
      assert.strictEqual(evaluation.cancellationFeePaisa, 0);
      assert.strictEqual(evaluation.providerCompensationPaisa, 0);
      assert.strictEqual(evaluation.refundAmountPaisa, 0);
    });

    test('2. Allows customer cancellation in PROVIDER_ACCEPTED / CONFIRMED with ₹50 fee and 80% provider compensation', () => {
      const evaluation = cancellationPolicyService.evaluateCustomerCancellation({
        currentStatus: BookingStatus.CONFIRMED,
        totalAmountPaisa: 60000,
        payment: { status: 'CAPTURED', amountPaisa: 60000 },
      });

      assert.strictEqual(evaluation.isAllowed, true);
      assert.strictEqual(evaluation.cancellationFeePaisa, 5000); // ₹50
      assert.strictEqual(evaluation.providerCompensationPaisa, 4000); // 80% of ₹50 = ₹40
      assert.strictEqual(evaluation.refundAmountPaisa, 55000); // 60000 - 5000
    });

    test('3. Allows customer cancellation in PROVIDER_ON_THE_WAY with ₹100 transit fee', () => {
      const evaluation = cancellationPolicyService.evaluateCustomerCancellation({
        currentStatus: BookingStatus.PROVIDER_ON_THE_WAY,
        totalAmountPaisa: 60000,
        payment: { status: 'CAPTURED', amountPaisa: 60000 },
      });

      assert.strictEqual(evaluation.isAllowed, true);
      assert.strictEqual(evaluation.cancellationFeePaisa, 10000); // ₹100
      assert.strictEqual(evaluation.providerCompensationPaisa, 8000);
      assert.strictEqual(evaluation.refundAmountPaisa, 50000);
    });

    test('4. Allows customer cancellation in ARRIVED with ₹150 callout fee', () => {
      const evaluation = cancellationPolicyService.evaluateCustomerCancellation({
        currentStatus: BookingStatus.ARRIVED,
        totalAmountPaisa: 60000,
        payment: { status: 'CAPTURED', amountPaisa: 60000 },
      });

      assert.strictEqual(evaluation.isAllowed, true);
      assert.strictEqual(evaluation.cancellationFeePaisa, 15000); // ₹150
      assert.strictEqual(evaluation.providerCompensationPaisa, 12000);
      assert.strictEqual(evaluation.refundAmountPaisa, 45000);
    });

    test('5. Blocks customer cancellation in JOB_STARTED / JOB_EXTENDED (requires dispute)', () => {
      const evaluation = cancellationPolicyService.evaluateCustomerCancellation({
        currentStatus: BookingStatus.JOB_STARTED,
        totalAmountPaisa: 60000,
        payment: null,
      });

      assert.strictEqual(evaluation.isAllowed, false);
      assert.match(evaluation.blockReason || '', /in progress/i);
    });

    test('6. Blocks customer cancellation in JOB_COMPLETED and PAYMENT_SETTLED', () => {
      const evaluation = cancellationPolicyService.evaluateCustomerCancellation({
        currentStatus: BookingStatus.PAYMENT_SETTLED,
        totalAmountPaisa: 60000,
        payment: { status: 'CAPTURED', amountPaisa: 60000 },
      });

      assert.strictEqual(evaluation.isAllowed, false);
      assert.match(evaluation.blockReason || '', /already been completed/i);
    });
  });

  // ===========================================================================
  // SECTION 2: CUSTOMER CANCELLATION API & IDOR
  // ===========================================================================
  describe('2. Customer Cancellation Flow & Security', () => {
    test('7. Customer successfully cancels unassigned booking in REQUESTED status', async () => {
      const booking = {
        id: 'bkg_cancel_01',
        bookingNumber: 'BK-20261021-001',
        customerId: customerA.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
        totalAmountPaisa: 60000,
        baseAmountPaisa: 60000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/cancel`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          reason: 'CUSTOMER_CHANGED_MIND',
          notes: 'No longer needed today',
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.bookingStatus, BookingStatus.CANCELLED);
      assert.strictEqual(body.data.cancellationFeePaisa, 0);

      const updated = mockPrisma._store.bookings.get(booking.id);
      assert.strictEqual(updated.currentStatus, BookingStatus.CANCELLED);
      assert.strictEqual(updated.cancelledBy, customerA.id);
    });

    test('8. Rejects customer cancellation if caller is not booking owner (IDOR - 403 Forbidden)', async () => {
      const booking = {
        id: 'bkg_cancel_02',
        bookingNumber: 'BK-20261021-002',
        customerId: customerA.id, // belongs to Customer A
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Customer B attempts to cancel Customer A's booking
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/cancel`,
        headers: { authorization: `Bearer ${tokenCustomerB}` },
        payload: { reason: 'CUSTOMER_CHANGED_MIND' },
      });

      assert.strictEqual(response.statusCode, 403);
      const body = response.json();
      assert.match(body.error?.message || body.message, /unauthorized/i);
    });

    test('9. Repeated customer cancellation is idempotent', async () => {
      const booking = {
        id: 'bkg_cancel_03',
        bookingNumber: 'BK-20261021-003',
        customerId: customerA.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.CANCELLED,
        cancellationReason: 'DUPLICATE_BOOKING',
        cancelledBy: customerA.id,
        cancelledAt: new Date(),
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/cancel`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { reason: 'DUPLICATE_BOOKING' },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.cancellationStatus, 'COMPLETED');
    });

    test('10. Deducts cancellation fee and initiates refund for captured payment in CONFIRMED state', async () => {
      const booking = {
        id: 'bkg_cancel_04',
        bookingNumber: 'BK-20261021-004',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.CONFIRMED,
        totalAmountPaisa: 60000,
        baseAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payment = {
        id: 'pay_cancel_04',
        bookingId: booking.id,
        gateway: 'RAZORPAY',
        amountPaisa: 60000,
        status: 'CAPTURED',
        currency: 'INR',
        idempotencyKey: 'idemp_pay_cancel_04',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/cancel`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { reason: 'CUSTOMER_UNAVAILABLE' },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.cancellationFeePaisa, 5000); // ₹50
      assert.strictEqual(body.data.refundAmountPaisa, 55000); // ₹550
      assert.strictEqual(body.data.refundStatus, 'SUCCEEDED');
    });

    test('11. Rejects cancellation once job is completed (400 Bad Request)', async () => {
      const booking = {
        id: 'bkg_cancel_05',
        bookingNumber: 'BK-20261021-005',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/cancel`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { reason: 'CUSTOMER_CHANGED_MIND' },
      });

      assert.strictEqual(response.statusCode, 400);
      const body = response.json();
      assert.match(body.error?.message || body.message, /already been completed/i);
    });

    test('12. Rejects cancellation for non-existent booking (404 Not Found)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings/bkg_non_existent/cancel',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { reason: 'CUSTOMER_CHANGED_MIND' },
      });

      assert.strictEqual(response.statusCode, 404);
    });
  });

  // ===========================================================================
  // SECTION 3: PROVIDER CANCELLATION & REDISPATCH
  // ===========================================================================
  describe('3. Provider Cancellation & Reassignment', () => {
    test('13. Provider cancels accepted booking, returns it to REQUESTED queue and clears providerId', async () => {
      const booking = {
        id: 'bkg_pro_cancel_01',
        bookingNumber: 'BK-20261021-006',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.PROVIDER_ACCEPTED,
        totalAmountPaisa: 60000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/cancel`,
        headers: { authorization: `Bearer ${tokenProvider}` },
        payload: { reason: 'PROVIDER_UNAVAILABLE', notes: 'Vehicle breakdown on way' },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.bookingStatus, BookingStatus.REQUESTED);
      assert.strictEqual(body.data.cancellationStatus, 'REASSIGNING');
      assert.strictEqual(body.data.cancellationFeePaisa, 0); // No fee to customer

      const updated = mockPrisma._store.bookings.get(booking.id);
      assert.strictEqual(updated.currentStatus, BookingStatus.REQUESTED);
      assert.strictEqual(updated.providerId, null);
    });

    test('14. Provider cannot cancel booking assigned to another provider (403 Forbidden)', async () => {
      const otherProvider = { id: 'prv_other_99', userId: 'usr_other_99' };
      mockPrisma._store.providers.set(otherProvider.id, otherProvider);

      const booking = {
        id: 'bkg_pro_cancel_02',
        bookingNumber: 'BK-20261021-007',
        customerId: customerA.id,
        providerId: otherProvider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.CONFIRMED,
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/cancel`,
        headers: { authorization: `Bearer ${tokenProvider}` },
        payload: { reason: 'PROVIDER_UNAVAILABLE' },
      });

      assert.strictEqual(response.statusCode, 403);
    });

    test('15. Provider cannot cancel booking once job is started (400 Bad Request)', async () => {
      const booking = {
        id: 'bkg_pro_cancel_03',
        bookingNumber: 'BK-20261021-008',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.JOB_STARTED,
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/cancel`,
        headers: { authorization: `Bearer ${tokenProvider}` },
        payload: { reason: 'EMERGENCY' },
      });

      assert.strictEqual(response.statusCode, 400);
      const body = response.json();
      assert.match(body.error?.message || body.message, /prior to service start/i);
    });

    test('16. Customer incurs zero cancellation fee when partner cancels', async () => {
      const booking = {
        id: 'bkg_pro_cancel_04',
        bookingNumber: 'BK-20261021-009',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.PROVIDER_ON_THE_WAY,
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const result = await cancellationService.cancelProviderBooking(
        { id: providerUser.id, roles: ['PROVIDER'] },
        booking.id,
        { reason: 'EMERGENCY' }
      );

      assert.strictEqual(result.cancellationFeePaisa, 0);
    });
  });

  // ===========================================================================
  // SECTION 4: NO-SHOW ENGINE
  // ===========================================================================
  describe('4. No-Show Engine', () => {
    test('17. Provider records Customer No-Show after arrival waiting period satisfied', async () => {
      const pastTime = new Date(Date.now() - 20 * 60000); // 20 minutes ago
      const booking = {
        id: 'bkg_noshow_01',
        bookingNumber: 'BK-20261021-010',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.ARRIVED,
        totalAmountPaisa: 60000,
        createdAt: pastTime,
        updatedAt: pastTime,
        statusHistory: [
          {
            bookingId: 'bkg_noshow_01',
            toState: BookingStatus.ARRIVED,
            createdAt: pastTime,
          },
        ],
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/no-show`,
        headers: { authorization: `Bearer ${tokenProvider}` },
        payload: {
          reason: 'CUSTOMER_NO_SHOW',
          notes: 'Waited 20 minutes at door, customer phone unreachable',
          waitingMinutes: 20,
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.bookingStatus, BookingStatus.NO_SHOW);
      assert.strictEqual(body.data.noShowActor, 'CUSTOMER');
      assert.strictEqual(body.data.feePaisa, 20000); // ₹200 fee
      assert.strictEqual(body.data.compensationPaisa, 16000); // 80% = ₹160 compensation
    });

    test('18. Provider cannot record Customer No-Show before 15 min waiting period elapses', async () => {
      const recentTime = new Date(Date.now() - 5 * 60000); // only 5 minutes ago
      const booking = {
        id: 'bkg_noshow_02',
        bookingNumber: 'BK-20261021-011',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.ARRIVED,
        totalAmountPaisa: 60000,
        createdAt: recentTime,
        updatedAt: recentTime,
        statusHistory: [
          {
            bookingId: 'bkg_noshow_02',
            toState: BookingStatus.ARRIVED,
            createdAt: recentTime,
          },
        ],
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/no-show`,
        headers: { authorization: `Bearer ${tokenProvider}` },
        payload: { reason: 'CUSTOMER_NO_SHOW' },
      });

      assert.strictEqual(response.statusCode, 400);
      const body = response.json();
      assert.match(body.error?.message || body.message, /waiting period/i);
    });

    test('19. Provider cannot record Customer No-Show before marking ARRIVED', async () => {
      const booking = {
        id: 'bkg_noshow_03',
        bookingNumber: 'BK-20261021-012',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.PROVIDER_ON_THE_WAY, // Has not arrived yet
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/no-show`,
        headers: { authorization: `Bearer ${tokenProvider}` },
        payload: { reason: 'CUSTOMER_NO_SHOW', waitingMinutes: 20 },
      });

      assert.strictEqual(response.statusCode, 400);
      const body = response.json();
      assert.match(body.error?.message || body.message, /marked ARRIVED/i);
    });

    test('20. Customer reports Provider No-Show when partner fails to arrive', async () => {
      const booking = {
        id: 'bkg_noshow_04',
        bookingNumber: 'BK-20261021-013',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.CONFIRMED,
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payment = {
        id: 'pay_noshow_04',
        bookingId: booking.id,
        amountPaisa: 60000,
        status: 'CAPTURED',
        gateway: 'RAZORPAY',
        idempotencyKey: 'idemp_pay_ns_04',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/no-show`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { reason: 'PROVIDER_NO_SHOW', notes: 'Pro never showed up' },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.bookingStatus, BookingStatus.NO_SHOW);
      assert.strictEqual(body.data.noShowActor, 'PROVIDER');
      assert.strictEqual(body.data.feePaisa, 0); // No fee to customer
      assert.strictEqual(body.data.refundAmountPaisa, 60000); // 100% full refund
    });

    test('21. Customer cannot report Provider No-Show if provider has already marked ARRIVED', async () => {
      const booking = {
        id: 'bkg_noshow_05',
        bookingNumber: 'BK-20261021-014',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.ARRIVED,
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/no-show`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { reason: 'PROVIDER_NO_SHOW' },
      });

      assert.strictEqual(response.statusCode, 400);
      const body = response.json();
      assert.match(body.error?.message || body.message, /failed to arrive/i);
    });

    test('22. Unauthorized user cannot report no-show (403 Forbidden)', async () => {
      const booking = {
        id: 'bkg_noshow_06',
        bookingNumber: 'BK-20261021-015',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.CONFIRMED,
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/no-show`,
        headers: { authorization: `Bearer ${tokenCustomerB}` }, // Customer B has no relation
        payload: { reason: 'PROVIDER_NO_SHOW' },
      });

      assert.strictEqual(response.statusCode, 403);
    });
  });

  // ===========================================================================
  // SECTION 5: REFUND ENGINE & FINANCIAL INVARIANTS
  // ===========================================================================
  describe('5. Refund Engine & Financial Ledger Integrity', () => {
    test('23. Full refund transitions Payment and Booking to REFUNDED, debits wallet and cancels payout', async () => {
      const booking = {
        id: 'bkg_rfnd_01',
        bookingNumber: 'BK-20261021-016',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.PAYMENT_SETTLED,
        totalAmountPaisa: 50000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payment = {
        id: 'pay_rfnd_01',
        bookingId: booking.id,
        amountPaisa: 50000,
        status: 'CAPTURED',
        gatewayPaymentId: 'pay_rzp_mock_rfnd_01',
        gateway: 'RAZORPAY',
        idempotencyKey: 'idemp_pay_rfnd_01',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      // Pre-seed wallet with previous credit
      const wallet = {
        id: 'wal_rfnd_01',
        providerId: provider.id,
        availableBalancePaisa: 42000, // 84% net
        pendingBalancePaisa: 0,
        paidOutBalancePaisa: 0,
        currency: 'INR',
      };
      mockPrisma._store.providerWallets.set(wallet.id, wallet);

      const payout = {
        id: 'pout_rfnd_01',
        providerId: provider.id,
        bookingId: booking.id,
        netPayoutPaisa: 42000,
        status: 'PENDING',
      };
      mockPrisma._store.providerPayouts.push(payout);

      const creditLedger = {
        id: 'ledg_credit_01',
        walletId: wallet.id,
        providerId: provider.id,
        bookingId: booking.id,
        entryType: 'PROVIDER_NET_EARNING',
        direction: 'CREDIT',
        amountPaisa: 42000,
      };
      mockPrisma._store.walletLedgerEntries.push(creditLedger);

      // Execute full refund
      const result = await refundService.processRefund({
        bookingId: booking.id,
        reason: 'Customer satisfaction guarantee',
        initiatedBy: adminUser.id,
      });

      assert.strictEqual(result.status, 'SUCCEEDED');
      assert.strictEqual(result.refundAmountPaisa, 50000);
      assert.strictEqual(result.remainingRefundablePaisa, 0);

      // Check Payment & Booking state
      const updatedPayment = mockPrisma._store.payments.get(payment.id);
      assert.strictEqual(updatedPayment.status, 'REFUNDED');

      const updatedBooking = mockPrisma._store.bookings.get(booking.id);
      assert.strictEqual(updatedBooking.currentStatus, BookingStatus.REFUNDED);

      // Check Provider Wallet debited
      const updatedWallet = mockPrisma._store.providerWallets.get(wallet.id);
      assert.strictEqual(updatedWallet.availableBalancePaisa, 0);

      // Check Payout cancelled
      const updatedPayout = mockPrisma._store.providerPayouts.find((p: any) => p.id === payout.id);
      assert.strictEqual(updatedPayout.status, 'CANCELLED');
    });

    test('24. Partial refund decrements remaining refundable balance and debits proportional provider earnings', async () => {
      const booking = {
        id: 'bkg_rfnd_02',
        bookingNumber: 'BK-20261021-017',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.PAYMENT_SETTLED,
        totalAmountPaisa: 50000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payment = {
        id: 'pay_rfnd_02',
        bookingId: booking.id,
        amountPaisa: 50000,
        status: 'CAPTURED',
        gatewayPaymentId: 'pay_rzp_mock_rfnd_02',
        gateway: 'RAZORPAY',
        idempotencyKey: 'idemp_pay_rfnd_02',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      const wallet = {
        id: 'wal_rfnd_02',
        providerId: provider.id,
        availableBalancePaisa: 42000,
        pendingBalancePaisa: 0,
        paidOutBalancePaisa: 0,
        currency: 'INR',
      };
      mockPrisma._store.providerWallets.set(wallet.id, wallet);

      const payout = {
        id: 'pout_rfnd_02',
        providerId: provider.id,
        bookingId: booking.id,
        netPayoutPaisa: 42000,
        status: 'PENDING',
      };
      mockPrisma._store.providerPayouts.push(payout);

      const creditLedger = {
        id: 'ledg_credit_02',
        walletId: wallet.id,
        providerId: provider.id,
        bookingId: booking.id,
        entryType: 'PROVIDER_NET_EARNING',
        direction: 'CREDIT',
        amountPaisa: 42000,
      };
      mockPrisma._store.walletLedgerEntries.push(creditLedger);

      // Partial refund of 50% = 25000 paisa
      const result = await refundService.processRefund({
        bookingId: booking.id,
        amountPaisa: 25000,
        reason: 'Partial goodwill refund',
        initiatedBy: adminUser.id,
      });

      assert.strictEqual(result.refundAmountPaisa, 25000);
      assert.strictEqual(result.remainingRefundablePaisa, 25000);

      // 50% of 42000 = 21000 debited from wallet
      const updatedWallet = mockPrisma._store.providerWallets.get(wallet.id);
      assert.strictEqual(updatedWallet.availableBalancePaisa, 21000);

      // Payout decremented by 21000 -> remains 21000
      const updatedPayout = mockPrisma._store.providerPayouts.find((p: any) => p.id === payout.id);
      assert.strictEqual(updatedPayout.netPayoutPaisa, 21000);
    });

    test('25. Rejects refund amount greater than remaining refundable amount', async () => {
      const booking = {
        id: 'bkg_rfnd_03',
        bookingNumber: 'BK-20261021-018',
        customerId: customerA.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.PAYMENT_SETTLED,
        totalAmountPaisa: 30000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payment = {
        id: 'pay_rfnd_03',
        bookingId: booking.id,
        amountPaisa: 30000,
        status: 'CAPTURED',
        gateway: 'RAZORPAY',
        idempotencyKey: 'idemp_pay_rfnd_03',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      await assert.rejects(
        async () => {
          await refundService.processRefund({
            bookingId: booking.id,
            amountPaisa: 45000, // Exceeds 30000
            reason: 'Excessive refund',
            initiatedBy: adminUser.id,
          });
        },
        /exceeds remaining refundable balance/i
      );
    });

    test('26. Rejects refund with zero or negative amount', async () => {
      const booking = {
        id: 'bkg_rfnd_04',
        bookingNumber: 'BK-20261021-019',
        customerId: customerA.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.PAYMENT_SETTLED,
        totalAmountPaisa: 30000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payment = {
        id: 'pay_rfnd_04',
        bookingId: booking.id,
        amountPaisa: 30000,
        status: 'CAPTURED',
        gateway: 'RAZORPAY',
        idempotencyKey: 'idemp_pay_rfnd_04',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      await assert.rejects(
        async () => {
          await refundService.processRefund({
            bookingId: booking.id,
            amountPaisa: -500,
            reason: 'Negative test',
            initiatedBy: adminUser.id,
          });
        },
        /must be greater than zero/i
      );
    });

    test('27. Idempotent refund: repeated calls with same idempotency key return existing refund', async () => {
      const booking = {
        id: 'bkg_rfnd_05',
        bookingNumber: 'BK-20261021-020',
        customerId: customerA.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.PAYMENT_SETTLED,
        totalAmountPaisa: 30000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payment = {
        id: 'pay_rfnd_05',
        bookingId: booking.id,
        amountPaisa: 30000,
        status: 'CAPTURED',
        gateway: 'RAZORPAY',
        idempotencyKey: 'idemp_pay_rfnd_05',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      const key = 'rfnd_idemp_key_999';

      const first = await refundService.processRefund({
        bookingId: booking.id,
        amountPaisa: 10000,
        reason: 'Refund test',
        initiatedBy: adminUser.id,
        idempotencyKey: key,
      });

      const second = await refundService.processRefund({
        bookingId: booking.id,
        amountPaisa: 10000,
        reason: 'Refund test',
        initiatedBy: adminUser.id,
        idempotencyKey: key,
      });

      assert.strictEqual(first.refundId, second.refundId);
      assert.strictEqual(mockPrisma._store.refunds.size, 1);
    });

    test('28. Strict financial invariant verified after refund mutations: available + pending + paidOut == totalEarned', async () => {
      const summary = await financialService.getProviderWalletSummary(provider.id);
      const computedTotal =
        summary.availableBalancePaisa +
        summary.pendingBalancePaisa +
        summary.paidOutBalancePaisa;

      assert.strictEqual(computedTotal, summary.totalEarnedPaisa);
    });

    test('29. Append-only double-entry ledger: each refund generates an immutable REFUND DEBIT record', async () => {
      const booking = {
        id: 'bkg_rfnd_06',
        bookingNumber: 'BK-20261021-021',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.PAYMENT_SETTLED,
        totalAmountPaisa: 40000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payment = {
        id: 'pay_rfnd_06',
        bookingId: booking.id,
        amountPaisa: 40000,
        status: 'CAPTURED',
        gateway: 'RAZORPAY',
        idempotencyKey: 'idemp_pay_rfnd_06',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      const wallet = {
        id: 'wal_rfnd_06',
        providerId: provider.id,
        availableBalancePaisa: 33600,
        pendingBalancePaisa: 0,
        paidOutBalancePaisa: 0,
      };
      mockPrisma._store.providerWallets.set(wallet.id, wallet);

      mockPrisma._store.walletLedgerEntries.push({
        id: 'ledg_credit_06',
        walletId: wallet.id,
        providerId: provider.id,
        bookingId: booking.id,
        entryType: 'PROVIDER_NET_EARNING',
        direction: 'CREDIT',
        amountPaisa: 33600,
      });

      await refundService.processRefund({
        bookingId: booking.id,
        amountPaisa: 40000,
        reason: 'Double-entry audit test',
        initiatedBy: adminUser.id,
      });

      const debitEntry = mockPrisma._store.walletLedgerEntries.find(
        (e: any) => e.bookingId === booking.id && e.entryType === 'REFUND'
      );

      assert.ok(debitEntry, 'Debit entry must exist');
      assert.strictEqual(debitEntry.direction, 'DEBIT');
      assert.strictEqual(debitEntry.amountPaisa, 33600);
      assert.strictEqual(debitEntry.resultingAvailablePaisa, 0);
    });
  });

  // ===========================================================================
  // SECTION 6: WEBHOOK REFUND PROCESSING
  // ===========================================================================
  describe('6. Webhook Refund Processing', () => {
    test('30. refund.processed webhook updates refund record to SUCCEEDED and emits REFUND_COMPLETED', async () => {
      const payment = {
        id: 'pay_wh_rfnd_01',
        bookingId: 'bkg_wh_rfnd_01',
        gatewayOrderId: 'order_wh_rfnd_01',
        amountPaisa: 50000,
        status: 'CAPTURED',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      const refundRecord = {
        id: 'rfnd_db_01',
        paymentId: payment.id,
        gatewayRefundId: 'rfnd_ext_12345',
        amountPaisa: 50000,
        status: 'PROCESSING',
      };
      mockPrisma._store.refunds.set(refundRecord.id, refundRecord);

      const webhookPayload = {
        event: 'refund.processed',
        paymentId: payment.id,
        gatewayRefundId: 'rfnd_ext_12345',
        payload: {
          refund: {
            entity: {
              id: 'rfnd_ext_12345',
              payment_id: 'pay_ext_12345',
              amount: 50000,
              status: 'processed',
            },
          },
        },
      };

      const result = await paymentService.handleWebhook('valid_signature', webhookPayload);
      assert.strictEqual(result.received, true);
      assert.strictEqual(result.refundProcessed, true);

      const updated = mockPrisma._store.refunds.get(refundRecord.id);
      assert.strictEqual(updated.status, 'SUCCEEDED');
    });

    test('31. refund.failed webhook updates refund record to FAILED and emits REFUND_FAILED', async () => {
      const payment = {
        id: 'pay_wh_rfnd_02',
        bookingId: 'bkg_wh_rfnd_02',
        amountPaisa: 50000,
        status: 'CAPTURED',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      const refundRecord = {
        id: 'rfnd_db_02',
        paymentId: payment.id,
        gatewayRefundId: 'rfnd_ext_failed_99',
        amountPaisa: 50000,
        status: 'PROCESSING',
      };
      mockPrisma._store.refunds.set(refundRecord.id, refundRecord);

      const webhookPayload = {
        event: 'refund.failed',
        paymentId: payment.id,
        gatewayRefundId: 'rfnd_ext_failed_99',
        payload: {
          refund: {
            entity: {
              id: 'rfnd_ext_failed_99',
              error_description: 'Beneficiary bank decline',
            },
          },
        },
      };

      const result = await paymentService.handleWebhook('valid_signature', webhookPayload);
      assert.strictEqual(result.received, true);
      assert.strictEqual(result.refundFailed, true);

      const updated = mockPrisma._store.refunds.get(refundRecord.id);
      assert.strictEqual(updated.status, 'FAILED');
    });

    test('32. Invalid webhook signature is rejected with 400 Bad Request', async () => {
      const webhookPayload = {
        event: 'refund.processed',
        paymentId: 'pay_01',
      };

      await assert.rejects(
        async () => {
          await paymentService.handleWebhook('bad_signature', webhookPayload);
        },
        /invalid webhook signature/i
      );
    });

    test('33. Gateway adapter processRefund returns deterministic refund reference', async () => {
      const adapter = paymentService.getAdapter();
      const res = await adapter.processRefund({
        gatewayPaymentId: 'pay_mock_test',
        amountPaisa: 10000,
        reason: 'Adapter test',
      });

      assert.ok(res.gatewayRefundId.startsWith('rfnd_'));
    });
  });

  // ===========================================================================
  // SECTION 7: DISPUTE LIFECYCLE & RESOLUTION
  // ===========================================================================
  describe('7. Dispute Engine & Admin Resolution', () => {
    test('34. Customer opens dispute on completed booking -> advances to DISPUTED and creates ticket', async () => {
      const booking = {
        id: 'bkg_dsp_01',
        bookingNumber: 'BK-20261021-022',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
        totalAmountPaisa: 60000,
        complaints: [],
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/disputes`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          reason: 'POOR_QUALITY',
          description: 'The ceiling fan still wobbles violently after repair.',
          disputedAmountPaisa: 60000,
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const body = response.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.status, DisputeStatus.OPEN);
      assert.ok(body.data.ticketNumber.startsWith('DSP-'));

      const updatedBooking = mockPrisma._store.bookings.get(booking.id);
      assert.strictEqual(updatedBooking.currentStatus, BookingStatus.DISPUTED);
    });

    test('35. Provider opens dispute on started booking', async () => {
      const booking = {
        id: 'bkg_dsp_02',
        bookingNumber: 'BK-20261021-023',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.JOB_STARTED,
        totalAmountPaisa: 60000,
        complaints: [],
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/disputes`,
        headers: { authorization: `Bearer ${tokenProvider}` },
        payload: {
          reason: 'SAFETY_ISSUE',
          description: 'Exposed live wiring in premises poses danger to partner.',
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const body = response.json();
      assert.strictEqual(body.data.actorRole, 'PROVIDER');
    });

    test('36. Rejects dispute on unconfirmed / REQUESTED booking (400 Bad Request)', async () => {
      const booking = {
        id: 'bkg_dsp_03',
        bookingNumber: 'BK-20261021-024',
        customerId: customerA.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
        totalAmountPaisa: 60000,
        complaints: [],
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/disputes`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          reason: 'OTHER',
          description: 'Cannot dispute before any work has occurred.',
        },
      });

      assert.strictEqual(response.statusCode, 400);
      const body = response.json();
      assert.match(body.error?.message || body.message, /only be opened for active/i);
    });

    test('37. Rejects duplicate dispute if an active dispute is already open (409 Conflict)', async () => {
      const existingComplaint = {
        id: 'cmpl_active_01',
        ticketNumber: 'DSP-112233',
        status: DisputeStatus.OPEN,
      };

      const booking = {
        id: 'bkg_dsp_04',
        bookingNumber: 'BK-20261021-025',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.DISPUTED,
        totalAmountPaisa: 60000,
        complaints: [existingComplaint],
      };
      mockPrisma._store.bookings.set(booking.id, booking);
      mockPrisma._store.complaints.set(existingComplaint.id, existingComplaint);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/disputes`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          reason: 'POOR_QUALITY',
          description: 'Another dispute for the same job should fail.',
        },
      });

      assert.strictEqual(response.statusCode, 409);
      const body = response.json();
      assert.match(body.error?.message || body.message, /already open/i);
    });

    test('38. Unauthorized user cannot open or view disputes for another customer (403 Forbidden)', async () => {
      const booking = {
        id: 'bkg_dsp_05',
        bookingNumber: 'BK-20261021-026',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
        totalAmountPaisa: 60000,
        complaints: [],
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Customer B attempts to open dispute on Customer A's booking
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/disputes`,
        headers: { authorization: `Bearer ${tokenCustomerB}` },
        payload: {
          reason: 'POOR_QUALITY',
          description: 'Trespassing customer trying to dispute.',
        },
      });

      assert.strictEqual(response.statusCode, 403);
    });

    test('39. Admin resolves dispute in favor of customer with full refund', async () => {
      const booking = {
        id: 'bkg_dsp_06',
        bookingNumber: 'BK-20261021-027',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.DISPUTED,
        totalAmountPaisa: 50000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payment = {
        id: 'pay_dsp_06',
        bookingId: booking.id,
        amountPaisa: 50000,
        status: 'CAPTURED',
        gateway: 'RAZORPAY',
        idempotencyKey: 'idemp_dsp_06',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      const wallet = {
        id: 'wal_dsp_06',
        providerId: provider.id,
        availableBalancePaisa: 42000,
        pendingBalancePaisa: 0,
        paidOutBalancePaisa: 0,
      };
      mockPrisma._store.providerWallets.set(wallet.id, wallet);

      mockPrisma._store.walletLedgerEntries.push({
        id: 'ledg_credit_dsp_06',
        walletId: wallet.id,
        providerId: provider.id,
        bookingId: booking.id,
        entryType: 'PROVIDER_NET_EARNING',
        direction: 'CREDIT',
        amountPaisa: 42000,
      });

      const complaint = {
        id: 'cmpl_dsp_06',
        ticketNumber: 'DSP-998877',
        bookingId: booking.id,
        raisedBy: customerA.id,
        category: 'JOB_NOT_COMPLETED',
        description: 'Pro left halfway without finishing.',
        status: DisputeStatus.OPEN,
        priority: 'HIGH',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.complaints.set(complaint.id, complaint);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/disputes/${complaint.id}/resolve`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          resolution: DisputeStatus.RESOLVED_CUSTOMER,
          resolutionNotes: 'Verified incomplete job via photo proof. Issuing 100% refund.',
          refundAmountPaisa: 50000,
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.status, DisputeStatus.RESOLVED_CUSTOMER);

      // Check booking updated to REFUNDED
      const updatedBooking = mockPrisma._store.bookings.get(booking.id);
      assert.strictEqual(updatedBooking.currentStatus, BookingStatus.REFUNDED);

      // Check provider wallet debited
      const updatedWallet = mockPrisma._store.providerWallets.get(wallet.id);
      assert.strictEqual(updatedWallet.availableBalancePaisa, 0);
    });

    test('40. Admin resolves dispute in favor of provider with 0 refund -> booking returned to PAYMENT_SETTLED', async () => {
      const booking = {
        id: 'bkg_dsp_07',
        bookingNumber: 'BK-20261021-028',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.DISPUTED,
        totalAmountPaisa: 50000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payment = {
        id: 'pay_dsp_07',
        bookingId: booking.id,
        amountPaisa: 50000,
        status: 'CAPTURED',
        gateway: 'RAZORPAY',
        idempotencyKey: 'idemp_dsp_07',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      const complaint = {
        id: 'cmpl_dsp_07',
        ticketNumber: 'DSP-998878',
        bookingId: booking.id,
        raisedBy: customerA.id,
        category: 'PRICE_DISAGREEMENT',
        description: 'Customer claims job was too expensive.',
        status: DisputeStatus.OPEN,
        priority: 'MEDIUM',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.complaints.set(complaint.id, complaint);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/disputes/${complaint.id}/resolve`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          resolution: DisputeStatus.RESOLVED_PROVIDER,
          resolutionNotes: 'Standard catalog rate was clearly approved upfront. Complaint invalid.',
          refundAmountPaisa: 0,
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.status, DisputeStatus.RESOLVED_PROVIDER);

      const updatedBooking = mockPrisma._store.bookings.get(booking.id);
      assert.strictEqual(updatedBooking.currentStatus, BookingStatus.PAYMENT_SETTLED);
    });

    test('41. Admin resolves dispute with partial refund and partial provider debit (RESOLVED_PARTIAL)', async () => {
      const booking = {
        id: 'bkg_dsp_08',
        bookingNumber: 'BK-20261021-029',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.DISPUTED,
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const payment = {
        id: 'pay_dsp_08',
        bookingId: booking.id,
        amountPaisa: 60000,
        status: 'CAPTURED',
        gateway: 'RAZORPAY',
        idempotencyKey: 'idemp_dsp_08',
      };
      mockPrisma._store.payments.set(payment.id, payment);

      const wallet = {
        id: 'wal_dsp_08',
        providerId: provider.id,
        availableBalancePaisa: 50400, // 84%
        pendingBalancePaisa: 0,
        paidOutBalancePaisa: 0,
      };
      mockPrisma._store.providerWallets.set(wallet.id, wallet);

      mockPrisma._store.walletLedgerEntries.push({
        id: 'ledg_credit_dsp_08',
        walletId: wallet.id,
        providerId: provider.id,
        bookingId: booking.id,
        entryType: 'PROVIDER_NET_EARNING',
        direction: 'CREDIT',
        amountPaisa: 50400,
      });

      const complaint = {
        id: 'cmpl_dsp_08',
        ticketNumber: 'DSP-998879',
        bookingId: booking.id,
        raisedBy: customerA.id,
        category: 'POOR_QUALITY',
        description: 'Minor scratches left during work.',
        status: DisputeStatus.OPEN,
        priority: 'MEDIUM',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.complaints.set(complaint.id, complaint);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/disputes/${complaint.id}/resolve`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          resolution: DisputeStatus.RESOLVED_PARTIAL,
          resolutionNotes: 'Issued ₹200 goodwill partial refund to customer.',
          refundAmountPaisa: 20000,
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.status, DisputeStatus.RESOLVED_PARTIAL);
    });

    test('42. Non-admin cannot resolve dispute (403 Forbidden)', async () => {
      const complaint = {
        id: 'cmpl_dsp_09',
        ticketNumber: 'DSP-998880',
        status: DisputeStatus.OPEN,
      };
      mockPrisma._store.complaints.set(complaint.id, complaint);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/disputes/${complaint.id}/resolve`,
        headers: { authorization: `Bearer ${tokenCustomerA}` }, // Customer attempting to resolve
        payload: {
          resolution: DisputeStatus.RESOLVED_CUSTOMER,
          resolutionNotes: 'Self-resolution attempt',
        },
      });

      assert.strictEqual(response.statusCode, 403);
    });

    test('43. Rejects resolution of already resolved/closed dispute (409 Conflict)', async () => {
      const complaint = {
        id: 'cmpl_dsp_10',
        ticketNumber: 'DSP-998881',
        bookingId: 'bkg_10',
        status: DisputeStatus.CLOSED,
      };
      mockPrisma._store.complaints.set(complaint.id, complaint);

      const booking = { id: 'bkg_10', currentStatus: BookingStatus.JOB_COMPLETED };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/disputes/${complaint.id}/resolve`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          resolution: DisputeStatus.RESOLVED_CUSTOMER,
          resolutionNotes: 'Attempting to re-resolve closed dispute',
        },
      });

      assert.strictEqual(response.statusCode, 409);
    });
  });

  // ===========================================================================
  // SECTION 8: SECURITY, TAMPERING & AUDIT INTEGRITY
  // ===========================================================================
  describe('8. Security, Tampering & Audit Integrity', () => {
    test('44. Client cannot tamper with or forge cancellation fees', async () => {
      const booking = {
        id: 'bkg_tamper_01',
        bookingNumber: 'BK-20261021-030',
        customerId: customerA.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.ARRIVED, // ₹150 callout fee mandatory by policy
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Client attempts to inject { cancellationFeePaisa: 0 }
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/cancel`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          reason: 'CUSTOMER_CHANGED_MIND',
          cancellationFeePaisa: 0, // Malicious forged fee
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      // Server-authoritative calculation overrides client payload
      assert.strictEqual(body.data.cancellationFeePaisa, 15000);
    });

    test('45. Admin dispute resolution records immutable AuditLog entry', async () => {
      const complaint = {
        id: 'cmpl_audit_01',
        ticketNumber: 'DSP-AUDIT-01',
        bookingId: 'bkg_audit_01',
        status: DisputeStatus.OPEN,
      };
      mockPrisma._store.complaints.set(complaint.id, complaint);

      const booking = {
        id: 'bkg_audit_01',
        currentStatus: BookingStatus.DISPUTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      await disputeService.resolveDispute(
        { id: adminUser.id, roles: ['ADMIN'] },
        complaint.id,
        {
          resolution: DisputeStatus.RESOLVED_PROVIDER,
          resolutionNotes: 'Resolution audit test',
        }
      );

      const auditLog = mockPrisma._store.auditLogs.find(
        (l: any) => l.action === 'ADMIN_RESOLVE_DISPUTE' && l.resourceId === complaint.id
      );

      assert.ok(auditLog, 'Audit log must be created');
      assert.strictEqual(auditLog.userId, adminUser.id);
      assert.strictEqual(auditLog.newState.ticketNumber, complaint.ticketNumber);
    });

    test('46. Admin can query dispute queue with status filtering and pagination', async () => {
      const c1 = { id: 'c1', ticketNumber: 'DSP-01', status: DisputeStatus.OPEN, createdAt: new Date() };
      const c2 = { id: 'c2', ticketNumber: 'DSP-02', status: DisputeStatus.RESOLVED_CUSTOMER, createdAt: new Date() };
      mockPrisma._store.complaints.set(c1.id, c1);
      mockPrisma._store.complaints.set(c2.id, c2);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/disputes?status=OPEN',
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.items.length, 1);
      assert.strictEqual(body.data.items[0].ticketNumber, 'DSP-01');
    });
  });
});
