import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { BookingStatus } from '@localman/constants';

describe('Provider Bookings API Contract & Authorization Tests (Phase 2A)', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  // Provider A (Authorized)
  const providerUserA = {
    id: 'usr_prov_a_001',
    phoneNumber: '9876500001',
    fullName: 'Provider Ramesh',
    email: 'ramesh@localman.test',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const providerProfileA = {
    id: 'prv_a_001',
    userId: providerUserA.id,
    businessName: 'Ramesh Services',
    verificationStatus: 'VERIFIED',
    isOnline: true,
  };

  // Provider B (Different Provider for IDOR testing)
  const providerUserB = {
    id: 'usr_prov_b_002',
    phoneNumber: '9876500002',
    fullName: 'Provider Suresh',
    email: 'suresh@localman.test',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const providerProfileB = {
    id: 'prv_b_002',
    userId: providerUserB.id,
    businessName: 'Suresh Services',
    verificationStatus: 'VERIFIED',
    isOnline: true,
  };

  // Customer User (Unauthorized for provider endpoints)
  const customerUser = {
    id: 'usr_cust_001',
    phoneNumber: '9876543210',
    fullName: 'Customer Anita',
    email: 'anita@localman.test',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  let tokenProviderA: string;
  let tokenProviderB: string;
  let tokenCustomer: string;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();

    // Populate Users & Providers
    mockPrisma._store.users.set(providerUserA.id, { ...providerUserA });
    mockPrisma._store.providers.set(providerProfileA.id, { ...providerProfileA });

    mockPrisma._store.users.set(providerUserB.id, { ...providerUserB });
    mockPrisma._store.providers.set(providerProfileB.id, { ...providerProfileB });

    mockPrisma._store.users.set(customerUser.id, { ...customerUser });

    // Seed Bookings
    // Booking 1: Assigned to Provider A, REQUESTED
    mockPrisma._store.bookings.set('bkg_001', {
      id: 'bkg_001',
      bookingNumber: 'BK-20261018-001',
      customerId: customerUser.id,
      providerId: providerProfileA.id,
      serviceId: 'srv_plumbing_01',
      addressId: 'addr_01',
      currentStatus: BookingStatus.REQUESTED,
      pricingModel: 'FIXED_PRICE',
      baseAmountPaisa: 19900,
      taxAmountPaisa: 3582,
      platformFeePaisa: 2985,
      totalAmountPaisa: 23482,
      providerEarningPaisa: 16915,
      startOtp: '482910',
      createdAt: new Date('2026-10-18T10:00:00Z'),
      service: { id: 'srv_plumbing_01', name: 'Tap Repair' },
      address: { addressLine1: 'Indiranagar 12th Main', city: 'Bengaluru', postalCode: '560038' },
      customer: { id: customerUser.id, fullName: 'Customer Anita', phoneNumber: '9876543210' },
    });

    // Booking 2: Assigned to Provider B, REQUESTED
    mockPrisma._store.bookings.set('bkg_002', {
      id: 'bkg_002',
      bookingNumber: 'BK-20261018-002',
      customerId: customerUser.id,
      providerId: providerProfileB.id,
      serviceId: 'srv_electrical_01',
      addressId: 'addr_02',
      currentStatus: BookingStatus.REQUESTED,
      pricingModel: 'FIXED_PRICE',
      baseAmountPaisa: 29900,
      totalAmountPaisa: 35282,
      providerEarningPaisa: 25415,
      startOtp: '123456',
      createdAt: new Date('2026-10-18T11:00:00Z'),
      service: { id: 'srv_electrical_01', name: 'Fan Repair' },
      customer: { id: customerUser.id, fullName: 'Customer Anita', phoneNumber: '9876543210' },
    });

    // Booking 3: Assigned to Provider A, CONFIRMED (cannot be accepted again)
    mockPrisma._store.bookings.set('bkg_003', {
      id: 'bkg_003',
      bookingNumber: 'BK-20261018-003',
      customerId: customerUser.id,
      providerId: providerProfileA.id,
      serviceId: 'srv_plumbing_01',
      currentStatus: BookingStatus.CONFIRMED,
      pricingModel: 'FIXED_PRICE',
      baseAmountPaisa: 19900,
      totalAmountPaisa: 23482,
      providerEarningPaisa: 16915,
      createdAt: new Date('2026-10-18T09:00:00Z'),
    });

    // Booking 4: Assigned to Provider A, REQUESTED (for reject testing)
    mockPrisma._store.bookings.set('bkg_004', {
      id: 'bkg_004',
      bookingNumber: 'BK-20261018-004',
      customerId: customerUser.id,
      providerId: providerProfileA.id,
      serviceId: 'srv_plumbing_01',
      currentStatus: BookingStatus.REQUESTED,
      pricingModel: 'FIXED_PRICE',
      baseAmountPaisa: 19900,
      totalAmountPaisa: 23482,
      providerEarningPaisa: 16915,
      createdAt: new Date('2026-10-18T08:00:00Z'),
    });

    // Status History initial seed
    mockPrisma._store.bookingStatusHistory.push({
      id: 'bsh_001_init',
      bookingId: 'bkg_001',
      fromState: null,
      toState: BookingStatus.REQUESTED,
      actorId: customerUser.id,
      actorRole: 'CUSTOMER',
      createdAt: new Date('2026-10-18T10:00:00Z'),
    });

    (globalThis as any).__prisma = mockPrisma;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();

    tokenProviderA = app.jwt.sign({ userId: providerUserA.id, roles: ['PROVIDER'] });
    tokenProviderB = app.jwt.sign({ userId: providerUserB.id, roles: ['PROVIDER'] });
    tokenCustomer = app.jwt.sign({ userId: customerUser.id, roles: ['CUSTOMER'] });
  });

  it('1. GET /api/v1/providers/bookings should return only bookings belonging to authenticated provider', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/bookings',
      headers: { authorization: `Bearer ${tokenProviderA}` },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, true);
    assert(Array.isArray(body.data), 'Bookings must be returned as an array');
    
    // Provider A should receive bkg_001, bkg_003, and bkg_004
    const bookingIds = body.data.map((b: any) => b.id);
    assert(bookingIds.includes('bkg_001'));
    assert(bookingIds.includes('bkg_003'));
    assert(bookingIds.includes('bkg_004'));
    assert(!bookingIds.includes('bkg_002'), 'Must NOT return Provider B booking to Provider A');
  });

  it('2. GET /api/v1/providers/bookings/:id should return details of assigned booking', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/bookings/bkg_001',
      headers: { authorization: `Bearer ${tokenProviderA}` },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.id, 'bkg_001');
    assert.equal(body.data.currentStatus, BookingStatus.REQUESTED);
    assert.equal(body.data.baseAmountPaisa, 19900);
  });

  it('3. should reject unauthorized requests (no token or non-provider role)', async () => {
    // No token
    const noTokenResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/bookings',
    });
    assert.equal(noTokenResponse.statusCode, 401);

    // Customer role attempting to access provider booking endpoint
    const customerRoleResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/bookings',
      headers: { authorization: `Bearer ${tokenCustomer}` },
    });
    assert.equal(customerRoleResponse.statusCode, 403);
    const body = JSON.parse(customerRoleResponse.payload);
    assert.match(body.error.message, /Access restricted/i);
  });

  it('4. should prevent IDOR: Provider accessing another provider booking returns 403 Forbidden', async () => {
    // Provider A attempts to view Provider B's booking (bkg_002)
    const viewResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/bookings/bkg_002',
      headers: { authorization: `Bearer ${tokenProviderA}` },
    });
    assert.equal(viewResponse.statusCode, 403);
    assert.match(JSON.parse(viewResponse.payload).error.message, /Access denied/i);

    // Provider A attempts to accept Provider B's booking (bkg_002)
    const acceptResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/bookings/bkg_002/accept',
      headers: { authorization: `Bearer ${tokenProviderA}` },
    });
    assert.equal(acceptResponse.statusCode, 403);
    assert.match(JSON.parse(acceptResponse.payload).error.message, /Access denied/i);

    // Provider A attempts to reject Provider B's booking (bkg_002)
    const rejectResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/bookings/bkg_002/reject',
      headers: { authorization: `Bearer ${tokenProviderA}` },
      payload: { reason: 'Malicious attempt' },
    });
    assert.equal(rejectResponse.statusCode, 403);
    assert.match(JSON.parse(rejectResponse.payload).error.message, /Access denied/i);
  });

  it('5. POST /api/v1/providers/bookings/:id/accept should transition REQUESTED -> PROVIDER_ACCEPTED and record history', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/bookings/bkg_001/accept',
      headers: { authorization: `Bearer ${tokenProviderA}` },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.currentStatus, BookingStatus.PROVIDER_ACCEPTED);

    // Verify DB state
    const storedBooking = await mockPrisma.booking.findUnique({ where: { id: 'bkg_001' } });
    assert.equal(storedBooking?.currentStatus, BookingStatus.PROVIDER_ACCEPTED);

    // Verify BookingStatusHistory
    const history = await mockPrisma.bookingStatusHistory.findMany({ where: { bookingId: 'bkg_001' } });
    const acceptHistory = history.find((h: any) => h.toState === BookingStatus.PROVIDER_ACCEPTED);
    assert(acceptHistory, 'BookingStatusHistory record must be created for accept transition');
    assert.equal(acceptHistory.fromState, BookingStatus.REQUESTED);
    assert.equal(acceptHistory.actorId, providerUserA.id);
    assert.equal(acceptHistory.actorRole, 'PROVIDER');
  });

  it('6. POST /api/v1/providers/bookings/:id/reject should transition REQUESTED -> REJECTED and record reason in history', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/bookings/bkg_004/reject',
      headers: { authorization: `Bearer ${tokenProviderA}` },
      payload: { reason: 'Currently busy with existing job in Domlur' },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.currentStatus, BookingStatus.REJECTED);

    // Verify DB state
    const storedBooking = await mockPrisma.booking.findUnique({ where: { id: 'bkg_004' } });
    assert.equal(storedBooking?.currentStatus, BookingStatus.REJECTED);

    // Verify history record with reason
    const history = await mockPrisma.bookingStatusHistory.findMany({ where: { bookingId: 'bkg_004' } });
    const rejectHistory = history.find((h: any) => h.toState === BookingStatus.REJECTED);
    assert(rejectHistory, 'BookingStatusHistory record must exist for reject transition');
    assert.equal(rejectHistory.fromState, BookingStatus.REQUESTED);
    assert.equal(rejectHistory.reason, 'Currently busy with existing job in Domlur');
  });

  it('7. should enforce FSM guards: invalid transition returns 400 and does NOT mutate database', async () => {
    // bkg_003 is already CONFIRMED. Accepting it is an illegal transition.
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/bookings/bkg_003/accept',
      headers: { authorization: `Bearer ${tokenProviderA}` },
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_STATE_TRANSITION');
    assert.match(body.error.message, /Cannot change booking status/);

    // Verify DB was NOT mutated
    const storedBooking = await mockPrisma.booking.findUnique({ where: { id: 'bkg_003' } });
    assert.equal(
      storedBooking?.currentStatus,
      BookingStatus.CONFIRMED,
      'Database status must remain CONFIRMED and unmutated'
    );
  });

  it('8. should completely ignore any client-controlled financial values or providerId in request body', async () => {
    // Client maliciously attempts to inject providerId and override payout amount
    const maliciousPayload = {
      providerId: providerProfileB.id,
      userId: providerUserB.id,
      totalAmountPaisa: 10000000,
      providerEarningPaisa: 9999999,
      baseAmountPaisa: 500000,
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/bookings/bkg_001/accept',
      headers: { authorization: `Bearer ${tokenProviderA}` },
      payload: maliciousPayload,
    });

    assert.equal(response.statusCode, 200);

    const storedBooking = await mockPrisma.booking.findUnique({ where: { id: 'bkg_001' } });
    // Verify server-side values were maintained intact
    assert.equal(storedBooking?.providerId, providerProfileA.id, 'providerId must NOT be changed by client');
    assert.equal(storedBooking?.totalAmountPaisa, 23482, 'totalAmountPaisa must NOT be changed by client');
    assert.equal(storedBooking?.providerEarningPaisa, 16915, 'providerEarningPaisa must NOT be changed by client');
    assert.equal(storedBooking?.baseAmountPaisa, 19900, 'baseAmountPaisa must NOT be changed by client');
  });
});
