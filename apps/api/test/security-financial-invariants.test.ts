import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { FinancialService } from '../src/modules/financial/financial.service.js';
import { AdminService } from '../src/modules/admin/admin.service.js';

describe('Phase 4F.1 — Security Audit Remediation: Financial Invariants & RBAC Tests', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  const adminService = new AdminService();

  // Role tokens
  let tokenAdmin: string;
  let tokenFinanceManager: string;
  let tokenCityManager: string;
  let tokenKycVerifier: string;
  let tokenProvider: string;
  let tokenCustomer: string;

  const testCategory = {
    id: 'cat_electrical_sec',
    name: 'Electrical Repairs',
    slug: 'electrical-sec',
    displayOrder: 1,
    isActive: true,
  };

  const testProvider = {
    id: 'prv_sec_01',
    userId: 'usr_prv_sec_01',
    businessName: 'Volt Fixers',
    verificationStatus: 'VERIFIED',
    isOnline: true,
  };

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;

    // Seed mock category and provider
    mockPrisma._store.serviceCategories.set(testCategory.id, { ...testCategory });
    mockPrisma._store.providers.set(testProvider.id, { ...testProvider });

    // Seed mock users with roles so auth middleware resolves permissions
    mockPrisma._store.users.set('usr_admin_sec', {
      id: 'usr_admin_sec',
      phoneNumber: '+919999900001',
      fullName: 'Super Admin',
      isActive: true,
      userRoles: [{ roleId: 'ADMIN' }],
    });
    mockPrisma._store.users.set('usr_fin_sec', {
      id: 'usr_fin_sec',
      phoneNumber: '+919999900002',
      fullName: 'Finance Manager',
      isActive: true,
      userRoles: [{ roleId: 'FINANCE_MANAGER' }],
    });
    mockPrisma._store.users.set('usr_cm_sec', {
      id: 'usr_cm_sec',
      phoneNumber: '+919999900003',
      fullName: 'City Manager',
      isActive: true,
      userRoles: [{ roleId: 'CITY_MANAGER' }],
    });
    mockPrisma._store.users.set('usr_kyc_sec', {
      id: 'usr_kyc_sec',
      phoneNumber: '+919999900004',
      fullName: 'KYC Verifier',
      isActive: true,
      userRoles: [{ roleId: 'KYC_VERIFIER' }],
    });
    mockPrisma._store.users.set('usr_prv_sec_01', {
      id: 'usr_prv_sec_01',
      phoneNumber: '+919999900005',
      fullName: 'Provider Pro',
      isActive: true,
      userRoles: [{ roleId: 'PROVIDER' }],
    });
    mockPrisma._store.users.set('usr_cust_sec', {
      id: 'usr_cust_sec',
      phoneNumber: '+919999900006',
      fullName: 'Customer Pooja',
      isActive: true,
      userRoles: [{ roleId: 'CUSTOMER' }],
    });

    app = await buildApp();
    await app.ready();

    tokenAdmin = app.jwt.sign({
      userId: 'usr_admin_sec',
      roles: ['ADMIN'],
      phoneNumber: '+919999900001',
    });

    tokenFinanceManager = app.jwt.sign({
      userId: 'usr_fin_sec',
      roles: ['FINANCE_MANAGER'],
      phoneNumber: '+919999900002',
    });

    tokenCityManager = app.jwt.sign({
      userId: 'usr_cm_sec',
      roles: ['CITY_MANAGER'],
      phoneNumber: '+919999900003',
    });

    tokenKycVerifier = app.jwt.sign({
      userId: 'usr_kyc_sec',
      roles: ['KYC_VERIFIER'],
      phoneNumber: '+919999900004',
    });

    tokenProvider = app.jwt.sign({
      userId: 'usr_prv_sec_01',
      roles: ['PROVIDER'],
      phoneNumber: '+919999900005',
    });

    tokenCustomer = app.jwt.sign({
      userId: 'usr_cust_sec',
      roles: ['CUSTOMER'],
      phoneNumber: '+919999900006',
    });
  });

  // ===========================================================================
  // 1. Financial Invariants & Canonical 15% Platform Fee / 1% TDS
  // ===========================================================================
  describe('1. Canonical Financial Formulas & Invariants', () => {
    it('should strictly enforce 15% commission baseline and 1% statutory TDS', () => {
      assert.strictEqual(FinancialService.DEFAULT_COMMISSION_PERCENT, 15.0);
      assert.strictEqual(FinancialService.STATUTORY_TDS_PERCENT, 1.0);
    });

    it('should maintain the financial invariant: Gross = Platform Fee + TDS + Net Earning across diverse amounts', () => {
      const testCases = [
        10000,   // ₹100
        14900,   // ₹149
        29900,   // ₹299
        49900,   // ₹499
        149900,  // ₹1,499
        299900,  // ₹2,999
        1000000, // ₹10,000
      ];

      for (const grossPaisa of testCases) {
        const result = FinancialService.calculateFinancials({ grossAmountPaisa: grossPaisa });

        // Integer paisa verification
        assert(Number.isInteger(result.platformFeePaisa), 'Platform fee must be integer paisa');
        assert(Number.isInteger(result.tdsDeductionPaisa), 'TDS deduction must be integer paisa');
        assert(Number.isInteger(result.providerNetEarningPaisa), 'Net earning must be integer paisa');

        // Rates
        assert.strictEqual(result.platformCommissionRate, 15.0);
        assert.strictEqual(result.tdsRate, 1.0);

        // Canonical 15% and 1% check
        const expectedFee = Math.round(grossPaisa * 0.15);
        const expectedTds = Math.round(grossPaisa * 0.01);
        const expectedNet = grossPaisa - expectedFee - expectedTds;

        assert.strictEqual(result.platformFeePaisa, expectedFee);
        assert.strictEqual(result.tdsDeductionPaisa, expectedTds);
        assert.strictEqual(result.providerNetEarningPaisa, expectedNet);

        // Conservation of funds invariant
        assert.strictEqual(
          result.platformFeePaisa + result.tdsDeductionPaisa + result.providerNetEarningPaisa,
          grossPaisa,
          `Conservation of funds failed for gross: ${grossPaisa}`
        );
      }
    });

    it('deriveBookingPricing should calculate base, platform fee, 18% GST, and total accurately', () => {
      const baseAmountPaisa = 100000; // ₹1,000 base
      const pricing = FinancialService.deriveBookingPricing({ baseAmountPaisa });

      assert.strictEqual(pricing.baseAmountPaisa, 100000);
      assert.strictEqual(pricing.platformFeePaisa, 15000); // 15% = ₹150
      assert.strictEqual(pricing.taxAmountPaisa, 18000);   // 18% GST = ₹180
      assert.strictEqual(pricing.totalAmountPaisa, 118000); // ₹1,180
      assert.strictEqual(pricing.providerEarningPaisa, 85000); // ₹850
      assert.strictEqual(pricing.platformCommissionPercent, 15.0);
    });
  });

  // ===========================================================================
  // 2. Catalog Service Commission Governance & RBAC
  // ===========================================================================
  describe('2. Catalog Commission RBAC & Audit Trails', () => {
    it('should allow CITY_MANAGER to create service with canonical 15.0% commission', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/catalog/services',
        headers: { authorization: `Bearer ${tokenCityManager}` },
        payload: {
          categoryId: testCategory.id,
          name: 'Ceiling Fan Installation',
          slug: 'fan-installation',
          pricingModel: 'FIXED_PRICE',
          basePricePaisa: 29900,
          estimatedDurationMinutes: 45,
          platformCommissionPercent: 15.0,
        },
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.platformCommissionPercent, 15.0);
    });

    it('should REJECT non-standard commission (e.g. 18%) when attempted by CITY_MANAGER (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/catalog/services',
        headers: { authorization: `Bearer ${tokenCityManager}` },
        payload: {
          categoryId: testCategory.id,
          name: 'Unauthorized Commission Service',
          slug: 'unauthorized-comm',
          pricingModel: 'FIXED_PRICE',
          basePricePaisa: 29900,
          estimatedDurationMinutes: 45,
          platformCommissionPercent: 18.0, // Non-standard override
        },
      });

      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, false);
      assert.match(body.error.message, /Non-standard platform commission can only be configured by Super Admin/);
    });

    it('should allow ADMIN to configure non-standard commission and record an AuditLog entry', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/catalog/services',
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          categoryId: testCategory.id,
          name: 'Special Commercial HVAC Service',
          slug: 'commercial-hvac',
          pricingModel: 'FIXED_PRICE',
          basePricePaisa: 99900,
          estimatedDurationMinutes: 120,
          platformCommissionPercent: 20.0, // Super admin override
        },
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.platformCommissionPercent, 20.0);

      // Verify AuditLog record was created in mockPrisma store
      const auditLogs = mockPrisma._store.auditLogs;
      const overrideLog = auditLogs.find((l: any) => l.action === 'SERVICE_COMMISSION_OVERRIDE_CREATED');
      assert(overrideLog, 'AuditLog for commission override must be created');
      assert.strictEqual(overrideLog.newState.platformCommissionPercent, 20.0);
      assert.strictEqual(overrideLog.newState.canonicalDefaultPercent, 15.0);
    });

    it('should REJECT customer or provider access to service creation (403 Forbidden)', async () => {
      const customerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/catalog/services',
        headers: { authorization: `Bearer ${tokenCustomer}` },
        payload: {
          categoryId: testCategory.id,
          name: 'Customer Attempt',
          slug: 'customer-attempt',
          pricingModel: 'FIXED_PRICE',
          basePricePaisa: 10000,
        },
      });
      assert.strictEqual(customerRes.statusCode, 403);

      const providerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/catalog/services',
        headers: { authorization: `Bearer ${tokenProvider}` },
        payload: {
          categoryId: testCategory.id,
          name: 'Provider Attempt',
          slug: 'provider-attempt',
          pricingModel: 'FIXED_PRICE',
          basePricePaisa: 10000,
        },
      });
      assert.strictEqual(providerRes.statusCode, 403);
    });
  });

  // ===========================================================================
  // 3. Administrative Route RBAC Hardening
  // ===========================================================================
  describe('3. Admin Routes Fine-Grained RBAC', () => {
    it('should forbid KYC_VERIFIER and CITY_MANAGER from executing financial adjustments', async () => {
      const kycRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/financial/adjustments',
        headers: { authorization: `Bearer ${tokenKycVerifier}` },
        payload: {
          providerId: testProvider.id,
          amountPaisa: 50000,
          direction: 'CREDIT',
          reason: 'Unauthorized bonus from KYC verifier',
        },
      });
      assert.strictEqual(kycRes.statusCode, 403, 'KYC_VERIFIER must be forbidden from financial adjustments');

      const cmRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/financial/adjustments',
        headers: { authorization: `Bearer ${tokenCityManager}` },
        payload: {
          providerId: testProvider.id,
          amountPaisa: 50000,
          direction: 'CREDIT',
          reason: 'Unauthorized bonus from City Manager',
        },
      });
      assert.strictEqual(cmRes.statusCode, 403, 'CITY_MANAGER must be forbidden from financial adjustments');
    });

    it('should allow ADMIN and FINANCE_MANAGER to access financial adjustments route', async () => {
      // Mock wallet in store
      mockPrisma._store.providerWallets.set('wlt_sec_01', {
        id: 'wlt_sec_01',
        providerId: testProvider.id,
        availableBalancePaisa: 100000,
        pendingBalancePaisa: 0,
        paidOutBalancePaisa: 0,
        currency: 'INR',
      });

      const adminRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/financial/adjustments',
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          providerId: testProvider.id,
          amountPaisa: 25000,
          direction: 'CREDIT',
          reason: 'Super Admin compensation adjustment',
        },
      });
      assert.strictEqual(adminRes.statusCode, 201);

      const finRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/financial/adjustments',
        headers: { authorization: `Bearer ${tokenFinanceManager}` },
        payload: {
          providerId: testProvider.id,
          amountPaisa: 10000,
          direction: 'CREDIT',
          reason: 'Finance Manager approved reconciliation credit',
        },
      });
      assert.strictEqual(finRes.statusCode, 201);
    });

    it('should forbid FINANCE_MANAGER from reviewing KYC documents', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/kyc/review',
        headers: { authorization: `Bearer ${tokenFinanceManager}` },
        payload: {
          documentId: 'doc_sec_01',
          status: 'APPROVED',
          reviewNotes: 'Finance manager should not review KYC',
        },
      });
      assert.strictEqual(res.statusCode, 403, 'FINANCE_MANAGER must be forbidden from KYC review');
    });
  });

  // ===========================================================================
  // 4. KYC PII Masking & Data Protection Compliance
  // ===========================================================================
  describe('4. KYC Document Masking (DPDPA & Aadhaar Compliance)', () => {
    it('getPendingKycDocuments should return masked document numbers', async () => {
      // Seed a document with raw PAN and masked value
      const mockDoc = {
        id: 'doc_kyc_pan_01',
        providerId: testProvider.id,
        documentType: 'PAN_CARD',
        documentNumber: 'ABCDE1234F',
        maskedDocumentNumber: 'XXXXX1234F',
        fileUrl: 'https://storage.localman.in/kyc/pan_01.jpg',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.providerDocuments.set(mockDoc.id, mockDoc);

      const pendingDocs = await adminService.getPendingKycDocuments();
      assert(pendingDocs.length > 0);

      const panDoc = pendingDocs.find((d: any) => d.id === 'doc_kyc_pan_01');
      assert(panDoc);
      // documentNumber must be masked as XXXXX1234F, not cleartext ABCDE1234F
      assert.strictEqual(panDoc.documentNumber, 'XXXXX1234F');
      assert.strictEqual(panDoc.maskedDocumentNumber, 'XXXXX1234F');
    });
  });
});
