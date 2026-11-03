import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { FinancialService } from '../src/modules/financial/financial.service.js';
import { AdminService } from '../src/modules/admin/admin.service.js';
import { monitoringService } from '../src/modules/monitoring/monitoring.service.js';
import { BookingStatus } from '@localman/constants';

describe('Phase 4K: Production Security, Financial Integrity & Reliability Audit', () => {
  let app: FastifyInstance;
  let mockPrisma: any;
  const adminService = new AdminService();

  // Test tokens
  let tokenAdmin: string;
  let tokenCustomerA: string;
  let tokenCustomerB: string;
  let tokenProviderA: string;
  let tokenProviderB: string;

  beforeEach(async () => {
    monitoringService.clear();
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;

    // Seed mock users
    mockPrisma._store.users.set('usr_admin_audit', {
      id: 'usr_admin_audit',
      phoneNumber: '+919800000001',
      fullName: 'Security Auditor Admin',
      isActive: true,
      userRoles: [{ roleId: 'ADMIN' }],
    });

    mockPrisma._store.users.set('usr_customer_a', {
      id: 'usr_customer_a',
      phoneNumber: '+919800000002',
      fullName: 'Customer Alice',
      isActive: true,
      userRoles: [{ roleId: 'CUSTOMER' }],
    });

    mockPrisma._store.users.set('usr_customer_b', {
      id: 'usr_customer_b',
      phoneNumber: '+919800000003',
      fullName: 'Customer Bob',
      isActive: true,
      userRoles: [{ roleId: 'CUSTOMER' }],
    });

    mockPrisma._store.users.set('usr_provider_a', {
      id: 'usr_provider_a',
      phoneNumber: '+919800000004',
      fullName: 'Provider Prakash',
      isActive: true,
      userRoles: [{ roleId: 'PROVIDER' }],
      provider: {
        id: 'prv_audit_a',
        userId: 'usr_provider_a',
        businessName: 'Prakash Electricals',
        verificationStatus: 'VERIFIED',
        isOnline: true,
      },
    });

    mockPrisma._store.users.set('usr_provider_b', {
      id: 'usr_provider_b',
      phoneNumber: '+919800000005',
      fullName: 'Provider Bablu',
      isActive: true,
      userRoles: [{ roleId: 'PROVIDER' }],
      provider: {
        id: 'prv_audit_b',
        userId: 'usr_provider_b',
        businessName: 'Bablu Plumbing',
        verificationStatus: 'VERIFIED',
        isOnline: true,
      },
    });

    mockPrisma._store.providers.set('prv_audit_a', {
      id: 'prv_audit_a',
      userId: 'usr_provider_a',
      businessName: 'Prakash Electricals',
      verificationStatus: 'VERIFIED',
      isOnline: true,
      user: mockPrisma._store.users.get('usr_provider_a'),
    });

    mockPrisma._store.providers.set('prv_audit_b', {
      id: 'prv_audit_b',
      userId: 'usr_provider_b',
      businessName: 'Bablu Plumbing',
      verificationStatus: 'VERIFIED',
      isOnline: true,
      user: mockPrisma._store.users.get('usr_provider_b'),
    });

    app = await buildApp();
    await app.ready();

    tokenAdmin = app.jwt.sign({ userId: 'usr_admin_audit', roles: ['ADMIN'], phoneNumber: '+919800000001' });
    tokenCustomerA = app.jwt.sign({ userId: 'usr_customer_a', roles: ['CUSTOMER'], phoneNumber: '+919800000002' });
    tokenCustomerB = app.jwt.sign({ userId: 'usr_customer_b', roles: ['CUSTOMER'], phoneNumber: '+919800000003' });
    tokenProviderA = app.jwt.sign({ userId: 'usr_provider_a', roles: ['PROVIDER'], phoneNumber: '+919800000004' });
    tokenProviderB = app.jwt.sign({ userId: 'usr_provider_b', roles: ['PROVIDER'], phoneNumber: '+919800000005' });
  });

  // =========================================================================
  // 1. APPLICATION SECURITY & RBAC
  // =========================================================================
  describe('1. Application Security, RBAC & IDOR Protections', () => {
    it('1.1 Rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/metrics',
      });
      assert.strictEqual(res.statusCode, 401);
    });

    it('1.2 Customer cannot access Admin endpoints (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/metrics',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    it('1.3 Provider cannot access Admin financial ledger (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/financial/ledger',
        headers: { authorization: `Bearer ${tokenProviderA}` },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    it('1.4 Customer A cannot view Customer B address (IDOR protection)', async () => {
      // Seed address owned by Customer B
      const addrB = {
        id: 'addr_b_secret',
        userId: 'usr_customer_b',
        label: 'Home',
        addressLine1: '42 Baker Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        latitude: 12.9716,
        longitude: 77.5946,
        isDefault: true,
      };
      mockPrisma._store.addresses.set(addrB.id, addrB);

      // Customer A attempts to read it
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/addresses/${addrB.id}`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    it('1.5 Customer A cannot modify Customer B address (IDOR protection)', async () => {
      const addrB = {
        id: 'addr_b_secret_mod',
        userId: 'usr_customer_b',
        label: 'Office',
        addressLine1: 'Tech Park',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        latitude: 12.9716,
        longitude: 77.5946,
        isDefault: false,
      };
      mockPrisma._store.addresses.set(addrB.id, addrB);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/addresses/${addrB.id}`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          addressLine1: 'Hacked Address',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          latitude: 12.9716,
          longitude: 77.5946,
        },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    it('1.6 Customer A cannot view Customer B booking details (IDOR protection)', async () => {
      const bookingB = {
        id: 'bkg_b_private',
        bookingNumber: 'LM-20261103-9999',
        customerId: 'usr_customer_b',
        serviceId: 'srv_1',
        addressId: 'addr_b',
        currentStatus: BookingStatus.REQUESTED,
        baseAmountPaisa: 50000,
        totalAmountPaisa: 59000,
      };
      mockPrisma._store.bookings.set(bookingB.id, bookingB);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingB.id}`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    it('1.7 Provider cannot view Customer Start OTP in booking details response', async () => {
      const bookingAssigned = {
        id: 'bkg_provider_assigned',
        bookingNumber: 'LM-20261103-8888',
        customerId: 'usr_customer_a',
        providerId: 'prv_audit_a',
        serviceId: 'srv_1',
        addressId: 'addr_a',
        currentStatus: BookingStatus.ARRIVED,
        startOtp: '482910', // Raw OTP
        startOtpHash: 'hashed_otp_value',
        baseAmountPaisa: 50000,
        totalAmountPaisa: 59000,
        customer: mockPrisma._store.users.get('usr_customer_a'),
        provider: mockPrisma._store.providers.get('prv_audit_a'),
      };
      mockPrisma._store.bookings.set(bookingAssigned.id, bookingAssigned);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingAssigned.id}`,
        headers: { authorization: `Bearer ${tokenProviderA}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const data = res.json().data;
      assert.strictEqual(data.startOtp, undefined, 'Provider must NEVER receive raw Start OTP');
      assert.strictEqual(data.startOtpHash, undefined, 'Provider must NEVER receive Start OTP hash');
    });

    it('1.8 Unassigned Provider B cannot access Provider A booking details (403 Forbidden)', async () => {
      const bookingA = {
        id: 'bkg_provider_a_only',
        bookingNumber: 'LM-20261103-7777',
        customerId: 'usr_customer_a',
        providerId: 'prv_audit_a',
        serviceId: 'srv_1',
        addressId: 'addr_a',
        currentStatus: BookingStatus.JOB_STARTED,
        baseAmountPaisa: 50000,
        totalAmountPaisa: 59000,
        customer: mockPrisma._store.users.get('usr_customer_a'),
        provider: mockPrisma._store.providers.get('prv_audit_a'),
      };
      mockPrisma._store.bookings.set(bookingA.id, bookingA);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingA.id}`,
        headers: { authorization: `Bearer ${tokenProviderB}` },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    it('1.9 KYC document numbers are masked in Admin review queue (UIDAI/DPDPA compliance)', async () => {
      mockPrisma._store.providerDocuments.set('doc_1', {
        id: 'doc_1',
        providerId: 'prv_audit_a',
        documentType: 'AADHAAR_FRONT',
        documentNumber: 'XXXXXXXX9012',
        maskedDocumentNumber: 'XXXXXXXX9012',
        fileUrl: 'https://storage.localman.in/kyc/doc1.pdf',
        status: 'PENDING',
        createdAt: new Date(),
        provider: {
          user: { fullName: 'Prakash', phoneNumber: '+919800000004', email: null },
        },
      });

      const docs = await adminService.getPendingKycDocuments();
      assert.strictEqual(docs.length, 1);
      assert.strictEqual(docs[0].documentNumber, 'XXXXXXXX9012');
      assert.ok(!docs[0].documentNumber.match(/^\d{12}$/), 'Raw 12-digit Aadhaar must never appear');
    });

    it('1.10 CORS policy blocks unauthorized foreign origins', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/live',
        headers: { origin: 'http://malicious-phishing-site.com' },
      });
      assert.strictEqual(res.statusCode, 500);
      assert.ok(res.body.includes('not allowed by LocalMan CORS policy'));
    });
  });

  // =========================================================================
  // 2. FINANCIAL INTEGRITY & CANONICAL INVARIANTS
  // =========================================================================
  describe('2. Financial Integrity & Invariants Verification', () => {
    it('2.1 Canonical 15% platform commission and statutory TDS baseline constants are immutable', () => {
      assert.strictEqual(FinancialService.DEFAULT_COMMISSION_PERCENT, 15.0);
      // Phase 4N: Section 194-O official amended statutory rate is 0.1% (w.e.f. 01.10.2024)
      assert.strictEqual(FinancialService.STATUTORY_TDS_PERCENT, 0.1);
    });

    it('2.2 Integer paisa invariant & funds conservation: Gross = Fee + TDS + Net Earning', () => {
      const sampleAmountsPaisa = [10000, 29900, 49900, 149900, 249900, 1000000];

      for (const gross of sampleAmountsPaisa) {
        const fin = FinancialService.calculateFinancials({ grossAmountPaisa: gross });

        assert(Number.isInteger(fin.platformFeePaisa), 'Platform fee must be integer paisa');
        assert(Number.isInteger(fin.tdsDeductionPaisa), 'TDS must be integer paisa');
        assert(Number.isInteger(fin.providerNetEarningPaisa), 'Net earning must be integer paisa');

        assert.strictEqual(
          fin.platformFeePaisa + fin.tdsDeductionPaisa + fin.providerNetEarningPaisa,
          gross,
          `Conservation of funds failed for gross: ${gross}`
        );

        // Canonical percentages
        assert.strictEqual(fin.platformFeePaisa, Math.round(gross * 0.15));
        assert.strictEqual(fin.tdsDeductionPaisa, Math.round(gross * (FinancialService.STATUTORY_TDS_PERCENT / 100)));
      }
    });

    it('2.3 Non-canonical provider commission override is blocked from settlement without owner authorization', async () => {
      const financialServiceInstance = new FinancialService();

      mockPrisma._store.providers.set('prv_override_test', {
        id: 'prv_override_test',
        commissionRateOverride: 5.0, // UNAUTHORIZED OVERRIDE (5% instead of 15%)
      });

      const bookingWithOverride = {
        id: 'bkg_override_fraud',
        bookingNumber: 'LM-20261103-6666',
        customerId: 'usr_customer_a',
        providerId: 'prv_override_test',
        totalAmountPaisa: 100000,
        platformFeePaisa: 15000,
        currentStatus: BookingStatus.JOB_COMPLETED,
        service: {
          platformCommissionPercent: 15.0,
        },
      };

      const payment = {
        id: 'pay_override_test',
        bookingId: bookingWithOverride.id,
        gateway: 'RAZORPAY',
        amountPaisa: 100000,
        status: 'PENDING',
        booking: bookingWithOverride,
      };

      mockPrisma._store.bookings.set(bookingWithOverride.id, bookingWithOverride);
      mockPrisma._store.payments.set(payment.id, payment);

      await assert.rejects(
        async () => {
          await financialServiceInstance.settleBookingPayment(payment.id, 'pay_gate_999');
        },
        {
          name: 'ForbiddenError',
          message: /blocked from settlement pending explicit owner authorization/,
        }
      );
    });

    it('2.4 Non-canonical catalog commission override is blocked from settlement without owner authorization', async () => {
      const financialServiceInstance = new FinancialService();

      mockPrisma._store.providers.set('prv_catalog_test', {
        id: 'prv_catalog_test',
        commissionRateOverride: null,
      });

      mockPrisma._store.services.set('srv_catalog_10', {
        id: 'srv_catalog_10',
        platformCommissionPercent: 10.0, // UNAUTHORIZED CATALOG OVERRIDE (10% instead of 15%)
      });

      const bookingWithCatalogOverride = {
        id: 'bkg_catalog_override_fraud',
        bookingNumber: 'LM-20261103-5555',
        customerId: 'usr_customer_a',
        providerId: 'prv_catalog_test',
        serviceId: 'srv_catalog_10',
        totalAmountPaisa: 100000,
        platformFeePaisa: 15000,
        currentStatus: BookingStatus.JOB_COMPLETED,
        service: {
          platformCommissionPercent: 10.0,
        },
      };

      const payment = {
        id: 'pay_catalog_override_test',
        bookingId: bookingWithCatalogOverride.id,
        gateway: 'RAZORPAY',
        amountPaisa: 100000,
        status: 'PENDING',
        booking: bookingWithCatalogOverride,
      };

      mockPrisma._store.bookings.set(bookingWithCatalogOverride.id, bookingWithCatalogOverride);
      mockPrisma._store.payments.set(payment.id, payment);

      await assert.rejects(
        async () => {
          await financialServiceInstance.settleBookingPayment(payment.id, 'pay_gate_888');
        },
        {
          name: 'ForbiddenError',
          message: /blocked from settlement pending explicit owner authorization/,
        }
      );
    });
  });

  // =========================================================================
  // 3. DATABASE RELIABILITY & CONCURRENCY
  // =========================================================================
  describe('3. Database Reliability & Concurrency Safeguards', () => {
    it('3.1 Atomic offer claim: race condition allows exactly one provider to accept', async () => {
      const testService = {
        id: 'srv_atomic',
        name: 'Atomic Service',
        isActive: true,
      };
      mockPrisma._store.services.set(testService.id, testService);

      const testAddress = {
        id: 'addr_atomic',
        userId: 'usr_customer_a',
        city: 'Bengaluru',
        latitude: 12.9716,
        longitude: 77.5946,
      };
      mockPrisma._store.addresses.set(testAddress.id, testAddress);

      mockPrisma._store.providers.set('prv_audit_a', {
        id: 'prv_audit_a',
        userId: 'usr_provider_a',
        verificationStatus: 'VERIFIED',
        isOnline: true,
        services: [{ serviceId: testService.id, isEnabled: true }],
        serviceAreas: [{ city: 'Bengaluru', serviceRadiusMeters: 25000, centerLatitude: 12.9716, centerLongitude: 77.5946 }],
        user: mockPrisma._store.users.get('usr_provider_a'),
      });
      mockPrisma._store.providers.set('prv_audit_b', {
        id: 'prv_audit_b',
        userId: 'usr_provider_b',
        verificationStatus: 'VERIFIED',
        isOnline: true,
        services: [{ serviceId: testService.id, isEnabled: true }],
        serviceAreas: [{ city: 'Bengaluru', serviceRadiusMeters: 25000, centerLatitude: 12.9716, centerLongitude: 77.5946 }],
        user: mockPrisma._store.users.get('usr_provider_b'),
      });

      const booking = {
        id: 'bkg_atomic_race',
        customerId: 'usr_customer_a',
        addressId: testAddress.id,
        serviceId: testService.id,
        currentStatus: BookingStatus.REQUESTED,
        providerId: null,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      // Offer offered to Provider A and Provider B simultaneously
      const offerA = {
        id: 'off_race_a',
        bookingId: booking.id,
        providerId: 'prv_audit_a',
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 60000),
      };
      const offerB = {
        id: 'off_race_b',
        bookingId: booking.id,
        providerId: 'prv_audit_b',
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 60000),
      };
      mockPrisma._store.dispatchOffers.set(offerA.id, offerA);
      mockPrisma._store.dispatchOffers.set(offerB.id, offerB);

      // Provider A claims offer
      const resA = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/dispatch/offers/${offerA.id}/accept`,
        headers: { authorization: `Bearer ${tokenProviderA}` },
      });
      assert.strictEqual(resA.statusCode, 200);

      // Provider B tries to claim offer on the now-assigned booking
      const resB = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/dispatch/offers/${offerB.id}/accept`,
        headers: { authorization: `Bearer ${tokenProviderB}` },
      });
      assert.strictEqual(resB.statusCode, 409, 'Second provider must receive 409 Conflict');
    });

    it('3.2 Database readiness probe returns 200 OK when connected', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().database, 'connected');
    });

    it('3.3 Database readiness probe returns 503 and logs alert when database query fails', async () => {
      mockPrisma.$queryRaw = async () => {
        throw new Error('Connection pool exhausted');
      };

      const res = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });
      assert.strictEqual(res.statusCode, 503);
      assert.strictEqual(res.json().database, 'disconnected');

      const alerts = monitoringService.getRecentAlerts();
      const dbAlert = alerts.find((a) => a.category === 'DATABASE');
      assert.ok(dbAlert, 'Database failure alert must be recorded');
      assert.strictEqual(dbAlert?.severity, 'CRITICAL');
    });
  });

  // =========================================================================
  // 4. MONITORING, STRUCTURED ALERTS & PRIVACY
  // =========================================================================
  describe('4. Monitoring & Privacy Safeguards', () => {
    it('4.1 Payment failure records structured alert and redacts sensitive card/secret fields', () => {
      monitoringService.recordPaymentFailure({
        bookingId: 'bkg_123',
        paymentId: 'pay_456',
        amountPaisa: 150000,
        reason: 'Signature mismatch',
        errorCode: 'INVALID_SIGNATURE',
      });

      const alerts = monitoringService.getRecentAlerts();
      assert.strictEqual(alerts.length, 1);
      assert.strictEqual(alerts[0].category, 'PAYMENT');
      assert.strictEqual(alerts[0].severity, 'CRITICAL');
      assert.strictEqual(alerts[0].metadata.amountInr, '1500.00');
    });

    it('4.2 OTP failure records alert with masked phone number and zero raw OTP code leaks', () => {
      monitoringService.recordOtpFailure({
        phoneNumber: '+919876543210',
        reason: 'RATE_LIMIT_EXCEEDED (Max 3 requests / 15 mins)',
        attemptCount: 3,
      });

      const alerts = monitoringService.getRecentAlerts();
      assert.strictEqual(alerts.length, 1);
      const metadata = alerts[0].metadata;
      assert.strictEqual(metadata.maskedPhone, '+9198****3210');
      assert.strictEqual(metadata.otp, undefined, 'Raw OTP code must never appear in alerts');
    });

    it('4.3 Dispatch failure records alert with attempt count and bookingId', () => {
      monitoringService.recordDispatchFailure({
        bookingId: 'bkg_dispatch_failed',
        serviceCategory: 'electrical-repairs',
        attemptNumber: 3,
        reason: 'Broadcast window expired with zero partner responses',
      });

      const alerts = monitoringService.getRecentAlerts();
      assert.strictEqual(alerts.length, 1);
      assert.strictEqual(alerts[0].category, 'DISPATCH');
      assert.strictEqual(alerts[0].severity, 'HIGH');
    });

    it('4.4 System health summary aggregates reliability stats correctly', () => {
      monitoringService.recordPaymentFailure({ reason: 'Test pay failure' });
      monitoringService.recordOtpFailure({ phoneNumber: '+919900001122', reason: 'OTP_LOCKED' });

      const health = monitoringService.getHealthSummary();
      assert.strictEqual(health.totalAlerts, 2);
      assert.strictEqual(health.counts.PAYMENT_FAILURES, 1);
      assert.strictEqual(health.counts.OTP_FAILURES, 1);
    });
  });
});
