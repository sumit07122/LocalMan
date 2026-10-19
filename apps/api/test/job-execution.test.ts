import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { BookingStatus } from '@localman/constants';

/**
 * Phase 2C Tests: Job Execution API & Provider Wallet/Ledger
 *
 * Verifies:
 * - Provider job execution status transitions (ON_THE_WAY, ARRIVED, JOB_STARTED, JOB_COMPLETED)
 * - Server-enforced OTP validation for JOB_STARTED (backend verifies; client cannot bypass)
 * - IDOR: provider cannot update another provider's booking
 * - Non-provider (customer) cannot call job execution endpoints
 * - Invalid FSM transitions are rejected, DB not mutated
 * - Client cannot inject actorId, providerId, or financial values
 * - Provider wallet returns backend-authoritative ledger data
 * - Unauthorized wallet access is rejected
 * - Provider wallet isolation: provider sees only their own payouts
 */
describe('Phase 2C: Job Execution API & Provider Wallet Tests', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  const providerUserA = {
    id: 'usr_prov_a_2c',
    phoneNumber: '9800000001',
    fullName: 'Provider Arjun',
    email: 'arjun@localman.test',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const providerProfileA = {
    id: 'prv_a_2c',
    userId: providerUserA.id,
    businessName: 'Arjun Electricals',
    verificationStatus: 'VERIFIED',
    isOnline: true,
  };

  const providerUserB = {
    id: 'usr_prov_b_2c',
    phoneNumber: '9800000002',
    fullName: 'Provider Bharat',
    email: 'bharat@localman.test',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const providerProfileB = {
    id: 'prv_b_2c',
    userId: providerUserB.id,
    businessName: 'Bharat HVAC',
    verificationStatus: 'VERIFIED',
    isOnline: true,
  };

  const customerUser = {
    id: 'usr_cust_2c',
    phoneNumber: '9800000003',
    fullName: 'Customer Priya',
    email: 'priya@localman.test',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  let tokenA: string;
  let tokenB: string;
  let tokenCustomer: string;

  const bookingStartOtp = '741852';

  beforeEach(async () => {
    mockPrisma = createMockPrisma();

    mockPrisma._store.users.set(providerUserA.id, { ...providerUserA });
    mockPrisma._store.providers.set(providerProfileA.id, { ...providerProfileA });

    mockPrisma._store.users.set(providerUserB.id, { ...providerUserB });
    mockPrisma._store.providers.set(providerProfileB.id, { ...providerProfileB });

    mockPrisma._store.users.set(customerUser.id, { ...customerUser });

    // Booking confirmed to Provider A (ready for ON_THE_WAY)
    mockPrisma._store.bookings.set('bkg_2c_001', {
      id: 'bkg_2c_001',
      bookingNumber: 'BK-2C-001',
      customerId: customerUser.id,
      providerId: providerProfileA.id,
      serviceId: 'srv_elec_01',
      currentStatus: BookingStatus.CONFIRMED,
      pricingModel: 'FIXED_PRICE',
      baseAmountPaisa: 50000,
      taxAmountPaisa: 9000,
      platformFeePaisa: 7500,
      totalAmountPaisa: 59000,
      providerEarningPaisa: 42500,
      startOtp: bookingStartOtp,
      startedAt: null,
      service: { id: 'srv_elec_01', name: 'Fan Repair' },
      address: { addressLine1: 'Koramangala 5th Block', city: 'Bengaluru', postalCode: '560095' },
      customer: { id: customerUser.id, fullName: 'Customer Priya', phoneNumber: '9800000003' },
    });

    // Booking for Provider A in ARRIVED state (ready for JOB_STARTED)
    mockPrisma._store.bookings.set('bkg_2c_002', {
      id: 'bkg_2c_002',
      bookingNumber: 'BK-2C-002',
      customerId: customerUser.id,
      providerId: providerProfileA.id,
      serviceId: 'srv_plumb_01',
      currentStatus: BookingStatus.ARRIVED,
      pricingModel: 'FIXED_PRICE',
      baseAmountPaisa: 35000,
      taxAmountPaisa: 6300,
      platformFeePaisa: 5250,
      totalAmountPaisa: 41300,
      providerEarningPaisa: 29750,
      startOtp: bookingStartOtp,
      startedAt: null,
      service: { id: 'srv_plumb_01', name: 'Tap Repair' },
      customer: { id: customerUser.id, fullName: 'Customer Priya', phoneNumber: '9800000003' },
    });

    // Booking for Provider A in JOB_STARTED state (ready for JOB_COMPLETED)
    mockPrisma._store.bookings.set('bkg_2c_003', {
      id: 'bkg_2c_003',
      bookingNumber: 'BK-2C-003',
      customerId: customerUser.id,
      providerId: providerProfileA.id,
      serviceId: 'srv_elec_01',
      currentStatus: BookingStatus.JOB_STARTED,
      pricingModel: 'FIXED_PRICE',
      baseAmountPaisa: 60000,
      taxAmountPaisa: 10800,
      platformFeePaisa: 9000,
      totalAmountPaisa: 70800,
      providerEarningPaisa: 51000,
      startOtp: bookingStartOtp,
      startedAt: new Date(Date.now() - 3600_000), // started 1 hour ago
      service: { id: 'srv_elec_01', name: 'AC Service' },
      customer: { id: customerUser.id, fullName: 'Customer Priya', phoneNumber: '9800000003' },
    });

    // Booking for Provider B (IDOR test target)
    mockPrisma._store.bookings.set('bkg_2c_004', {
      id: 'bkg_2c_004',
      bookingNumber: 'BK-2C-004',
      customerId: customerUser.id,
      providerId: providerProfileB.id,
      serviceId: 'srv_elec_01',
      currentStatus: BookingStatus.CONFIRMED,
      pricingModel: 'FIXED_PRICE',
      baseAmountPaisa: 40000,
      totalAmountPaisa: 47200,
      startOtp: '999999',
      startedAt: null,
    });

    // Payout ledger for Provider A
    mockPrisma._store.providerPayouts.push({
      id: 'pout_a_001',
      providerId: providerProfileA.id,
      bookingId: 'bkg_settled_001',
      grossAmountPaisa: 59000,
      platformDeductionPaisa: 7500,
      tdsDeductionPaisa: 590,
      netPayoutPaisa: 50910,
      payoutMode: 'BANK_TRANSFER',
      status: 'PENDING',
      createdAt: new Date(),
      booking: { bookingNumber: 'BK-OLD-001', service: { name: 'Fan Repair' } },
    });

    // Payout ledger for Provider B (isolation test)
    mockPrisma._store.providerPayouts.push({
      id: 'pout_b_001',
      providerId: providerProfileB.id,
      bookingId: 'bkg_settled_002',
      grossAmountPaisa: 47200,
      platformDeductionPaisa: 6000,
      tdsDeductionPaisa: 472,
      netPayoutPaisa: 40728,
      payoutMode: 'BANK_TRANSFER',
      status: 'SETTLED',
      createdAt: new Date(),
      booking: { bookingNumber: 'BK-OLD-002', service: { name: 'AC Service' } },
    });

    (globalThis as any).__prisma = mockPrisma;
    const { buildApp } = await import('../src/app.js');
    app = await buildApp();

    tokenA = app.jwt.sign({ userId: providerUserA.id, roles: ['PROVIDER'] });
    tokenB = app.jwt.sign({ userId: providerUserB.id, roles: ['PROVIDER'] });
    tokenCustomer = app.jwt.sign({ userId: customerUser.id, roles: ['CUSTOMER'] });
  });

  // ===========================================================================
  // Job Execution: Status Transitions
  // ===========================================================================

  it('1. PATCH /job-status: CONFIRMED → PROVIDER_ON_THE_WAY succeeds and records history', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/bookings/bkg_2c_001/job-status',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: 'PROVIDER_ON_THE_WAY' },
    });

    assert.equal(response.statusCode, 200, `Expected 200, got ${response.statusCode}: ${response.payload}`);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.currentStatus, BookingStatus.PROVIDER_ON_THE_WAY);

    // DB state verified
    const stored = await mockPrisma.booking.findUnique({ where: { id: 'bkg_2c_001' } });
    assert.equal(stored?.currentStatus, BookingStatus.PROVIDER_ON_THE_WAY);

    // History audit trail
    const history = await mockPrisma.bookingStatusHistory.findMany({ where: { bookingId: 'bkg_2c_001' } });
    const entry = history.find((h: any) => h.toState === BookingStatus.PROVIDER_ON_THE_WAY);
    assert(entry, 'Status history record must be created');
    assert.equal(entry.fromState, BookingStatus.CONFIRMED);
    assert.equal(entry.actorId, providerUserA.id);
    assert.equal(entry.actorRole, 'PROVIDER');
  });

  it('2. PATCH /job-status: ARRIVED → JOB_STARTED with correct OTP records startedAt', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/bookings/bkg_2c_002/job-status',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: 'JOB_STARTED', startOtp: bookingStartOtp },
    });

    assert.equal(response.statusCode, 200, `Expected 200, got ${response.payload}`);
    const body = JSON.parse(response.payload);
    assert.equal(body.data.currentStatus, BookingStatus.JOB_STARTED);

    const stored = await mockPrisma.booking.findUnique({ where: { id: 'bkg_2c_002' } });
    assert.equal(stored?.currentStatus, BookingStatus.JOB_STARTED);
    assert(stored?.startedAt, 'startedAt must be recorded server-side');
  });

  it('3. PATCH /job-status: JOB_STARTED → JOB_COMPLETED server-advances to PAYMENT_PENDING', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/bookings/bkg_2c_003/job-status',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: 'JOB_COMPLETED' },
    });

    assert.equal(response.statusCode, 200, `Expected 200, got ${response.payload}`);
    const body = JSON.parse(response.payload);
    // Server advances to PAYMENT_PENDING automatically
    assert.equal(body.data.currentStatus, BookingStatus.PAYMENT_PENDING);

    const stored = await mockPrisma.booking.findUnique({ where: { id: 'bkg_2c_003' } });
    assert.equal(stored?.currentStatus, BookingStatus.PAYMENT_PENDING, 'Server must auto-advance to PAYMENT_PENDING');
    assert(stored?.completedAt, 'completedAt must be recorded server-side');
  });

  // ===========================================================================
  // Security: Authentication & Authorization
  // ===========================================================================

  it('4. should reject unauthenticated job-status update with 401', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/bookings/bkg_2c_001/job-status',
      payload: { status: 'PROVIDER_ON_THE_WAY' },
    });
    assert.equal(response.statusCode, 401);
  });

  it('5. should reject customer role on job-status endpoint with 403', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/bookings/bkg_2c_001/job-status',
      headers: { authorization: `Bearer ${tokenCustomer}` },
      payload: { status: 'PROVIDER_ON_THE_WAY' },
    });
    assert.equal(response.statusCode, 403);
    assert.match(JSON.parse(response.payload).error.message, /Access restricted/i);
  });

  it('6. IDOR: Provider A cannot update Provider B booking via job-status', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/bookings/bkg_2c_004/job-status',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: 'PROVIDER_ON_THE_WAY' },
    });
    assert.equal(response.statusCode, 403);
    assert.match(JSON.parse(response.payload).error.message, /Access denied/i);

    // Verify Provider B booking was not mutated
    const stored = await mockPrisma.booking.findUnique({ where: { id: 'bkg_2c_004' } });
    assert.equal(stored?.currentStatus, BookingStatus.CONFIRMED, 'Provider B booking must remain unmutated');
  });

  // ===========================================================================
  // Security: OTP Enforcement (Server-side)
  // ===========================================================================

  it('7. JOB_STARTED with wrong OTP returns 422 and does NOT mutate DB', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/bookings/bkg_2c_002/job-status',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: 'JOB_STARTED', startOtp: '000000' }, // wrong OTP
    });

    assert.equal(response.statusCode, 422, `Expected 422, got ${response.statusCode}: ${response.payload}`);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, false);

    // DB must not be mutated
    const stored = await mockPrisma.booking.findUnique({ where: { id: 'bkg_2c_002' } });
    assert.equal(stored?.currentStatus, BookingStatus.ARRIVED, 'DB status must remain ARRIVED');
  });

  it('8. JOB_STARTED missing OTP entirely returns error and does NOT mutate DB', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/bookings/bkg_2c_002/job-status',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: 'JOB_STARTED' }, // missing startOtp
    });

    // Should fail at FSM validation (422) or contract validation (422)
    assert(response.statusCode >= 400, `Expected 4xx, got ${response.statusCode}`);

    const stored = await mockPrisma.booking.findUnique({ where: { id: 'bkg_2c_002' } });
    assert.equal(stored?.currentStatus, BookingStatus.ARRIVED, 'DB status must remain ARRIVED');
  });

  // ===========================================================================
  // Security: Client Injection Resistance
  // ===========================================================================

  it('9. Client-injected actorId, providerId, and financial fields are completely ignored', async () => {
    const maliciousPayload = {
      status: 'PROVIDER_ON_THE_WAY',
      // These must all be silently ignored
      actorId: providerUserB.id,
      actorRole: 'ADMIN',
      providerId: providerProfileB.id,
      providerEarningPaisa: 9_999_999,
      totalAmountPaisa: 9_999_999,
      baseAmountPaisa: 9_999_999,
    };

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/bookings/bkg_2c_001/job-status',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: maliciousPayload,
    });

    assert.equal(response.statusCode, 200, `Expected 200, got ${response.payload}`);

    const stored = await mockPrisma.booking.findUnique({ where: { id: 'bkg_2c_001' } });
    // Financial values must remain unchanged from DB seed
    assert.equal(stored?.providerId, providerProfileA.id, 'providerId must not be changed by client');
    assert.equal(stored?.providerEarningPaisa, 42500, 'providerEarningPaisa must not be changed');
    assert.equal(stored?.totalAmountPaisa, 59000, 'totalAmountPaisa must not be changed');
    assert.equal(stored?.baseAmountPaisa, 50000, 'baseAmountPaisa must not be changed');

    // History actorRole must come from server, not client payload
    const history = await mockPrisma.bookingStatusHistory.findMany({ where: { bookingId: 'bkg_2c_001' } });
    const entry = history.find((h: any) => h.toState === BookingStatus.PROVIDER_ON_THE_WAY);
    assert(entry, 'History entry must exist');
    assert.equal(entry.actorId, providerUserA.id, 'actorId must be derived from JWT, not client body');
    assert.equal(entry.actorRole, 'PROVIDER', 'actorRole must be set server-side');
  });

  // ===========================================================================
  // Security: Invalid FSM Transitions
  // ===========================================================================

  it('10. Invalid FSM: provider cannot skip to JOB_COMPLETED from CONFIRMED (returns 400, DB unchanged)', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/bookings/bkg_2c_001/job-status',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: 'JOB_COMPLETED' },
    });

    assert.equal(response.statusCode, 400, `Expected 400, got ${response.statusCode}`);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_STATE_TRANSITION');

    // DB must not be mutated
    const stored = await mockPrisma.booking.findUnique({ where: { id: 'bkg_2c_001' } });
    assert.equal(stored?.currentStatus, BookingStatus.CONFIRMED, 'Booking must remain CONFIRMED');
  });

  it('11. Non-job-execution status (e.g. REJECTED) is rejected with 422 from this endpoint', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/bookings/bkg_2c_001/job-status',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: 'REJECTED' },
    });

    // UpdateJobStatusSchema only accepts job-phase statuses
    assert.equal(response.statusCode, 422, `Expected 422, got ${response.statusCode}`);
  });

  // ===========================================================================
  // Wallet Endpoint Tests
  // ===========================================================================

  it('12. GET /providers/wallet returns backend-authoritative balance and ledger for authenticated provider', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/wallet',
      headers: { authorization: `Bearer ${tokenA}` },
    });

    assert.equal(response.statusCode, 200, `Expected 200, got ${response.payload}`);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, true);
    assert('availableBalancePaisa' in body.data, 'availableBalancePaisa must be in response');
    assert('pendingSettlementPaisa' in body.data, 'pendingSettlementPaisa must be in response');
    assert('totalEarnedPaisa' in body.data, 'totalEarnedPaisa must be in response');
    assert(Array.isArray(body.data.ledger), 'Ledger must be an array');

    // Provider A has one PENDING payout of 50910 paisa
    assert.equal(body.data.availableBalancePaisa, 50910, 'Available balance must match backend-calculated value');
    assert.equal(body.data.ledger.length, 1, 'Provider A should see exactly 1 ledger entry');
  });

  it('13. Provider wallet isolation: Provider A cannot see Provider B payout entries', async () => {
    const responseA = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/wallet',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const responseB = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/wallet',
      headers: { authorization: `Bearer ${tokenB}` },
    });

    const bodyA = JSON.parse(responseA.payload);
    const bodyB = JSON.parse(responseB.payload);

    // Each provider sees only their own data
    assert.equal(bodyA.data.ledger.length, 1);
    assert.equal(bodyB.data.ledger.length, 1);

    // Provider B ledger has SETTLED status
    assert.equal(bodyB.data.availableBalancePaisa, 0, 'Provider B PENDING balance should be 0 (only SETTLED entries exist)');
  });

  it('14. GET /providers/wallet: unauthenticated request returns 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/wallet',
    });
    assert.equal(response.statusCode, 401);
  });

  it('15. GET /providers/wallet: customer role returns 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/wallet',
      headers: { authorization: `Bearer ${tokenCustomer}` },
    });
    assert.equal(response.statusCode, 403);
    assert.match(JSON.parse(response.payload).error.message, /Access restricted/i);
  });
});
