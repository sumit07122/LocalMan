import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { AdminService } from '../src/modules/admin/admin.service.js';
import { RefundService } from '../src/modules/refunds/refund.service.js';
import { monitoringService } from '../src/modules/monitoring/monitoring.service.js';
import { safelyMaskKycDocumentNumber } from '../src/common/utils/kyc-masking.js';
import { isPincodeInPilotZone, getPilotConfig } from '../src/config/pilot.config.js';

describe('Phase 4M: Final Pilot Pre-Launch Validation & Owner Gate Closure', () => {
  let app: FastifyInstance;
  let mockPrisma: any;
  const adminService = new AdminService();
  const refundService = new RefundService();

  let tokenAdmin: string;
  let tokenCustomer: string;
  let tokenProvider: string;

  beforeEach(async () => {
    monitoringService.clear();
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;

    // Reset pilot zone env
    delete process.env.PILOT_ZONE_CONFIRMED;
    delete process.env.PILOT_CLUSTER_NAME;
    delete process.env.PILOT_CITY;
    delete process.env.PILOT_PINCODES;

    // Seed mock admin
    mockPrisma._store.users.set('usr_admin_pilot', {
      id: 'usr_admin_pilot',
      phoneNumber: '+919800000001',
      fullName: 'Pilot Operations Lead',
      isActive: true,
      userRoles: [{ roleId: 'ADMIN' }],
    });

    // Seed mock customer
    mockPrisma._store.users.set('usr_pilot_customer', {
      id: 'usr_pilot_customer',
      phoneNumber: '+919800000002',
      fullName: 'Beta Customer',
      isActive: true,
      userRoles: [{ roleId: 'CUSTOMER' }],
    });

    // Seed mock provider
    mockPrisma._store.users.set('usr_pilot_provider', {
      id: 'usr_pilot_provider',
      phoneNumber: '+919800000003',
      fullName: 'Verified Electrician',
      isActive: true,
      userRoles: [{ roleId: 'PROVIDER' }],
      provider: {
        id: 'prv_pilot_01',
        businessName: 'Local Electrician',
        verificationStatus: 'VERIFIED',
        isOnline: true,
        commissionRateOverride: null,
      },
    });

    mockPrisma._store.providers.set('prv_pilot_01', {
      id: 'prv_pilot_01',
      userId: 'usr_pilot_provider',
      businessName: 'Local Electrician',
      verificationStatus: 'VERIFIED',
      isOnline: true,
      commissionRateOverride: null,
      ratingAverage: 4.95,
      ratingCount: 18,
    });

    // Generate JWT tokens
    const signToken = (payload: any) => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const claims = Buffer.from(
        JSON.stringify({
          ...payload,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      const signature = crypto
        .createHmac('sha256', process.env.JWT_SECRET || 'localman-test-jwt-secret-min-32-chars-long')
        .update(`${header}.${claims}`)
        .digest('base64url');
      return `${header}.${claims}.${signature}`;
    };

    tokenAdmin = signToken({
      id: 'usr_admin_pilot',
      userId: 'usr_admin_pilot',
      role: 'ADMIN',
      roles: ['ADMIN'],
    });

    tokenCustomer = signToken({
      id: 'usr_pilot_customer',
      userId: 'usr_pilot_customer',
      role: 'CUSTOMER',
      roles: ['CUSTOMER'],
    });

    tokenProvider = signToken({
      id: 'usr_pilot_provider',
      userId: 'usr_pilot_provider',
      role: 'PROVIDER',
      roles: ['PROVIDER'],
    });

    app = await buildApp();
  });

  // ---------------------------------------------------------------------------
  // 1. GENUINE VS SIMULATED PILOT TELEMETRY (STAGE 2)
  // ---------------------------------------------------------------------------
  describe('1. Pilot Telemetry & Dynamic Readiness Verification', () => {
    it('1.1 Returns null for avgDispatchTimeSeconds when no real dispatch offers exist (no simulation)', async () => {
      const metrics = await adminService.getPilotMetrics();
      assert.strictEqual(
        metrics.kpis.avgDispatchTimeSeconds,
        null,
        'Must return null instead of a hardcoded or simulated number when no offers exist'
      );
    });

    it('1.2 Calculates real average dispatch duration in seconds from persisted timestamps', async () => {
      const t0 = new Date('2026-11-03T10:00:00Z');
      const t1 = new Date('2026-11-03T10:00:30Z'); // 30s
      const t2 = new Date('2026-11-03T10:01:10Z'); // 70s

      mockPrisma._store.dispatchOffers.set('off_real_1', {
        id: 'off_real_1',
        status: 'ACCEPTED',
        createdAt: t0,
        respondedAt: t1,
      });

      mockPrisma._store.dispatchOffers.set('off_real_2', {
        id: 'off_real_2',
        status: 'ACCEPTED',
        createdAt: t0,
        respondedAt: t2,
      });

      const metrics = await adminService.getPilotMetrics();
      // (30 + 70) / 2 = 50 seconds
      assert.strictEqual(metrics.kpis.avgDispatchTimeSeconds, 50);
    });

    it('1.3 Clearly distinguishes target cohort sizes from actual registered counts', async () => {
      const metrics = await adminService.getPilotMetrics();
      assert.strictEqual(typeof metrics.cohorts.customers.targetCohortSize, 'number');
      assert.strictEqual(typeof metrics.cohorts.customers.actualRegistered, 'number');
      assert.strictEqual(typeof metrics.cohorts.providers.targetCohortSize, 'number');
      assert.strictEqual(typeof metrics.cohorts.providers.verifiedOnline, 'number');
      assert.strictEqual(typeof metrics.cohorts.providers.verifiedOffline, 'number');
      assert.strictEqual(metrics.cohorts.customers.actualRegistered, 1); // 1 seeded customer
    });

    it('1.4 Dynamically derives isPilotReady=false when pilot zone is unconfirmed by owner', async () => {
      delete process.env.PILOT_ZONE_CONFIRMED;
      const metrics = await adminService.getPilotMetrics();
      assert.strictEqual(metrics.dataIntegrity.isPilotReady, false);
      assert.ok(metrics.dataIntegrity.readinessBlockers.includes('PILOT_ZONE_NOT_CONFIRMED'));
      assert.strictEqual(metrics.pilotZone.status, 'PILOT_ZONE_NOT_CONFIRMED');
    });

    it('1.5 Derives isPilotReady=true only when owner confirms zone and verified online providers exist', async () => {
      process.env.PILOT_ZONE_CONFIRMED = 'true';
      process.env.PILOT_CLUSTER_NAME = 'Test Owner Cluster';
      process.env.PILOT_PINCODES = '560034,560102';

      const metrics = await adminService.getPilotMetrics();
      assert.strictEqual(metrics.dataIntegrity.isPilotReady, true);
      assert.strictEqual(metrics.pilotZone.status, 'PILOT_ZONE_CONFIRMED');
      assert.strictEqual(metrics.pilotZone.clusterName, 'Test Owner Cluster');
      assert.deepStrictEqual(metrics.pilotZone.pincodes, ['560034', '560102']);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. KYC PRIVACY & SAFE MASKING (STAGE 3)
  // ---------------------------------------------------------------------------
  describe('2. KYC Privacy & Raw Document Protection', () => {
    it('2.1 Safely masks Aadhaar number (last 4 only) even when maskedDocumentNumber is null', () => {
      const rawAadhaar = '987654321234';
      const masked = safelyMaskKycDocumentNumber('AADHAAR_FRONT', rawAadhaar, null);
      assert.strictEqual(masked, 'XXXXXXXX1234');
      assert.ok(!masked.includes('98765432'), 'Raw Aadhaar prefix must never leak');
    });

    it('2.2 Safely masks PAN card even when maskedDocumentNumber is missing or empty', () => {
      const rawPan = 'ABCDE1234F';
      const masked = safelyMaskKycDocumentNumber('PAN_CARD', rawPan, '');
      assert.strictEqual(masked, 'ABXXXXXX4F');
      assert.ok(!masked.includes('CDE123'), 'Raw PAN body must never leak');
    });

    it('2.3 Returns safe placeholder when raw number is malformed or missing', () => {
      assert.strictEqual(safelyMaskKycDocumentNumber('AADHAAR_FRONT', '', null), 'XXXXXXXX****');
      assert.strictEqual(safelyMaskKycDocumentNumber('PAN_CARD', null, null), 'XXXXXXXX****');
    });

    it('2.4 Admin KYC queue endpoint never reveals unmasked document numbers', async () => {
      mockPrisma._store.providerDocuments.set('doc_unmasked_in_db', {
        id: 'doc_unmasked_in_db',
        providerId: 'prv_pilot_01',
        documentType: 'AADHAAR_FRONT',
        documentNumber: '999988881234', // Raw unmasked in DB
        maskedDocumentNumber: null, // Null in DB
        status: 'PENDING',
        provider: {
          user: { fullName: 'Test Provider', phoneNumber: '+919800000003', email: 'p@test.com' },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/kyc/pending',
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      const doc = body.data.find((d: any) => d.id === 'doc_unmasked_in_db');
      assert.ok(doc);
      assert.strictEqual(doc.documentNumber, 'XXXXXXXX1234');
      assert.ok(!JSON.stringify(body).includes('99998888'), 'Raw document number must never appear in response payload');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. REFUND IDEMPOTENCY & STABILITY (STAGE 4)
  // ---------------------------------------------------------------------------
  describe('3. Refund Idempotency & Gateway Operation Stability', () => {
    it('3.1 Repeated refund requests with same idempotency key return identical refund without duplicating', async () => {
      // Seed payment
      mockPrisma._store.payments.set('pay_refund_test', {
        id: 'pay_refund_test',
        bookingId: 'bkg_refund_test',
        amountPaisa: 100000, // ₹1,000
        status: 'CAPTURED',
        gateway: 'RAZORPAY',
        gatewayPaymentId: 'pay_rzp_test_123',
        refunds: [],
      });

      mockPrisma._store.bookings.set('bkg_refund_test', {
        id: 'bkg_refund_test',
        customerId: 'usr_pilot_customer',
        currentStatus: 'CONFIRMED',
      });

      const idempotencyKey = 'client_refund_unique_uuid_9999';

      // First refund request
      const refund1 = await refundService.processRefund({
        bookingId: 'bkg_refund_test',
        amountPaisa: 50000, // ₹500 partial refund
        reason: 'Customer requested cancellation',
        initiatedBy: 'usr_pilot_customer',
        idempotencyKey,
      });

      // Second identical request (retry simulation)
      const refund2 = await refundService.processRefund({
        bookingId: 'bkg_refund_test',
        amountPaisa: 50000,
        reason: 'Customer requested cancellation (retry)',
        initiatedBy: 'usr_pilot_customer',
        idempotencyKey,
      });

      assert.strictEqual(refund1.refundId, refund2.refundId, 'Must return same refund record on retry');
      assert.strictEqual(refund1.gatewayRefundId, refund2.gatewayRefundId, 'Gateway refund ID must remain identical');
      assert.strictEqual(refund1.refundAmountPaisa, 50000);
      assert.strictEqual(refund2.refundAmountPaisa, 50000);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. PILOT ZONE CONFIGURATION LAYER (STAGE 5)
  // ---------------------------------------------------------------------------
  describe('4. Pilot Zone Configuration Layer', () => {
    it('4.1 Rejects all pincodes when pilot zone is unconfirmed by project owner', () => {
      delete process.env.PILOT_ZONE_CONFIRMED;
      assert.strictEqual(isPincodeInPilotZone('560034'), false);
      assert.strictEqual(isPincodeInPilotZone('560102'), false);
    });

    it('4.2 Accepts confirmed pincodes and rejects unlisted pincodes when owner approves configuration', () => {
      process.env.PILOT_ZONE_CONFIRMED = 'true';
      process.env.PILOT_PINCODES = '560034, 560102, 560068';

      assert.strictEqual(isPincodeInPilotZone('560034'), true);
      assert.strictEqual(isPincodeInPilotZone('560102'), true);
      assert.strictEqual(isPincodeInPilotZone('560068'), true);
      assert.strictEqual(isPincodeInPilotZone('560001'), false); // Central Bangalore rejected
      assert.strictEqual(isPincodeInPilotZone('110001'), false); // Delhi rejected
    });
  });
});
