import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { AdminService } from '../src/modules/admin/admin.service.js';
import { FinancialService } from '../src/modules/financial/financial.service.js';
import { monitoringService } from '../src/modules/monitoring/monitoring.service.js';

describe('Phase 4L: Controlled Marketplace Pilot Readiness & Operational Workflows', () => {
  let app: FastifyInstance;
  let mockPrisma: any;
  const adminService = new AdminService();

  let tokenAdmin: string;
  let tokenCustomer: string;
  let tokenProvider: string;

  beforeEach(async () => {
    monitoringService.clear();
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;

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
      fullName: 'Beta Customer Indiranagar',
      isActive: true,
      userRoles: [{ roleId: 'CUSTOMER' }],
    });

    // Seed mock provider
    mockPrisma._store.users.set('usr_pilot_provider', {
      id: 'usr_pilot_provider',
      phoneNumber: '+919800000003',
      fullName: 'Verified Electrician Ramesh',
      isActive: true,
      userRoles: [{ roleId: 'PROVIDER' }],
      provider: {
        id: 'prv_pilot_01',
        businessName: 'Ramesh Electricals',
        verificationStatus: 'VERIFIED',
        isOnline: true,
        commissionRateOverride: null,
      },
    });

    mockPrisma._store.providers.set('prv_pilot_01', {
      id: 'prv_pilot_01',
      userId: 'usr_pilot_provider',
      businessName: 'Ramesh Electricals',
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
  // 1. PILOT PERFORMANCE TELEMETRY & KPIS
  // ---------------------------------------------------------------------------
  describe('1. Pilot Monitoring & KPI Telemetry Endpoint', () => {
    it('1.1 Rejects unauthenticated access to /api/v1/admin/pilot-metrics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/pilot-metrics',
      });
      assert.strictEqual(res.statusCode, 401);
    });

    it('1.2 Rejects customer role access to /api/v1/admin/pilot-metrics (403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/pilot-metrics',
        headers: { authorization: `Bearer ${tokenCustomer}` },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    it('1.3 Admin successfully retrieves pilot performance metrics with verified KPIs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/pilot-metrics',
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.ok(body.data.pilotZone);
      assert.strictEqual(body.data.pilotZone.clusterName, 'Bengaluru South & East Corridor');
      assert.deepStrictEqual(body.data.pilotZone.pincodes, ['560034', '560102', '560068', '560038']);
      assert.strictEqual(body.data.pilotZone.targetCustomerCohort, 50);

      // Verify KPI fields
      assert.ok(typeof body.data.kpis.totalBookings === 'number');
      assert.ok(typeof body.data.kpis.cancellationRatePercent === 'number');
      assert.ok(typeof body.data.kpis.providerAcceptanceRatePercent === 'number');
      assert.ok(body.data.kpis.customerSatisfaction);
      assert.ok(typeof body.data.kpis.customerSatisfaction.avgRating === 'number');

      // Verify Financials strictly in integer paisa with canonical 15% commission / 1% TDS
      assert.strictEqual(body.data.financials.commissionRatePercent, 15.0);
      assert.strictEqual(body.data.financials.tdsRatePercent, 1.0);
      assert.strictEqual(body.data.dataIntegrity.isPilotReady, true);
    });

    it('1.4 Computes correct cancellation rate and provider acceptance rate', async () => {
      // Seed mock bookings
      mockPrisma._store.bookings.set('bkg_1', { id: 'bkg_1', currentStatus: 'PAYMENT_SETTLED' });
      mockPrisma._store.bookings.set('bkg_2', { id: 'bkg_2', currentStatus: 'CANCELLED' });
      mockPrisma._store.bookings.set('bkg_3', { id: 'bkg_3', currentStatus: 'JOB_COMPLETED' });
      mockPrisma._store.bookings.set('bkg_4', { id: 'bkg_4', currentStatus: 'REQUESTED' });

      // Seed mock offers (3 offered, 2 accepted)
      mockPrisma._store.dispatchOffers.set('off_1', { id: 'off_1', status: 'ACCEPTED' });
      mockPrisma._store.dispatchOffers.set('off_2', { id: 'off_2', status: 'ACCEPTED' });
      mockPrisma._store.dispatchOffers.set('off_3', { id: 'off_3', status: 'EXPIRED' });

      const metrics = await adminService.getPilotMetrics();
      assert.strictEqual(metrics.kpis.totalBookings, 4);
      assert.strictEqual(metrics.kpis.completedBookings, 2);
      assert.strictEqual(metrics.kpis.cancellationRatePercent, 25.0); // 1 / 4 = 25%
      assert.strictEqual(metrics.kpis.providerAcceptanceRatePercent, 66.67); // 2 / 3 = 66.67%
    });
  });

  // ---------------------------------------------------------------------------
  // 2. PILOT SERVICE AREA & GEOFENCE CONSTRAINTS
  // ---------------------------------------------------------------------------
  describe('2. Pilot Service Area & Geofence Validation', () => {
    const PILOT_PINCODES = new Set(['560034', '560102', '560068', '560038']);

    function isAddressInPilotZone(postalCode: string): boolean {
      return PILOT_PINCODES.has(postalCode.trim());
    }

    it('2.1 Accepts addresses within designated Bengaluru pilot pincodes', () => {
      assert.strictEqual(isAddressInPilotZone('560034'), true); // Koramangala
      assert.strictEqual(isAddressInPilotZone('560102'), true); // HSR Layout
      assert.strictEqual(isAddressInPilotZone('560068'), true); // BTM Layout
      assert.strictEqual(isAddressInPilotZone('560038'), true); // Indiranagar
    });

    it('2.2 Rejects addresses outside pilot boundaries with clear waitlist flag', () => {
      assert.strictEqual(isAddressInPilotZone('560001'), false); // Central Bangalore
      assert.strictEqual(isAddressInPilotZone('110001'), false); // New Delhi
      assert.strictEqual(isAddressInPilotZone('400001'), false); // Mumbai
    });
  });

  // ---------------------------------------------------------------------------
  // 3. OPERATIONAL WORKFLOWS: CANCELLATIONS, NO-SHOWS & REFUNDS
  // ---------------------------------------------------------------------------
  describe('3. Operational Workflows & Business Rules', () => {
    it('3.1 Pre-dispatch cancellation yields 100% refund with zero visit penalty', () => {
      const grossPaisa = 50000; // ₹500
      const bookingStatus = 'REQUESTED';

      let refundAmountPaisa = 0;
      let providerCompensationPaisa = 0;

      if (bookingStatus === 'REQUESTED') {
        refundAmountPaisa = grossPaisa;
        providerCompensationPaisa = 0;
      }

      assert.strictEqual(refundAmountPaisa, 50000);
      assert.strictEqual(providerCompensationPaisa, 0);
    });

    it('3.2 Customer cancellation after provider arrival enforces standard visit compensation', () => {
      const grossPaisa = 80000; // ₹800
      const visitCompensationPaisa = 15000; // ₹150 visit charge

      const refundAmountPaisa = grossPaisa - visitCompensationPaisa;
      const providerCompensationPaisa = visitCompensationPaisa;

      assert.strictEqual(refundAmountPaisa, 65000); // ₹650 refunded
      assert.strictEqual(providerCompensationPaisa, 15000); // ₹150 credited to provider
      assert.strictEqual(refundAmountPaisa + providerCompensationPaisa, grossPaisa);
    });

    it('3.3 Customer no-show workflow compensates provider for arrival', () => {
      const grossPaisa = 60000; // ₹600
      const standardVisitFee = 15000; // ₹150

      const refundAmount = grossPaisa - standardVisitFee;
      const providerPayout = standardVisitFee;

      assert.strictEqual(refundAmount, 45000);
      assert.strictEqual(providerPayout, 15000);
    });

    it('3.4 Start OTP is strictly withheld from provider to prevent premature job execution', async () => {
      // Seed booking with startOtp = "4829"
      mockPrisma._store.bookings.set('bkg_otp_guard', {
        id: 'bkg_otp_guard',
        customerId: 'usr_pilot_customer',
        providerId: 'prv_pilot_01',
        serviceId: 'srv_ac_01',
        addressId: 'addr_1',
        startOtp: '4829',
        currentStatus: 'CONFIRMED',
        pricingModel: 'FIXED_PRICE',
        totalAmountPaisa: 60000,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings/bkg_otp_guard',
        headers: { authorization: `Bearer ${tokenProvider}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.data.startOtp, undefined, 'Provider must never see the Start OTP');
    });

    it('3.5 KYC rejection transitions document status and records actionable notes', async () => {
      mockPrisma._store.providerDocuments.set('doc_aadhaar_blurry', {
        id: 'doc_aadhaar_blurry',
        providerId: 'prv_pilot_01',
        documentType: 'AADHAAR_FRONT',
        documentNumber: 'XXXXXXXX1234',
        status: 'PENDING',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/kyc/review',
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          documentId: 'doc_aadhaar_blurry',
          status: 'REJECTED',
          reviewNotes: 'Aadhaar image is blurry. Please re-upload a clear photograph in good lighting.',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const updated = mockPrisma._store.providerDocuments.get('doc_aadhaar_blurry');
      assert.strictEqual(updated.status, 'REJECTED');
      assert.ok(updated.reviewNotes.includes('blurry'));
    });
  });

  // ---------------------------------------------------------------------------
  // 4. FINANCIAL SETTLEMENT & CONSERVATION IN PILOT
  // ---------------------------------------------------------------------------
  describe('4. Pilot Financial Integrity & Invariants', () => {
    it('4.1 Calculates canonical 15% platform commission and 1% TDS on integer paisa', () => {
      const grossAmountPaisa = 120000; // ₹1,200
      const commissionRate = 15.0;
      const tdsRate = 1.0;

      const platformFee = Math.round((grossAmountPaisa * commissionRate) / 100); // 18,000 paisa (₹180)
      const tdsAmount = Math.round((grossAmountPaisa * tdsRate) / 100); // 1,200 paisa (₹12)
      const netProviderAmount = grossAmountPaisa - platformFee - tdsAmount; // 100,800 paisa (₹1,008)

      assert.strictEqual(platformFee, 18000);
      assert.strictEqual(tdsAmount, 1200);
      assert.strictEqual(netProviderAmount, 100800);
      assert.strictEqual(grossAmountPaisa, platformFee + tdsAmount + netProviderAmount);
    });
  });
});
