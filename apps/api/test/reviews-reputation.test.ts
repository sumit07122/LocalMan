import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { prisma } from '../src/config/database.js';
import {
  BookingStatus,
  ReviewStatus,
  ReviewReportReason,
  REVIEW_EDIT_WINDOW_MS,
} from '@localman/constants';
import { matchingService } from '../src/modules/dispatch/matching.service.js';

describe('Phase 3J — Reviews, Ratings & Reputation System', () => {
  let app: FastifyInstance;
  let mockPrisma: any;

  // Test Users
  const customerA = {
    id: 'usr_cust_3j_a',
    phoneNumber: '+919999911001',
    fullName: 'Ananya Sharma',
    avatarUrl: 'https://cdn.localman.in/avatars/ananya.jpg',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const customerB = {
    id: 'usr_cust_3j_b',
    phoneNumber: '+919999911002',
    fullName: 'Bhavin Mehta',
    avatarUrl: null,
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const providerUser1 = {
    id: 'usr_prov_3j_01',
    phoneNumber: '+919999911003',
    fullName: 'Vikram Electrician',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider1 = {
    id: 'prv_3j_01',
    userId: providerUser1.id,
    businessName: 'Vikram Electrical Solutions',
    ratingAverage: 5.0,
    ratingCount: 0,
    experienceYears: 4,
    verificationStatus: 'VERIFIED',
    isOnline: true,
  };

  const providerUser2 = {
    id: 'usr_prov_3j_02',
    phoneNumber: '+919999911004',
    fullName: 'Pooja Plumber',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider2 = {
    id: 'prv_3j_02',
    userId: providerUser2.id,
    businessName: 'Pooja Plumbing Works',
    ratingAverage: 5.0,
    ratingCount: 0,
    experienceYears: 5,
    verificationStatus: 'VERIFIED',
    isOnline: true,
  };

  const adminUser = {
    id: 'usr_admin_3j_01',
    phoneNumber: '+919999911099',
    fullName: 'Admin Supervisor',
    isActive: true,
    userRoles: [{ roleId: 'ADMIN' }],
  };

  const kycVerifierUser = {
    id: 'usr_kyc_3j_01',
    phoneNumber: '+919999911088',
    fullName: 'KYC Document Specialist',
    isActive: true,
    userRoles: [{ roleId: 'KYC_VERIFIER' }],
  };

  let tokenCustomerA: string;
  let tokenCustomerB: string;
  let tokenProvider1: string;
  let tokenProvider2: string;
  let tokenAdmin: string;
  let tokenKycVerifier: string;

  before(async () => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;
    Object.assign(prisma, mockPrisma);

    mockPrisma._store.users.set(customerA.id, { ...customerA });
    mockPrisma._store.users.set(customerB.id, { ...customerB });
    mockPrisma._store.users.set(providerUser1.id, { ...providerUser1 });
    mockPrisma._store.users.set(providerUser2.id, { ...providerUser2 });
    mockPrisma._store.users.set(adminUser.id, { ...adminUser });
    mockPrisma._store.users.set(kycVerifierUser.id, { ...kycVerifierUser });

    mockPrisma._store.providers.set(provider1.id, { ...provider1, user: providerUser1 });
    mockPrisma._store.providers.set(provider2.id, { ...provider2, user: providerUser2 });

    app = await buildApp();
    await app.ready();

    tokenCustomerA = app.jwt.sign({ userId: customerA.id });
    tokenCustomerB = app.jwt.sign({ userId: customerB.id });
    tokenProvider1 = app.jwt.sign({ userId: providerUser1.id });
    tokenProvider2 = app.jwt.sign({ userId: providerUser2.id });
    tokenAdmin = app.jwt.sign({ userId: adminUser.id });
    tokenKycVerifier = app.jwt.sign({ userId: kycVerifierUser.id });
  });

  const getErrorMessage = (res: any) => res.json()?.error?.message || res.json()?.message || '';

  // ===========================================================================
  // SECTION 1: REVIEW ELIGIBILITY & FSM RULES
  // ===========================================================================
  describe('1. Review Eligibility & Finite State Machine Validation', () => {
    test('1. Customer successfully submits review for completed booking (JOB_COMPLETED)', async () => {
      const booking = {
        id: 'bkg_rev_elig_01',
        bookingNumber: 'BKG-REV-01',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
        totalAmountPaisa: 50000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          rating: 5,
          title: 'Excellent electrical repair!',
          body: 'Vikram arrived on time, was very polite and solved the MCB trip issue quickly.',
        },
      });

      assert.strictEqual(res.statusCode, 201);
      const data = res.json().data;
      assert.strictEqual(data.rating, 5);
      assert.strictEqual(data.title, 'Excellent electrical repair!');
      assert.strictEqual(data.status, ReviewStatus.PUBLISHED);
      assert.strictEqual(data.canEdit, true);

      // Verify booking status transitioned to REVIEWED
      const updatedBooking = mockPrisma._store.bookings.get(booking.id);
      assert.strictEqual(updatedBooking.currentStatus, BookingStatus.REVIEWED);
    });

    test('2. Customer successfully submits review for settled booking (PAYMENT_SETTLED)', async () => {
      const booking = {
        id: 'bkg_rev_elig_02',
        bookingNumber: 'BKG-REV-02',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.PAYMENT_SETTLED,
        totalAmountPaisa: 60000,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          rating: 4,
          title: 'Good job overall',
          body: 'Fixed the wiring issue promptly.',
        },
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.json().data.rating, 4);
    });

    test('3. Security IDOR: Customer A cannot review Customer B\'s booking', async () => {
      const booking = {
        id: 'bkg_rev_idor_01',
        bookingNumber: 'BKG-REV-IDOR',
        customerId: customerB.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5, title: 'Malicious IDOR review' },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.match(getErrorMessage(res), /own bookings/i);
    });

    test('4. Security IDOR: Provider cannot review themselves as customer', async () => {
      const booking = {
        id: 'bkg_rev_self_01',
        bookingNumber: 'BKG-REV-SELF',
        customerId: providerUser1.id, // provider user booked
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: { rating: 5, title: 'Fake self review' },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.match(getErrorMessage(res), /cannot review their own bookings/i);
    });

    test('5. Rejects review for unassigned booking without provider', async () => {
      const booking = {
        id: 'bkg_rev_unassigned_01',
        customerId: customerA.id,
        providerId: null,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5 },
      });

      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /without an assigned service professional/i);
    });

    test('6. Rejects review for incomplete booking in REQUESTED state', async () => {
      const booking = {
        id: 'bkg_rev_incomplete_req',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5 },
      });

      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /completed bookings/i);
    });

    test('7. Rejects review for incomplete booking in CONFIRMED state', async () => {
      const booking = {
        id: 'bkg_rev_incomplete_conf',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CONFIRMED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5 },
      });

      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /completed bookings/i);
    });

    test('8. Rejects review for incomplete booking in PROVIDER_ON_THE_WAY state', async () => {
      const booking = {
        id: 'bkg_rev_incomplete_otw',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.PROVIDER_ON_THE_WAY,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5 },
      });

      assert.strictEqual(res.statusCode, 400);
    });

    test('9. Rejects review for incomplete booking in ARRIVED state', async () => {
      const booking = {
        id: 'bkg_rev_incomplete_arr',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.ARRIVED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5 },
      });

      assert.strictEqual(res.statusCode, 400);
    });

    test('10. Rejects review for incomplete booking in JOB_STARTED state', async () => {
      const booking = {
        id: 'bkg_rev_incomplete_start',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_STARTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5 },
      });

      assert.strictEqual(res.statusCode, 400);
    });

    test('11. Rejects review for CANCELLED booking', async () => {
      const booking = {
        id: 'bkg_rev_cancelled',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.CANCELLED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 1 },
      });

      assert.strictEqual(res.statusCode, 400);
    });

    test('12. Rejects review for NO_SHOW booking', async () => {
      const booking = {
        id: 'bkg_rev_noshow',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.NO_SHOW,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 1 },
      });

      assert.strictEqual(res.statusCode, 400);
    });
  });

  // ===========================================================================
  // SECTION 2: DUPLICATE PROTECTION & CONCURRENCY
  // ===========================================================================
  describe('2. Duplicate Protection & Idempotent Invariants', () => {
    test('13. Rejects duplicate review creation for the same booking with 409 Conflict', async () => {
      const booking = {
        id: 'bkg_rev_dup_01',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // First submission
      const firstRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5, body: 'First review' },
      });
      assert.strictEqual(firstRes.statusCode, 201);

      // Duplicate submission
      const dupRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 4, body: 'Duplicate attempt' },
      });
      assert.strictEqual(dupRes.statusCode, 409);
      assert.match(getErrorMessage(dupRes), /already been submitted/i);
    });

    test('14. Safely rejects concurrent duplicate submissions', async () => {
      const booking = {
        id: 'bkg_rev_concurrent_01',
        customerId: customerB.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const req1 = app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerB}` },
        payload: { rating: 5, body: 'Concurrent review 1' },
      });
      const req2 = app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerB}` },
        payload: { rating: 5, body: 'Concurrent review 2' },
      });

      const [res1, res2] = await Promise.all([req1, req2]);
      const statusCodes = [res1.statusCode, res2.statusCode];
      assert.ok(statusCodes.includes(201), 'One request should succeed');
      assert.ok(statusCodes.includes(409), 'The duplicate request should be rejected with 409 Conflict');
    });
  });

  // ===========================================================================
  // SECTION 3: CONTENT & PAYLOAD VALIDATION
  // ===========================================================================
  describe('3. Review Content & Payload Validation', () => {
    test('15. Rejects decimal rating (e.g. 4.5)', async () => {
      const booking = {
        id: 'bkg_rev_val_decimal',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 4.5 },
      });

      assert.strictEqual(res.statusCode, 422);
    });

    test('16. Rejects rating below 1 (e.g. 0)', async () => {
      const booking = {
        id: 'bkg_rev_val_min',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 0 },
      });

      assert.strictEqual(res.statusCode, 422);
    });

    test('17. Rejects rating above 5 (e.g. 6)', async () => {
      const booking = {
        id: 'bkg_rev_val_max',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 6 },
      });

      assert.strictEqual(res.statusCode, 422);
    });

    test('18. Rejects negative rating (e.g. -1)', async () => {
      const booking = {
        id: 'bkg_rev_val_neg',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: -1 },
      });

      assert.strictEqual(res.statusCode, 422);
    });

    test('19. Rejects string/non-numeric rating', async () => {
      const booking = {
        id: 'bkg_rev_val_str',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 'five_stars' },
      });

      assert.strictEqual(res.statusCode, 422);
    });

    test('20. Rejects title exceeding 120 characters', async () => {
      const booking = {
        id: 'bkg_rev_val_long_title',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5, title: 'A'.repeat(121) },
      });

      assert.strictEqual(res.statusCode, 422);
    });

    test('21. Rejects body exceeding 2000 characters', async () => {
      const booking = {
        id: 'bkg_rev_val_long_body',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5, body: 'B'.repeat(2001) },
      });

      assert.strictEqual(res.statusCode, 422);
    });

    test('22. Client-supplied customerId and providerId are strictly ignored/overridden', async () => {
      const booking = {
        id: 'bkg_rev_val_override',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          rating: 5,
          customerId: 'fake_customer_id',
          providerId: provider2.id, // Attempting to review provider 2 instead of 1
          status: 'ADMIN_APPROVED',
        },
      });

      assert.strictEqual(res.statusCode, 201);
      const data = res.json().data;
      assert.strictEqual(data.customerId, customerA.id);
      assert.strictEqual(data.providerId, provider1.id);
      assert.strictEqual(data.status, ReviewStatus.PUBLISHED);
    });
  });

  // ===========================================================================
  // SECTION 4: REVIEW RETRIEVAL & PERMISSIONS
  // ===========================================================================
  describe('4. Review Retrieval, Pagination & Isolation', () => {
    let reviewTargetBookingId: string;

    before(async () => {
      const booking = {
        id: 'bkg_rev_retrieval_target',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);
      reviewTargetBookingId = booking.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5, title: 'Superb service!', body: 'Detailed feedback.' },
      });
    });

    test('23. Customer retrieves their own booking review', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${reviewTargetBookingId}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().data.rating, 5);
      assert.strictEqual(res.json().data.canEdit, true);
    });

    test('24. Assigned provider retrieves booking review', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${reviewTargetBookingId}/review`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().data.rating, 5);
    });

    test('25. Admin retrieves booking review', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${reviewTargetBookingId}/review`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().data.rating, 5);
    });

    test('26. Security IDOR: Third-party customer cannot view private booking review endpoint', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${reviewTargetBookingId}/review`,
        headers: { authorization: `Bearer ${tokenCustomerB}` },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.match(getErrorMessage(res), /access denied/i);
    });

    test('27. Public provider reviews endpoint returns published reviews with pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/providers/${provider1.id}/reviews?page=1&limit=5`,
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.ok(Array.isArray(json.data));
      assert.ok(json.pagination);
      assert.strictEqual(json.pagination.page, 1);
      assert.strictEqual(json.pagination.limit, 5);
    });

    test('28. Public reviews omit internal moderation fields (moderatedBy, moderationReason)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/providers/${provider1.id}/reviews`,
      });

      assert.strictEqual(res.statusCode, 200);
      const reviews = res.json().data;
      assert.ok(reviews.length > 0);
      const first = reviews[0];
      assert.strictEqual(first.moderatedBy, undefined);
      assert.strictEqual(first.moderationReason, undefined);
    });
  });

  // ===========================================================================
  // SECTION 5: PROVIDER REPUTATION CALCULATION & MATCHING INTEGRATION
  // ===========================================================================
  describe('5. Provider Reputation Calculation & Matching Scorer Integration', () => {
    test('29. Provider reputation aggregates published star distribution and average rating', async () => {
      // Clear reviews for provider2 to test exact mathematical distribution
      const p2Reviews = [
        { rating: 5, body: 'R1' },
        { rating: 5, body: 'R2' },
        { rating: 4, body: 'R3' },
        { rating: 3, body: 'R4' },
        { rating: 1, body: 'R5' },
      ];

      for (let i = 0; i < p2Reviews.length; i++) {
        const b = {
          id: `bkg_rep_p2_${i}`,
          customerId: customerA.id,
          providerId: provider2.id,
          currentStatus: BookingStatus.JOB_COMPLETED,
        };
        mockPrisma._store.bookings.set(b.id, b);
        mockPrisma._store.reviews.set(`rev_p2_${i}`, {
          id: `rev_p2_${i}`,
          bookingId: b.id,
          customerId: customerA.id,
          providerId: provider2.id,
          rating: p2Reviews[i].rating,
          body: p2Reviews[i].body,
          status: ReviewStatus.PUBLISHED,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/providers/${provider2.id}/reputation`,
      });

      assert.strictEqual(res.statusCode, 200);
      const rep = res.json().data;
      assert.strictEqual(rep.publishedReviewCount, 5);
      // (5 + 5 + 4 + 3 + 1) / 5 = 18 / 5 = 3.60
      assert.strictEqual(rep.averageRating, 3.6);
      assert.strictEqual(rep.ratingDistribution['5'], 2);
      assert.strictEqual(rep.ratingDistribution['4'], 1);
      assert.strictEqual(rep.ratingDistribution['3'], 1);
      assert.strictEqual(rep.ratingDistribution['2'], 0);
      assert.strictEqual(rep.ratingDistribution['1'], 1);
    });

    test('30. New provider with zero reviews returns default 5.0 rating and 0 count', async () => {
      const freshProvider = {
        id: 'prv_3j_fresh',
        userId: 'usr_fresh',
        businessName: 'Fresh Services',
        ratingAverage: 5.0,
        ratingCount: 0,
      };
      mockPrisma._store.providers.set(freshProvider.id, freshProvider);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/providers/${freshProvider.id}/reputation`,
      });

      assert.strictEqual(res.statusCode, 200);
      const rep = res.json().data;
      assert.strictEqual(rep.publishedReviewCount, 0);
      assert.strictEqual(rep.averageRating, 5.0);
    });

    test('31. Cross-provider reputation isolation: Provider 1 reviews do not alter Provider 2 reputation', async () => {
      const rep1Res = await app.inject({
        method: 'GET',
        url: `/api/v1/providers/${provider1.id}/reputation`,
      });
      const rep2Res = await app.inject({
        method: 'GET',
        url: `/api/v1/providers/${provider2.id}/reputation`,
      });

      assert.strictEqual(rep1Res.statusCode, 200);
      assert.strictEqual(rep2Res.statusCode, 200);
      const rep1 = rep1Res.json().data;
      const rep2 = rep2Res.json().data;

      assert.notStrictEqual(rep1.publishedReviewCount, rep2.publishedReviewCount);
    });

    test('32. Matching scoring integrates server-authoritative provider reputation', async () => {
      // Test that DefaultMatchingScorer ranks a provider with higher rating higher
      const pHigh = {
        ratingAverage: 4.8,
        ratingCount: 25,
        experienceYears: 5,
      };
      const pLow = {
        ratingAverage: 3.5,
        ratingCount: 25,
        experienceYears: 5,
      };

      const scoreHigh = (matchingService as any).scorer.calculateScore(pHigh);
      const scoreLow = (matchingService as any).scorer.calculateScore(pLow);

      assert.ok(scoreHigh > scoreLow, `Expected score ${scoreHigh} to exceed ${scoreLow}`);
    });
  });

  // ===========================================================================
  // SECTION 6: 48-HOUR REVIEW EDIT POLICY
  // ===========================================================================
  describe('6. 48-Hour Review Edit Policy', () => {
    test('33. Customer can edit their review within 48 hours of creation', async () => {
      const booking = {
        id: 'bkg_rev_edit_allowed',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Create review
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 4, title: 'Original title', body: 'Original comment' },
      });
      const reviewId = createRes.json().data.id;

      // Edit review within 48 hours
      const editRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5, title: 'Updated title', body: 'Updated comment' },
      });

      assert.strictEqual(editRes.statusCode, 200);
      const updated = editRes.json().data;
      assert.strictEqual(updated.id, reviewId);
      assert.strictEqual(updated.rating, 5);
      assert.strictEqual(updated.title, 'Updated title');
      assert.strictEqual(updated.body, 'Updated comment');
    });

    test('34. Security / Policy: Customer cannot edit review after 48-hour window expires', async () => {
      const oldCreatedAt = new Date(Date.now() - (REVIEW_EDIT_WINDOW_MS + 1000 * 60 * 60)); // 49 hours ago
      const expiredReview = {
        id: 'rev_expired_48h',
        bookingId: 'bkg_rev_expired_48h',
        customerId: customerA.id,
        providerId: provider1.id,
        rating: 4,
        title: 'Old title',
        body: 'Old body',
        status: ReviewStatus.PUBLISHED,
        createdAt: oldCreatedAt,
        updatedAt: oldCreatedAt,
      };
      mockPrisma._store.reviews.set(expiredReview.id, expiredReview);
      mockPrisma._store.bookings.set(expiredReview.bookingId, {
        id: expiredReview.bookingId,
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.REVIEWED,
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/reviews/${expiredReview.id}`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5, title: 'Attempted edit after 49 hours' },
      });

      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /48 hours/i);
    });

    test('35. Customer cannot edit a review that has been HIDDEN by moderation', async () => {
      const hiddenReview = {
        id: 'rev_hidden_no_edit',
        bookingId: 'bkg_rev_hidden_no_edit',
        customerId: customerA.id,
        providerId: provider1.id,
        rating: 1,
        title: 'Hidden review',
        body: 'Inappropriate content',
        status: ReviewStatus.HIDDEN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.reviews.set(hiddenReview.id, hiddenReview);
      mockPrisma._store.bookings.set(hiddenReview.bookingId, {
        id: hiddenReview.bookingId,
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.REVIEWED,
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/reviews/${hiddenReview.id}`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5, title: 'Bypass moderation edit' },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.match(getErrorMessage(res), /moderated/i);
    });

    test('36. Customer cannot edit a review that has been REMOVED by moderation', async () => {
      const removedReview = {
        id: 'rev_removed_no_edit',
        bookingId: 'bkg_rev_removed_no_edit',
        customerId: customerA.id,
        providerId: provider1.id,
        rating: 1,
        status: ReviewStatus.REMOVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.reviews.set(removedReview.id, removedReview);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/reviews/${removedReview.id}`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 5 },
      });

      assert.strictEqual(res.statusCode, 403);
    });
  });

  // ===========================================================================
  // SECTION 7: PROVIDER RESPONSE WORKFLOW
  // ===========================================================================
  describe('7. Provider Response Workflow & Protections', () => {
    let publishedReviewId: string;

    before(async () => {
      const r = {
        id: 'rev_for_provider_resp',
        bookingId: 'bkg_for_provider_resp',
        customerId: customerA.id,
        providerId: provider1.id,
        rating: 4,
        title: 'Great service',
        body: 'Quick fix for our ceiling fan.',
        status: ReviewStatus.PUBLISHED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.reviews.set(r.id, r);
      mockPrisma._store.bookings.set(r.bookingId, {
        id: r.bookingId,
        customerId: customerA.id,
        providerId: provider1.id,
      });
      publishedReviewId = r.id;
    });

    test('37. Assigned provider submits professional response to published review', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${publishedReviewId}/response`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          response: 'Thank you for your valuable feedback, Ananya! Happy to assist you anytime.',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const data = res.json().data;
      assert.strictEqual(data.providerResponse, 'Thank you for your valuable feedback, Ananya! Happy to assist you anytime.');
      assert.ok(data.providerRespondedAt);
    });

    test('38. Security IDOR: Unassigned Provider 2 cannot respond to Provider 1\'s review', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${publishedReviewId}/response`,
        headers: { authorization: `Bearer ${tokenProvider2}` },
        payload: {
          response: 'Malicious provider attempting response on competitor review.',
        },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.match(getErrorMessage(res), /own services/i);
    });

    test('39. Security IDOR: Customer cannot submit provider response', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${publishedReviewId}/response`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { response: 'Customer trying to act as provider.' },
      });

      assert.strictEqual(res.statusCode, 403);
    });

    test('40. Provider response cannot alter rating, customerId, or bookingId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${publishedReviewId}/response`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          response: 'Valid updated response note.',
          rating: 1, // Malicious rating tampering attempt
          customerId: 'tampered_cust',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const stored = mockPrisma._store.reviews.get(publishedReviewId);
      assert.strictEqual(stored.rating, 4); // Rating preserved!
      assert.strictEqual(stored.customerId, customerA.id); // Ownership preserved!
    });

    test('41. Rejects provider response shorter than 5 characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${publishedReviewId}/response`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: { response: 'Thx' },
      });

      assert.strictEqual(res.statusCode, 422);
    });

    test('42. Rejects provider response exceeding 1500 characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${publishedReviewId}/response`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: { response: 'A'.repeat(1501) },
      });

      assert.strictEqual(res.statusCode, 422);
    });

    test('43. Rejects provider response to a HIDDEN or REMOVED review', async () => {
      const hiddenReview = {
        id: 'rev_hidden_resp_test',
        bookingId: 'bkg_hidden_resp_test',
        customerId: customerA.id,
        providerId: provider1.id,
        rating: 1,
        status: ReviewStatus.HIDDEN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.reviews.set(hiddenReview.id, hiddenReview);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${hiddenReview.id}/response`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: { response: 'Attempting to reply to hidden review' },
      });

      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /published reviews/i);
    });
  });

  // ===========================================================================
  // SECTION 8: REPORT / FLAG WORKFLOW
  // ===========================================================================
  describe('8. Report & Flagging Workflow', () => {
    let reportTargetReviewId: string;

    before(async () => {
      const r = {
        id: 'rev_to_be_reported',
        bookingId: 'bkg_to_be_reported',
        customerId: customerA.id,
        providerId: provider1.id,
        rating: 1,
        title: 'Spam review',
        body: 'Click here for free coupons http://spam.xyz',
        status: ReviewStatus.PUBLISHED,
        isFlagged: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.reviews.set(r.id, r);
      reportTargetReviewId = r.id;
    });

    test('44. Provider can report an inappropriate review with valid reason', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${reportTargetReviewId}/report`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          reason: ReviewReportReason.SPAM,
          details: 'Contains suspicious external spam link and has nothing to do with the job.',
        },
      });

      assert.strictEqual(res.statusCode, 201);
      assert.ok(res.json().data.reportId);

      // Verify review is marked as flagged
      const stored = mockPrisma._store.reviews.get(reportTargetReviewId);
      assert.strictEqual(stored.isFlagged, true);
    });

    test('45. Duplicate report prevention: reporting same review twice by same user is rejected with 409', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${reportTargetReviewId}/report`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          reason: ReviewReportReason.SPAM,
          details: 'Second report attempt.',
        },
      });

      assert.strictEqual(res.statusCode, 409);
      assert.match(getErrorMessage(res), /already reported/i);
    });

    test('46. Reporting does not automatically delete/hide the review (moderation remains authoritative)', async () => {
      const stored = mockPrisma._store.reviews.get(reportTargetReviewId);
      // Status remains PUBLISHED until explicitly moderated by admin!
      assert.strictEqual(stored.status, ReviewStatus.PUBLISHED);
      assert.strictEqual(stored.isFlagged, true);
    });
  });

  // ===========================================================================
  // SECTION 9: ADMIN MODERATION & RBAC
  // ===========================================================================
  describe('9. Admin Moderation & RBAC Oversight', () => {
    let modTargetReviewId: string;

    before(async () => {
      const modProvider = {
        id: 'prv_3j_mod_target',
        userId: 'usr_prov_mod',
        businessName: 'Mod Target Services',
        ratingAverage: 5.0,
        ratingCount: 0,
        experienceYears: 3,
        verificationStatus: 'VERIFIED',
        isOnline: true,
      };
      mockPrisma._store.providers.set(modProvider.id, modProvider);

      const r = {
        id: 'rev_mod_admin_target',
        bookingId: 'bkg_mod_admin_target',
        customerId: customerA.id,
        providerId: modProvider.id,
        rating: 1,
        title: 'Review with offensive language',
        body: 'Vulgar text violating platform community guidelines.',
        status: ReviewStatus.PUBLISHED,
        isFlagged: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.reviews.set(r.id, r);
      mockPrisma._store.bookings.set(r.bookingId, {
        id: r.bookingId,
        customerId: customerA.id,
        providerId: modProvider.id,
      });
      modTargetReviewId = r.id;
    });

    test('47. Admin lists reviews in moderation queue with status filter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reviews?status=PUBLISHED',
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.ok(Array.isArray(json.data));
      assert.ok(json.pagination);
    });

    test('48. Admin inspects detailed review data with report history and audit records', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/reviews/${modTargetReviewId}`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const data = res.json().data;
      assert.strictEqual(data.id, modTargetReviewId);
      assert.ok(Array.isArray(data.auditLogs));
    });

    test('49. Admin HIDES inappropriate review with mandatory moderation reason', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reviews/${modTargetReviewId}/moderate`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          status: ReviewStatus.HIDDEN,
          moderationReason: 'Contains abusive language in violation of terms of service.',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const stored = mockPrisma._store.reviews.get(modTargetReviewId);
      assert.strictEqual(stored.status, ReviewStatus.HIDDEN);
      assert.strictEqual(stored.moderatedBy, adminUser.id);
      assert.ok(stored.moderatedAt);
      assert.strictEqual(stored.moderationReason, 'Contains abusive language in violation of terms of service.');
    });

    test('50. Security: Hidden review is immediately excluded from provider reputation', async () => {
      const repRes = await app.inject({
        method: 'GET',
        url: '/api/v1/providers/prv_3j_mod_target/reputation',
      });

      assert.strictEqual(repRes.statusCode, 200);
      const rep = repRes.json().data;
      // Since the 1-star review was hidden, 1-star count is 0 and reputation excluded it!
      assert.strictEqual(rep.ratingDistribution['1'], 0);
    });

    test('51. Rejects moderation action without moderation reason', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reviews/${modTargetReviewId}/moderate`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          status: ReviewStatus.REMOVED,
          moderationReason: 'Tiny', // Less than 5 characters
        },
      });

      assert.strictEqual(res.statusCode, 422);
    });

    test('52. Admin can re-PUBLISH a previously hidden review', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reviews/${modTargetReviewId}/moderate`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          status: ReviewStatus.PUBLISHED,
          moderationReason: 'Customer edited review to remove abusive words; restored.',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const stored = mockPrisma._store.reviews.get(modTargetReviewId);
      assert.strictEqual(stored.status, ReviewStatus.PUBLISHED);
    });

    test('53. Security RBAC: Customer cannot access admin moderation endpoints', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reviews/${modTargetReviewId}/moderate`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { status: ReviewStatus.REMOVED, moderationReason: 'Unauthorized' },
      });

      assert.strictEqual(res.statusCode, 403);
    });

    test('54. Security RBAC: Provider cannot access admin moderation endpoints', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reviews/${modTargetReviewId}/moderate`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: { status: ReviewStatus.REMOVED, moderationReason: 'Unauthorized' },
      });

      assert.strictEqual(res.statusCode, 403);
    });

    test('55. Security RBAC: KYC Verifier cannot moderate reviews (least privilege RBAC)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reviews/${modTargetReviewId}/moderate`,
        headers: { authorization: `Bearer ${tokenKycVerifier}` },
        payload: { status: ReviewStatus.REMOVED, moderationReason: 'KYC specialist trying to moderate' },
      });

      assert.strictEqual(res.statusCode, 403);
    });
  });

  // ===========================================================================
  // SECTION 10: DISPUTE WORKFLOW SEPARATION
  // ===========================================================================
  describe('10. Booking Disputes Remain Strictly Separate from Reviews', () => {
    test('56. Review exists alongside active dispute without interfering with each other', async () => {
      const booking = {
        id: 'bkg_dispute_sep_01',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Submit review
      const revRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { rating: 2, title: 'Disappointed', body: 'Work was subpar' },
      });
      assert.strictEqual(revRes.statusCode, 201);

      // Verify review exists
      const storedReview = mockPrisma._store.reviews.get(revRes.json().data.id);
      assert.strictEqual(storedReview.status, ReviewStatus.PUBLISHED);

      // Simulating a separate complaint ticket created
      mockPrisma._store.complaints.set('comp_01', {
        id: 'comp_01',
        ticketNumber: 'TKT-001',
        bookingId: booking.id,
        status: 'OPEN',
      });

      // Review remains unchanged and distinct
      assert.strictEqual(storedReview.status, ReviewStatus.PUBLISHED);
    });
  });
});
