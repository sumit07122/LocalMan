import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { prisma } from '../src/config/database.js';
import { BookingStatus, NEAR_DESTINATION_THRESHOLD_METERS } from '@localman/constants';
import { locationService } from '../src/modules/location/location.service.js';
import { realtimeService } from '../src/modules/realtime/realtime.service.js';

describe('Phase 3K — Live Maps, GPS Tracking & Server-Authoritative ETA', () => {
  let app: FastifyInstance;
  let mockPrisma: any;

  // Test Users
  const customerA = {
    id: 'usr_cust_3k_a',
    phoneNumber: '+919999922001',
    fullName: 'Rahul Dravid',
    avatarUrl: 'https://cdn.localman.in/avatars/rahul.jpg',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const customerB = {
    id: 'usr_cust_3k_b',
    phoneNumber: '+919999922002',
    fullName: 'Sneha Patel',
    avatarUrl: null,
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const providerUser1 = {
    id: 'usr_prov_3k_01',
    phoneNumber: '+919999922003',
    fullName: 'Ramesh AC Technician',
    avatarUrl: 'https://cdn.localman.in/avatars/ramesh.jpg',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider1 = {
    id: 'prv_3k_01',
    userId: providerUser1.id,
    businessName: 'Ramesh Climate Solutions',
    ratingAverage: 4.85,
    ratingCount: 14,
    experienceYears: 6,
    verificationStatus: 'VERIFIED',
    isOnline: true,
    currentLatitude: 12.9716,
    currentLongitude: 77.5946,
    currentAccuracyMeters: 8.5,
    currentHeading: 90,
    currentSpeed: 12.5,
    lastLocationAt: new Date(Date.now() - 60000),
  };

  const providerUser2 = {
    id: 'usr_prov_3k_02',
    phoneNumber: '+919999922004',
    fullName: 'Sunil Plumber',
    avatarUrl: null,
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider2 = {
    id: 'prv_3k_02',
    userId: providerUser2.id,
    businessName: 'Sunil Plumbing Service',
    ratingAverage: 4.9,
    ratingCount: 20,
    experienceYears: 8,
    verificationStatus: 'VERIFIED',
    isOnline: true,
    currentLatitude: 12.9352,
    currentLongitude: 77.6245,
    lastLocationAt: new Date(Date.now() - 60000),
  };

  const adminUser = {
    id: 'usr_admin_3k_01',
    phoneNumber: '+919999922099',
    fullName: 'Operations Manager',
    isActive: true,
    userRoles: [{ roleId: 'ADMIN' }],
  };

  const customerAddress = {
    id: 'addr_cust_3k_01',
    userId: customerA.id,
    label: 'Home',
    addressLine1: '#402, Green Glen Layout, Bellandur',
    addressLine2: 'Outer Ring Road',
    landmark: 'Opposite Ecospace Tech Park',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560103',
    latitude: 12.9260,
    longitude: 77.6762,
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

    mockPrisma._store.providers.set(provider1.id, {
      ...provider1,
      user: providerUser1,
      lastLocationAt: new Date(Date.now() - 60000),
    });
    mockPrisma._store.providers.set(provider2.id, {
      ...provider2,
      user: providerUser2,
      lastLocationAt: new Date(Date.now() - 60000),
    });
    mockPrisma._store.addresses.set(customerAddress.id, { ...customerAddress });

    app = await buildApp();
    await app.ready();

    tokenCustomerA = app.jwt.sign({ userId: customerA.id });
    tokenCustomerB = app.jwt.sign({ userId: customerB.id });
    tokenProvider1 = app.jwt.sign({ userId: providerUser1.id });
    tokenProvider2 = app.jwt.sign({ userId: providerUser2.id });
    tokenAdmin = app.jwt.sign({ userId: adminUser.id });
  });

  const getAuthHeader = (token: string) => ({ authorization: `Bearer ${token}` });

  const resetProviderThrottle = (providerId: string = provider1.id) => {
    locationService.clearThrottleCache();
    const p = mockPrisma?._store?.providers?.get(providerId);
    if (p) {
      p.lastLocationAt = new Date(Date.now() - 60000);
    }
  };

  // ===========================================================================
  // SECTION 1: GPS BEACON VALIDATION & SANITY CHECKS
  // ===========================================================================
  describe('1. GPS Beacon Validation & Physical Boundary Checks', () => {
    test('1. Provider sends valid location beacon successfully', async () => {
      resetProviderThrottle(provider1.id);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: {
          latitude: 12.9716,
          longitude: 77.5946,
          accuracy: 5.2,
          heading: 180,
          speed: 15.0,
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.latitude, 12.9716);
      assert.strictEqual(json.data.longitude, 77.5946);
      assert.strictEqual(json.data.freshnessStatus, 'FRESH');
    });

    test('2. Rejects invalid latitude > 90', async () => {
      resetProviderThrottle(provider1.id);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: 91.5, longitude: 77.5946 },
      });
      assert.strictEqual(res.statusCode, 422);
    });

    test('3. Rejects invalid latitude < -90', async () => {
      resetProviderThrottle(provider1.id);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: -95.0, longitude: 77.5946 },
      });
      assert.strictEqual(res.statusCode, 422);
    });

    test('4. Rejects invalid longitude > 180', async () => {
      resetProviderThrottle(provider1.id);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: 12.9716, longitude: 181.0 },
      });
      assert.strictEqual(res.statusCode, 422);
    });

    test('5. Rejects invalid longitude < -180', async () => {
      resetProviderThrottle(provider1.id);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: 12.9716, longitude: -185.0 },
      });
      assert.strictEqual(res.statusCode, 422);
    });

    test('6. Rejects null-island placeholder coordinates (0,0)', async () => {
      resetProviderThrottle(provider1.id);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: 0.0, longitude: 0.0 },
      });
      assert.ok(res.statusCode === 400 || res.statusCode === 422);
      assert.match(res.body, /invalid placeholder coordinates/i);
    });

    test('7. Rejects negative GPS accuracy', async () => {
      resetProviderThrottle(provider1.id);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: 12.9716, longitude: 77.5946, accuracy: -5 },
      });
      assert.strictEqual(res.statusCode, 422);
    });

    test('8. Rejects excessive accuracy > 5000 meters', async () => {
      resetProviderThrottle(provider1.id);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: 12.9716, longitude: 77.5946, accuracy: 6000 },
      });
      assert.strictEqual(res.statusCode, 422);
    });

    test('9. Rejects physically impossible travel speed (> 75 m/s)', async () => {
      resetProviderThrottle(provider1.id);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: 12.9716, longitude: 77.5946, speed: 120 },
      });
      assert.strictEqual(res.statusCode, 422);
    });

    test('10. Rejects invalid heading (< 0 or > 360 degrees)', async () => {
      resetProviderThrottle(provider1.id);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: 12.9716, longitude: 77.5946, heading: 400 },
      });
      assert.strictEqual(res.statusCode, 422);
    });

    test('11. Rejects timestamp in the future (> 15s drift)', async () => {
      resetProviderThrottle(provider1.id);
      const futureTime = new Date(Date.now() + 60000).toISOString();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: 12.9716, longitude: 77.5946, timestamp: futureTime },
      });
      assert.strictEqual(res.statusCode, 422);
      assert.match(res.body, /cannot be in the future/i);
    });

    test('12. Rejects stale timestamp older than 24 hours', async () => {
      resetProviderThrottle(provider1.id);
      const oldTime = new Date(Date.now() - 30 * 3600 * 1000).toISOString();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: 12.9716, longitude: 77.5946, timestamp: oldTime },
      });
      assert.strictEqual(res.statusCode, 422);
      assert.match(res.body, /too old/i);
    });

    test('13. Enforces rate-limiting / beacon throttling (429 on spam)', async () => {
      resetProviderThrottle(provider1.id);
      // First update succeeds
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: 12.9716, longitude: 77.5946 },
      });
      assert.strictEqual(res1.statusCode, 200);

      // Immediate second update is throttled
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider1),
        payload: { latitude: 12.9720, longitude: 77.5950 },
      });
      assert.strictEqual(res2.statusCode, 429);
      assert.match(res2.body, /throttled/i);
    });
  });

  // ===========================================================================
  // SECTION 2: PROVIDER LOCATION STATUS
  // ===========================================================================
  describe('2. Provider Location Status Inspection', () => {
    test('14. Provider inspects their own location & operational status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/providers/location/status',
        headers: getAuthHeader(tokenProvider1),
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.providerId, provider1.id);
      assert.strictEqual(json.data.isOnline, true);
      assert.strictEqual(json.data.operationalStatus, 'ONLINE');
    });

    test('15. Security: Unauthenticated request to location status returns 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/providers/location/status',
      });
      assert.strictEqual(res.statusCode, 401);
    });

    test('16. Security RBAC: Customer role cannot call provider location status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/providers/location/status',
        headers: getAuthHeader(tokenCustomerA),
      });
      assert.strictEqual(res.statusCode, 403);
    });
  });

  // ===========================================================================
  // SECTION 3: AUTHORITATIVE LIVE MAP STATE MACHINE
  // ===========================================================================
  describe('3. Authoritative Live Map State Machine', () => {
    test('17. State 1: SEARCHING (booking with no provider assigned)', async () => {
      const booking = {
        id: 'bkg_3k_state_searching',
        bookingNumber: 'BKG-3K-01',
        customerId: customerA.id,
        providerId: null,
        currentStatus: BookingStatus.REQUESTED,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/map-state`,
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.data.mapState, 'SEARCHING');
      assert.strictEqual(json.data.isTrackingPermitted, false);
      assert.strictEqual(json.data.provider, null);
      assert.strictEqual(json.data.providerLocation, null);
    });

    test('18. State 2: PROVIDER_ASSIGNED_LOCATION_UNAVAILABLE (assigned but CONFIRMED / not en route)', async () => {
      const booking = {
        id: 'bkg_3k_state_assigned_pre_transit',
        bookingNumber: 'BKG-3K-02',
        customerId: customerA.id,
        providerId: provider1.id,
        provider: { ...provider1, user: providerUser1 },
        currentStatus: BookingStatus.CONFIRMED,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/map-state`,
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.data.mapState, 'PROVIDER_ASSIGNED_LOCATION_UNAVAILABLE');
      assert.strictEqual(json.data.isTrackingPermitted, false);
      assert.strictEqual(json.data.provider.id, provider1.id);
      // Privacy check: coordinates must NOT be exposed before transit begins
      assert.strictEqual(json.data.providerLocation, null);
    });

    test('19. State 3: PROVIDER_ON_THE_WAY (en route with fresh GPS coordinates)', async () => {
      // Set provider position ~6 km from customer address
      const providerLocationFresh = {
        ...provider1,
        user: providerUser1,
        currentLatitude: 12.9716,
        currentLongitude: 77.5946,
        lastLocationAt: new Date(),
      };
      mockPrisma._store.providers.set(provider1.id, providerLocationFresh);

      const booking = {
        id: 'bkg_3k_state_on_the_way',
        bookingNumber: 'BKG-3K-03',
        customerId: customerA.id,
        providerId: provider1.id,
        provider: providerLocationFresh,
        currentStatus: BookingStatus.PROVIDER_ON_THE_WAY,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/map-state`,
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.data.mapState, 'PROVIDER_ON_THE_WAY');
      assert.strictEqual(json.data.isTrackingPermitted, true);
      assert.strictEqual(json.data.isNearDestination, false);
      assert.ok(json.data.providerLocation !== null);
      assert.strictEqual(json.data.providerLocation.latitude, 12.9716);
      assert.strictEqual(json.data.providerLocation.longitude, 77.5946);
      assert.strictEqual(json.data.providerLocation.freshnessStatus, 'FRESH');
      assert.ok(json.data.route.distanceMeters > NEAR_DESTINATION_THRESHOLD_METERS);
    });

    test('20. State 4: PROVIDER_NEAR_DESTINATION (en route and distance <= 500m)', async () => {
      // Position provider 200m away from customer address
      // customerAddress: 12.9260, 77.6762
      const providerNear = {
        ...provider1,
        user: providerUser1,
        currentLatitude: 12.9268,
        currentLongitude: 77.6768,
        lastLocationAt: new Date(),
      };
      mockPrisma._store.providers.set(provider1.id, providerNear);

      const booking = {
        id: 'bkg_3k_state_near_dest',
        bookingNumber: 'BKG-3K-04',
        customerId: customerA.id,
        providerId: provider1.id,
        provider: providerNear,
        currentStatus: BookingStatus.PROVIDER_ON_THE_WAY,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/map-state`,
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.data.mapState, 'PROVIDER_NEAR_DESTINATION');
      assert.strictEqual(json.data.isTrackingPermitted, true);
      assert.strictEqual(json.data.isNearDestination, true);
      assert.ok(json.data.route.distanceMeters <= NEAR_DESTINATION_THRESHOLD_METERS);
    });

    test('21. State 5: PROVIDER_ARRIVED (provider reached customer doorstep)', async () => {
      const providerArrived = {
        ...provider1,
        user: providerUser1,
        currentLatitude: 12.9261,
        currentLongitude: 77.6763,
        lastLocationAt: new Date(),
      };
      mockPrisma._store.providers.set(provider1.id, providerArrived);

      const booking = {
        id: 'bkg_3k_state_arrived',
        bookingNumber: 'BKG-3K-05',
        customerId: customerA.id,
        providerId: provider1.id,
        provider: providerArrived,
        currentStatus: BookingStatus.ARRIVED,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/map-state`,
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.data.mapState, 'PROVIDER_ARRIVED');
      assert.strictEqual(json.data.isTrackingPermitted, true);
      assert.strictEqual(json.data.isNearDestination, true);
    });

    test('22. State 6: TRACKING_STOPPED_JOB_STARTED (job started; tracking stopped for privacy)', async () => {
      const booking = {
        id: 'bkg_3k_state_job_started',
        bookingNumber: 'BKG-3K-06',
        customerId: customerA.id,
        providerId: provider1.id,
        provider: { ...provider1, user: providerUser1 },
        currentStatus: BookingStatus.JOB_STARTED,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/map-state`,
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.data.mapState, 'TRACKING_STOPPED_JOB_STARTED');
      assert.strictEqual(json.data.isTrackingPermitted, false);
      // Privacy check: coordinates must be strictly nullified during service work
      assert.strictEqual(json.data.providerLocation, null);
      assert.strictEqual(json.data.route, null);
    });

    test('23. State 7: LOCATION_STALE (en route, but GPS signal older than 15 minutes)', async () => {
      const staleTimestamp = new Date(Date.now() - 20 * 60 * 1000); // 20m ago
      const providerStale = {
        ...provider1,
        user: providerUser1,
        currentLatitude: 12.9716,
        currentLongitude: 77.5946,
        lastLocationAt: staleTimestamp,
      };
      mockPrisma._store.providers.set(provider1.id, providerStale);

      const booking = {
        id: 'bkg_3k_state_stale',
        bookingNumber: 'BKG-3K-07',
        customerId: customerA.id,
        providerId: provider1.id,
        provider: providerStale,
        currentStatus: BookingStatus.PROVIDER_ON_THE_WAY,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/map-state`,
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.data.mapState, 'LOCATION_STALE');
      assert.strictEqual(json.data.isTrackingPermitted, true);
      // Stale coordinates must NEVER be presented as live position
      assert.strictEqual(json.data.providerLocation.latitude, null);
      assert.strictEqual(json.data.providerLocation.longitude, null);
      assert.strictEqual(json.data.providerLocation.freshnessStatus, 'STALE');
    });

    test('24. State 8: LOCATION_UNAVAILABLE (en route, but provider has null coordinates)', async () => {
      const providerNoCoords = {
        ...provider1,
        user: providerUser1,
        currentLatitude: null,
        currentLongitude: null,
        lastLocationAt: null,
      };
      mockPrisma._store.providers.set(provider1.id, providerNoCoords);

      const booking = {
        id: 'bkg_3k_state_no_coords',
        bookingNumber: 'BKG-3K-08',
        customerId: customerA.id,
        providerId: provider1.id,
        provider: providerNoCoords,
        currentStatus: BookingStatus.PROVIDER_ON_THE_WAY,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/map-state`,
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.data.mapState, 'LOCATION_UNAVAILABLE');
      assert.strictEqual(json.data.providerLocation.latitude, null);
      assert.strictEqual(json.data.providerLocation.freshnessStatus, 'UNAVAILABLE');
    });

    test('25. State 9: BOOKING_CANCELLED (terminal cancellation state)', async () => {
      const booking = {
        id: 'bkg_3k_state_cancelled',
        bookingNumber: 'BKG-3K-09',
        customerId: customerA.id,
        providerId: provider1.id,
        provider: { ...provider1, user: providerUser1 },
        currentStatus: BookingStatus.CANCELLED,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/map-state`,
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().data.mapState, 'BOOKING_CANCELLED');
      assert.strictEqual(res.json().data.isTrackingPermitted, false);
      assert.strictEqual(res.json().data.providerLocation, null);
    });

    test('26. State 10: BOOKING_COMPLETED (terminal completion state)', async () => {
      const booking = {
        id: 'bkg_3k_state_completed',
        bookingNumber: 'BKG-3K-10',
        customerId: customerA.id,
        providerId: provider1.id,
        provider: { ...provider1, user: providerUser1 },
        currentStatus: BookingStatus.JOB_COMPLETED,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/map-state`,
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().data.mapState, 'BOOKING_COMPLETED');
      assert.strictEqual(res.json().data.isTrackingPermitted, false);
      assert.strictEqual(res.json().data.providerLocation, null);
    });
  });

  // ===========================================================================
  // SECTION 4: SECURITY & PRIVACY CONTROLS (IDOR & LEAST-PRIVILEGE RBAC)
  // ===========================================================================
  describe('4. Security & Privacy Controls (IDOR & Least-Privilege RBAC)', () => {
    test('27. Security IDOR: Customer B cannot view Customer A\'s map-state (403 Forbidden)', async () => {
      const booking = {
        id: 'bkg_3k_idor_cust',
        bookingNumber: 'BKG-3K-IDOR-01',
        customerId: customerA.id,
        providerId: provider1.id,
        provider: { ...provider1, user: providerUser1 },
        currentStatus: BookingStatus.PROVIDER_ON_THE_WAY,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/map-state`,
        headers: getAuthHeader(tokenCustomerB),
      });

      assert.strictEqual(res.statusCode, 403);
    });

    test('28. Security IDOR: Customer B cannot view Customer A\'s ETA (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings/bkg_3k_idor_cust/eta',
        headers: getAuthHeader(tokenCustomerB),
      });
      assert.strictEqual(res.statusCode, 403);
    });

    test('29. Security IDOR: Customer B cannot view Customer A\'s location (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings/bkg_3k_idor_cust/location',
        headers: getAuthHeader(tokenCustomerB),
      });
      assert.strictEqual(res.statusCode, 403);
    });

    test('30. Security IDOR: Provider 2 cannot access Provider 1\'s booking map-state (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings/bkg_3k_idor_cust/map-state',
        headers: getAuthHeader(tokenProvider2),
      });
      assert.strictEqual(res.statusCode, 403);
    });

    test('31. Assigned Provider 1 CAN access their own assigned booking map-state', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings/bkg_3k_idor_cust/map-state',
        headers: getAuthHeader(tokenProvider1),
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().data.bookingId, 'bkg_3k_idor_cust');
      assert.ok(res.json().data.destination !== null);
    });

    test('32. Security IDOR: Provider 2 cannot associate Provider 1\'s bookingId in location beacon', async () => {
      resetProviderThrottle(provider2.id);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/location/beacon',
        headers: getAuthHeader(tokenProvider2),
        payload: {
          latitude: 12.9352,
          longitude: 77.6245,
          bookingId: 'bkg_3k_idor_cust',
        },
      });
      assert.strictEqual(res.statusCode, 403);
      assert.match(res.body, /not assigned to this booking/i);
    });

    test('33. Admin / City Manager can inspect map-state with administrative privileges', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings/bkg_3k_idor_cust/map-state',
        headers: getAuthHeader(tokenAdmin),
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().data.bookingId, 'bkg_3k_idor_cust');
    });

    test('34. Unauthenticated request to map-state returns 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings/bkg_3k_idor_cust/map-state',
      });
      assert.strictEqual(res.statusCode, 401);
    });

    test('35. Requesting non-existent booking returns 404 Not Found', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings/bkg_does_not_exist/map-state',
        headers: getAuthHeader(tokenCustomerA),
      });
      assert.strictEqual(res.statusCode, 404);
    });
  });

  // ===========================================================================
  // SECTION 5: AUTHORITATIVE ETA & ROUTE CALCULATION
  // ===========================================================================
  describe('5. Authoritative ETA & Route Calculation', () => {
    test('36. GET /bookings/:id/eta returns authoritative distance, duration, and status', async () => {
      const providerLocation = {
        ...provider1,
        user: providerUser1,
        currentLatitude: 12.9716,
        currentLongitude: 77.5946,
        lastLocationAt: new Date(),
      };
      mockPrisma._store.providers.set(provider1.id, providerLocation);

      const booking = {
        id: 'bkg_3k_eta_test',
        bookingNumber: 'BKG-3K-ETA-01',
        customerId: customerA.id,
        providerId: provider1.id,
        provider: providerLocation,
        currentStatus: BookingStatus.PROVIDER_ON_THE_WAY,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/eta`,
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.data.bookingId, booking.id);
      assert.strictEqual(json.data.isTrackingPermitted, true);
      assert.strictEqual(json.data.freshnessStatus, 'FRESH');
      assert.ok(json.data.distanceMeters > 0);
      // In test/dev environment, fallback routing reports straight-line status with duration: null
      assert.strictEqual(json.data.isRealTimeRouting, false);
      assert.strictEqual(json.data.routingStatus, 'FALLBACK_STRAIGHT_LINE');
    });

    test('37. GET /bookings/:id/eta returns null distance/ETA when booking is not in transit', async () => {
      const booking = {
        id: 'bkg_3k_eta_not_trackable',
        bookingNumber: 'BKG-3K-ETA-02',
        customerId: customerA.id,
        providerId: provider1.id,
        provider: { ...provider1, user: providerUser1 },
        currentStatus: BookingStatus.CONFIRMED,
        addressId: customerAddress.id,
        address: customerAddress,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/eta`,
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.data.isTrackingPermitted, false);
      assert.strictEqual(json.data.distanceMeters, null);
      assert.strictEqual(json.data.etaMinutes, null);
      assert.strictEqual(json.data.routingStatus, 'NOT_TRACKABLE');
    });

    test('38. Destination address snapshot is immutable and cannot be altered via map APIs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings/bkg_3k_eta_test/map-state',
        headers: getAuthHeader(tokenCustomerA),
      });

      assert.strictEqual(res.statusCode, 200);
      const dest = res.json().data.destination;
      assert.strictEqual(dest.addressLine1, customerAddress.addressLine1);
      assert.strictEqual(dest.latitude, customerAddress.latitude);
      assert.strictEqual(dest.longitude, customerAddress.longitude);
    });
  });

  // ===========================================================================
  // SECTION 6: REALTIME BROADCAST & LIFECYCLE INVARIANTS
  // ===========================================================================
  describe('6. Realtime Broadcast & Lifecycle Invariants', () => {
    test('39. Location update emits PROVIDER_LOCATION_UPDATED when booking is in transit', async () => {
      resetProviderThrottle(provider1.id);
      const booking = {
        id: 'bkg_3k_realtime_transit',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: 'PROVIDER_ON_THE_WAY',
      };
      // Register in provider bookings and bookings store for active transit lookup
      mockPrisma._store.bookings.set(booking.id, booking);
      const prov = mockPrisma._store.providers.get(provider1.id);
      prov.bookings = [booking];

      let emittedEvent: any = null;
      const unsubscribe = realtimeService.subscribe(`booking:${booking.id}`, (evt) => {
        emittedEvent = evt;
      });

      await locationService.updateProviderLocation(providerUser1.id, {
        latitude: 12.9716,
        longitude: 77.5946,
        bookingId: booking.id,
      });

      unsubscribe();
      assert.ok(emittedEvent !== null);
      assert.strictEqual(emittedEvent.type, 'PROVIDER_LOCATION_UPDATED');
      assert.strictEqual(emittedEvent.payload.bookingId, booking.id);
      assert.strictEqual(emittedEvent.payload.latitude, 12.9716);
    });

    test('40. Location update does NOT emit transit event when booking is in JOB_STARTED', async () => {
      resetProviderThrottle(provider1.id);
      const booking = {
        id: 'bkg_3k_realtime_job_started',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: 'JOB_STARTED',
      };
      mockPrisma._store.bookings.set(booking.id, booking);
      const prov = mockPrisma._store.providers.get(provider1.id);
      prov.bookings = [booking];

      let emittedEvent: any = null;
      const unsubscribe = realtimeService.subscribe(`booking:${booking.id}`, (evt) => {
        emittedEvent = evt;
      });

      await locationService.updateProviderLocation(providerUser1.id, {
        latitude: 12.9716,
        longitude: 77.5946,
      });

      unsubscribe();
      // Must NOT broadcast transit event to booking channel once job is started
      assert.strictEqual(emittedEvent, null);
    });
  });
});
