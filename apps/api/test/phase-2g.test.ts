import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { locationService } from '../src/modules/location/location.service.js';
import { googleMapsService } from '../src/modules/location/google-maps.service.js';
import { matchingService } from '../src/modules/dispatch/matching.service.js';
import { realtimeService } from '../src/modules/realtime/realtime.service.js';

describe('Phase 2G — Location, Maps, GPS & Provider Operations', { concurrency: 1 }, () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  // Test Entities
  const providerUser1 = {
    id: 'usr_prv_2g_01',
    phoneNumber: '+919999900001',
    fullName: 'Provider Suresh',
    isActive: true,
    roles: ['PROVIDER'],
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider1 = {
    id: 'prv_2g_01',
    userId: providerUser1.id,
    businessName: 'Suresh Quick Plumbing',
    verificationStatus: 'VERIFIED',
    isOnline: true,
    ratingAverage: 4.8,
    ratingCount: 15,
    experienceYears: 5,
    currentLatitude: 12.9716,
    currentLongitude: 77.5946,
    lastLocationAt: new Date(Date.now() - 60 * 1000),
    currentAccuracyMeters: 10,
    currentHeading: 90,
    currentSpeed: 5,
    services: [
      {
        id: 'psrv_01',
        providerId: 'prv_2g_01',
        serviceId: 'srv_plumbing_01',
        isEnabled: true,
      },
    ],
    serviceAreas: [
      {
        id: 'area_01',
        providerId: 'prv_2g_01',
        city: 'Bengaluru',
        centerLatitude: 12.9716,
        centerLongitude: 77.5946,
        serviceRadiusMeters: 15000,
      },
    ],
    bookings: [],
    dispatchOffers: [],
  };

  const providerUser2 = {
    id: 'usr_prv_2g_02',
    phoneNumber: '+919999900002',
    fullName: 'Provider Dinesh',
    isActive: true,
    roles: ['PROVIDER'],
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider2 = {
    id: 'prv_2g_02',
    userId: providerUser2.id,
    businessName: 'Dinesh Express Repairs',
    verificationStatus: 'VERIFIED',
    isOnline: true,
    ratingAverage: 4.9,
    ratingCount: 20,
    experienceYears: 6,
    currentLatitude: 12.9352,
    currentLongitude: 77.6245,
    lastLocationAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes old (STALE)
    currentAccuracyMeters: 25,
    currentHeading: 0,
    currentSpeed: 0,
    services: [
      {
        id: 'psrv_02',
        providerId: 'prv_2g_02',
        serviceId: 'srv_plumbing_01',
        isEnabled: true,
      },
    ],
    serviceAreas: [
      {
        id: 'area_02',
        providerId: 'prv_2g_02',
        city: 'Bengaluru',
        centerLatitude: 12.9352,
        centerLongitude: 77.6245,
        serviceRadiusMeters: 15000,
      },
    ],
    bookings: [],
    dispatchOffers: [],
  };

  const customerUser = {
    id: 'usr_cust_2g_01',
    phoneNumber: '+919888800001',
    fullName: 'Customer Anita',
    isActive: true,
    roles: ['CUSTOMER'],
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const unrelatedCustomerUser = {
    id: 'usr_cust_2g_unrelated',
    phoneNumber: '+919888800099',
    fullName: 'Intruder Bob',
    isActive: true,
    roles: ['CUSTOMER'],
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const adminUser = {
    id: 'usr_admin_2g_01',
    phoneNumber: '+919777700001',
    fullName: 'City Manager Vikram',
    isActive: true,
    roles: ['CITY_MANAGER'],
    userRoles: [{ roleId: 'CITY_MANAGER' }],
  };

  const customerAddress = {
    id: 'addr_cust_2g_01',
    userId: customerUser.id,
    addressLine1: 'Indiranagar 100ft Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
    latitude: 12.9784,
    longitude: 77.6408,
  };

  const bookingEnRoute = {
    id: 'bkg_2g_enroute',
    bookingNumber: 'LM-2G-001',
    customerId: customerUser.id,
    providerId: provider1.id,
    serviceId: 'srv_plumbing_01',
    addressId: customerAddress.id,
    currentStatus: 'PROVIDER_ON_THE_WAY',
    pricingModel: 'FIXED_PRICE',
    baseAmountPaisa: 50000,
    totalAmountPaisa: 50000,
    address: customerAddress,
    customer: customerUser,
    provider: provider1,
    dispatchOffers: [],
  };

  const bookingConfirmed = {
    id: 'bkg_2g_confirmed',
    bookingNumber: 'LM-2G-002',
    customerId: customerUser.id,
    providerId: provider1.id,
    serviceId: 'srv_plumbing_01',
    addressId: customerAddress.id,
    currentStatus: 'CONFIRMED',
    pricingModel: 'FIXED_PRICE',
    baseAmountPaisa: 50000,
    totalAmountPaisa: 50000,
    address: customerAddress,
    customer: customerUser,
    provider: provider1,
    dispatchOffers: [],
  };

  const bookingCompleted = {
    id: 'bkg_2g_completed',
    bookingNumber: 'LM-2G-003',
    customerId: customerUser.id,
    providerId: provider1.id,
    serviceId: 'srv_plumbing_01',
    addressId: customerAddress.id,
    currentStatus: 'COMPLETED',
    pricingModel: 'FIXED_PRICE',
    baseAmountPaisa: 50000,
    totalAmountPaisa: 50000,
    address: customerAddress,
    customer: customerUser,
    provider: provider1,
    dispatchOffers: [],
  };

  const bookingJobStarted = {
    id: 'bkg_2g_started',
    bookingNumber: 'LM-2G-004',
    customerId: customerUser.id,
    providerId: provider1.id,
    serviceId: 'srv_plumbing_01',
    addressId: customerAddress.id,
    currentStatus: 'JOB_STARTED',
    pricingModel: 'FIXED_PRICE',
    baseAmountPaisa: 50000,
    totalAmountPaisa: 50000,
    address: customerAddress,
    customer: customerUser,
    provider: provider1,
    dispatchOffers: [],
  };

  const bookingStaleProvider = {
    id: 'bkg_2g_stale',
    bookingNumber: 'LM-2G-005',
    customerId: customerUser.id,
    providerId: provider2.id,
    serviceId: 'srv_plumbing_01',
    addressId: customerAddress.id,
    currentStatus: 'PROVIDER_ON_THE_WAY',
    pricingModel: 'FIXED_PRICE',
    baseAmountPaisa: 50000,
    totalAmountPaisa: 50000,
    address: customerAddress,
    customer: customerUser,
    provider: provider2,
    dispatchOffers: [],
  };

  beforeEach(async () => {
    locationService.clearThrottleCache();

    mockPrisma = createMockPrisma({
      users: new Map([
        [providerUser1.id, { ...providerUser1 }],
        [providerUser2.id, { ...providerUser2 }],
        [customerUser.id, { ...customerUser }],
        [unrelatedCustomerUser.id, { ...unrelatedCustomerUser }],
        [adminUser.id, { ...adminUser }],
      ]),
      providers: new Map([
        [provider1.id, { ...provider1, lastLocationAt: new Date(Date.now() - 60 * 1000) }],
        [provider2.id, { ...provider2, lastLocationAt: new Date(Date.now() - 30 * 60 * 1000) }],
      ]),
      bookings: new Map([
        [bookingEnRoute.id, { ...bookingEnRoute }],
        [bookingConfirmed.id, { ...bookingConfirmed }],
        [bookingCompleted.id, { ...bookingCompleted }],
        [bookingJobStarted.id, { ...bookingJobStarted }],
        [bookingStaleProvider.id, { ...bookingStaleProvider }],
      ]),
    });

    (globalThis as any).__prisma = mockPrisma;

    app = await buildApp();
    await app.ready();
  });

  function getAuthHeader(user: { id: string; roles: string[]; phoneNumber?: string }) {
    const token = app.jwt.sign({
      userId: user.id,
      roles: user.roles,
      phoneNumber: user.phoneNumber || '+919999900000',
    });
    return { authorization: `Bearer ${token}` };
  }

  // ===========================================================================
  // 1. PROVIDER LOCATION UPDATE API & SANITY CHECKS
  // ===========================================================================
  describe('Provider Location Update API & Sanity Validation', () => {
    it('1. should accept a valid location update and persist coordinates & audit log', async () => {
      const payload = {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 12.5,
        heading: 180,
        speed: 8.5,
        source: 'FOREGROUND_APP',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload,
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.latitude, 12.9716);
      assert.strictEqual(body.data.longitude, 77.5946);
      assert.strictEqual(body.data.freshnessStatus, 'FRESH');
      assert.strictEqual(body.data.operationalStatus, 'ONLINE');

      // Verify audit log entry in mock store
      assert.strictEqual(mockPrisma._store.providerLocationLogs.length, 1);
      const log = mockPrisma._store.providerLocationLogs[0];
      assert.strictEqual(log.providerId, provider1.id);
      assert.strictEqual(log.latitude, 12.9716);
      assert.strictEqual(log.accuracy, 12.5);
    });

    it('2. should reject coordinates with latitude out of range (> 90 or < -90)', async () => {
      const resHigh = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: { latitude: 91.5, longitude: 77.5946 },
      });
      assert.ok(resHigh.statusCode === 400 || resHigh.statusCode === 422);

      const resLow = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: { latitude: -91.0, longitude: 77.5946 },
      });
      assert.ok(resLow.statusCode === 400 || resLow.statusCode === 422);
    });

    it('3. should reject coordinates with longitude out of range (> 180 or < -180)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: { latitude: 12.9716, longitude: 181.0 },
      });
      assert.ok(res.statusCode === 400 || res.statusCode === 422);
    });

    it('4. should reject non-positive or impossible accuracy values (> 5000m)', async () => {
      const resZero = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: { latitude: 12.9716, longitude: 77.5946, accuracy: 0 },
      });
      assert.ok(resZero.statusCode === 400 || resZero.statusCode === 422);

      const resExcessive = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: { latitude: 12.9716, longitude: 77.5946, accuracy: 6000 },
      });
      assert.ok(resExcessive.statusCode === 400 || resExcessive.statusCode === 422);
    });

    it('5. should reject client timestamp far into the future (> 60 seconds)', async () => {
      const futureTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: {
          latitude: 12.9716,
          longitude: 77.5946,
          timestamp: futureTime,
        },
      });
      assert.strictEqual(res.statusCode, 422);
      const body = JSON.parse(res.body);
      assert.match(body.error?.message || body.message, /future/i);
    });

    it('6. should reject impossible travel speed / teleportation (> 250 km/h)', async () => {
      // First legitimate location update in Bengaluru (Indiranagar)
      await locationService.updateProviderLocation(providerUser1.id, {
        latitude: 12.9716,
        longitude: 77.5946,
      });

      // Clear throttle map & simulate 10 seconds elapsed (past the 5s throttle window)
      locationService.clearThrottleCache();
      const p1 = mockPrisma._store.providers.get(provider1.id);
      if (p1) p1.lastLocationAt = new Date(Date.now() - 10000);

      // Sudden jump to Delhi (1700 km away in 10 seconds = 170 km/s)
      await assert.rejects(
        async () => {
          await locationService.updateProviderLocation(providerUser1.id, {
            latitude: 28.6139,
            longitude: 77.2090,
          });
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 422);
          assert.match(err.message, /displacement|physical limits/i);
          return true;
        }
      );
    });
  });

  // ===========================================================================
  // 2. THROTTLING & RATE LIMITING
  // ===========================================================================
  describe('Location Throttling & Anti-Spam', () => {
    it('7. should throttle rapid consecutive updates from the same provider within 5 seconds', async () => {
      const payload = { latitude: 12.9716, longitude: 77.5946 };

      // First update succeeds
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload,
      });
      assert.strictEqual(res1.statusCode, 200);

      // Immediate second update must be throttled with 429
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload,
      });
      assert.strictEqual(res2.statusCode, 429);
      const body = JSON.parse(res2.body);
      assert.match(body.error?.message || body.message, /throttled/i);
    });
  });

  // ===========================================================================
  // 3. AUTHENTICATION & IDOR BOUNDARIES
  // ===========================================================================
  describe('Security & IDOR Isolation', () => {
    it('8. should reject unauthenticated location updates with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        payload: { latitude: 12.9716, longitude: 77.5946 },
      });
      assert.strictEqual(res.statusCode, 401);
    });

    it('9. should reject customer tokens from calling provider location update with 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(customerUser),
        payload: { latitude: 12.9716, longitude: 77.5946 },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    it('10. provider identity is derived from session; provider cannot spoof another providerId', async () => {
      // Clear throttle & reset last location from previous test to avoid displacement check
      locationService.clearThrottleCache();
      const p1 = mockPrisma._store.providers.get(provider1.id);
      if (p1) p1.lastLocationAt = null;

      // Even if client injects a malicious "providerId" into the payload,
      // the endpoint updates ONLY the authenticated provider's record
      const maliciousPayload = {
        latitude: 12.9720,
        longitude: 77.5950,
        providerId: provider2.id, // Trying to update Provider 2
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: maliciousPayload,
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.data.providerId, provider1.id); // Updated Provider 1, NOT Provider 2

      // Verify Provider 2 in the store remained untouched
      const p2 = mockPrisma._store.providers.get(provider2.id);
      assert.strictEqual(p2.currentLatitude, 12.9352);
    });
  });

  // ===========================================================================
  // 4. LOCATION FRESHNESS & OPERATIONAL STATES
  // ===========================================================================
  describe('Location Freshness Rules', () => {
    it('11. should classify location fresh within threshold and stale beyond threshold', () => {
      const now = new Date();
      const freshStatus = locationService.getFreshnessStatus(now);
      assert.strictEqual(freshStatus, 'FRESH');

      // 16 minutes ago (threshold is 15 minutes)
      const staleTime = new Date(Date.now() - 16 * 60 * 1000);
      const staleStatus = locationService.getFreshnessStatus(staleTime);
      assert.strictEqual(staleStatus, 'STALE');

      // Null location
      const nullStatus = locationService.getFreshnessStatus(null);
      assert.strictEqual(nullStatus, 'UNAVAILABLE');
    });

    it('12. should calculate correct operational status (ONLINE vs ONLINE_BUT_LOCATION_STALE)', () => {
      // Provider isOnline: true with fresh location
      const statusOnline = locationService.getOperationalStatus({
        isOnline: true,
        lastLocationAt: new Date(),
      });
      assert.strictEqual(statusOnline, 'ONLINE');

      // Provider isOnline: true with stale location (30 mins old)
      const statusStale = locationService.getOperationalStatus({
        isOnline: true,
        lastLocationAt: new Date(Date.now() - 30 * 60 * 1000),
      });
      assert.strictEqual(statusStale, 'ONLINE_BUT_LOCATION_STALE');

      // Provider isOnline: false
      const statusOffline = locationService.getOperationalStatus({
        isOnline: false,
        lastLocationAt: new Date(),
      });
      assert.strictEqual(statusOffline, 'OFFLINE');

      // Provider busy with an active job
      const statusBusy = locationService.getOperationalStatus({
        isOnline: true,
        lastLocationAt: new Date(),
        activeBookingsCount: 1,
      });
      assert.strictEqual(statusBusy, 'BUSY');
    });

    it('13. provider can inspect their own operational location status via API', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/providers/location/status',
        headers: getAuthHeader(providerUser1),
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.data.providerId, provider1.id);
      assert.strictEqual(body.data.freshnessStatus, 'FRESH');
      assert.strictEqual(body.data.operationalStatus, 'ONLINE');
    });
  });

  // ===========================================================================
  // 5. MATCHING SERVICE & PROXIMITY INTEGRATION
  // ===========================================================================
  describe('MatchingService Proximity & Freshness Integration', () => {
    it('14. should compute proximity distance for fresh provider and omit distance for stale provider', async () => {
      const candidates = await matchingService.findEligibleProviders(bookingEnRoute.id);
      assert.strictEqual(candidates.length, 2);

      const candidateA = candidates.find((c) => c.providerId === provider1.id)!;
      const candidateB = candidates.find((c) => c.providerId === provider2.id)!;

      // Provider 1 has FRESH location -> distanceKm is accurately computed
      assert.strictEqual(candidateA.freshnessStatus, 'FRESH');
      assert.notStrictEqual(candidateA.distanceKm, undefined);
      assert.ok(candidateA.distanceKm! > 0);

      // Provider 2 has STALE location -> distanceKm is undefined (no fake proximity advantage)
      assert.strictEqual(candidateB.freshnessStatus, 'STALE');
      assert.strictEqual(candidateB.distanceKm, undefined);
    });

    it('15. should exclude stale provider when requireFreshLocation option is enforced', async () => {
      const candidates = await matchingService.findEligibleProviders(
        bookingEnRoute.id,
        [],
        { requireFreshLocation: true }
      );

      // Only Provider 1 (FRESH) is returned; Provider 2 (STALE) is excluded
      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].providerId, provider1.id);
    });
  });

  // ===========================================================================
  // 6. CUSTOMER TRACKING ENDPOINT & LIFECYCLE PRIVACY
  // ===========================================================================
  describe('Customer Tracking Endpoint & Location Privacy Boundaries', () => {
    it('16. customer can track provider location when booking is in PROVIDER_ON_THE_WAY', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingEnRoute.id}/provider-location`,
        headers: getAuthHeader(customerUser),
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.bookingId, bookingEnRoute.id);
      assert.strictEqual(body.data.providerId, provider1.id);
      assert.strictEqual(body.data.latitude, provider1.currentLatitude);
      assert.strictEqual(body.data.longitude, provider1.currentLongitude);
      assert.strictEqual(body.data.freshnessStatus, 'FRESH');
      assert.strictEqual(body.data.isRealTimeRouting, false); // Safe fallback (no fake ETA)
      assert.strictEqual(body.data.etaMinutes, null); // NEVER fabricated
    });

    it('17. should reject tracking when booking is not en-route or arrived (e.g. CONFIRMED)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingConfirmed.id}/provider-location`,
        headers: getAuthHeader(customerUser),
      });

      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.body);
      assert.match(body.error?.message || body.message, /only available while provider is en route/i);
    });

    it('18. should reject unrelated customer from tracking another customer’s booking with 403 (IDOR)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingEnRoute.id}/provider-location`,
        headers: getAuthHeader(unrelatedCustomerUser),
      });

      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.body);
      assert.match(body.error?.message || body.message, /not authorized/i);
    });

    it('19. admin/city manager can view provider tracking location under RBAC', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingEnRoute.id}/provider-location`,
        headers: getAuthHeader(adminUser),
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.data.bookingId, bookingEnRoute.id);
    });
  });

  // ===========================================================================
  // 7. REALTIME BROADCAST & DATA RETENTION
  // ===========================================================================
  describe('Real-Time Location Events & Retention Pruning', () => {
    it('20. should emit PROVIDER_LOCATION_UPDATED realtime event on update', async () => {
      let eventReceived: any = null;
      const unsubscribe = realtimeService.subscribe(`provider:${provider1.id}`, (event) => {
        eventReceived = event;
      });

      await locationService.updateProviderLocation(providerUser1.id, {
        latitude: 12.9716,
        longitude: 77.5946,
      });

      unsubscribe();
      assert.ok(eventReceived);
      assert.strictEqual(eventReceived.type, 'PROVIDER_LOCATION_UPDATED');
      assert.strictEqual(eventReceived.payload.providerId, provider1.id);
    });

    it('21. admin can prune location breadcrumbs older than retention policy', async () => {
      // Add old log 40 days ago
      mockPrisma._store.providerLocationLogs.push({
        id: 'loc_old_01',
        providerId: provider1.id,
        latitude: 12.97,
        longitude: 77.59,
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      });

      // Add recent log 5 days ago
      mockPrisma._store.providerLocationLogs.push({
        id: 'loc_recent_01',
        providerId: provider1.id,
        latitude: 12.98,
        longitude: 77.60,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/location/prune',
        headers: getAuthHeader(adminUser),
        payload: { retentionDays: 30 },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.data.deletedCount, 1);
      assert.strictEqual(mockPrisma._store.providerLocationLogs.length, 1);
      assert.strictEqual(mockPrisma._store.providerLocationLogs[0].id, 'loc_recent_01');
    });

    it('22. non-admin cannot call retention prune endpoint', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/location/prune',
        headers: getAuthHeader(providerUser1),
        payload: { retentionDays: 30 },
      });
      assert.strictEqual(res.statusCode, 403);
    });
  });

  // ===========================================================================
  // 8. GOOGLE MAPS & ETA ABSTRACTION
  // ===========================================================================
  describe('Google Maps Routing & ETA Abstraction', () => {
    it('23. should never fabricate ETA or distance in mock/dev mode', async () => {
      const route = await googleMapsService.calculateRoute(
        { lat: 12.9716, lng: 77.5946 },
        { lat: 12.9784, lng: 77.6408 }
      );

      // In mock/test mode: durationSeconds and etaMinutes MUST be null
      assert.strictEqual(route.durationSeconds, null);
      assert.strictEqual(route.etaMinutes, null);
      assert.strictEqual(route.isRealTimeRouting, false);
      assert.ok(route.distanceMeters > 0);
    });
  });

  // ===========================================================================
  // 9. PHASE 2G FINAL HARDENING & PRODUCTION READINESS PASS
  // ===========================================================================
  describe('Phase 2G Final Hardening & Invariant Protection', () => {
    it('24. should reject negative speed or speed exceeding 75 m/s (~270 km/h)', async () => {
      const resNeg = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: { latitude: 12.9716, longitude: 77.5946, speed: -5 },
      });
      assert.ok(resNeg.statusCode === 400 || resNeg.statusCode === 422);

      const resExcess = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: { latitude: 12.9716, longitude: 77.5946, speed: 120 },
      });
      assert.ok(resExcess.statusCode === 400 || resExcess.statusCode === 422);
    });

    it('25. should reject negative heading (< 0) or heading > 360 degrees', async () => {
      const resNeg = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: { latitude: 12.9716, longitude: 77.5946, heading: -15 },
      });
      assert.ok(resNeg.statusCode === 400 || resNeg.statusCode === 422);

      const resExcess = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: { latitude: 12.9716, longitude: 77.5946, heading: 375 },
      });
      assert.ok(resExcess.statusCode === 400 || resExcess.statusCode === 422);
    });

    it('26. should reject timestamp far into future (>15s) and classify future timestamps as UNAVAILABLE', async () => {
      const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: { latitude: 12.9716, longitude: 77.5946, timestamp: futureTime },
      });
      assert.strictEqual(res.statusCode, 422);

      // Freshness check for future timestamp
      const freshness = locationService.getFreshnessStatus(new Date(Date.now() + 60 * 1000));
      assert.strictEqual(freshness, 'UNAVAILABLE');
    });

    it('27. should evaluate exact freshness boundary: fresh at <= 900s, stale at > 900s, unavailable for missing', async () => {
      // Exactly 900 seconds ago (15 minutes threshold)
      const exactlyFresh = new Date(Date.now() - 900 * 1000);
      assert.strictEqual(locationService.getFreshnessStatus(exactlyFresh), 'FRESH');

      // 901 seconds ago (threshold + 1s)
      const thresholdPlusOne = new Date(Date.now() - 901 * 1000);
      assert.strictEqual(locationService.getFreshnessStatus(thresholdPlusOne), 'STALE');

      // Null / missing location
      assert.strictEqual(locationService.getFreshnessStatus(null), 'UNAVAILABLE');
      assert.strictEqual(locationService.getFreshnessStatus(undefined), 'UNAVAILABLE');
    });

    it('28. should enforce multi-instance DB throttle when provider updated on another node within 5s', async () => {
      // Provider 1 lastLocationAt set in DB to 2 seconds ago (simulating update on Node A)
      const p1 = mockPrisma._store.providers.get(provider1.id);
      p1.lastLocationAt = new Date(Date.now() - 2000);

      // Node B has empty in-memory map
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location',
        headers: getAuthHeader(providerUser1),
        payload: { latitude: 12.9716, longitude: 77.5946 },
      });

      assert.strictEqual(res.statusCode, 429);
      const body = JSON.parse(res.body);
      assert.match(body.error?.message || body.message, /throttled/i);
    });

    it('29. should preserve latest authoritative coordinates when older out-of-order beacon arrives', async () => {
      locationService.clearThrottleCache();
      const p1 = mockPrisma._store.providers.get(provider1.id);
      p1.currentLatitude = 12.9716;
      p1.currentLongitude = 77.5946;
      p1.lastLocationAt = new Date(Date.now() - 10000); // authoritative reading (outside 5s throttle window)

      // Delayed beacon with older timestamp (1 minute ago)
      const olderTimestamp = new Date(Date.now() - 60000).toISOString();
      await locationService.updateProviderLocation(providerUser1.id, {
        latitude: 12.9000,
        longitude: 77.5000,
        timestamp: olderTimestamp,
      });

      // Provider active coordinates must NOT have been overwritten with older position
      assert.strictEqual(p1.currentLatitude, 12.9716);
      assert.strictEqual(p1.currentLongitude, 77.5946);

      // But telemetry log should contain the historical reading
      const logs = mockPrisma._store.providerLocationLogs.filter((l) => l.latitude === 12.9000);
      assert.strictEqual(logs.length, 1);
    });

    it('30. customer tracking returns STALE status with nullified coordinates and null ETA when provider GPS is stale', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingStaleProvider.id}/provider-location`,
        headers: getAuthHeader(customerUser),
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.data.freshnessStatus, 'STALE');
      // Must NEVER present stale coordinates as live position
      assert.strictEqual(body.data.latitude, null);
      assert.strictEqual(body.data.longitude, null);
      assert.strictEqual(body.data.etaMinutes, null);
      assert.strictEqual(body.data.distanceMeters, null);
      assert.strictEqual(body.data.isRealTimeRouting, false);
      assert.ok(body.data.lastLocationAt);
    });

    it('31. customer tracking is strictly rejected with 403 after booking completion (lifecycle ended)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingCompleted.id}/provider-location`,
        headers: getAuthHeader(customerUser),
      });

      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.body);
      assert.match(body.error?.message || body.message, /only available while provider is en route/i);
    });

    it('32. matching scorer awards proximity advantage to fresh provider, zero advantage to stale/unavailable', () => {
      const freshScore = matchingService['scorer'].calculateScore({
        ratingAverage: 5.0,
        ratingCount: 10,
        experienceYears: 5,
        distanceKm: 2.0, // Fresh coordinates 2km away
      });

      const staleScore = matchingService['scorer'].calculateScore({
        ratingAverage: 5.0,
        ratingCount: 10,
        experienceYears: 5,
        distanceKm: undefined, // Stale coordinates (distance omitted)
      });

      const unavailableScore = matchingService['scorer'].calculateScore({
        ratingAverage: 5.0,
        ratingCount: 10,
        experienceYears: 5,
        distanceKm: undefined, // Unavailable coordinates
      });

      // Fresh candidate receives proximity advantage (+16 points)
      assert.strictEqual(freshScore, 100 + 10 + 16);
      assert.strictEqual(staleScore, 100 + 10 + 0);
      assert.strictEqual(unavailableScore, 100 + 10 + 0);
      assert.ok(freshScore > staleScore);
      assert.strictEqual(staleScore, unavailableScore);
    });

    it('33. service-area fallback matching remains intact even when provider GPS is temporarily unavailable', async () => {
      // Provider 1 GPS temporarily unavailable (null coords)
      const p1 = mockPrisma._store.providers.get(provider1.id);
      p1.currentLatitude = null;
      p1.currentLongitude = null;
      p1.lastLocationAt = null;

      // Service area city match should still consider provider eligible for dispatch
      const result = await matchingService.checkEligibility(provider1.id, bookingEnRoute.id);
      assert.strictEqual(result.isEligible, true);
    });

    it('34. real-time GPS stream is NOT emitted to booking channel when status is JOB_STARTED', async () => {
      locationService.clearThrottleCache();
      let eventReceived: any = null;
      const unsubscribe = realtimeService.subscribe(`booking:${bookingJobStarted.id}`, (event) => {
        eventReceived = event;
      });

      await locationService.updateProviderLocation(providerUser1.id, {
        latitude: 12.9716,
        longitude: 77.5946,
        bookingId: bookingJobStarted.id,
      });

      unsubscribe();
      // Since booking is in JOB_STARTED (provider on-site), GPS transit event must NOT be emitted to booking
      assert.strictEqual(eventReceived, null);
    });

    it('35. retention pruning audits admin execution and rejects retentionDays < 1', async () => {
      // Reject invalid retentionDays
      const resInvalid = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/location/prune',
        headers: getAuthHeader(adminUser),
        payload: { retentionDays: 0 },
      });
      assert.ok(resInvalid.statusCode === 400 || resInvalid.statusCode === 422);

      // Valid pruning logs audit entry
      const resValid = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/location/prune',
        headers: getAuthHeader(adminUser),
        payload: { retentionDays: 14 },
      });
      assert.strictEqual(resValid.statusCode, 200);

      const auditEntries = mockPrisma._store.auditLogs.filter((a) => a.action === 'PRUNE_LOCATION_LOGS');
      assert.ok(auditEntries.length > 0);
      assert.strictEqual(auditEntries[0].newState.retentionDays, 14);
      assert.strictEqual(auditEntries[0].userId, adminUser.id);
    });
  });
});
