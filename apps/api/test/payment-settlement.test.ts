import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { prisma } from '../src/config/database.js';
import { BookingStatus, PaymentStatus } from '@localman/constants';
import { RazorpayAdapter } from '../src/modules/payments/adapters/razorpay.adapter.js';
import { MockPaymentAdapter } from '../src/modules/payments/adapters/mock.adapter.js';
import { financialService, FinancialService } from '../src/modules/financial/financial.service.js';
import { env } from '../src/config/env.js';

describe('Phase 3F — Customer Payment, Checkout, Settlement & Financial Integration Tests', () => {
  let app: FastifyInstance;
  let mockPrisma: any;

  // Actors
  const customerA = {
    id: 'usr_cust_3f_a',
    phoneNumber: '+919876543201',
    fullName: 'Ananya Sharma',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const customerB = {
    id: 'usr_cust_3f_b',
    phoneNumber: '+919876543202',
    fullName: 'Rohan Mehra',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const providerUser = {
    id: 'usr_pro_3f_1',
    phoneNumber: '+919876543211',
    fullName: 'Rajesh Pro',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider = {
    id: 'prv_3f_1',
    userId: providerUser.id,
    businessName: 'Rajesh SuperFix Services',
    verificationStatus: 'VERIFIED',
    status: 'ACTIVE',
    isOnline: true,
  };

  const service = {
    id: 'srv_plumbing_sink',
    name: 'Kitchen Sink Unclogging',
    slug: 'kitchen-sink-unclogging',
    basePricePaisa: 50000, // ₹500.00
  };

  const customerAddress = {
    id: 'addr_3f_1',
    userId: customerA.id,
    addressLine1: 'Flat 302, Palm Grove',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    latitude: 12.9716,
    longitude: 77.5946,
  };

  let tokenCustomerA: string;
  let tokenCustomerB: string;
  let tokenProvider: string;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;
    Object.assign(prisma, mockPrisma);

    mockPrisma._store.users.set(customerA.id, { ...customerA });
    mockPrisma._store.users.set(customerB.id, { ...customerB });
    mockPrisma._store.users.set(providerUser.id, { ...providerUser });
    mockPrisma._store.providers.set(provider.id, { ...provider, user: providerUser });
    mockPrisma._store.addresses.set(customerAddress.id, { ...customerAddress });
    mockPrisma._store.services.set(service.id, { ...service });

    app = await buildApp();
    await app.ready();

    tokenCustomerA = app.jwt.sign({ userId: customerA.id, roles: ['CUSTOMER'] });
    tokenCustomerB = app.jwt.sign({ userId: customerB.id, roles: ['CUSTOMER'] });
    tokenProvider = app.jwt.sign({ userId: providerUser.id, roles: ['PROVIDER'] });
  });

  function seedBooking(overrides: Partial<any> = {}) {
    const bookingId = overrides.id || `bkg_3f_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const booking = {
      id: bookingId,
      bookingNumber: overrides.bookingNumber || `BK-3F-${Date.now().toString().slice(-6)}`,
      customerId: overrides.customerId || customerA.id,
      providerId: overrides.providerId || provider.id,
      serviceId: service.id,
      addressId: customerAddress.id,
      currentStatus: overrides.currentStatus || BookingStatus.JOB_COMPLETED,
      pricingModel: 'FIXED_PRICE',
      baseAmountPaisa: overrides.baseAmountPaisa ?? 50000, // ₹500.00
      taxAmountPaisa: overrides.taxAmountPaisa ?? 9000,    // ₹90.00 (18%)
      platformFeePaisa: overrides.platformFeePaisa ?? 0,
      extraDurationAmountPaisa: overrides.extraDurationAmountPaisa ?? 0,
      materialsTotalPaisa: overrides.materialsTotalPaisa ?? 0,
      totalAmountPaisa: overrides.totalAmountPaisa ?? 59000,
      scheduledDate: new Date('2026-10-25'),
      scheduledTimeSlot: '10:00 - 12:00',
      createdAt: new Date(),
      updatedAt: new Date(),
      materials: overrides.materials ?? [],
      ...overrides,
    };
    mockPrisma._store.bookings.set(booking.id, booking);
    return booking;
  }

  // ===========================================================================
  // 1. CHECKOUT CREATION & ELIGIBILITY
  // ===========================================================================

  test('1. POST /checkout: Customer successfully creates checkout session for JOB_COMPLETED booking', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_COMPLETED });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        idempotencyKey: 'idemp-checkout-001',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.bookingId, booking.id);
    assert.equal(body.data.amountPaisa, booking.totalAmountPaisa);
    assert.equal(body.data.currency, 'INR');
    assert.ok(body.data.gatewayOrderId);
    assert.equal(body.data.paymentStatus, 'CREATED');
  });

  test('2. POST /checkout: Also allows checkout when booking is already in PAYMENT_PENDING', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PAYMENT_PENDING });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        idempotencyKey: 'idemp-checkout-002',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.data.amountPaisa, booking.totalAmountPaisa);
  });

  test('3. POST /checkout: Rejects checkout when booking is in ineligible status (REQUESTED, CONFIRMED, JOB_STARTED)', async () => {
    for (const status of [BookingStatus.REQUESTED, BookingStatus.CONFIRMED, BookingStatus.JOB_STARTED]) {
      const booking = seedBooking({ currentStatus: status });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/payment/checkout`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          bookingId: booking.id,
          idempotencyKey: `idemp-ineligible-${status}`,
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      const errMessage = body.error?.message || body.message || '';
      assert.ok(errMessage.includes('not eligible for payment checkout'));
    }
  });

  test('4. POST /checkout: Rejects checkout when booking is already PAYMENT_SETTLED', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PAYMENT_SETTLED });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        idempotencyKey: 'idemp-already-settled',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    const errMessage = body.error?.message || body.message || '';
    assert.ok(errMessage.toLowerCase().includes('settled') || errMessage.includes('already paid'));
  });

  test('5. POST /checkout: Ownership IDOR: Customer B cannot create checkout for Customer A booking', async () => {
    const booking = seedBooking({ customerId: customerA.id });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerB}` },
      payload: {
        bookingId: booking.id,
        idempotencyKey: 'idemp-idor-b',
      },
    });

    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.payload);
    const errMessage = body.error?.message || body.message || '';
    assert.ok(errMessage.includes('Unauthorized'));
  });

  test('6. POST /checkout: Provider cannot create checkout for customer booking', async () => {
    const booking = seedBooking({ customerId: customerA.id });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenProvider}` },
      payload: {
        bookingId: booking.id,
        idempotencyKey: 'idemp-pro-checkout',
      },
    });

    assert.equal(res.statusCode, 403);
  });

  // ===========================================================================
  // 2. AUTHORITATIVE AMOUNT CALCULATION & CLIENT TAMPERING RESISTANCE
  // ===========================================================================

  test('7. Server calculates authoritative amount including approved materials (client cannot override)', async () => {
    const approvedMaterial = {
      id: 'mat_01',
      bookingId: 'bkg_mat_1',
      materialName: 'High Grade Brass Valve',
      quantity: 2,
      unitPricePaisa: 15000, // ₹150.00 each
      totalAmountPaisa: 30000, // ₹300.00
      status: 'APPROVED',
      isCustomerApproved: true,
    };
    const rejectedMaterial = {
      id: 'mat_02',
      bookingId: 'bkg_mat_1',
      materialName: 'Unapproved Pipe Seal',
      quantity: 1,
      unitPricePaisa: 50000,
      totalAmountPaisa: 50000,
      status: 'REJECTED',
      isCustomerApproved: false,
    };

    // Base: 50000, Approved Materials: 30000, Tax: 9000, PlatformFee: 2500 -> Total: 91500
    const booking = seedBooking({
      id: 'bkg_mat_1',
      baseAmountPaisa: 50000,
      taxAmountPaisa: 9000,
      platformFeePaisa: 2500,
      materialsTotalPaisa: 30000,
      totalAmountPaisa: 91500,
      materials: [approvedMaterial, rejectedMaterial],
    });

    // Client maliciously attempts to send totalAmountPaisa = 100 paisa (₹1)
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        idempotencyKey: 'idemp-tamper-01',
        totalAmountPaisa: 100, // MALICIOUS
        commissionRate: 0,      // MALICIOUS
        tdsRate: 0,             // MALICIOUS
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    // Server MUST use authoritative 91500 paisa, completely ignoring malicious client input
    assert.equal(body.data.amountPaisa, 91500);
  });

  // ===========================================================================
  // 3. CHECKOUT IDEMPOTENCY
  // ===========================================================================

  test('8. Checkout Idempotency: Same booking + same idempotency key returns identical session', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_COMPLETED });

    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        idempotencyKey: 'idemp-replay-001',
      },
    });
    assert.equal(res1.statusCode, 201);
    const body1 = JSON.parse(res1.payload);

    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        idempotencyKey: 'idemp-replay-001',
      },
    });
    assert.equal(res2.statusCode, 201);
    const body2 = JSON.parse(res2.payload);

    assert.equal(body1.data.transactionId, body2.data.transactionId);
    assert.equal(body1.data.gatewayOrderId, body2.data.gatewayOrderId);
    assert.equal(body1.data.amountPaisa, body2.data.amountPaisa);
  });

  test('9. Checkout Idempotency Conflict: Same idempotency key with different bookingId yields 409 Conflict', async () => {
    const booking1 = seedBooking({ id: 'bkg_idem_1' });
    const booking2 = seedBooking({ id: 'bkg_idem_2' });

    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking1.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking1.id,
        idempotencyKey: 'idemp-conflict-test',
      },
    });
    assert.equal(res1.statusCode, 201);

    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking2.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking2.id,
        idempotencyKey: 'idemp-conflict-test', // Same key, different booking!
      },
    });
    assert.equal(res2.statusCode, 409);
    const body2 = JSON.parse(res2.payload);
    const errMessage2 = body2.error?.message || body2.message || '';
    assert.ok(errMessage2.includes('Idempotency key collision'));
  });

  // ===========================================================================
  // 4. GATEWAY ADAPTER CONTRACT & SIGNATURE VERIFICATION
  // ===========================================================================

  test('10. Gateway Abstraction: RazorpayAdapter computes and verifies valid HMAC SHA-256 signatures', () => {
    const adapter = new RazorpayAdapter();
    const orderId = 'order_test_12345';
    const paymentId = 'pay_test_67890';
    const secret = env.RAZORPAY_KEY_SECRET;

    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = adapter.verifyPaymentSignature({
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      gatewaySignature: validSignature,
    });
    assert.equal(isValid, true);
  });

  test('11. Gateway Abstraction: RazorpayAdapter rejects invalid/tampered signatures using constant-time check', () => {
    const adapter = new RazorpayAdapter();
    const orderId = 'order_test_12345';
    const paymentId = 'pay_test_67890';

    const isTamperedValid = adapter.verifyPaymentSignature({
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      gatewaySignature: '0000000000000000000000000000000000000000000000000000000000000000',
    });
    assert.equal(isTamperedValid, false);

    const isBadLengthValid = adapter.verifyPaymentSignature({
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      gatewaySignature: 'short_forged_sig',
    });
    assert.equal(isBadLengthValid, false);

    const isNullValid = adapter.verifyPaymentSignature({
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      gatewaySignature: '',
    });
    assert.equal(isNullValid, false);
  });

  test('12. Gateway Abstraction: MockPaymentAdapter rejects explicit invalid/bad signatures', () => {
    const adapter = new MockPaymentAdapter();
    assert.equal(adapter.verifyPaymentSignature({
      gatewayOrderId: 'ord_1',
      gatewayPaymentId: 'pay_1',
      gatewaySignature: 'valid_mock_sig',
    }), true);

    assert.equal(adapter.verifyPaymentSignature({
      gatewayOrderId: 'ord_1',
      gatewayPaymentId: 'pay_1',
      gatewaySignature: 'invalid_signature',
    }), false);

    assert.equal(adapter.verifyPaymentSignature({
      gatewayOrderId: 'ord_1',
      gatewayPaymentId: 'pay_1',
      gatewaySignature: 'bad_signature',
    }), false);
  });

  // ===========================================================================
  // 5. PAYMENT VERIFICATION & SETTLEMENT EXECUTION
  // ===========================================================================

  test('13. POST /verify: Valid payment signature triggers FinancialService and transitions to PAYMENT_SETTLED', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_COMPLETED });

    // Step 1: Create checkout
    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    assert.equal(checkoutRes.statusCode, 201);
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    // Step 2: Verify payment
    const verifyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        gatewayOrderId: checkoutData.gatewayOrderId,
        gatewayPaymentId: 'pay_mock_success_123',
        gatewaySignature: 'sig_mock_success_123',
      },
    });

    assert.equal(verifyRes.statusCode, 200);
    const verifyBody = JSON.parse(verifyRes.payload);
    assert.equal(verifyBody.success, true);
    assert.equal(verifyBody.data.paymentStatus, 'SUCCESS');
    assert.equal(verifyBody.data.bookingStatus, BookingStatus.PAYMENT_SETTLED);

    // Verify booking state in store
    const updatedBooking = mockPrisma._store.bookings.get(booking.id);
    assert.equal(updatedBooking.currentStatus, BookingStatus.PAYMENT_SETTLED);
  });

  test('14. POST /verify: Invalid signature is rejected with 400 and keeps transaction PENDING/FAILED', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_COMPLETED });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    const verifyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        gatewayOrderId: checkoutData.gatewayOrderId,
        gatewayPaymentId: 'pay_mock_tampered',
        gatewaySignature: 'invalid_signature', // triggers failure
      },
    });

    assert.equal(verifyRes.statusCode, 400);
    const body = JSON.parse(verifyRes.payload);
    const errMessage = body.error?.message || body.message || '';
    assert.ok(errMessage.includes('Invalid payment gateway signature'));

    // Invariant: Booking is NOT marked PAYMENT_SETTLED
    const bkg = mockPrisma._store.bookings.get(booking.id);
    assert.notEqual(bkg.currentStatus, BookingStatus.PAYMENT_SETTLED);
  });

  // ===========================================================================
  // 6. FINANCIAL SETTLEMENT, RATES, WALLET & INVARIANTS
  // ===========================================================================

  test('15. Financial Calculation: FinancialService accurately applies canonical 15% commission and 1% TDS', async () => {
    // ₹1000.00 base + ₹180.00 tax = ₹1180.00 gross total
    const booking = seedBooking({
      baseAmountPaisa: 100000,
      taxAmountPaisa: 18000,
      totalAmountPaisa: 118000,
    });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    const verifyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        gatewayOrderId: checkoutData.gatewayOrderId,
        gatewayPaymentId: 'pay_fin_calc_01',
        gatewaySignature: 'sig_valid_01',
      },
    });
    assert.equal(verifyRes.statusCode, 200);

    // Expected Financial Settlement:
    // Gross: 118000 paisa
    // 15% Platform Commission: 118000 * 0.15 = 17700 paisa
    // Statutory Section 194-O TDS on Gross
    const expectedTdsRate = FinancialService.STATUTORY_TDS_PERCENT;
    const expectedTds = Math.round(118000 * (expectedTdsRate / 100));
    const expectedNet = 118000 - 17700 - expectedTds;

    const payouts = await mockPrisma.providerPayout.findMany({
      where: { bookingId: booking.id },
    });
    assert.ok(payouts.length >= 1);
    const payout = payouts[0];
    assert.equal(payout.grossAmountPaisa, 118000);
    assert.equal(payout.platformDeductionPaisa, 17700);
    assert.equal(payout.tdsDeductionPaisa, expectedTds);
    assert.equal(payout.netPayoutPaisa, expectedNet);
    assert.equal(payout.appliedCommissionRate, 15.0);
    assert.equal(payout.appliedTdsRate, expectedTdsRate);

    const payment = Array.from(mockPrisma._store.payments.values()).find(
      (p: any) => p.bookingId === booking.id
    ) as any;
    assert.ok(payment);
    assert.equal(payment.status, 'CAPTURED');
  });

  test('16. Provider Wallet & Ledger: Wallet is credited with net amount and append-only ledger entry is recorded', async () => {
    const booking = seedBooking({
      totalAmountPaisa: 100000, // ₹1000.00
    });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        gatewayOrderId: checkoutData.gatewayOrderId,
        gatewayPaymentId: 'pay_wallet_01',
        gatewaySignature: 'sig_wallet_01',
      },
    });

    // Check provider wallet
    const wallet = await financialService.getProviderWalletSummary(provider.id);
    assert.ok(wallet);
    const expectedTds16 = Math.round(100000 * (FinancialService.STATUTORY_TDS_PERCENT / 100));
    const expectedNet16 = 100000 - 15000 - expectedTds16;
    assert.equal(wallet.availableBalancePaisa, expectedNet16);
    assert.equal(wallet.totalEarnedPaisa, expectedNet16);

    // Check WalletLedgerEntry
    const ledgerEntries = await mockPrisma.walletLedgerEntry.findMany({
      where: { providerId: provider.id },
    });
    assert.equal(ledgerEntries.length, 1);
    assert.equal(ledgerEntries[0].direction, 'CREDIT');
    assert.equal(ledgerEntries[0].amountPaisa, expectedNet16);
    assert.equal(ledgerEntries[0].resultingAvailablePaisa, expectedNet16);
  });

  test('17. ProviderPayout: Payout record created with PENDING status and scheduled availableAt', async () => {
    const booking = seedBooking({ baseAmountPaisa: 50000, taxAmountPaisa: 0, totalAmountPaisa: 50000 });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        gatewayOrderId: checkoutData.gatewayOrderId,
        gatewayPaymentId: 'pay_payout_01',
        gatewaySignature: 'sig_payout_01',
      },
    });

    const payouts = await mockPrisma.providerPayout.findMany({
      where: { providerId: provider.id },
    });
    assert.ok(payouts.length >= 1);
    const payout = payouts[0];
    const expectedTds17 = Math.round(50000 * (FinancialService.STATUTORY_TDS_PERCENT / 100));
    const expectedNet17 = 50000 - 7500 - expectedTds17;
    assert.equal(payout.status, 'PENDING');
    assert.equal(payout.appliedCommissionRate, 15.0);
    assert.equal(payout.appliedTdsRate, FinancialService.STATUTORY_TDS_PERCENT);
    assert.equal(payout.netPayoutPaisa, expectedNet17);
  });

  test('18. Strict Financial Invariant: availableBalance + paidOutBalance + pendingPayouts == totalEarned', async () => {
    const booking1 = seedBooking({ id: 'bkg_inv_1', totalAmountPaisa: 60000 });
    const booking2 = seedBooking({ id: 'bkg_inv_2', totalAmountPaisa: 40000 });

    // Settle booking 1
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking1.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking1.id },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking1.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking1.id,
        gatewayOrderId: JSON.parse(res1.payload).data.gatewayOrderId,
        gatewayPaymentId: 'pay_inv_1',
        gatewaySignature: 'sig_inv_1',
      },
    });

    // Settle booking 2
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking2.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking2.id },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking2.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking2.id,
        gatewayOrderId: JSON.parse(res2.payload).data.gatewayOrderId,
        gatewayPaymentId: 'pay_inv_2',
        gatewaySignature: 'sig_inv_2',
      },
    });

    const wallet = await financialService.getProviderWalletSummary(provider.id);
    const available = wallet.availableBalancePaisa || 0;
    const paidOut = wallet.paidOutBalancePaisa || 0;
    const pending = wallet.pendingBalancePaisa || 0;
    const totalEarned = wallet.totalEarnedPaisa;

    // Check invariant
    assert.equal(available + paidOut + pending, totalEarned);

    // Check against sum of credit ledger entries
    const ledgerEntries = await mockPrisma.walletLedgerEntry.findMany({
      where: { providerId: provider.id, direction: 'CREDIT' },
    });
    const sumCredits = ledgerEntries.reduce((sum: number, e: any) => sum + e.amountPaisa, 0);
    assert.equal(totalEarned, sumCredits);
  });

  // ===========================================================================
  // 7. WEBHOOK PROCESSING & SECURITY
  // ===========================================================================

  test('19. Webhook Security: Unsigned or invalid webhook signature is rejected with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhook',
      headers: {
        'x-razorpay-signature': 'invalid_signature',
      },
      payload: {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_unauth', order_id: 'order_unauth', amount: 50000 },
          },
        },
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    const errMessage = body.error?.message || body.message || '';
    assert.ok(errMessage.includes('Invalid webhook signature'));
  });

  test('20. Webhook Processing: Valid webhook payment.captured settles booking idempotently', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_COMPLETED });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhook',
      headers: {
        'x-razorpay-signature': 'valid_webhook_signature',
      },
      payload: {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_hook_01',
              order_id: checkoutData.gatewayOrderId,
              amount: booking.totalAmountPaisa,
              notes: { bookingId: booking.id },
            },
          },
        },
      },
    });

    assert.equal(webhookRes.statusCode, 200);
    const webhookBody = JSON.parse(webhookRes.payload);
    assert.equal(webhookBody.success, true);
    assert.equal(webhookBody.data.received, true);

    const bkg = mockPrisma._store.bookings.get(booking.id);
    assert.equal(bkg.currentStatus, BookingStatus.PAYMENT_SETTLED);
  });

  test('21. Webhook Failure: payment.failed event marks transaction FAILED and does not credit wallet', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_COMPLETED });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhook',
      headers: {
        'x-razorpay-signature': 'valid_webhook_signature',
      },
      payload: {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_fail_01',
              order_id: checkoutData.gatewayOrderId,
              amount: booking.totalAmountPaisa,
              notes: { bookingId: booking.id },
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Card declined by issuing bank',
            },
          },
        },
      },
    });

    assert.equal(webhookRes.statusCode, 200);

    // Invariant: Provider wallet must remain 0
    const wallet = await financialService.getProviderWalletSummary(provider.id);
    assert.equal(wallet.availableBalancePaisa, 0);
    assert.equal(wallet.totalEarnedPaisa, 0);

    // Transaction should reflect failure
    const payment = Array.from(mockPrisma._store.payments.values()).find(
      (p: any) => p.bookingId === booking.id
    ) as any;
    assert.equal(payment.status, 'FAILED');
  });

  // ===========================================================================
  // 8. IDEMPOTENCY, REPLAY & CONCURRENCY RACES
  // ===========================================================================

  test('22. Webhook Replay: Duplicate webhook delivers 200 without creating duplicate wallet credits', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_COMPLETED });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    const webhookPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_dup_01',
            order_id: checkoutData.gatewayOrderId,
            amount: booking.totalAmountPaisa,
            notes: { bookingId: booking.id },
          },
        },
      },
    };

    // First arrival
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhook',
      headers: { 'x-razorpay-signature': 'valid_sig' },
      payload: webhookPayload,
    });
    assert.equal(res1.statusCode, 200);

    const walletAfterFirst = (await financialService.getProviderWalletSummary(provider.id)).availableBalancePaisa;

    // Second arrival (duplicate / replay)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhook',
      headers: { 'x-razorpay-signature': 'valid_sig' },
      payload: webhookPayload,
    });
    assert.equal(res2.statusCode, 200);

    const walletAfterSecond = (await financialService.getProviderWalletSummary(provider.id)).availableBalancePaisa;
    // Invariant: Balance must be identical; no duplicate credit
    assert.equal(walletAfterFirst, walletAfterSecond);
  });

  test('23. Client & Webhook Race: Client verification and webhook race settles exactly once', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_COMPLETED });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    // Execute verify and webhook concurrently
    const [clientRes, hookRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/payment/verify`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          bookingId: booking.id,
          gatewayOrderId: checkoutData.gatewayOrderId,
          gatewayPaymentId: 'pay_race_01',
          gatewaySignature: 'sig_race_01',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/payments/webhook',
        headers: { 'x-razorpay-signature': 'valid_sig' },
        payload: {
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: 'pay_race_01',
                order_id: checkoutData.gatewayOrderId,
                amount: booking.totalAmountPaisa,
                notes: { bookingId: booking.id },
              },
            },
          },
        },
      }),
    ]);

    assert.equal(clientRes.statusCode, 200);
    assert.equal(hookRes.statusCode, 200);

    // Invariant: Exactly 1 ledger entry
    const ledgerEntries = await mockPrisma.walletLedgerEntry.findMany({
      where: { providerId: provider.id },
    });
    assert.equal(ledgerEntries.length, 1);
  });

  test('24. Repeated Client Verification: Successive verify calls return success idempotently', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_COMPLETED });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    const verifyPayload = {
      bookingId: booking.id,
      gatewayOrderId: checkoutData.gatewayOrderId,
      gatewayPaymentId: 'pay_repeat_01',
      gatewaySignature: 'sig_repeat_01',
    };

    const call1 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: verifyPayload,
    });
    assert.equal(call1.statusCode, 200);

    const call2 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: verifyPayload,
    });
    assert.equal(call2.statusCode, 200);
    assert.equal(JSON.parse(call2.payload).data.paymentStatus, 'SUCCESS');
  });

  // ===========================================================================
  // 9. SECURITY & IDOR RESTRICTIONS
  // ===========================================================================

  test('25. Security IDOR: Customer B cannot verify payment for Customer A booking', async () => {
    const booking = seedBooking({ customerId: customerA.id });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    const verifyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerB}` }, // Customer B attempting verification
      payload: {
        bookingId: booking.id,
        gatewayOrderId: checkoutData.gatewayOrderId,
        gatewayPaymentId: 'pay_idor_01',
        gatewaySignature: 'sig_idor_01',
      },
    });

    assert.equal(verifyRes.statusCode, 403);
    const body = JSON.parse(verifyRes.payload);
    const errMessage = body.error?.message || body.message || '';
    assert.ok(errMessage.includes('Unauthorized'));
  });

  test('26. Security IDOR: Provider cannot verify customer payment', async () => {
    const booking = seedBooking({ customerId: customerA.id });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    const verifyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenProvider}` }, // Provider attempting verification
      payload: {
        bookingId: booking.id,
        gatewayOrderId: checkoutData.gatewayOrderId,
        gatewayPaymentId: 'pay_pro_tamper',
        gatewaySignature: 'sig_pro_tamper',
      },
    });

    assert.equal(verifyRes.statusCode, 403);
  });

  test('27. Webhook Security: Unmatched bookingId in webhook notes cannot settle unrelated payment', async () => {
    const booking1 = seedBooking({ id: 'bkg_webhook_unrelated_1' });
    const booking2 = seedBooking({ id: 'bkg_webhook_unrelated_2' });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking1.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking1.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    // Attacker crafts webhook referencing booking1's orderId but points notes to booking2
    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhook',
      headers: { 'x-razorpay-signature': 'valid_sig' },
      payload: {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_unrelated_spoof',
              order_id: checkoutData.gatewayOrderId, // belongs to booking1
              amount: 50000,
              notes: { bookingId: booking2.id }, // forged booking2 reference
            },
          },
        },
      },
    });

    // Should process safely or settle booking1 (the true owner of order_id), NEVER marking booking2 settled
    const bkg2 = mockPrisma._store.bookings.get(booking2.id);
    assert.notEqual(bkg2.currentStatus, BookingStatus.PAYMENT_SETTLED);
  });

  // ===========================================================================
  // 10. PAYMENT SUMMARY / RECEIPT & DATA SANITIZATION
  // ===========================================================================

  test('28. GET /summary: Customer retrieves server-authoritative payment summary', async () => {
    const testMaterial = {
      id: 'mat_rec_01',
      bookingId: 'bkg_rec_01',
      materialName: 'Water Filter Cartridge',
      quantity: 1,
      unitPricePaisa: 15000,
      totalAmountPaisa: 15000,
      status: 'APPROVED',
      isCustomerApproved: true,
    };
    const booking = seedBooking({
      id: 'bkg_rec_01',
      baseAmountPaisa: 50000,
      taxAmountPaisa: 9000,
      platformFeePaisa: 2500,
      materialsTotalPaisa: 15000,
      totalAmountPaisa: 76500,
      materials: [testMaterial],
      currentStatus: BookingStatus.JOB_COMPLETED,
    });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    const checkoutData = JSON.parse(checkoutRes.payload).data;

    await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        gatewayOrderId: checkoutData.gatewayOrderId,
        gatewayPaymentId: 'pay_receipt_01',
        gatewaySignature: 'sig_receipt_01',
      },
    });

    const summaryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${booking.id}/payment/summary`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
    });

    assert.equal(summaryRes.statusCode, 200);
    const summary = JSON.parse(summaryRes.payload).data;
    assert.equal(summary.bookingId, booking.id);
    assert.equal(summary.totalAmountPaisa, 76500);
    assert.equal(summary.baseAmountPaisa, 50000);
    assert.equal(summary.taxAmountPaisa, 9000);
    assert.equal(summary.platformFeePaisa, 2500);
    assert.equal(summary.materialsAmountPaisa, 15000);
    assert.equal(summary.paymentStatus, 'SUCCESS');
    assert.equal(summary.paymentGateway, 'RAZORPAY');
    assert.equal(summary.gatewayPaymentId, 'pay_receipt_01');
    assert.ok(summary.items.length >= 1);
  });

  test('29. GET /summary: Customer receipt NEVER exposes provider bank details, TDS or internal ledger entries', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_COMPLETED });

    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        gatewayOrderId: JSON.parse(checkoutRes.payload).data.gatewayOrderId,
        gatewayPaymentId: 'pay_sanitized_01',
        gatewaySignature: 'sig_sanitized_01',
      },
    });

    const summaryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${booking.id}/payment/summary`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
    });

    const bodyString = summaryRes.payload;
    // Ensure sensitive terms do NOT leak to customer client
    assert.ok(!bodyString.includes('bankAccountNumber'));
    assert.ok(!bodyString.includes('ifscCode'));
    assert.ok(!bodyString.includes('tdsAmountPaisa'));
    assert.ok(!bodyString.includes('commissionAmountPaisa'));
    assert.ok(!bodyString.includes('WalletLedgerEntry'));
    assert.ok(!bodyString.includes('availableBalancePaisa'));
  });

  test('30. GET /summary: Ownership IDOR: Customer B cannot view Customer A payment summary', async () => {
    const booking = seedBooking({ customerId: customerA.id });

    const summaryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${booking.id}/payment/summary`,
      headers: { authorization: `Bearer ${tokenCustomerB}` },
    });

    assert.equal(summaryRes.statusCode, 403);
    const body = JSON.parse(summaryRes.payload);
    const errMessage = body.error?.message || body.message || '';
    assert.ok(errMessage.includes('Unauthorized'));
  });

  // ===========================================================================
  // 11. PAYMENT RETRY & TRANSACTION RECOVERY
  // ===========================================================================

  test('31. Payment Retry: Customer can retry checkout after failed attempt without corrupting booking', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_COMPLETED });

    // Checkout 1
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id, idempotencyKey: 'idemp-retry-1' },
    });
    assert.equal(res1.statusCode, 201);
    const data1 = JSON.parse(res1.payload).data;

    // Fail payment 1
    await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        gatewayOrderId: data1.gatewayOrderId,
        gatewayPaymentId: 'pay_fail_retry',
        gatewaySignature: 'invalid_signature',
      },
    });

    // Booking remains safe and eligible for retry
    const bkg = mockPrisma._store.bookings.get(booking.id);
    assert.notEqual(bkg.currentStatus, BookingStatus.PAYMENT_SETTLED);

    // Customer retries checkout with a new key
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: booking.id, idempotencyKey: 'idemp-retry-2' },
    });
    assert.equal(res2.statusCode, 201);
    const data2 = JSON.parse(res2.payload).data;

    // Verify retry succeeds
    const verifyRes2 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.id}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: booking.id,
        gatewayOrderId: data2.gatewayOrderId,
        gatewayPaymentId: 'pay_success_retry',
        gatewaySignature: 'sig_success_retry',
      },
    });
    assert.equal(verifyRes2.statusCode, 200);

    const updatedBkg = mockPrisma._store.bookings.get(booking.id);
    assert.equal(updatedBkg.currentStatus, BookingStatus.PAYMENT_SETTLED);
  });

  test('32. Non-existent booking returns 404 on checkout, verify, and summary endpoints', async () => {
    const fakeId = 'bkg_non_existent_999';

    const r1 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${fakeId}/payment/checkout`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: { bookingId: fakeId },
    });
    assert.equal(r1.statusCode, 404);

    const r2 = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${fakeId}/payment/verify`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
      payload: {
        bookingId: fakeId,
        gatewayOrderId: 'ord_fake',
        gatewayPaymentId: 'pay_fake',
        gatewaySignature: 'sig_fake',
      },
    });
    assert.equal(r2.statusCode, 404);

    const r3 = await app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${fakeId}/payment/summary`,
      headers: { authorization: `Bearer ${tokenCustomerA}` },
    });
    assert.equal(r3.statusCode, 404);
  });
});
