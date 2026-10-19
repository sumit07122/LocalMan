import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { matchingService } from '../src/modules/dispatch/matching.service.js';
import { dispatchService } from '../src/modules/dispatch/dispatch.service.js';
import { realtimeService } from '../src/modules/realtime/realtime.service.js';
import { notificationService, DevNotificationAdapter } from '../src/modules/notifications/notification.service.js';

describe('Phase 2F — Real-Time Marketplace Dispatch & Provider Matching', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let devNotifier: DevNotificationAdapter;

  // Test Entities
  const servicePlumbing = {
    id: 'srv_plumbing_01',
    name: 'Pipe Leak Repair',
    slug: 'pipe-leak-repair',
    basePricePaisa: 50000, // ₹500
    platformCommissionPercent: 15.0,
    isActive: true,
  };

  const serviceElectrical = {
    id: 'srv_electrical_01',
    name: 'Switchboard Repair',
    slug: 'switchboard-repair',
    basePricePaisa: 40000,
    platformCommissionPercent: 15.0,
    isActive: true,
  };

  const customerUser = {
    id: 'usr_cust_2f_01',
    phoneNumber: '+919888800001',
    fullName: 'Customer Rohan',
    isActive: true,
    roles: ['CUSTOMER'],
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const customerAddress = {
    id: 'addr_cust_2f_01',
    userId: customerUser.id,
    addressLine1: 'Flat 402, Green Glen',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560103',
    latitude: 12.9279,
    longitude: 77.6771, // Bellandur, Bengaluru
  };

  // Provider 1: Verified, Online, Plumbing, Close Proximity (Rating 4.9)
  const providerUser1 = {
    id: 'usr_prv_2f_01',
    phoneNumber: '+919888800011',
    fullName: 'Ramesh Plumber',
    isActive: true,
    roles: ['PROVIDER'],
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const provider1 = {
    id: 'prv_2f_01',
    userId: providerUser1.id,
    businessName: 'Ramesh Plumbing Services',
    verificationStatus: 'VERIFIED',
    isOnline: true,
    currentLatitude: 12.9300,
    currentLongitude: 77.6750, // ~300m away
    ratingAverage: 4.9,
    ratingCount: 45,
    experienceYears: 6,
    services: [{ serviceId: servicePlumbing.id, isEnabled: true }],
    serviceAreas: [
      {
        city: 'Bengaluru',
        serviceRadiusMeters: 15000,
        centerLatitude: 12.9300,
        centerLongitude: 77.6750,
      },
    ],
  };

  // Provider 2: Verified, Online, Plumbing, Farther (Rating 4.5)
  const providerUser2 = {
    id: 'usr_prv_2f_02',
    phoneNumber: '+919888800012',
    fullName: 'Suresh Express',
    isActive: true,
    roles: ['PROVIDER'],
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const provider2 = {
    id: 'prv_2f_02',
    userId: providerUser2.id,
    businessName: 'Suresh Express Repairs',
    verificationStatus: 'VERIFIED',
    isOnline: true,
    currentLatitude: 12.9716,
    currentLongitude: 77.5946, // ~10km away
    ratingAverage: 4.5,
    ratingCount: 20,
    experienceYears: 3,
    services: [{ serviceId: servicePlumbing.id, isEnabled: true }],
    serviceAreas: [
      {
        city: 'Bengaluru',
        serviceRadiusMeters: 20000,
        centerLatitude: 12.9716,
        centerLongitude: 77.5946,
      },
    ],
  };

  // Provider 3: Unverified (DRAFT)
  const providerUser3 = {
    id: 'usr_prv_2f_03',
    phoneNumber: '+919888800013',
    fullName: 'Draft Partner',
    isActive: true,
    roles: ['PROVIDER'],
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const provider3 = {
    id: 'prv_2f_03',
    userId: providerUser3.id,
    businessName: 'Draft Partner Services',
    verificationStatus: 'DRAFT',
    isOnline: false,
    services: [{ serviceId: servicePlumbing.id, isEnabled: true }],
    serviceAreas: [{ city: 'Bengaluru', serviceRadiusMeters: 10000 }],
  };

  // Provider 4: Suspended
  const providerUser4 = {
    id: 'usr_prv_2f_04',
    phoneNumber: '+919888800014',
    fullName: 'Suspended Partner',
    isActive: true,
    roles: ['PROVIDER'],
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const provider4 = {
    id: 'prv_2f_04',
    userId: providerUser4.id,
    businessName: 'Suspended Services',
    verificationStatus: 'SUSPENDED',
    isOnline: true,
    services: [{ serviceId: servicePlumbing.id, isEnabled: true }],
    serviceAreas: [{ city: 'Bengaluru', serviceRadiusMeters: 10000 }],
  };

  // Provider 5: Verified, but Offline
  const providerUser5 = {
    id: 'usr_prv_2f_05',
    phoneNumber: '+919888800015',
    fullName: 'Offline Partner',
    isActive: true,
    roles: ['PROVIDER'],
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const provider5 = {
    id: 'prv_2f_05',
    userId: providerUser5.id,
    businessName: 'Offline Services',
    verificationStatus: 'VERIFIED',
    isOnline: false,
    services: [{ serviceId: servicePlumbing.id, isEnabled: true }],
    serviceAreas: [{ city: 'Bengaluru', serviceRadiusMeters: 10000 }],
  };

  let tokenProvider1: string;
  let tokenProvider2: string;
  let tokenCustomer: string;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;

    devNotifier = new DevNotificationAdapter();
    notificationService.setProvider(devNotifier);

    // Seed users
    mockPrisma._store.users.set(customerUser.id, customerUser);
    mockPrisma._store.users.set(providerUser1.id, providerUser1);
    mockPrisma._store.users.set(providerUser2.id, providerUser2);
    mockPrisma._store.users.set(providerUser3.id, providerUser3);
    mockPrisma._store.users.set(providerUser4.id, providerUser4);
    mockPrisma._store.users.set(providerUser5.id, providerUser5);

    // Seed providers
    mockPrisma._store.providers.set(provider1.id, { ...provider1 });
    mockPrisma._store.providers.set(provider2.id, { ...provider2 });
    mockPrisma._store.providers.set(provider3.id, { ...provider3 });
    mockPrisma._store.providers.set(provider4.id, { ...provider4 });
    mockPrisma._store.providers.set(provider5.id, { ...provider5 });

    app = await buildApp();
    await app.ready();

    tokenProvider1 = app.jwt.sign({
      userId: providerUser1.id,
      roles: providerUser1.roles,
      phoneNumber: providerUser1.phoneNumber,
    });
    tokenProvider2 = app.jwt.sign({
      userId: providerUser2.id,
      roles: providerUser2.roles,
      phoneNumber: providerUser2.phoneNumber,
    });
    tokenCustomer = app.jwt.sign({
      userId: customerUser.id,
      roles: customerUser.roles,
      phoneNumber: customerUser.phoneNumber,
    });
  });

  // Helper to create a test unassigned booking
  function createTestBooking(id = 'bkg_2f_001', serviceId = servicePlumbing.id) {
    const booking = {
      id,
      bookingNumber: `BKG-${Math.floor(100000 + Math.random() * 900000)}`,
      customerId: customerUser.id,
      providerId: null,
      serviceId,
      addressId: customerAddress.id,
      currentStatus: 'REQUESTED',
      pricingModel: 'FIXED_PRICE',
      scheduledDate: new Date('2026-10-25'),
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      baseAmountPaisa: 50000,
      totalAmountPaisa: 59000,
      service: servicePlumbing,
      address: customerAddress,
      customer: customerUser,
      createdAt: new Date(),
    };
    mockPrisma._store.bookings.set(booking.id, booking);
    return booking;
  }

  // ===========================================================================
  // 1. PROVIDER ELIGIBILITY RULES
  // ===========================================================================

  it('1. should qualify a verified, online provider matching service and area', async () => {
    const booking = createTestBooking('bkg_elig_01');
    const res = await matchingService.checkEligibility(provider1.id, booking.id);
    assert.equal(res.isEligible, true);
  });

  it('2. should reject an unverified provider from receiving dispatch', async () => {
    const booking = createTestBooking('bkg_elig_02');
    const res = await matchingService.checkEligibility(provider3.id, booking.id);
    assert.equal(res.isEligible, false);
    assert.match(res.reason!, /not KYC verified/i);
  });

  it('3. should reject a suspended provider from receiving dispatch', async () => {
    const booking = createTestBooking('bkg_elig_03');
    const res = await matchingService.checkEligibility(provider4.id, booking.id);
    assert.equal(res.isEligible, false);
    assert.match(res.reason!, /suspended/i);
  });

  it('4. should reject an offline provider from receiving dispatch', async () => {
    const booking = createTestBooking('bkg_elig_04');
    const res = await matchingService.checkEligibility(provider5.id, booking.id);
    assert.equal(res.isEligible, false);
    assert.match(res.reason!, /offline/i);
  });

  it('5. should reject a provider currently busy with an active job in progress', async () => {
    const booking = createTestBooking('bkg_elig_05');
    // Assign provider1 to an ongoing active job
    mockPrisma._store.bookings.set('bkg_busy_01', {
      id: 'bkg_busy_01',
      providerId: provider1.id,
      currentStatus: 'JOB_STARTED',
    });

    const res = await matchingService.checkEligibility(provider1.id, booking.id);
    assert.equal(res.isEligible, false);
    assert.match(res.reason!, /busy/i);
  });

  it('6. should reject a provider who does not offer the requested service', async () => {
    const electricalBooking = createTestBooking('bkg_elig_06', serviceElectrical.id);
    // provider1 only offers plumbing
    const res = await matchingService.checkEligibility(provider1.id, electricalBooking.id);
    assert.equal(res.isEligible, false);
    assert.match(res.reason!, /does not offer/i);
  });

  it('7. should reject a provider outside the service city/area', async () => {
    // Create booking in Mysuru
    const bookingMysuru = {
      id: 'bkg_mysuru_01',
      bookingNumber: 'BKG-MYS-01',
      customerId: customerUser.id,
      providerId: null,
      serviceId: servicePlumbing.id,
      currentStatus: 'REQUESTED',
      address: { city: 'Mysuru', latitude: 12.2958, longitude: 76.6394 },
    };
    mockPrisma._store.bookings.set(bookingMysuru.id, bookingMysuru);

    const res = await matchingService.checkEligibility(provider1.id, bookingMysuru.id);
    assert.equal(res.isEligible, false);
    assert.match(res.reason!, /outside provider service area/i);
  });

  it('8. should prevent customer from servicing their own booking (self-booking guard)', async () => {
    // Give customerUser a provider profile
    const selfProvider = {
      id: 'prv_self_01',
      userId: customerUser.id,
      verificationStatus: 'VERIFIED',
      isOnline: true,
      services: [{ serviceId: servicePlumbing.id, isEnabled: true }],
      serviceAreas: [{ city: 'Bengaluru', serviceRadiusMeters: 10000 }],
    };
    mockPrisma._store.providers.set(selfProvider.id, selfProvider);

    const booking = createTestBooking('bkg_elig_08');
    const res = await matchingService.checkEligibility(selfProvider.id, booking.id);
    assert.equal(res.isEligible, false);
    assert.match(res.reason!, /cannot service their own booking/i);
  });

  // ===========================================================================
  // 2. MATCHING RANKING & DISPATCH OFFERS
  // ===========================================================================

  it('9. should rank eligible candidates by proximity and rating', async () => {
    const booking = createTestBooking('bkg_match_01');
    const candidates = await matchingService.findEligibleProviders(booking.id);

    assert.equal(candidates.length, 2, 'Both provider1 and provider2 are eligible');
    assert.equal(candidates[0].providerId, provider1.id, 'Provider 1 is closer with higher rating');
    assert.equal(candidates[1].providerId, provider2.id);
    assert.ok(candidates[0].score > candidates[1].score);
  });

  it('10. should create a DispatchOffer with server expiration and notify provider', async () => {
    const booking = createTestBooking('bkg_disp_01');
    const offer = await dispatchService.dispatchBooking(booking.id);

    assert.ok(offer);
    assert.equal(offer.status, 'OFFERED');
    assert.equal(offer.providerId, provider1.id);
    assert.equal(offer.attemptNumber, 1);
    assert.ok(new Date(offer.expiresAt) > new Date());

    // Verify notification was recorded
    const notifs = devNotifier.getSentNotifications();
    assert.ok(notifs.length > 0);
    assert.equal(notifs[0].recipientUserId, providerUser1.id);
    assert.match(notifs[0].payload.title, /Job Offered/i);
  });

  it('11. should handle zero eligible providers gracefully and emit DISPATCH_FAILED', async () => {
    // Booking requiring unavailable service
    const rareBooking = createTestBooking('bkg_rare_01', 'srv_nonexistent');
    const offer = await dispatchService.dispatchBooking(rareBooking.id);

    assert.equal(offer, null);
    const notifs = devNotifier.getSentNotifications();
    assert.ok(notifs.some((n) => n.recipientUserId === customerUser.id));
  });

  // ===========================================================================
  // 3. ATOMIC CLAIMING & ACCEPTANCE
  // ===========================================================================

  it('12. provider successfully accepts offer: assigns booking, updates status to PROVIDER_ACCEPTED', async () => {
    const booking = createTestBooking('bkg_claim_01');
    const offer = await dispatchService.dispatchBooking(booking.id);
    assert.ok(offer);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer.id}/accept`,
      headers: { authorization: `Bearer ${tokenProvider1}` },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.booking.currentStatus, 'PROVIDER_ACCEPTED');
    assert.equal(body.data.booking.providerId, provider1.id);
    assert.equal(body.data.offer.status, 'ACCEPTED');

    // Customer notified
    const notifs = devNotifier.getSentNotifications();
    assert.ok(notifs.some((n) => n.recipientUserId === customerUser.id && n.payload.category === 'BOOKING'));
  });

  // ===========================================================================
  // 4. REJECTION & REDISPATCH
  // ===========================================================================

  it('13. provider declines offer: offer marked REJECTED and system dispatches next candidate', async () => {
    const booking = createTestBooking('bkg_reject_01');
    const offer1 = await dispatchService.dispatchBooking(booking.id);
    assert.ok(offer1);
    assert.equal(offer1.providerId, provider1.id);

    // Provider 1 declines
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer1.id}/reject`,
      headers: { authorization: `Bearer ${tokenProvider1}` },
      payload: { reason: 'Schedule conflict' },
    });

    assert.equal(response.statusCode, 200);
    const updatedOffer1 = mockPrisma._store.dispatchOffers.get(offer1.id);
    assert.equal(updatedOffer1.status, 'REJECTED');
    assert.equal(updatedOffer1.rejectionReason, 'Schedule conflict');

    // Redispatch should pick Provider 2
    const offer2 = await dispatchService.dispatchBooking(booking.id);
    assert.ok(offer2);
    assert.equal(offer2.providerId, provider2.id, 'Dispatched to next candidate Provider 2');
    assert.equal(offer2.attemptNumber, 2);
  });

  // ===========================================================================
  // 5. OFFER EXPIRATION
  // ===========================================================================

  it('14. stale offer sweeps mark offers past deadline as EXPIRED and redispatch', async () => {
    const booking = createTestBooking('bkg_expire_01');
    const offer1 = await dispatchService.dispatchBooking(booking.id);
    assert.ok(offer1);

    // Manually backdate expiration to 5 seconds ago
    offer1.expiresAt = new Date(Date.now() - 5000);
    mockPrisma._store.dispatchOffers.set(offer1.id, offer1);

    // Run expiration sweep
    const sweep = await dispatchService.expireStaleOffers();
    assert.equal(sweep.expiredCount, 1);

    const expiredOffer = mockPrisma._store.dispatchOffers.get(offer1.id);
    assert.equal(expiredOffer.status, 'EXPIRED');

    // Attempting to accept expired offer should fail
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer1.id}/accept`,
      headers: { authorization: `Bearer ${tokenProvider1}` },
    });
    assert.ok([409, 422].includes(acceptRes.statusCode), 'Must reject expired offer with 409 or 422');
    assert.match(acceptRes.json().error.message, /expired/i);
  });

  // ===========================================================================
  // 6. CONCURRENCY & RACE CONDITIONS
  // ===========================================================================

  it('15. race condition: exactly one provider succeeds when two attempt to claim simultaneously', async () => {
    const booking = createTestBooking('bkg_race_01');
    // Dispatch offer to Provider 1
    const offer1 = await mockPrisma.dispatchOffer.create({
      data: {
        bookingId: booking.id,
        providerId: provider1.id,
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    // Create parallel offer to Provider 2 for concurrency test
    const offer2 = await mockPrisma.dispatchOffer.create({
      data: {
        bookingId: booking.id,
        providerId: provider2.id,
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 60000),
      },
    });

    // Provider 1 claims first
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer1.id}/accept`,
      headers: { authorization: `Bearer ${tokenProvider1}` },
    });
    assert.equal(res1.statusCode, 200, 'Provider 1 wins race');

    // Provider 2 tries to claim the now-claimed booking
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer2.id}/accept`,
      headers: { authorization: `Bearer ${tokenProvider2}` },
    });
    assert.equal(res2.statusCode, 409, 'Provider 2 rejected with 409 Conflict');
    assert.match(res2.json().error.message, /cancelled|already been claimed/i);

    // Verify booking is assigned solely to Provider 1
    const freshBooking = mockPrisma._store.bookings.get(booking.id);
    assert.equal(freshBooking.providerId, provider1.id);
    assert.equal(freshBooking.currentStatus, 'PROVIDER_ACCEPTED');
  });

  it('16. idempotency: same provider accepting twice returns success without duplicate status records', async () => {
    const booking = createTestBooking('bkg_idem_01');
    const offer = await dispatchService.dispatchBooking(booking.id);
    assert.ok(offer);

    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer.id}/accept`,
      headers: { authorization: `Bearer ${tokenProvider1}` },
    });
    assert.equal(res1.statusCode, 200);

    const historyCountBefore = mockPrisma._store.bookingStatusHistory.length;

    // Tap Accept a second time
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer.id}/accept`,
      headers: { authorization: `Bearer ${tokenProvider1}` },
    });
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.json().data.alreadyClaimed, true);

    const historyCountAfter = mockPrisma._store.bookingStatusHistory.length;
    assert.equal(historyCountAfter, historyCountBefore, 'No duplicate history record created');
  });

  // ===========================================================================
  // 7. SECURITY & IDOR PROTECTIONS
  // ===========================================================================

  it('17. IDOR protection: Provider B cannot accept Provider A offer', async () => {
    const booking = createTestBooking('bkg_idor_01');
    const offer = await dispatchService.dispatchBooking(booking.id);
    assert.ok(offer);
    assert.equal(offer.providerId, provider1.id);

    // Provider 2 attempts to accept Provider 1's offer
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer.id}/accept`,
      headers: { authorization: `Bearer ${tokenProvider2}` },
    });

    assert.equal(res.statusCode, 403, 'Forbidden: IDOR blocked');
    assert.match(res.json().error.message, /Access denied/i);
  });

  it('18. IDOR protection: Provider B cannot decline Provider A offer', async () => {
    const booking = createTestBooking('bkg_idor_02');
    const offer = await dispatchService.dispatchBooking(booking.id);
    assert.ok(offer);

    // Provider 2 attempts to decline Provider 1's offer
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/dispatch/offers/${offer.id}/reject`,
      headers: { authorization: `Bearer ${tokenProvider2}` },
    });

    assert.equal(res.statusCode, 403, 'Forbidden: IDOR blocked');
  });

  it('19. provider can fetch active offer and list historical offers via authenticated API', async () => {
    const booking = createTestBooking('bkg_api_01');
    const offer = await dispatchService.dispatchBooking(booking.id);
    assert.ok(offer);

    // GET /api/v1/providers/dispatch/offers/active
    const activeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/dispatch/offers/active',
      headers: { authorization: `Bearer ${tokenProvider1}` },
    });
    assert.equal(activeRes.statusCode, 200);
    assert.equal(activeRes.json().data.id, offer.id);

    // GET /api/v1/providers/dispatch/offers
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/dispatch/offers',
      headers: { authorization: `Bearer ${tokenProvider1}` },
    });
    assert.equal(listRes.statusCode, 200);
    assert.equal(listRes.json().data.total, 1);
  });
});
