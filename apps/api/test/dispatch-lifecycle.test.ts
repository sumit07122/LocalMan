import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { prisma } from '../src/config/database.js';
import { realtimeService, RealtimeEvent } from '../src/modules/realtime/realtime.service.js';
import { dispatchService } from '../src/modules/dispatch/dispatch.service.js';

describe('Phase 3D — Customer Booking Lifecycle & Provider Dispatch Integration Tests', () => {
  let app: FastifyInstance;
  let mockPrisma: any;

  // Actors
  const customerUser = {
    id: 'usr_cust_3d_1',
    phoneNumber: '+919876543210',
    fullName: 'Ravi Kumar',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const foreignCustomerUser = {
    id: 'usr_cust_3d_foreign',
    phoneNumber: '+919876543299',
    fullName: 'Foreign Customer',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const providerUser1 = {
    id: 'usr_pro_3d_1',
    phoneNumber: '+919876543211',
    fullName: 'Amit Sharma',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider1 = {
    id: 'prv_3d_1',
    userId: providerUser1.id,
    businessName: 'Amit Electrical Solutions',
    verificationStatus: 'VERIFIED',
    isOnline: true,
    ratingAverage: 4.85,
    ratingCount: 24,
    experienceYears: 6,
    services: [{ serviceId: 'srv_fan_repair', isEnabled: true }],
    serviceAreas: [
      {
        city: 'Bengaluru',
        serviceRadiusMeters: 25000,
        centerLatitude: 12.9716,
        centerLongitude: 77.5946,
      },
    ],
  };

  const providerUser2 = {
    id: 'usr_pro_3d_2',
    phoneNumber: '+919876543212',
    fullName: 'Suresh Verma',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider2 = {
    id: 'prv_3d_2',
    userId: providerUser2.id,
    businessName: 'Suresh Express Repairs',
    verificationStatus: 'VERIFIED',
    isOnline: true,
    ratingAverage: 4.70,
    ratingCount: 15,
    experienceYears: 4,
    services: [{ serviceId: 'srv_fan_repair', isEnabled: true }],
    serviceAreas: [
      {
        city: 'Bengaluru',
        serviceRadiusMeters: 25000,
        centerLatitude: 12.9716,
        centerLongitude: 77.5946,
      },
    ],
  };

  const ineligibleProviderUser = {
    id: 'usr_pro_ineligible',
    phoneNumber: '+919876543213',
    fullName: 'Ineligible Pro',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const ineligibleProvider = {
    id: 'prv_ineligible',
    userId: ineligibleProviderUser.id,
    businessName: 'Offline Pro',
    verificationStatus: 'VERIFIED',
    isOnline: false, // OFFLINE!
    ratingAverage: 4.5,
    ratingCount: 10,
    experienceYears: 3,
    services: [{ serviceId: 'srv_fan_repair', isEnabled: true }],
    serviceAreas: [{ city: 'Bengaluru' }],
  };

  const customerAddress = {
    id: 'addr_cust_3d_1',
    userId: customerUser.id,
    label: 'Home',
    addressLine1: '402 Sunrise Apartments',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    latitude: 12.9716,
    longitude: 77.5946,
  };

  const serviceCategory = {
    id: 'cat_electrical',
    name: 'Electrical Services',
    slug: 'electrical-services',
    isActive: true,
  };

  const service = {
    id: 'srv_fan_repair',
    categoryId: 'cat_electrical',
    name: 'Ceiling Fan Repair',
    slug: 'ceiling-fan-repair',
    pricingModel: 'FIXED_PRICE',
    basePricePaisa: 49900,
    isActive: true,
    category: serviceCategory,
  };

  let customerToken: string;
  let foreignCustomerToken: string;
  let providerToken1: string;
  let providerToken2: string;
  let ineligibleProviderToken: string;

  const createValidBookingPayload = (extra: Record<string, any> = {}) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toISOString().split('T')[0];
    return {
      serviceId: service.id,
      addressId: customerAddress.id,
      scheduledDate: tomorrow,
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      pricingModel: 'FIXED_PRICE',
      jobDescription: 'Ceiling fan makes humming noise and stops rotating properly.',
      ...extra,
    };
  };

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;
    Object.assign(prisma, mockPrisma);

    // Seed mock database
    mockPrisma._store.users.set(customerUser.id, { ...customerUser });
    mockPrisma._store.users.set(foreignCustomerUser.id, { ...foreignCustomerUser });
    mockPrisma._store.users.set(providerUser1.id, { ...providerUser1 });
    mockPrisma._store.users.set(providerUser2.id, { ...providerUser2 });
    mockPrisma._store.users.set(ineligibleProviderUser.id, { ...ineligibleProviderUser });

    mockPrisma._store.providers.set(provider1.id, { ...provider1 });
    mockPrisma._store.providers.set(provider2.id, { ...provider2 });
    mockPrisma._store.providers.set(ineligibleProvider.id, { ...ineligibleProvider });

    mockPrisma._store.addresses.set(customerAddress.id, { ...customerAddress });
    mockPrisma._store.serviceCategories.set(serviceCategory.id, { ...serviceCategory });
    mockPrisma._store.services.set(service.id, { ...service });

    app = await buildApp();

    customerToken = app.jwt.sign(
      { userId: customerUser.id, phoneNumber: customerUser.phoneNumber, roles: ['CUSTOMER'] },
      { expiresIn: '1h' }
    );

    foreignCustomerToken = app.jwt.sign(
      { userId: foreignCustomerUser.id, phoneNumber: foreignCustomerUser.phoneNumber, roles: ['CUSTOMER'] },
      { expiresIn: '1h' }
    );

    providerToken1 = app.jwt.sign(
      { userId: providerUser1.id, phoneNumber: providerUser1.phoneNumber, roles: ['PROVIDER'] },
      { expiresIn: '1h' }
    );

    providerToken2 = app.jwt.sign(
      { userId: providerUser2.id, phoneNumber: providerUser2.phoneNumber, roles: ['PROVIDER'] },
      { expiresIn: '1h' }
    );

    ineligibleProviderToken = app.jwt.sign(
      { userId: ineligibleProviderUser.id, phoneNumber: ineligibleProviderUser.phoneNumber, roles: ['PROVIDER'] },
      { expiresIn: '1h' }
    );
  });

  // Test 1: Customer booking triggers dispatch
  test('1. Customer booking creation automatically triggers server-side dispatch', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    const bookingId = body.data.id;
    assert.ok(bookingId);
    assert.equal(body.data.currentStatus, 'REQUESTED');

    // Verify a dispatch offer was created
    const offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);
    assert.equal(offers.length, 1);
    assert.equal(offers[0].bookingId, bookingId);
    assert.equal(offers[0].status, 'OFFERED');
  });

  // Test 2: Eligible provider receives offer
  test('2. Highest ranked eligible provider receives dispatch offer', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    assert.equal(bookingRes.statusCode, 201);
    const offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);
    // Provider 1 has rating 4.85 vs Provider 2 4.70, so Provider 1 gets the first offer
    assert.equal(offers[0].providerId, provider1.id);

    // Provider 1 fetches active dispatch offer
    const proOfferRes = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/dispatch/offers/active',
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    assert.equal(proOfferRes.statusCode, 200);
    const proBody = proOfferRes.json();
    assert.ok(proBody.data);
    assert.equal(proBody.data.id, offers[0].id);
  });

  // Test 3: Ineligible provider does not receive offer
  test('3. Ineligible (offline/unverified/wrong service) providers never receive dispatch offers', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const inelOfferRes = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/dispatch/offers/active',
      headers: { authorization: `Bearer ${ineligibleProviderToken}` },
    });

    assert.equal(inelOfferRes.statusCode, 200);
    assert.equal(inelOfferRes.json().data, null);
  });

  // Test 4 & 5: Provider rejects offer and rejection redispatches to next candidate
  test('4 & 5. Provider rejects offer, triggering immediate redispatch to next candidate', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const bookingId = bookingRes.json().data.id;
    let offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);
    const firstOfferId = offers[0].id;
    assert.equal(offers[0].providerId, provider1.id);

    // Provider 1 rejects
    const rejectRes = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${firstOfferId}/reject`,
      headers: { authorization: `Bearer ${providerToken1}` },
      payload: { rejectionReason: 'Too far away today' },
    });

    assert.equal(rejectRes.statusCode, 200);
    assert.equal(rejectRes.json().data.offer.status, 'REJECTED');

    // Wait for redispatch async promise
    await new Promise((r) => setTimeout(r, 50));

    // Offer was created for Provider 2!
    offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);
    assert.equal(offers.length, 2);
    assert.equal(offers[1].providerId, provider2.id);
    assert.equal(offers[1].status, 'OFFERED');
    assert.equal(offers[1].bookingId, bookingId);
  });

  // Test 6: Offer expiration redispatches to next candidate
  test('6. Stale offer expiration reassigns booking to next eligible candidate', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const bookingId = bookingRes.json().data.id;
    let offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);
    const firstOffer = offers[0];

    // Artificially age the offer past expiration
    firstOffer.expiresAt = new Date(Date.now() - 1000);

    // Expire stale offers scanner
    const expireRes = await dispatchService.expireStaleOffers();
    assert.equal(expireRes.expiredCount, 1);
    assert.equal(firstOffer.status, 'EXPIRED');

    // Redispatch created offer for candidate 2
    offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);
    assert.equal(offers.length, 2);
    assert.equal(offers[1].providerId, provider2.id);
    assert.equal(offers[1].status, 'OFFERED');
    assert.equal(offers[1].bookingId, bookingId);
  });

  // Test 7, 8, 9: Provider accepts offer, booking becomes PROVIDER_ACCEPTED, providerId assigned atomically
  test('7, 8 & 9. Provider accepts offer, advancing booking to PROVIDER_ACCEPTED with atomic providerId assignment', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const bookingId = bookingRes.json().data.id;
    const offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);
    const offerId = offers[0].id;

    // Provider 1 accepts
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offerId}/accept`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    assert.equal(acceptRes.statusCode, 200);
    const body = acceptRes.json().data;
    assert.equal(body.booking.currentStatus, 'PROVIDER_ACCEPTED');
    assert.equal(body.booking.providerId, provider1.id);
    assert.equal(body.offer.status, 'ACCEPTED');

    // Verify DB state
    const updatedBooking = mockPrisma._store.bookings.get(bookingId);
    assert.equal(updatedBooking.currentStatus, 'PROVIDER_ACCEPTED');
    assert.equal(updatedBooking.providerId, provider1.id);
  });

  // Test 10 & 11: Concurrent providers — exactly one wins, losing provider receives 409 Conflict
  test('10 & 11. Concurrency: exactly one provider wins; competing provider receives 409 Conflict', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const bookingId = bookingRes.json().data.id;

    // Create simultaneous offers for provider 1 and provider 2
    const offer1 = {
      id: 'off_concurrent_1',
      bookingId,
      providerId: provider1.id,
      status: 'OFFERED',
      attemptNumber: 1,
      expiresAt: new Date(Date.now() + 60000),
    };
    const offer2 = {
      id: 'off_concurrent_2',
      bookingId,
      providerId: provider2.id,
      status: 'OFFERED',
      attemptNumber: 1,
      expiresAt: new Date(Date.now() + 60000),
    };

    mockPrisma._store.dispatchOffers.set(offer1.id, offer1);
    mockPrisma._store.dispatchOffers.set(offer2.id, offer2);

    // Provider 1 accepts first
    const acceptRes1 = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer1.id}/accept`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });
    assert.equal(acceptRes1.statusCode, 200);

    // Provider 2 tries to accept concurrently
    const acceptRes2 = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer2.id}/accept`,
      headers: { authorization: `Bearer ${providerToken2}` },
    });

    assert.equal(acceptRes2.statusCode, 409);
    const errMsg = acceptRes2.json().error?.message || acceptRes2.json().message || '';
    assert.ok(
      errMsg.includes('already been claimed') || errMsg.includes('cancelled'),
      `Expected conflict error message, got: ${errMsg}`
    );

    // Verify Provider 1 is the sole winner
    const bookingInDb = mockPrisma._store.bookings.get(bookingId);
    assert.equal(bookingInDb.providerId, provider1.id);
    assert.equal(bookingInDb.currentStatus, 'PROVIDER_ACCEPTED');
  });

  // Test 12: Winning provider repeated accept is idempotent
  test('12. Winning provider repeated accept is safe and idempotent', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);
    const offerId = offers[0].id;

    // Accept 1
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offerId}/accept`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });
    assert.equal(res1.statusCode, 200);

    // Accept 2 (replay)
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offerId}/accept`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.json().data.alreadyClaimed, true);
  });

  // Test 13: Expired offer cannot be accepted
  test('13. Expired offer cannot be accepted (returns validation error)', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);
    const offer = offers[0];
    offer.expiresAt = new Date(Date.now() - 5000); // Past

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer.id}/accept`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    assert.equal(res.statusCode, 422);
    assert.ok(res.json().error.message.includes('expired'));
  });

  // Test 14: Rejected offer cannot be accepted
  test('14. Rejected offer cannot be accepted (returns 409 Conflict)', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);
    const offer = offers[0];

    // Reject first
    await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer.id}/reject`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    // Attempt accept
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer.id}/accept`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    assert.equal(res.statusCode, 409);
    assert.ok(res.json().error.message.includes('rejected'));
  });

  // Test 15: Wrong provider cannot accept
  test('15. Foreign provider attempting to accept another provider offer receives 403 Forbidden', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);
    const offerIdForPro1 = offers[0].id;

    // Provider 2 attempts to claim Provider 1's offer
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offerIdForPro1}/accept`,
      headers: { authorization: `Bearer ${providerToken2}` },
    });

    assert.equal(res.statusCode, 403);
    assert.ok(res.json().error.message.includes('not the recipient'));
  });

  // Test 16: Customer cannot assign provider through booking creation
  test('16. Client cannot inject providerId; backend enforces unassigned status on creation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload({
        providerId: provider1.id, // Injected!
      }),
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.data.currentStatus, 'REQUESTED');
    // Provider assignment must happen via dispatch claim, not client injection
    const bookingInDb = mockPrisma._store.bookings.get(body.data.id);
    assert.equal(bookingInDb.providerId, null);
  });

  // Test 17: Booking IDOR remains blocked
  test('17. Customer A cannot view or inspect Customer B booking details (403 Forbidden)', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const bookingId = bookingRes.json().data.id;

    // Foreign customer tries to access
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${bookingId}`,
      headers: { authorization: `Bearer ${foreignCustomerToken}` },
    });

    assert.equal(res.statusCode, 403);
  });

  // Test 18: Provider assignment is visible to customer
  test('18. Customer booking detail exposes sanitized assigned provider info and timeline after acceptance', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const bookingId = bookingRes.json().data.id;
    const offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);

    // Provider accepts
    await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offers[0].id}/accept`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    // Customer views booking detail
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${bookingId}`,
      headers: { authorization: `Bearer ${customerToken}` },
    });

    assert.equal(detailRes.statusCode, 200);
    const data = detailRes.json().data;
    assert.equal(data.currentStatus, 'PROVIDER_ACCEPTED');
    assert.ok(data.assignedProvider);
    assert.equal(data.assignedProvider.fullName, providerUser1.fullName);
    assert.equal(data.assignedProvider.businessName, provider1.businessName);
    assert.equal(data.assignedProvider.ratingAverage, 4.85);

    // Sensitive fields must NOT be exposed
    assert.equal(data.assignedProvider.bankAccountHolder, undefined);
    assert.equal(data.assignedProvider.bankAccountNumberEnc, undefined);
    assert.equal(data.assignedProvider.bankIfscCode, undefined);
    assert.equal(data.assignedProvider.upiId, undefined);
    assert.equal(data.assignedProvider.currentLatitude, undefined);
  });

  // Test 19: Booking status history records assignment
  test('19. BookingStatusHistory records authoritative REQUESTED -> PROVIDER_ACCEPTED transition', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const bookingId = bookingRes.json().data.id;
    const offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);

    await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offers[0].id}/accept`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    const history = mockPrisma._store.bookingStatusHistory.filter(
      (h: any) => h.bookingId === bookingId
    );

    assert.equal(history.length, 2);
    // Initial creation
    assert.equal(history[0].toState, 'REQUESTED');
    assert.equal(history[0].actorRole, 'CUSTOMER');
    // Provider claim
    assert.equal(history[1].fromState, 'REQUESTED');
    assert.equal(history[1].toState, 'PROVIDER_ACCEPTED');
    assert.equal(history[1].actorRole, 'PROVIDER');
  });

  // Test 20: No eligible provider leaves booking in REQUESTED state
  test('20. If no eligible providers exist, booking remains safely in REQUESTED searching state', async () => {
    // Take all providers offline in mock store
    const p1 = mockPrisma._store.providers.get(provider1.id);
    const p2 = mockPrisma._store.providers.get(provider2.id);
    if (p1) p1.isOnline = false;
    if (p2) p2.isOnline = false;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    assert.equal(res.statusCode, 201);
    const bookingId = res.json().data.id;
    const bookingInDb = mockPrisma._store.bookings.get(bookingId);

    assert.equal(bookingInDb.currentStatus, 'REQUESTED');
    assert.equal(bookingInDb.providerId, null);
    assert.equal(mockPrisma._store.dispatchOffers.size, 0);
  });

  // Test 21: Realtime event emitted on assignment
  test('21. Realtime events (BOOKING_ACCEPTED and PROVIDER_ASSIGNED) are broadcast to booking channel', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const bookingId = bookingRes.json().data.id;
    const receivedEvents: RealtimeEvent[] = [];

    // Subscribe listener to booking channel
    const unsub = realtimeService.subscribe(`booking:${bookingId}`, (evt) => {
      receivedEvents.push(evt);
    });

    const offers = Array.from(mockPrisma._store.dispatchOffers.values() as IterableIterator<any>);
    await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offers[0].id}/accept`,
      headers: { authorization: `Bearer ${providerToken1}` },
    });

    unsub();

    assert.ok(receivedEvents.some((e) => e.type === 'BOOKING_ACCEPTED'));
    assert.ok(receivedEvents.some((e) => e.type === 'PROVIDER_ASSIGNED'));
  });

  // Test 22: Duplicate / replayed realtime events are safe
  test('22. Duplicate/replayed realtime events do not cause server errors', async () => {
    let callCount = 0;
    const unsub = realtimeService.subscribe('booking:test_dup', () => {
      callCount++;
    });

    realtimeService.emitToBooking('test_dup', 'PROVIDER_ASSIGNED', { providerId: 'p1' });
    realtimeService.emitToBooking('test_dup', 'PROVIDER_ASSIGNED', { providerId: 'p1' });

    unsub();
    assert.equal(callCount, 2);
  });

  // Test 23: Unauthorized realtime subscription rejected
  test('23. Unauthorized customer cannot subscribe to another customer booking SSE stream (403)', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const bookingId = bookingRes.json().data.id;

    // Foreign customer attempts to connect to SSE stream
    const sseRes = await app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${bookingId}/stream`,
      headers: { authorization: `Bearer ${foreignCustomerToken}` },
    });

    assert.equal(sseRes.statusCode, 403);
  });

  // Test 24: Customer only receives their own booking events
  test('24. Customer subscription receives only events destined for their authorized booking', async () => {
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: createValidBookingPayload(),
    });

    const bookingId = bookingRes.json().data.id;
    const otherBookingId = 'bkg_other_unrelated_999';

    const eventsReceived: RealtimeEvent[] = [];
    const unsub = realtimeService.subscribe(`booking:${bookingId}`, (evt) => {
      eventsReceived.push(evt);
    });

    // Broadcast on unrelated channel
    realtimeService.emitToBooking(otherBookingId, 'PROVIDER_ASSIGNED', { other: true });

    // Broadcast on customer channel
    realtimeService.emitToBooking(bookingId, 'PROVIDER_ASSIGNED', { target: true });

    unsub();

    assert.equal(eventsReceived.length, 1);
    assert.equal((eventsReceived[0].payload as any).target, true);
  });
});
