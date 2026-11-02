import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { prisma } from '../src/config/database.js';
import {
  BookingStatus,
  MediaPurpose,
  ReviewStatus,
} from '@localman/constants';

function getErrorMessage(res: any): string {
  try {
    const json = res.json();
    return json.error?.message || json.message || '';
  } catch {
    return '';
  }
}

describe('Phase 3L — Object Storage, Pre-signed URLs & Media Attachments System', () => {
  let app: FastifyInstance;
  let mockPrisma: any;

  // Test Users
  const customerA = {
    id: 'usr_cust_3l_a',
    phoneNumber: '+919999922001',
    fullName: 'Ravi Kumar',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const customerB = {
    id: 'usr_cust_3l_b',
    phoneNumber: '+919999922002',
    fullName: 'Sunita Patel',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const providerUser1 = {
    id: 'usr_prov_3l_01',
    phoneNumber: '+919999922003',
    fullName: 'Manoj Electrician',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider1 = {
    id: 'prv_3l_01',
    userId: providerUser1.id,
    businessName: 'Manoj Electrical Works',
    ratingAverage: 5.0,
    ratingCount: 0,
    isOnline: true,
  };

  const providerUser2 = {
    id: 'usr_prov_3l_02',
    phoneNumber: '+919999922004',
    fullName: 'Deepak Plumber',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider2 = {
    id: 'prv_3l_02',
    userId: providerUser2.id,
    businessName: 'Deepak Quick Fix',
    ratingAverage: 4.8,
    ratingCount: 1,
    isOnline: true,
  };

  const adminUser = {
    id: 'usr_admin_3l_01',
    phoneNumber: '+919999922099',
    fullName: 'Super Admin',
    isActive: true,
    userRoles: [{ roleId: 'ADMIN' }],
  };

  // Test Bookings across various lifecycle states
  const bkgRequested = {
    id: 'bkg_3l_requested',
    bookingNumber: 'BKG-3L-REQ',
    customerId: customerA.id,
    providerId: null,
    currentStatus: BookingStatus.REQUESTED,
    attachments: [],
  };

  const bkgOnTheWay = {
    id: 'bkg_3l_on_the_way',
    bookingNumber: 'BKG-3L-OTW',
    customerId: customerA.id,
    providerId: provider1.id,
    currentStatus: BookingStatus.PROVIDER_ON_THE_WAY,
    attachments: [],
  };

  const bkgArrived = {
    id: 'bkg_3l_arrived',
    bookingNumber: 'BKG-3L-ARR',
    customerId: customerA.id,
    providerId: provider1.id,
    currentStatus: BookingStatus.ARRIVED,
    attachments: [],
  };

  const bkgJobStarted = {
    id: 'bkg_3l_job_started',
    bookingNumber: 'BKG-3L-JST',
    customerId: customerA.id,
    providerId: provider1.id,
    currentStatus: BookingStatus.JOB_STARTED,
    attachments: [],
  };

  const bkgJobExtended = {
    id: 'bkg_3l_job_extended',
    bookingNumber: 'BKG-3L-JEX',
    customerId: customerA.id,
    providerId: provider1.id,
    currentStatus: BookingStatus.JOB_EXTENDED,
    attachments: [],
  };

  const bkgJobCompleted = {
    id: 'bkg_3l_job_completed',
    bookingNumber: 'BKG-3L-JCP',
    customerId: customerA.id,
    providerId: provider1.id,
    currentStatus: BookingStatus.JOB_COMPLETED,
    attachments: [],
  };

  const bkgPaymentSettled = {
    id: 'bkg_3l_payment_settled',
    bookingNumber: 'BKG-3L-PST',
    customerId: customerA.id,
    providerId: provider1.id,
    currentStatus: BookingStatus.PAYMENT_SETTLED,
    attachments: [],
  };

  const bkgCancelled = {
    id: 'bkg_3l_cancelled',
    bookingNumber: 'BKG-3L-CAN',
    customerId: customerA.id,
    providerId: provider1.id,
    currentStatus: BookingStatus.CANCELLED,
    attachments: [],
  };

  const bkgExpired = {
    id: 'bkg_3l_expired',
    bookingNumber: 'BKG-3L-EXP',
    customerId: customerA.id,
    providerId: null,
    currentStatus: BookingStatus.EXPIRED,
    attachments: [],
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

    mockPrisma._store.providers.set(provider1.id, { ...provider1, user: providerUser1 });
    mockPrisma._store.providers.set(provider2.id, { ...provider2, user: providerUser2 });

    mockPrisma._store.bookings.set(bkgRequested.id, { ...bkgRequested });
    mockPrisma._store.bookings.set(bkgOnTheWay.id, { ...bkgOnTheWay, provider: provider1 });
    mockPrisma._store.bookings.set(bkgArrived.id, { ...bkgArrived, provider: provider1 });
    mockPrisma._store.bookings.set(bkgJobStarted.id, { ...bkgJobStarted, provider: provider1 });
    mockPrisma._store.bookings.set(bkgJobExtended.id, { ...bkgJobExtended, provider: provider1 });
    mockPrisma._store.bookings.set(bkgJobCompleted.id, { ...bkgJobCompleted, provider: provider1 });
    mockPrisma._store.bookings.set(bkgPaymentSettled.id, { ...bkgPaymentSettled, provider: provider1 });
    mockPrisma._store.bookings.set(bkgCancelled.id, { ...bkgCancelled, provider: provider1 });
    mockPrisma._store.bookings.set(bkgExpired.id, { ...bkgExpired });

    app = await buildApp();
    await app.ready();

    tokenCustomerA = app.jwt.sign({ userId: customerA.id });
    tokenCustomerB = app.jwt.sign({ userId: customerB.id });
    tokenProvider1 = app.jwt.sign({ userId: providerUser1.id });
    tokenProvider2 = app.jwt.sign({ userId: providerUser2.id });
    tokenAdmin = app.jwt.sign({ userId: adminUser.id });
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: Pre-signed Upload URL Security & Whitelist Validation
  // ---------------------------------------------------------------------------
  describe('1. Pre-signed Upload URL Security & Whitelist Validation', () => {
    test('1. Reject unsupported MIME type (application/x-sh) with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          entityId: bkgOnTheWay.id,
          fileName: 'malicious_script.sh',
          contentType: 'application/x-sh',
          fileSizeBytes: 2048,
        },
      });
      assert.ok(res.statusCode === 422 || res.statusCode === 400);
    });

    test('2. Reject HTML script upload (text/html) with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          entityId: bkgOnTheWay.id,
          fileName: 'phishing.html',
          contentType: 'text/html',
          fileSizeBytes: 2048,
        },
      });
      assert.ok(res.statusCode === 422 || res.statusCode === 400);
    });

    test('3. Accept supported image types (image/jpeg, image/png, image/webp, image/heic)', async () => {
      for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/heic']) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/media/presign',
          headers: { authorization: `Bearer ${tokenCustomerA}` },
          payload: {
            purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
            entityId: bkgOnTheWay.id,
            fileName: `photo_${mime.split('/')[1]}.${mime.split('/')[1]}`,
            contentType: mime,
            fileSizeBytes: 1024 * 500,
          },
        });
        assert.strictEqual(res.statusCode, 200, `Failed for MIME: ${mime}`);
        const data = res.json();
        assert.ok(data.uploadUrl);
        assert.ok(data.fileUrl);
        assert.ok(data.storageKey);
      }
    });

    test('4. Accept supported document type (application/pdf) for KYC / evidence', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.KYC_DOCUMENT,
          entityId: provider1.id,
          fileName: 'pan_card.pdf',
          contentType: 'application/pdf',
          fileSizeBytes: 1024 * 1024 * 2,
        },
      });
      assert.strictEqual(res.statusCode, 200);
      const data = res.json();
      assert.match(data.storageKey, /\.pdf$/);
    });

    test('5. Reject file size exceeding photo limit (> 5MB) for image/jpeg', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          entityId: bkgOnTheWay.id,
          fileName: 'huge_image.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 6 * 1024 * 1024, // 6 MB > 5MB limit
        },
      });
      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /exceeds maximum permitted limit of 5 MB/i);
    });

    test('6. Reject file size exceeding document limit (> 10MB) for application/pdf', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.KYC_DOCUMENT,
          entityId: provider1.id,
          fileName: 'huge_document.pdf',
          contentType: 'application/pdf',
          fileSizeBytes: 12 * 1024 * 1024, // 12 MB > 10MB limit
        },
      });
      assert.ok(res.statusCode === 422 || res.statusCode === 400);
    });

    test('7. Pre-signed response contains valid uploadUrl, fileUrl, storageKey, non-zero expiresInSeconds, and headers', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          entityId: bkgOnTheWay.id,
          fileName: 'leaking_pipe.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 200,
        },
      });
      assert.strictEqual(res.statusCode, 200);
      const data = res.json();
      assert.ok(data.uploadUrl.startsWith('https://storage.localman.in/'));
      assert.ok(data.fileUrl.startsWith('https://storage.localman.in/'));
      assert.strictEqual(data.headers['Content-Type'], 'image/jpeg');
      assert.strictEqual(data.expiresInSeconds, 900);
      assert.strictEqual(data.entityId, bkgOnTheWay.id);
    });

    test('8. Unauthenticated request to presign returns 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        payload: {
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          entityId: bkgOnTheWay.id,
          fileName: 'leaking_pipe.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 200,
        },
      });
      assert.strictEqual(res.statusCode, 401);
    });
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: Customer Booking Problem Photos & Anti-IDOR
  // ---------------------------------------------------------------------------
  describe('2. Customer Booking Problem Photos & Anti-IDOR', () => {
    test('9. Customer A can request presigned URL for problem photo on their own booking', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          entityId: bkgOnTheWay.id,
          fileName: 'switchboard.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 300,
        },
      });
      assert.strictEqual(res.statusCode, 200);
    });

    test("10. Customer B requesting presigned URL for Customer A's booking problem photo returns 403 Forbidden", async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerB}` },
        payload: {
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          entityId: bkgOnTheWay.id,
          fileName: 'idor_attempt.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 300,
        },
      });
      assert.strictEqual(res.statusCode, 403);
      assert.match(getErrorMessage(res), /only upload problem photos for your own bookings/i);
    });

    test('11. Provider cannot request presigned URL with BOOKING_PROBLEM_PHOTO for customer booking', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          entityId: bkgOnTheWay.id,
          fileName: 'provider_upload_problem.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 300,
        },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    test('12. Presigned URL rejected if booking is in CANCELLED status (State validation)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          entityId: bkgCancelled.id,
          fileName: 'cancelled_booking.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 300,
        },
      });
      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /Cannot attach problem photos to a booking in CANCELLED status/i);
    });

    test('13. Presigned URL rejected if booking is in EXPIRED status (State validation)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          entityId: bkgExpired.id,
          fileName: 'expired_booking.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 300,
        },
      });
      assert.strictEqual(res.statusCode, 400);
    });

    test('14. Enforces maximum 5 problem photos per booking limit', async () => {
      // Simulate booking with 5 existing problem photos
      const bkgFullPhotos = {
        id: 'bkg_3l_full_photos',
        customerId: customerA.id,
        currentStatus: BookingStatus.PROVIDER_ON_THE_WAY,
        attachments: [1, 2, 3, 4, 5].map((i) => ({
          id: `att_${i}`,
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          fileUrl: `https://storage.localman.in/photo_${i}.jpg`,
        })),
      };
      mockPrisma._store.bookings.set(bkgFullPhotos.id, bkgFullPhotos);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          entityId: bkgFullPhotos.id,
          fileName: 'sixth_photo.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 300,
        },
      });
      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /Maximum 5 problem photos allowed per booking/i);
    });
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: Provider Job Before-Work Photos & Transit State Invariants
  // ---------------------------------------------------------------------------
  describe('3. Provider Job Before-Work Photos & Transit State Invariants', () => {
    test('15. Assigned Provider 1 can request presigned URL for JOB_BEFORE_WORK while booking is in PROVIDER_ON_THE_WAY', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.JOB_BEFORE_WORK,
          entityId: bkgOnTheWay.id,
          fileName: 'before_repair_1.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 400,
        },
      });
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.json().storageKey, /media\/job_before_work/);
    });

    test('16. Assigned Provider 1 can request presigned URL for JOB_BEFORE_WORK while booking is in ARRIVED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.JOB_BEFORE_WORK,
          entityId: bkgArrived.id,
          fileName: 'before_repair_2.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 400,
        },
      });
      assert.strictEqual(res.statusCode, 200);
    });

    test('17. Assigned Provider 1 can request presigned URL for JOB_BEFORE_WORK while booking is in JOB_STARTED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.JOB_BEFORE_WORK,
          entityId: bkgJobStarted.id,
          fileName: 'before_repair_3.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 400,
        },
      });
      assert.strictEqual(res.statusCode, 200);
    });

    test('18. Provider 2 (unassigned) requesting JOB_BEFORE_WORK returns 403 Forbidden (Anti-IDOR)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider2}` },
        payload: {
          purpose: MediaPurpose.JOB_BEFORE_WORK,
          entityId: bkgOnTheWay.id,
          fileName: 'unassigned_provider_photo.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 400,
        },
      });
      assert.strictEqual(res.statusCode, 403);
      assert.match(getErrorMessage(res), /Only the assigned service professional can upload before-work photos/i);
    });

    test('19. Customer requesting JOB_BEFORE_WORK returns 403 Forbidden (Provider-only invariant)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.JOB_BEFORE_WORK,
          entityId: bkgOnTheWay.id,
          fileName: 'customer_before_photo.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 400,
        },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    test('20. JOB_BEFORE_WORK presign rejected if booking is still in REQUESTED status (State validation)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.JOB_BEFORE_WORK,
          entityId: bkgRequested.id,
          fileName: 'premature_photo.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 400,
        },
      });
      assert.strictEqual(res.statusCode, 403); // Not assigned to this booking
    });

    test('21. JOB_BEFORE_WORK presign rejected if booking is already JOB_COMPLETED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.JOB_BEFORE_WORK,
          entityId: bkgJobCompleted.id,
          fileName: 'too_late_before.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 400,
        },
      });
      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /Before-work photos can only be uploaded when on the way, arrived, or executing the job/i);
    });

    test('22. Enforces maximum 5 before-work photos per job', async () => {
      const bkgMaxBefore = {
        id: 'bkg_3l_max_before',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_STARTED,
        attachments: [1, 2, 3, 4, 5].map((i) => ({
          id: `att_before_${i}`,
          purpose: MediaPurpose.JOB_BEFORE_WORK,
          fileUrl: `https://storage.localman.in/before_${i}.jpg`,
        })),
      };
      mockPrisma._store.bookings.set(bkgMaxBefore.id, { ...bkgMaxBefore, provider: provider1 });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.JOB_BEFORE_WORK,
          entityId: bkgMaxBefore.id,
          fileName: 'sixth_before.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 400,
        },
      });
      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /Maximum 5 before-work photos allowed/i);
    });
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: Provider Job After-Work Photos & Execution State Invariants
  // ---------------------------------------------------------------------------
  describe('4. Provider Job After-Work Photos & Execution State Invariants', () => {
    test('23. Assigned Provider 1 can request presigned URL for JOB_AFTER_WORK while booking is in JOB_STARTED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.JOB_AFTER_WORK,
          entityId: bkgJobStarted.id,
          fileName: 'completed_installation.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 450,
        },
      });
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.json().storageKey, /media\/job_after_work/);
    });

    test('24. Assigned Provider 1 can request presigned URL for JOB_AFTER_WORK while booking is in JOB_EXTENDED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.JOB_AFTER_WORK,
          entityId: bkgJobExtended.id,
          fileName: 'extended_job_done.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 450,
        },
      });
      assert.strictEqual(res.statusCode, 200);
    });

    test('25. JOB_AFTER_WORK presign rejected if booking is still in PROVIDER_ON_THE_WAY', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.JOB_AFTER_WORK,
          entityId: bkgOnTheWay.id,
          fileName: 'premature_after_work.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 450,
        },
      });
      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /After-work photos can only be uploaded while the job is actively in progress/i);
    });

    test('26. JOB_AFTER_WORK presign rejected if booking is still in ARRIVED (not started yet)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.JOB_AFTER_WORK,
          entityId: bkgArrived.id,
          fileName: 'arrived_after_work.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 450,
        },
      });
      assert.strictEqual(res.statusCode, 400);
    });

    test('27. Provider 2 (unassigned) requesting JOB_AFTER_WORK returns 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider2}` },
        payload: {
          purpose: MediaPurpose.JOB_AFTER_WORK,
          entityId: bkgJobStarted.id,
          fileName: 'unassigned_after_work.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 450,
        },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    test('28. Customer requesting JOB_AFTER_WORK returns 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.JOB_AFTER_WORK,
          entityId: bkgJobStarted.id,
          fileName: 'customer_after_photo.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 450,
        },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    test('29. Enforces maximum 5 after-work photos per job', async () => {
      const bkgMaxAfter = {
        id: 'bkg_3l_max_after',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_STARTED,
        attachments: [1, 2, 3, 4, 5].map((i) => ({
          id: `att_after_${i}`,
          purpose: MediaPurpose.JOB_AFTER_WORK,
          fileUrl: `https://storage.localman.in/after_${i}.jpg`,
        })),
      };
      mockPrisma._store.bookings.set(bkgMaxAfter.id, { ...bkgMaxAfter, provider: provider1 });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.JOB_AFTER_WORK,
          entityId: bkgMaxAfter.id,
          fileName: 'sixth_after.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 450,
        },
      });
      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /Maximum 5 after-work photos allowed/i);
    });
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: Customer Review Photos & Lifecycle Binding
  // ---------------------------------------------------------------------------
  describe('5. Customer Review Photos & Lifecycle Binding', () => {
    test('30. Customer A can request presigned URL for REVIEW_PHOTO when booking is in JOB_COMPLETED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.REVIEW_PHOTO,
          entityId: bkgJobCompleted.id,
          fileName: 'review_photo_1.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 350,
        },
      });
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.json().storageKey, /media\/review_photo/);
    });

    test('31. Customer A can request presigned URL for REVIEW_PHOTO when booking is in PAYMENT_SETTLED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.REVIEW_PHOTO,
          entityId: bkgPaymentSettled.id,
          fileName: 'review_photo_settled.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 350,
        },
      });
      assert.strictEqual(res.statusCode, 200);
    });

    test('32. REVIEW_PHOTO presign rejected while booking is still in JOB_STARTED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          purpose: MediaPurpose.REVIEW_PHOTO,
          entityId: bkgJobStarted.id,
          fileName: 'premature_review.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 350,
        },
      });
      assert.strictEqual(res.statusCode, 400);
      assert.match(getErrorMessage(res), /Review photos can only be uploaded for completed bookings/i);
    });

    test('33. Provider requesting REVIEW_PHOTO returns 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          purpose: MediaPurpose.REVIEW_PHOTO,
          entityId: bkgJobCompleted.id,
          fileName: 'provider_review_photo.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 350,
        },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    test("34. Customer B requesting REVIEW_PHOTO for Customer A's booking returns 403 Forbidden", async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/presign',
        headers: { authorization: `Bearer ${tokenCustomerB}` },
        payload: {
          purpose: MediaPurpose.REVIEW_PHOTO,
          entityId: bkgJobCompleted.id,
          fileName: 'customer_b_review_photo.jpg',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 350,
        },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    test('35. Review submission with photos array persists and returns photos in GET review', async () => {
      const bkgToReview = {
        id: 'bkg_3l_review_test',
        bookingNumber: 'BKG-3L-REV-01',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
        attachments: [],
      };
      mockPrisma._store.bookings.set(bkgToReview.id, { ...bkgToReview, provider: provider1 });

      const photoUrls = [
        'https://storage.localman.in/reviews/clean_sink_1.jpg',
        'https://storage.localman.in/reviews/clean_sink_2.jpg',
      ];

      // Submit review with 2 photos
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${bkgToReview.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          rating: 5,
          title: 'Outstanding plumbing work',
          body: 'Manoj was fast, professional, and took care of all cleanup.',
          photos: photoUrls,
        },
      });
      assert.strictEqual(createRes.statusCode, 201);
      const createdData = createRes.json();
      const photosFromCreated = createdData.data?.photos ?? createdData.photos;
      assert.deepStrictEqual(photosFromCreated, photoUrls);

      // Verify GET review returns photos
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bkgToReview.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(getRes.statusCode, 200);
      const getReviewData = getRes.json();
      const photosFromGet = getReviewData.data?.photos ?? getReviewData.photos;
      assert.deepStrictEqual(photosFromGet, photoUrls);
    });

    test('36. Review update with photos updates photo list', async () => {
      const bkgToUpdateReview = {
        id: 'bkg_3l_update_review',
        bookingNumber: 'BKG-3L-REV-02',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
        attachments: [],
      };
      mockPrisma._store.bookings.set(bkgToUpdateReview.id, { ...bkgToUpdateReview, provider: provider1 });

      // Create initial review
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${bkgToUpdateReview.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          rating: 4,
          title: 'Good job',
          body: 'Solid work overall.',
          photos: ['https://storage.localman.in/reviews/old_pic.jpg'],
        },
      });
      assert.strictEqual(createRes.statusCode, 201);

      // Update with new photos
      const newPhotos = [
        'https://storage.localman.in/reviews/new_pic_1.jpg',
        'https://storage.localman.in/reviews/new_pic_2.jpg',
      ];
      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/bookings/${bkgToUpdateReview.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          rating: 5,
          photos: newPhotos,
        },
      });
      assert.strictEqual(updateRes.statusCode, 200);
      const updateData = updateRes.json();
      const photosFromUpdate = updateData.data?.photos ?? updateData.photos;
      assert.deepStrictEqual(photosFromUpdate, newPhotos);
    });

    test('37. Review submission with > 5 photos rejected with 422/400 validation error', async () => {
      const bkgExceedPhotos = {
        id: 'bkg_3l_exceed_photos',
        customerId: customerA.id,
        providerId: provider1.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
        attachments: [],
      };
      mockPrisma._store.bookings.set(bkgExceedPhotos.id, { ...bkgExceedPhotos, provider: provider1 });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${bkgExceedPhotos.id}/review`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          rating: 5,
          title: 'Too many pictures',
          body: 'Detailed review text.',
          photos: [1, 2, 3, 4, 5, 6].map((i) => `https://storage.localman.in/pic_${i}.jpg`),
        },
      });
      assert.ok(res.statusCode === 422 || res.statusCode === 400);
    });
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 6: Media Confirmation, Categorized Retrieval & Anti-IDOR
  // ---------------------------------------------------------------------------
  describe('6. Media Confirmation, Categorized Retrieval & Anti-IDOR', () => {
    let confirmedProblemPhotoId: string;
    let confirmedBeforePhotoId: string;
    let confirmedAfterPhotoId: string;

    test('38. Confirming media attachment persists attachment with unique ID', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/confirm',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          storageKey: `media/booking_problem_photo/${bkgOnTheWay.id}/1700000001_pipe.jpg`,
          fileUrl: `https://storage.localman.in/files/pipe.jpg`,
          purpose: MediaPurpose.BOOKING_PROBLEM_PHOTO,
          entityId: bkgOnTheWay.id,
          caption: 'Severe pipe leak under sink',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 300,
        },
      });
      assert.strictEqual(res.statusCode, 201);
      const data = res.json();
      assert.ok(data.id.startsWith('med_'));
      assert.strictEqual(data.caption, 'Severe pipe leak under sink');
      assert.strictEqual(data.uploaderRole, 'CUSTOMER');
      confirmedProblemPhotoId = data.id;
    });

    test('39. Confirmed booking media updates Booking.attachments snapshot', async () => {
      // Confirm a before-work photo as provider
      const resBefore = await app.inject({
        method: 'POST',
        url: '/api/v1/media/confirm',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          storageKey: `media/job_before_work/${bkgJobStarted.id}/1700000002_before.jpg`,
          fileUrl: `https://storage.localman.in/files/before.jpg`,
          purpose: MediaPurpose.JOB_BEFORE_WORK,
          entityId: bkgJobStarted.id,
          caption: 'Pre-existing wall cracks before mounting',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 400,
        },
      });
      assert.strictEqual(resBefore.statusCode, 201);
      confirmedBeforePhotoId = resBefore.json().id;

      // Confirm an after-work photo as provider
      const resAfter = await app.inject({
        method: 'POST',
        url: '/api/v1/media/confirm',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          storageKey: `media/job_after_work/${bkgJobStarted.id}/1700000003_after.jpg`,
          fileUrl: `https://storage.localman.in/files/after.jpg`,
          purpose: MediaPurpose.JOB_AFTER_WORK,
          entityId: bkgJobStarted.id,
          caption: 'Clean installation verified and tested',
          contentType: 'image/jpeg',
          fileSizeBytes: 1024 * 400,
        },
      });
      assert.strictEqual(resAfter.statusCode, 201);
      confirmedAfterPhotoId = resAfter.json().id;

      // Verify booking snapshot in store
      const booking = mockPrisma._store.bookings.get(bkgJobStarted.id);
      assert.ok(Array.isArray(booking.attachments));
      assert.ok(booking.attachments.length >= 2);
    });

    test('40. Customer can retrieve categorized booking media (GET /api/v1/bookings/:id/media)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bkgJobStarted.id}/media`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(res.statusCode, 200);
      const data = res.json();
      assert.strictEqual(data.bookingId, bkgJobStarted.id);
      assert.ok(Array.isArray(data.beforeWorkPhotos));
      assert.ok(Array.isArray(data.afterWorkPhotos));
      assert.ok(Array.isArray(data.problemPhotos));
      assert.ok(data.totalCount >= 2);
    });

    test('41. Categorized media properly segregates problemPhotos, beforeWorkPhotos, and afterWorkPhotos', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bkgJobStarted.id}/media`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(res.statusCode, 200);
      const data = res.json();

      for (const p of data.beforeWorkPhotos) {
        assert.strictEqual(p.purpose, MediaPurpose.JOB_BEFORE_WORK);
      }
      for (const p of data.afterWorkPhotos) {
        assert.strictEqual(p.purpose, MediaPurpose.JOB_AFTER_WORK);
      }
      for (const p of data.problemPhotos) {
        assert.strictEqual(p.purpose, MediaPurpose.BOOKING_PROBLEM_PHOTO);
      }
    });

    test('42. Shortcut endpoint GET /api/v1/media/booking/:id returns same categorized response', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/media/booking/${bkgJobStarted.id}`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().bookingId, bkgJobStarted.id);
    });

    test('43. Assigned Provider can retrieve categorized booking media', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bkgJobStarted.id}/media`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
      });
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.json().totalCount >= 2);
    });

    test('44. Admin / City Manager can inspect booking media across any booking (RBAC)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bkgJobStarted.id}/media`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.json().totalCount >= 2);
    });

    test("45. Customer B attempting to retrieve Customer A's booking media returns 403 Forbidden (Anti-IDOR)", async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bkgJobStarted.id}/media`,
        headers: { authorization: `Bearer ${tokenCustomerB}` },
      });
      assert.strictEqual(res.statusCode, 403);
      assert.match(getErrorMessage(res), /not authorized to view media for this booking/i);
    });

    test('46. Provider 2 (unassigned) attempting to retrieve booking media returns 403 Forbidden (Anti-IDOR)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bkgJobStarted.id}/media`,
        headers: { authorization: `Bearer ${tokenProvider2}` },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    test('47. Unauthenticated request to booking media returns 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bkgJobStarted.id}/media`,
      });
      assert.strictEqual(res.statusCode, 401);
    });

    test('48. Deleting media attachment succeeds for uploader', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/media/${confirmedProblemPhotoId}`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().success, true);
    });

    test('49. Deleting media attachment by unauthorized user returns 403 Forbidden', async () => {
      // Customer B attempts to delete Provider 1's before photo
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/media/${confirmedBeforePhotoId}`,
        headers: { authorization: `Bearer ${tokenCustomerB}` },
      });
      assert.strictEqual(res.statusCode, 403);
      assert.match(getErrorMessage(res), /only delete your own uploaded media/i);
    });

    test('50. Admin can delete any media attachment for content moderation', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/media/${confirmedAfterPhotoId}`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().success, true);
    });
  });
});
