import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { prisma } from '../src/config/database.js';
import { realtimeService, RealtimeEvent } from '../src/modules/realtime/realtime.service.js';
import { bookingOtpService } from '../src/modules/bookings/booking-otp.service.js';
import { locationService } from '../src/modules/location/location.service.js';
import { BookingStatus } from '@localman/constants';

describe('Phase 3E — Provider Job Execution Lifecycle, Start Verification & Completion Tests', () => {
  let app: FastifyInstance;
  let mockPrisma: any;

  // Actors
  const customerUser = {
    id: 'usr_cust_3e_1',
    phoneNumber: '+919876543201',
    fullName: 'Ananya Sharma',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const foreignCustomerUser = {
    id: 'usr_cust_3e_foreign',
    phoneNumber: '+919876543299',
    fullName: 'Foreign Customer',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const providerUser1 = {
    id: 'usr_pro_3e_1',
    phoneNumber: '+919876543211',
    fullName: 'Rajesh Pro',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider1 = {
    id: 'prv_3e_1',
    userId: providerUser1.id,
    businessName: 'Rajesh SuperFix Services',
    verificationStatus: 'VERIFIED',
    status: 'ACTIVE',
    isOnline: true,
    ratingAverage: 4.9,
    ratingCount: 50,
    experienceYears: 8,
  };

  const providerUser2 = {
    id: 'usr_pro_3e_2',
    phoneNumber: '+919876543212',
    fullName: 'Vikram Pro',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider2 = {
    id: 'prv_3e_2',
    userId: providerUser2.id,
    businessName: 'Vikram QuickRepairs',
    verificationStatus: 'VERIFIED',
    status: 'ACTIVE',
    isOnline: true,
    ratingAverage: 4.8,
    ratingCount: 30,
    experienceYears: 5,
  };

  const unverifiedProviderUser = {
    id: 'usr_pro_unverified',
    phoneNumber: '+919876543213',
    fullName: 'Unverified Pro',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const unverifiedProvider = {
    id: 'prv_unverified',
    userId: unverifiedProviderUser.id,
    businessName: 'Pending Verification Pro',
    verificationStatus: 'SUBMITTED', // NOT VERIFIED!
    status: 'ACTIVE',
    isOnline: true,
  };

  const suspendedProviderUser = {
    id: 'usr_pro_suspended',
    phoneNumber: '+919876543214',
    fullName: 'Suspended Pro',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const suspendedProvider = {
    id: 'prv_suspended',
    userId: suspendedProviderUser.id,
    businessName: 'Suspended Pro Solutions',
    verificationStatus: 'VERIFIED',
    status: 'SUSPENDED', // SUSPENDED!
    isOnline: true,
  };

  const service = {
    id: 'srv_plumbing_sink',
    name: 'Kitchen Sink Unclogging',
    slug: 'kitchen-sink-unclogging',
    basePricePaisa: 49900,
  };

  const customerAddress = {
    id: 'addr_3e_1',
    userId: customerUser.id,
    addressLine1: 'Flat 302, Palm Grove',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    latitude: 12.9716,
    longitude: 77.5946,
  };

  const TEST_START_OTP = '849201';

  let customerToken: string;
  let foreignCustomerToken: string;
  let providerToken1: string;
  let providerToken2: string;
  let unverifiedProviderToken: string;
  let suspendedProviderToken: string;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;
    Object.assign(prisma, mockPrisma);
    bookingOtpService.resetAll();
    locationService.clearThrottleCache();

    // Seed mock database
    mockPrisma._store.users.set(customerUser.id, { ...customerUser });
    mockPrisma._store.users.set(foreignCustomerUser.id, { ...foreignCustomerUser });
    mockPrisma._store.users.set(providerUser1.id, { ...providerUser1 });
    mockPrisma._store.users.set(providerUser2.id, { ...providerUser2 });
    mockPrisma._store.users.set(unverifiedProviderUser.id, { ...unverifiedProviderUser });
    mockPrisma._store.users.set(suspendedProviderUser.id, { ...suspendedProviderUser });

    mockPrisma._store.providers.set(provider1.id, { ...provider1, user: providerUser1 });
    mockPrisma._store.providers.set(provider2.id, { ...provider2, user: providerUser2 });
    mockPrisma._store.providers.set(unverifiedProvider.id, { ...unverifiedProvider, user: unverifiedProviderUser });
    mockPrisma._store.providers.set(suspendedProvider.id, { ...suspendedProvider, user: suspendedProviderUser });

    mockPrisma._store.addresses.set(customerAddress.id, { ...customerAddress });
    mockPrisma._store.services.set(service.id, { ...service });

    app = await buildApp();

    customerToken = app.jwt.sign({ userId: customerUser.id, roles: ['CUSTOMER'] });
    foreignCustomerToken = app.jwt.sign({ userId: foreignCustomerUser.id, roles: ['CUSTOMER'] });
    providerToken1 = app.jwt.sign({ userId: providerUser1.id, roles: ['PROVIDER'] });
    providerToken2 = app.jwt.sign({ userId: providerUser2.id, roles: ['PROVIDER'] });
    unverifiedProviderToken = app.jwt.sign({ userId: unverifiedProviderUser.id, roles: ['PROVIDER'] });
    suspendedProviderToken = app.jwt.sign({ userId: suspendedProviderUser.id, roles: ['PROVIDER'] });
  });

  function seedBooking(overrides: Partial<any> = {}) {
    const booking = {
      id: overrides.id || `bkg_3e_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      bookingNumber: overrides.bookingNumber || `BK-${Date.now().toString().slice(-6)}`,
      customerId: customerUser.id,
      providerId: provider1.id,
      serviceId: service.id,
      addressId: customerAddress.id,
      currentStatus: overrides.currentStatus || BookingStatus.PROVIDER_ACCEPTED,
      pricingModel: 'FIXED_PRICE',
      scheduledDate: new Date('2026-10-25'),
      scheduledTimeSlot: '10:00 - 12:00',
      startOtp: overrides.startOtp || TEST_START_OTP,
      baseAmountPaisa: 49900,
      taxAmountPaisa: 8982,
      extraDurationAmountPaisa: 0,
      materialsTotalPaisa: 0,
      totalAmountPaisa: 58882,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    mockPrisma._store.bookings.set(booking.id, booking);
    return booking;
  }

  // ===========================================================================
  // 1. PROVIDER "ON THE WAY" LIFECYCLE
  // ===========================================================================

  test('1. POST /on-the-way: transitions PROVIDER_ACCEPTED to PROVIDER_ON_THE_WAY and records history', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ACCEPTED });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/on-the-way`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { reason: 'Traffic is clear, leaving workshop now' },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.currentStatus, BookingStatus.PROVIDER_ON_THE_WAY);

    const stored = await mockPrisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stored?.currentStatus, BookingStatus.PROVIDER_ON_THE_WAY);

    const history = await mockPrisma.bookingStatusHistory.findMany({ where: { bookingId: booking.id } });
    const entry = history.find((h: any) => h.toState === BookingStatus.PROVIDER_ON_THE_WAY);
    assert.ok(entry);
    assert.equal(entry.fromState, BookingStatus.PROVIDER_ACCEPTED);
    assert.equal(entry.actorRole, 'PROVIDER');
  });

  test('2. POST /on-the-way: repeated call is idempotent (returns 200 with current state)', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ON_THE_WAY });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/on-the-way`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.data.currentStatus, BookingStatus.PROVIDER_ON_THE_WAY);
  });

  test('3. POST /on-the-way: emits JOB_STATUS_CHANGED realtime event', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ACCEPTED });
    const events: RealtimeEvent[] = [];
    const unsubscribe = realtimeService.subscribe(`booking:${booking.id}`, (e) => events.push(e));

    await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/on-the-way`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    unsubscribe();
    const event = events.find((e) => e.type === 'JOB_STATUS_CHANGED');
    assert.ok(event, 'Realtime event must be emitted');
    assert.equal(event.payload.status, BookingStatus.PROVIDER_ON_THE_WAY);
  });

  // ===========================================================================
  // 2. PROVIDER ARRIVAL LIFECYCLE
  // ===========================================================================

  test('4. POST /arrived: transitions PROVIDER_ON_THE_WAY to ARRIVED and records history', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ON_THE_WAY });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/arrived`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { reason: 'Reached customer doorstep' },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.data.currentStatus, BookingStatus.ARRIVED);

    const stored = await mockPrisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stored?.currentStatus, BookingStatus.ARRIVED);

    const history = await mockPrisma.bookingStatusHistory.findMany({ where: { bookingId: booking.id } });
    const entry = history.find((h: any) => h.toState === BookingStatus.ARRIVED);
    assert.ok(entry);
    assert.equal(entry.fromState, BookingStatus.PROVIDER_ON_THE_WAY);
    assert.equal(entry.actorRole, 'PROVIDER');
  });

  test('5. POST /arrived: repeated call is idempotent (returns 200 with current state)', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.ARRIVED });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/arrived`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.data.currentStatus, BookingStatus.ARRIVED);
  });

  test('6. POST /arrived: emits JOB_STATUS_CHANGED realtime event', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ON_THE_WAY });
    const events: RealtimeEvent[] = [];
    const unsubscribe = realtimeService.subscribe(`booking:${booking.id}`, (e) => events.push(e));

    await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/arrived`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    unsubscribe();
    const event = events.find((e) => e.type === 'JOB_STATUS_CHANGED');
    assert.ok(event, 'Arrival event must be emitted');
    assert.equal(event.payload.status, BookingStatus.ARRIVED);
  });

  // ===========================================================================
  // 3. START-JOB VERIFICATION & START LIFECYCLE
  // ===========================================================================

  test('7. POST /start: transitions ARRIVED to JOB_STARTED with correct OTP and records startedAt', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.ARRIVED, startOtp: '654321' });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/start`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { startOtp: '654321' },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.data.currentStatus, BookingStatus.JOB_STARTED);

    const stored = await mockPrisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stored?.currentStatus, BookingStatus.JOB_STARTED);
    assert.ok(stored?.startedAt, 'startedAt timestamp must be recorded');

    const history = await mockPrisma.bookingStatusHistory.findMany({ where: { bookingId: booking.id } });
    const entry = history.find((h: any) => h.toState === BookingStatus.JOB_STARTED);
    assert.ok(entry);
    assert.equal(entry.fromState, BookingStatus.ARRIVED);
    assert.equal(entry.actorRole, 'PROVIDER');
  });

  test('8. POST /start: emits JOB_STATUS_CHANGED realtime event without leaking OTP', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.ARRIVED, startOtp: '112233' });
    const events: RealtimeEvent[] = [];
    const unsubscribe = realtimeService.subscribe(`booking:${booking.id}`, (e) => events.push(e));

    await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/start`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { startOtp: '112233' },
    });

    unsubscribe();
    const event = events.find((e) => e.type === 'JOB_STATUS_CHANGED');
    assert.ok(event);
    assert.equal(event.payload.status, BookingStatus.JOB_STARTED);
    // CRITICAL: OTP must not appear in event payload
    assert.equal(event.payload.startOtp, undefined);
  });

  // ===========================================================================
  // 4. MATERIALS & EXTENSION INTEGRATION
  // ===========================================================================

  test('9. POST /materials: adding spare material during JOB_STARTED transitions to JOB_EXTENDED', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_STARTED, startedAt: new Date() });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/materials`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: {
        itemName: 'Heavy Duty PVC Trap Pipe',
        quantity: 1,
        unitPricePaisa: 35000,
      },
    });

    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.payload);
    assert.equal(body.data.itemName, 'Heavy Duty PVC Trap Pipe');
    assert.equal(body.data.totalPricePaisa, 35000);
    assert.equal(body.data.isCustomerApproved, false);

    const stored = await mockPrisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stored?.currentStatus, BookingStatus.JOB_EXTENDED);
  });

  test('10. Customer approves material: updates totalAmountPaisa server-side', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_EXTENDED, baseAmountPaisa: 49900, totalAmountPaisa: 58882 });
    const mat = {
      id: 'mat_pipe_01',
      bookingId: booking.id,
      itemName: 'PVC Pipe',
      quantity: 1,
      unitPricePaisa: 20000,
      totalPricePaisa: 20000,
      isCustomerApproved: false,
    };
    mockPrisma._store.bookingMaterials.set(mat.id, mat);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/bookings/${booking.id}/materials/approve`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { materialId: mat.id, approved: true },
    });

    assert.equal(response.statusCode, 200);
    const stored = await mockPrisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stored?.totalAmountPaisa, 58882 + 20000);
  });

  // ===========================================================================
  // 5. JOB COMPLETION
  // ===========================================================================

  test('11. POST /complete: transitions JOB_STARTED to JOB_COMPLETED, records completedAt and duration', async () => {
    const pastTime = new Date(Date.now() - 45 * 60 * 1000); // 45 mins ago
    const booking = seedBooking({
      currentStatus: BookingStatus.JOB_STARTED,
      startedAt: pastTime,
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/complete`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { reason: 'Sink unclogged, water drainage tested and verified.' },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.data.currentStatus, BookingStatus.JOB_COMPLETED);

    const stored = await mockPrisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stored?.currentStatus, BookingStatus.JOB_COMPLETED);
    assert.ok(stored?.completedAt);
    assert.ok((stored?.durationMinutes || 0) >= 44);

    const history = await mockPrisma.bookingStatusHistory.findMany({ where: { bookingId: booking.id } });
    const entry = history.find((h: any) => h.toState === BookingStatus.JOB_COMPLETED);
    assert.ok(entry);
    assert.equal(entry.fromState, BookingStatus.JOB_STARTED);
    assert.equal(entry.actorRole, 'PROVIDER');
  });

  test('12. POST /complete: can complete from JOB_EXTENDED state', async () => {
    const booking = seedBooking({
      currentStatus: BookingStatus.JOB_EXTENDED,
      startedAt: new Date(Date.now() - 30 * 60 * 1000),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/complete`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    assert.equal(response.statusCode, 200);
    const stored = await mockPrisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stored?.currentStatus, BookingStatus.JOB_COMPLETED);
  });

  test('13. POST /complete: is idempotent when repeated', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_COMPLETED, completedAt: new Date() });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/complete`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.data.currentStatus, BookingStatus.JOB_COMPLETED);
  });

  // ===========================================================================
  // 6. SECURITY & IDOR AUDIT
  // ===========================================================================

  test('14. Security: Customer cannot mark provider on-the-way (403 Forbidden)', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ACCEPTED });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/on-the-way`,
      headers: { authorization: `Bearer ${customerToken}` },
    });

    assert.equal(response.statusCode, 403);
  });

  test('15. Security: Customer cannot mark provider arrived (403 Forbidden)', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ON_THE_WAY });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/arrived`,
      headers: { authorization: `Bearer ${customerToken}` },
    });

    assert.equal(response.statusCode, 403);
  });

  test('16. Security: Customer cannot start provider job (403 Forbidden)', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.ARRIVED });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/start`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { startOtp: TEST_START_OTP },
    });

    assert.equal(response.statusCode, 403);
  });

  test('17. Security: Customer cannot complete provider job (403 Forbidden)', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_STARTED, startedAt: new Date() });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/complete`,
      headers: { authorization: `Bearer ${customerToken}` },
    });

    assert.equal(response.statusCode, 403);
  });

  test('18. Security: Provider A cannot mutate Provider B booking (403 Forbidden)', async () => {
    // Booking assigned to provider 2
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ACCEPTED, providerId: provider2.id });

    // Provider 1 tries to mutate
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/on-the-way`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    assert.equal(response.statusCode, 403);
  });

  test('19. Security: Unassigned provider cannot mutate booking (403 Forbidden)', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.REQUESTED, providerId: null });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/on-the-way`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    assert.equal(response.statusCode, 403);
  });

  test('20. Security: Unverified provider cannot perform operational transitions (403 Forbidden)', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ACCEPTED, providerId: unverifiedProvider.id });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/on-the-way`,
      headers: { authorization: `Bearer ${unverifiedProviderToken}` },
    });

    assert.equal(response.statusCode, 403);
  });

  test('21. Security: Suspended provider cannot perform operational transitions (403 Forbidden)', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ACCEPTED, providerId: suspendedProvider.id });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/on-the-way`,
      headers: { authorization: `Bearer ${suspendedProviderToken}` },
    });

    assert.equal(response.statusCode, 403);
  });

  test('22. Security: Start verification fails with wrong OTP (422 Unprocessable)', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.ARRIVED, startOtp: '999888' });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/start`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { startOtp: '000000' }, // wrong
    });

    assert.equal(response.statusCode, 422);
    const body = JSON.parse(response.payload);
    assert.match(body.error.message, /Invalid Customer Start OTP/i);

    // Booking must remain ARRIVED
    const stored = await mockPrisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stored?.currentStatus, BookingStatus.ARRIVED);
  });

  test('23. Security: Excessive failed OTP attempts (5) locks verification (429 Too Many Requests)', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.ARRIVED, startOtp: '123456' });

    for (let i = 0; i < 4; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/start`,
        headers: { authorization: `Bearer ${providerToken1}` },
        payload: { startOtp: '000000' },
      });
      assert.equal(res.statusCode, 422);
    }

    // 5th attempt must trigger 429 Too Many Requests
    const fifth = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/start`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { startOtp: '000000' },
    });

    assert.equal(fifth.statusCode, 429);
    assert.match(JSON.parse(fifth.payload).error.message, /Maximum Start OTP verification attempts exceeded/i);

    // Even with the correct OTP now, verification remains locked
    const locked = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/start`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { startOtp: '123456' },
    });

    assert.equal(locked.statusCode, 429);
  });

  test('24. Security: Expired OTP cannot be verified (422 Unprocessable)', async () => {
    const pastDate = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30h ago (> 24h lifetime)
    const booking = seedBooking({
      currentStatus: BookingStatus.ARRIVED,
      startOtp: '778899',
      createdAt: pastDate,
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/start`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { startOtp: '778899' },
    });

    assert.equal(response.statusCode, 422);
    assert.match(JSON.parse(response.payload).error.message, /expired/i);
  });

  test('25. Security: OTP replay fails once booking has already started', async () => {
    const booking = seedBooking({
      currentStatus: BookingStatus.JOB_STARTED,
      startOtp: '112233',
      startedAt: new Date(),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/start`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { startOtp: '112233' },
    });

    assert.equal(response.statusCode, 400); // InvalidStateTransitionError
  });

  test('26. Security: Completed booking cannot be restarted', async () => {
    const booking = seedBooking({
      currentStatus: BookingStatus.JOB_COMPLETED,
      startOtp: '112233',
      completedAt: new Date(),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/start`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { startOtp: '112233' },
    });

    assert.equal(response.statusCode, 400);
  });

  test('27. Security: Invalid FSM transitions fail (e.g. PROVIDER_ACCEPTED -> JOB_STARTED, ARRIVED -> JOB_COMPLETED)', async () => {
    // Cannot jump from PROVIDER_ACCEPTED to JOB_STARTED directly
    const b1 = seedBooking({ currentStatus: BookingStatus.PROVIDER_ACCEPTED });
    const r1 = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${b1.id}/start`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { startOtp: TEST_START_OTP },
    });
    assert.equal(r1.statusCode, 400);

    // Cannot jump from ARRIVED to JOB_COMPLETED directly
    const b2 = seedBooking({ currentStatus: BookingStatus.ARRIVED });
    const r2 = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${b2.id}/complete`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });
    assert.equal(r2.statusCode, 400);
  });

  test('28. Security: Client cannot inject actorRole, providerId, or financial fields', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ACCEPTED, baseAmountPaisa: 49900, totalAmountPaisa: 58882 });

    const maliciousPayload = {
      actorRole: 'ADMIN',
      providerId: provider2.id,
      baseAmountPaisa: 9999999,
      totalAmountPaisa: 9999999,
    };

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/bookings/${booking.id}/on-the-way`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: maliciousPayload,
    });

    assert.equal(response.statusCode, 200);
    const stored = await mockPrisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stored?.providerId, provider1.id);
    assert.equal(stored?.baseAmountPaisa, 49900);
    assert.equal(stored?.totalAmountPaisa, 58882);

    const history = await mockPrisma.bookingStatusHistory.findMany({ where: { bookingId: booking.id } });
    const entry = history.find((h: any) => h.toState === BookingStatus.PROVIDER_ON_THE_WAY);
    assert.equal(entry.actorRole, 'PROVIDER');
  });

  test('29. Privacy: Start OTP never leaks in provider booking listings or details', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.ARRIVED, startOtp: '741852' });

    // GET /providers/bookings/:id
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/providers/bookings/${booking.id}`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });
    assert.equal(detailRes.statusCode, 200);
    const detailBody = JSON.parse(detailRes.payload);
    assert.equal(detailBody.data.startOtp, undefined, 'startOtp must never be returned to provider');

    // GET /providers/bookings
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/providers/bookings`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });
    assert.equal(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.payload);
    const item = listBody.data.find((b: any) => b.id === booking.id);
    assert.ok(item);
    assert.equal(item.startOtp, undefined, 'startOtp must never be returned in provider bookings list');
  });

  // ===========================================================================
  // 7. LOCATION PRIVACY & BOUNDARY TESTS
  // ===========================================================================

  test('30. Location Privacy: Provider GPS broadcasts to customer channel during ON_THE_WAY and ARRIVED, stops at JOB_STARTED', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ON_THE_WAY });

    const customerEvents: RealtimeEvent[] = [];
    const unsubscribe = realtimeService.subscribe(`booking:${booking.id}`, (e) => customerEvents.push(e));

    // 1. Send location while in PROVIDER_ON_THE_WAY -> broadcast received
    await locationService.updateProviderLocation(providerUser1.id, {
      latitude: 12.9720,
      longitude: 77.5950,
      accuracy: 10,
      bookingId: booking.id,
    });

    const onTheWayEvent = customerEvents.find((e) => e.type === 'PROVIDER_LOCATION_UPDATED');
    assert.ok(onTheWayEvent, 'Customer must receive location updates during ON_THE_WAY');

    // 2. Transition booking to JOB_STARTED
    booking.currentStatus = BookingStatus.JOB_STARTED;
    mockPrisma._store.bookings.set(booking.id, booking);
    customerEvents.length = 0; // Clear events

    locationService.clearThrottleCache();
    const p1 = mockPrisma._store.providers.get(provider1.id);
    if (p1) p1.lastLocationAt = new Date(Date.now() - 10000);

    // 3. Send location while in JOB_STARTED -> broadcast must NOT be sent to booking channel
    await locationService.updateProviderLocation(providerUser1.id, {
      latitude: 12.9725,
      longitude: 77.5955,
      accuracy: 10,
      bookingId: booking.id,
    });

    unsubscribe();
    const jobStartedEvent = customerEvents.find((e) => e.type === 'PROVIDER_LOCATION_UPDATED');
    assert.equal(jobStartedEvent, undefined, 'Customer must NOT receive provider location during JOB_STARTED');
  });

  // ===========================================================================
  // 8. CONCURRENCY TESTS
  // ===========================================================================

  test('31. Concurrency: Concurrent on-the-way requests succeed deterministically without duplicate corrupt states', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ACCEPTED });

    const [r1, r2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/on-the-way`,
        headers: { authorization: `Bearer ${providerToken1}` },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/on-the-way`,
        headers: { authorization: `Bearer ${providerToken1}` },
      }),
    ]);

    assert.equal(r1.statusCode, 200);
    assert.equal(r2.statusCode, 200);
    const stored = await mockPrisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stored?.currentStatus, BookingStatus.PROVIDER_ON_THE_WAY);
  });

  test('32. Concurrency: Concurrent arrival requests succeed deterministically', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.PROVIDER_ON_THE_WAY });

    const [r1, r2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/arrived`,
        headers: { authorization: `Bearer ${providerToken1}` },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/arrived`,
        headers: { authorization: `Bearer ${providerToken1}` },
      }),
    ]);

    assert.equal(r1.statusCode, 200);
    assert.equal(r2.statusCode, 200);
    const stored = await mockPrisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stored?.currentStatus, BookingStatus.ARRIVED);
  });

  test('33. Concurrency: Concurrent completion requests succeed deterministically', async () => {
    const booking = seedBooking({ currentStatus: BookingStatus.JOB_STARTED, startedAt: new Date(Date.now() - 20 * 60000) });

    const [r1, r2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/complete`,
        headers: { authorization: `Bearer ${providerToken1}` },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/complete`,
        headers: { authorization: `Bearer ${providerToken1}` },
      }),
    ]);

    assert.equal(r1.statusCode, 200);
    assert.equal(r2.statusCode, 200);
    const stored = await mockPrisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stored?.currentStatus, BookingStatus.JOB_COMPLETED);
  });
});
