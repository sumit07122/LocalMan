import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { FinancialService } from '../src/modules/financial/financial.service.js';
import {
  getTaxConfig,
  calculateStatutoryTdsPaisa,
  isLiveDisbursementPermitted,
} from '../src/config/tax.config.js';
import { getPilotConfig, isPincodeInPilotZone } from '../src/config/pilot.config.js';
import { AdminService } from '../src/modules/admin/admin.service.js';
import { BookingService } from '../src/modules/bookings/booking.service.js';
import { DispatchService } from '../src/modules/dispatch/dispatch.service.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { ForbiddenError, ValidationError, ConflictError } from '../src/common/errors/app-error.js';

describe('Phase 4N: Financial Tax Rule Validation & Mathura Launch Configuration', () => {
  let adminService: AdminService;
  let financialService: FinancialService;
  let bookingService: BookingService;
  let dispatchService: DispatchService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;
    adminService = new AdminService();
    financialService = new FinancialService();
    bookingService = new BookingService();
    dispatchService = new DispatchService();

    // Reset tax environment
    delete process.env.TAX_POLICY_APPROVED_BY_CA;
    delete process.env.STATUTORY_TDS_RATE_PERCENT;
    delete process.env.NO_PAN_TDS_RATE_PERCENT;
    delete process.env.TDS_THRESHOLD_EXEMPTION_ENABLED;
    delete process.env.PILOT_ZONE_CONFIRMED;
    delete process.env.PILOT_ENFORCEMENT_ENABLED;
    delete process.env.PILOT_PINCODES;
    delete process.env.PILOT_CITY;
    delete process.env.PILOT_STATE;
    delete process.env.PILOT_CLUSTER_NAME;
  });

  // ---------------------------------------------------------------------------
  // 1. STATUTORY TAX (194-O) VS PLATFORM COMMISSION SEPARATION (STAGE 1)
  // ---------------------------------------------------------------------------
  describe('1. Statutory Tax (194-O) vs Platform Commission Separation', () => {
    it('1.1 Computes 0.1% Section 194-O statutory TDS following official 1 October 2024 amendment', () => {
      const config = getTaxConfig();
      assert.strictEqual(config.statutoryTdsRatePercent, 0.1, 'Default TDS rate must be 0.1% per amended Section 194-O');
      assert.strictEqual(config.platformCommissionPercent, 15.0, 'Platform commission must be canonical 15.0%');

      // Calculation on ₹1,000 (100,000 paisa)
      const res = calculateStatutoryTdsPaisa({
        grossAmountPaisa: 100000,
        hasVerifiedPan: true,
      });

      // 0.1% of ₹1,000 = ₹1.00 (100 paisa)
      assert.strictEqual(res.tdsRatePercent, 0.1);
      assert.strictEqual(res.tdsDeductionPaisa, 100);
      assert.strictEqual(res.isExempt, false);
      assert.ok(res.ruleCitation.includes('0.1%'));
    });

    it('1.2 Strictly separates platform commission (revenue) from statutory TDS (withheld tax)', () => {
      const grossAmountPaisa = 100000; // ₹1,000.00
      const financials = FinancialService.calculateFinancials({
        grossAmountPaisa,
        commissionPercentOverride: 15.0,
        tdsPercentOverride: 0.1,
      });

      // Platform commission: 15% of ₹1,000 = ₹150.00 (15,000 paisa) -> Platform Revenue
      assert.strictEqual(financials.platformFeePaisa, 15000);
      assert.strictEqual(financials.platformCommissionRate, 15.0);

      // Statutory TDS: 0.1% of ₹1,000 = ₹1.00 (100 paisa) -> Tax Withholding
      assert.strictEqual(financials.tdsDeductionPaisa, 100);
      assert.strictEqual(financials.tdsRate, 0.1);

      // Provider net earning: ₹1,000 - ₹150 - ₹1 = ₹849.00 (84,900 paisa)
      assert.strictEqual(financials.providerNetEarningPaisa, 84900);

      // Verify the sum invariant: Net Earning + Commission + TDS = Gross
      assert.strictEqual(
        financials.providerNetEarningPaisa + financials.platformFeePaisa + financials.tdsDeductionPaisa,
        grossAmountPaisa
      );
    });

    it('1.3 Enforces 5.0% higher withholding under Section 206AA when provider lacks PAN', () => {
      const res = calculateStatutoryTdsPaisa({
        grossAmountPaisa: 100000,
        hasVerifiedPan: false, // Provider failed to supply PAN
      });

      // 5.0% of ₹1,000 = ₹50.00 (5,000 paisa)
      assert.strictEqual(res.tdsRatePercent, 5.0);
      assert.strictEqual(res.tdsDeductionPaisa, 5000);
      assert.ok(res.ruleCitation.includes('Section 206AA'));
    });

    it('1.4 Supports Section 194-O(2) ₹5,00,000 threshold exemption when configured', () => {
      process.env.TDS_THRESHOLD_EXEMPTION_ENABLED = 'true';

      // Provider has PAN, cumulative gross = ₹2,00,000, booking = ₹1,000 (total ₹2,01,000 <= ₹5,00,000)
      const res = calculateStatutoryTdsPaisa({
        grossAmountPaisa: 100000,
        hasVerifiedPan: true,
        cumulativeAnnualGrossPaisa: 20000000,
      });

      assert.strictEqual(res.isExempt, true);
      assert.strictEqual(res.tdsRatePercent, 0.0);
      assert.strictEqual(res.tdsDeductionPaisa, 0);
      assert.ok(res.exemptionReason?.includes('exemption limit'));
    });

    it('1.5 Supports configurable pre-October 2024 1.0% TDS rate if specifically required by CA', () => {
      process.env.STATUTORY_TDS_RATE_PERCENT = '1.0';

      const config = getTaxConfig();
      assert.strictEqual(config.statutoryTdsRatePercent, 1.0);

      const res = calculateStatutoryTdsPaisa({
        grossAmountPaisa: 100000,
        hasVerifiedPan: true,
      });
      // 1.0% of ₹1,000 = ₹10.00 (1,000 paisa)
      assert.strictEqual(res.tdsDeductionPaisa, 1000);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. FINANCIAL SAFETY & SETTLEMENT DISBURSEMENT GATES (STAGE 2)
  // ---------------------------------------------------------------------------
  describe('2. Financial Safety & Settlement Disbursement Gates', () => {
    it('2.1 Blocks live payout disbursement when CA tax policy determination is pending', async () => {
      assert.strictEqual(isLiveDisbursementPermitted(), false);

      // Seed provider and payout
      mockPrisma._store.providers.set('prv_tax_test', {
        id: 'prv_tax_test',
        userId: 'usr_provider_01',
        verificationStatus: 'VERIFIED',
      });

      mockPrisma._store.providerPayouts.push({
        id: 'payout_test_01',
        providerId: 'prv_tax_test',
        netPayoutPaisa: 50000,
        status: 'PENDING',
      });

      // Attempting to mark payout as PAID without CA approval must throw ForbiddenError
      await assert.rejects(
        async () => {
          await financialService.updatePayoutStatus('payout_test_01', {
            status: 'PAID',
            payoutReference: 'UTR_BANK_123456',
          });
        },
        (err: any) => {
          assert.ok(err instanceof ForbiddenError);
          assert.ok(err.message.includes('Live provider payout disbursement is blocked'));
          return true;
        }
      );
    });

    it('2.2 Allows payout disbursement only after explicit owner CA approval flag is set', async () => {
      process.env.TAX_POLICY_APPROVED_BY_CA = 'true';
      assert.strictEqual(isLiveDisbursementPermitted(), true);

      mockPrisma._store.providers.set('prv_tax_test2', {
        id: 'prv_tax_test2',
        userId: 'usr_provider_02',
        verificationStatus: 'VERIFIED',
      });

      mockPrisma._store.providerWallets.set('prv_tax_test2', {
        id: 'wallet_tax_test2',
        providerId: 'prv_tax_test2',
        availableBalancePaisa: 0,
        pendingBalancePaisa: 50000,
        paidOutBalancePaisa: 0,
      });

      mockPrisma._store.providerPayouts.push({
        id: 'payout_test_02',
        providerId: 'prv_tax_test2',
        netPayoutPaisa: 50000,
        status: 'PENDING',
      });

      const updated = await financialService.updatePayoutStatus('payout_test_02', {
        status: 'PAID',
        payoutReference: 'UTR_BANK_APPROVED_999',
      });

      assert.strictEqual(updated.status, 'PAID');
      assert.strictEqual(updated.payoutReference, 'UTR_BANK_APPROVED_999');
    });

    it('2.3 Withheld taxes in ledger entries have remittanceStatus WITHHELD_IN_ESCROW_NOT_REMITTED', async () => {
      // Seed booking and payment
      mockPrisma._store.providers.set('prv_tax_settle', {
        id: 'prv_tax_settle',
        userId: 'usr_prv_settle',
        panNumber: 'ABCDE1234F',
        commissionRateOverride: null,
      });

      mockPrisma._store.bookings.set('bkg_tax_settle', {
        id: 'bkg_tax_settle',
        bookingNumber: 'BKG-2026-MATHURA-001',
        providerId: 'prv_tax_settle',
        totalAmountPaisa: 200000, // ₹2,000.00
        platformFeePaisa: 30000, // 15% = ₹300.00
        currentStatus: 'JOB_COMPLETED',
        provider: { id: 'prv_tax_settle', panNumber: 'ABCDE1234F', commissionRateOverride: null },
        service: { platformCommissionPercent: 15.0 },
      });

      mockPrisma._store.payments.set('pay_tax_settle', {
        id: 'pay_tax_settle',
        bookingId: 'bkg_tax_settle',
        amountPaisa: 200000,
        status: 'AUTHORIZED',
        gateway: 'RAZORPAY',
        booking: mockPrisma._store.bookings.get('bkg_tax_settle'),
      });

      await financialService.settleBookingPayment('pay_tax_settle', 'rzp_pay_tax_999');

      // Verify ledger entries
      const entries = Array.from(mockPrisma._store.walletLedgerEntries.values());
      const earningEntry = entries.find((e: any) => e.entryType === 'PROVIDER_NET_EARNING');
      assert.ok(earningEntry);
      assert.strictEqual(earningEntry.metadata.remittanceStatus, 'WITHHELD_IN_ESCROW_NOT_REMITTED');
      assert.strictEqual(earningEntry.metadata.taxPolicyStatus, 'TAX_POLICY_PENDING_CA_APPROVAL');
      assert.strictEqual(earningEntry.metadata.platformCommissionRate, 15.0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. MATHURA PILOT CONFIGURATION & GEOFENCE ENFORCEMENT (STAGE 3)
  // ---------------------------------------------------------------------------
  describe('3. Mathura Pilot Configuration & Geofence Enforcement', () => {
    it('3.1 Defaults to Mathura, Uttar Pradesh and status PILOT_ZONE_NOT_CONFIRMED', () => {
      const config = getPilotConfig();
      assert.strictEqual(config.city, 'Mathura');
      assert.strictEqual(config.state, 'Uttar Pradesh');
      assert.strictEqual(config.status, 'PILOT_ZONE_NOT_CONFIRMED');
      assert.strictEqual(config.isConfirmedByOwner, false);
      assert.strictEqual(config.pincodes.length, 0);
      assert.strictEqual(isPincodeInPilotZone('281001'), false);
    });

    it('3.2 Rejects booking creation when pilot enforcement is enabled and address is outside confirmed zone', async () => {
      process.env.PILOT_ENFORCEMENT_ENABLED = 'true';
      delete process.env.PILOT_ZONE_CONFIRMED; // Unconfirmed

      // Seed customer user, service, address
      mockPrisma._store.users.set('usr_cust_mathura', {
        id: 'usr_cust_mathura',
        role: 'CUSTOMER',
        isBlocked: false,
      });

      mockPrisma._store.addresses.set('addr_mathura_test', {
        id: 'addr_mathura_test',
        userId: 'usr_cust_mathura',
        city: 'Mathura',
        state: 'Uttar Pradesh',
        postalCode: '281001',
      });

      mockPrisma._store.serviceCategories.set('cat_01', {
        id: 'cat_01',
        name: 'Electrical',
        isActive: true,
      });

      mockPrisma._store.services.set('srv_elec_mathura', {
        id: 'srv_elec_mathura',
        name: 'Electrical Inspection',
        categoryId: 'cat_01',
        basePricePaisa: 50000,
        pricingModel: 'FIXED_PRICE',
        platformCommissionPercent: 15.0,
        isActive: true,
        category: { id: 'cat_01', name: 'Electrical', isActive: true },
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      const scheduledDate = futureDate.toISOString().split('T')[0];

      await assert.rejects(
        async () => {
          await bookingService.createBooking(
            { id: 'usr_cust_mathura', role: 'CUSTOMER', userId: 'usr_cust_mathura' } as any,
            {
              serviceId: 'srv_elec_mathura',
              addressId: 'addr_mathura_test',
              pricingModel: 'FIXED_PRICE',
              scheduledDate,
              scheduledTimeSlot: '10:00 - 12:00',
              jobDescription: 'Fix light wiring in living room',
            }
          );
        },
        (err: any) => {
          assert.ok(err instanceof ValidationError);
          assert.ok(err.message.includes('restricted to owner-confirmed pilot neighborhoods in Mathura'));
          return true;
        }
      );
    });

    it('3.3 Blocks automated dispatch when Mathura pilot zone is unconfirmed', async () => {
      process.env.PILOT_ENFORCEMENT_ENABLED = 'true';
      delete process.env.PILOT_ZONE_CONFIRMED;

      mockPrisma._store.bookings.set('bkg_dispatch_unconfirmed', {
        id: 'bkg_dispatch_unconfirmed',
        currentStatus: 'REQUESTED',
        providerId: null,
        address: { postalCode: '281001' },
        dispatchOffers: [],
      });

      await assert.rejects(
        async () => {
          await dispatchService.dispatchBooking('bkg_dispatch_unconfirmed');
        },
        (err: any) => {
          assert.ok(err instanceof ConflictError);
          assert.ok(err.message.includes('Mathura pilot zone is not yet confirmed'));
          return true;
        }
      );
    });

    it('3.4 Admin pilot metrics clearly display Mathura, unconfirmed status, and separate cohorts', async () => {
      const metrics = await adminService.getPilotMetrics();
      assert.strictEqual(metrics.pilotZone.city, 'Mathura');
      assert.strictEqual(metrics.pilotZone.state, 'Uttar Pradesh');
      assert.strictEqual(metrics.pilotZone.status, 'PILOT_ZONE_NOT_CONFIRMED');
      assert.strictEqual(metrics.financials.commissionRatePercent, 15.0);
      assert.strictEqual(metrics.financials.tdsRatePercent, 0.1);
      assert.strictEqual(metrics.financials.taxPolicyStatus, 'TAX_POLICY_PENDING_CA_APPROVAL');
      assert.strictEqual(metrics.financials.isTaxPolicyApprovedByCa, false);
      assert.ok(metrics.financials.statutoryReference.includes('Section 194-O'));

      // Cohorts distinction
      assert.strictEqual(metrics.cohorts.customers.targetCohortSize, 50);
      assert.strictEqual(typeof metrics.cohorts.customers.actualRegistered, 'number');
      assert.strictEqual(metrics.cohorts.providers.targetCohortSize, 10);
      assert.strictEqual(typeof metrics.cohorts.providers.totalRegistered, 'number');
    });
  });
});
