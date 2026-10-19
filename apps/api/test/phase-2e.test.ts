import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { BookingStatus } from '@localman/constants';
import { FinancialService, financialService } from '../src/modules/financial/financial.service.js';

describe('Phase 2E — Financial Ledger, Provider Wallet & Payout Foundation', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  // Providers
  const providerUserVerified = {
    id: 'usr_prv_2e_ver',
    phoneNumber: '+919999900001',
    fullName: 'Apex Plumber',
    isActive: true,
    roles: ['PROVIDER'],
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const providerProfileVerified = {
    id: 'prv_2e_ver',
    userId: providerUserVerified.id,
    businessName: 'Apex Plumbing Co',
    verificationStatus: 'VERIFIED',
    isOnline: true,
  };

  const providerUserDraft = {
    id: 'usr_prv_2e_draft',
    phoneNumber: '+919999900002',
    fullName: 'Unverified Fixer',
    isActive: true,
    roles: ['PROVIDER'],
    userRoles: [{ roleId: 'PROVIDER' }],
  };
  const providerProfileDraft = {
    id: 'prv_2e_draft',
    userId: providerUserDraft.id,
    businessName: 'Unverified Fixes',
    verificationStatus: 'DRAFT',
    isOnline: false,
  };

  // Customer & Admin
  const customerUser = {
    id: 'usr_cust_2e_01',
    phoneNumber: '+919999900003',
    fullName: 'Customer Pooja',
    isActive: true,
    roles: ['CUSTOMER'],
    userRoles: [{ roleId: 'CUSTOMER' }],
  };
  const adminUser = {
    id: 'usr_admin_2e_01',
    phoneNumber: '+919999900004',
    fullName: 'Finance Admin',
    isActive: true,
    roles: ['ADMIN'],
    userRoles: [{ roleId: 'ADMIN' }, { roleId: 'FINANCE_MANAGER' }],
  };

  let tokenVerifiedProvider: string;
  let tokenDraftProvider: string;
  let tokenCustomer: string;
  let tokenAdmin: string;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;

    // Seed users
    mockPrisma._store.users.set(providerUserVerified.id, providerUserVerified);
    mockPrisma._store.users.set(providerUserDraft.id, providerUserDraft);
    mockPrisma._store.users.set(customerUser.id, customerUser);
    mockPrisma._store.users.set(adminUser.id, adminUser);

    // Seed providers
    mockPrisma._store.providers.set(providerProfileVerified.id, providerProfileVerified);
    mockPrisma._store.providers.set(providerProfileDraft.id, providerProfileDraft);

    app = await buildApp();
    await app.ready();

    tokenVerifiedProvider = app.jwt.sign({
      userId: providerUserVerified.id,
      roles: providerUserVerified.roles,
      phoneNumber: providerUserVerified.phoneNumber,
    });
    tokenDraftProvider = app.jwt.sign({
      userId: providerUserDraft.id,
      roles: providerUserDraft.roles,
      phoneNumber: providerUserDraft.phoneNumber,
    });
    tokenCustomer = app.jwt.sign({
      userId: customerUser.id,
      roles: customerUser.roles,
      phoneNumber: customerUser.phoneNumber,
    });
    tokenAdmin = app.jwt.sign({
      userId: adminUser.id,
      roles: adminUser.roles,
      phoneNumber: adminUser.phoneNumber,
    });
  });

  // ===========================================================================
  // 1. Authoritative Financial Formulas & Canonical 15% Rate Resolution
  // ===========================================================================

  it('1. should compute canonical 15% platform commission and 1% statutory TDS', () => {
    // Base Gross: ₹1,000 (100,000 paisa)
    const res = FinancialService.calculateFinancials({
      grossAmountPaisa: 100000,
    });

    assert.equal(res.grossAmountPaisa, 100000);
    assert.equal(res.platformCommissionRate, 15.0);
    assert.equal(res.platformFeePaisa, 15000, '15% of 100,000 = 15,000 paisa');
    assert.equal(res.tdsRate, 1.0);
    assert.equal(res.tdsDeductionPaisa, 1000, '1% of 100,000 = 1,000 paisa');
    assert.equal(
      res.providerNetEarningPaisa,
      100000 - 15000 - 1000, // 84,000 paisa (₹840)
      'Net earning = gross - commission - TDS'
    );
  });

  it('2. should support custom category commission rates (e.g. 18% for Deep Cleaning)', () => {
    const res = FinancialService.calculateFinancials({
      grossAmountPaisa: 250000, // ₹2,500
      commissionPercentOverride: 18.0,
    });

    assert.equal(res.platformCommissionRate, 18.0);
    assert.equal(res.platformFeePaisa, 45000, '18% of 250,000 = 45,000 paisa');
    assert.equal(res.tdsDeductionPaisa, 2500, '1% of 250,000 = 2,500 paisa');
    assert.equal(res.providerNetEarningPaisa, 250000 - 45000 - 2500); // 202,500 paisa
  });

  it('3. should never use floating point for money units and prevent negative earnings', () => {
    const res = FinancialService.calculateFinancials({
      grossAmountPaisa: -500,
    });
    assert.equal(res.grossAmountPaisa, 0);
    assert.equal(res.providerNetEarningPaisa, 0);
  });

  // ===========================================================================
  // 2. Provider Wallet & Payment Settlement
  // ===========================================================================

  it('4. should initialize empty wallet for a provider with 0 balances', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/wallet',
      headers: { authorization: `Bearer ${tokenVerifiedProvider}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.availableBalancePaisa, 0);
    assert.equal(body.data.pendingBalancePaisa, 0);
    assert.equal(body.data.paidOutBalancePaisa, 0);
    assert.equal(body.data.totalEarnedPaisa, 0);
    assert.equal(body.data.walletLedger.length, 0);
  });

  it('5. should settle payment, credit available balance, and record immutable ledger entry', async () => {
    // 1. Create completed booking for ₹2000 (200000 paisa)
    const booking = {
      id: 'bkg_2e_settle_01',
      bookingNumber: 'BK-2E-001',
      customerId: customerUser.id,
      providerId: providerProfileVerified.id,
      serviceId: 'srv_plumb_01',
      totalAmountPaisa: 200000,
      platformFeePaisa: 30000, // 15%
      currentStatus: BookingStatus.JOB_COMPLETED,
      service: { name: 'Pipe Repair', platformCommissionPercent: 15.0 },
    };
    mockPrisma._store.bookings.set(booking.id, booking);

    // 2. Create initiated payment
    const payment = await mockPrisma.payment.create({
      data: {
        id: 'pay_2e_001',
        bookingId: booking.id,
        amountPaisa: 200000,
        currency: 'INR',
        gateway: 'RAZORPAY',
        status: 'INITIATED',
        idempotencyKey: 'pay_idem_2e_001',
      },
    });

    // 3. Confirm payment
    const confirmRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/confirm',
      payload: {
        paymentId: payment.id,
        gatewayPaymentId: 'pay_rzp_mock_2e_99',
      },
    });

    assert.equal(confirmRes.statusCode, 200);

    // 4. Verify wallet balance credited with net earning:
    // Gross: 200,000 | 15% Comm: 30,000 | 1% TDS: 2,000 | Net: 168,000 paisa (₹1,680)
    const wallet = await financialService.getProviderWalletSummary(providerProfileVerified.id);
    assert.equal(wallet.availableBalancePaisa, 168000);
    assert.equal(wallet.totalEarnedPaisa, 168000);
    assert.equal(wallet.pendingBalancePaisa, 0);

    // 5. Verify ledger entry
    const ledger = await mockPrisma.walletLedgerEntry.findMany({
      where: { providerId: providerProfileVerified.id },
    });
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].entryType, 'PROVIDER_NET_EARNING');
    assert.equal(ledger[0].direction, 'CREDIT');
    assert.equal(ledger[0].amountPaisa, 168000);
    assert.equal(ledger[0].resultingAvailablePaisa, 168000);

    // 6. Verify payout record with stored applied rates
    const payouts = await mockPrisma.providerPayout.findMany({
      where: { providerId: providerProfileVerified.id },
    });
    assert.equal(payouts.length, 1);
    assert.equal(payouts[0].appliedCommissionRate, 15.0);
    assert.equal(payouts[0].appliedTdsRate, 1.0);
    assert.equal(payouts[0].netPayoutPaisa, 168000);
  });

  it('6. should be idempotent: duplicate payment capture does not double credit wallet', async () => {
    // Settle once
    const booking = {
      id: 'bkg_2e_idem_01',
      bookingNumber: 'BK-2E-IDEM',
      customerId: customerUser.id,
      providerId: providerProfileVerified.id,
      serviceId: 'srv_plumb_01',
      totalAmountPaisa: 200000,
      platformFeePaisa: 30000,
      currentStatus: BookingStatus.JOB_COMPLETED,
      service: { name: 'Pipe Repair', platformCommissionPercent: 15.0 },
    };
    mockPrisma._store.bookings.set(booking.id, booking);

    const payment = await mockPrisma.payment.create({
      data: {
        id: 'pay_2e_idem',
        bookingId: booking.id,
        amountPaisa: 200000,
        currency: 'INR',
        gateway: 'RAZORPAY',
        status: 'INITIATED',
        idempotencyKey: 'pay_idem_key_002',
      },
    });

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/confirm',
      payload: { paymentId: payment.id, gatewayPaymentId: 'rzp_pay_idem_1' },
    });
    assert.equal(res1.statusCode, 200);

    // Settle twice
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/confirm',
      payload: { paymentId: payment.id, gatewayPaymentId: 'rzp_pay_idem_1' },
    });
    assert.equal(res2.statusCode, 200);

    const wallet = await financialService.getProviderWalletSummary(providerProfileVerified.id);
    assert.equal(wallet.availableBalancePaisa, 168000, 'Balance must not double credit');

    const ledger = await mockPrisma.walletLedgerEntry.findMany({
      where: { providerId: providerProfileVerified.id },
    });
    assert.equal(ledger.length, 1, 'Ledger must not have duplicate entries');
  });

  // ===========================================================================
  // 3. Payout Withdrawal Lifecycle & Security
  // ===========================================================================

  it('7. should reject withdrawal request if provider is not VERIFIED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/wallet/payouts',
      headers: { authorization: `Bearer ${tokenDraftProvider}` },
      payload: { amountPaisa: 50000 },
    });

    assert.equal(res.statusCode, 403, 'Unverified provider must be blocked');
  });

  it('8. should reject withdrawal request below minimum ₹100 (10,000 paisa)', async () => {
    // Fund provider wallet first with ₹500
    await mockPrisma.providerWallet.create({
      data: {
        providerId: providerProfileVerified.id,
        availableBalancePaisa: 50000,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/wallet/payouts',
      headers: { authorization: `Bearer ${tokenVerifiedProvider}` },
      payload: { amountPaisa: 5000 }, // ₹50
    });

    assert.equal(res.statusCode, 422, 'Below min amount must be rejected with 422');
  });

  it('9. should reject withdrawal request exceeding available balance', async () => {
    await mockPrisma.providerWallet.create({
      data: {
        providerId: providerProfileVerified.id,
        availableBalancePaisa: 50000, // ₹500
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/wallet/payouts',
      headers: { authorization: `Bearer ${tokenVerifiedProvider}` },
      payload: { amountPaisa: 500000 }, // ₹5,000
    });

    assert.equal(res.statusCode, 422, 'Exceeding balance must be rejected with 422');
  });

  it('10. should successfully reserve funds and transition to PROCESSING', async () => {
    // Set available balance to 168000 (₹1,680)
    await mockPrisma.providerWallet.create({
      data: {
        providerId: providerProfileVerified.id,
        availableBalancePaisa: 168000,
      },
    });

    // Request ₹1000 (100000 paisa)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/wallet/payouts',
      headers: {
        authorization: `Bearer ${tokenVerifiedProvider}`,
        'idempotency-key': 'payout_idem_req_001',
      },
      payload: {
        amountPaisa: 100000,
        payoutMode: 'BANK_TRANSFER',
      },
    });

    assert.equal(res.statusCode, 201);
    const payout = JSON.parse(res.payload).data;
    assert.equal(payout.status, 'PROCESSING');
    assert.equal(payout.netPayoutPaisa, 100000);

    // Verify wallet atomic movement: available: 68,000, pending: 100,000
    const wallet = await financialService.getProviderWalletSummary(providerProfileVerified.id);
    assert.equal(wallet.availableBalancePaisa, 68000);
    assert.equal(wallet.pendingBalancePaisa, 100000);
    assert.equal(wallet.paidOutBalancePaisa, 0);

    // Invariant check: available + pending = 168,000
    assert.equal(
      wallet.availableBalancePaisa + wallet.pendingBalancePaisa + wallet.paidOutBalancePaisa,
      168000
    );

    // Check ledger entry
    const ledger = await mockPrisma.walletLedgerEntry.findMany({
      where: { providerId: providerProfileVerified.id },
    });
    const debitEntry = ledger.find((e: any) => e.entryType === 'PAYOUT_PROCESSING');
    assert.ok(debitEntry);
    assert.equal(debitEntry.direction, 'DEBIT');
    assert.equal(debitEntry.amountPaisa, 100000);
    assert.equal(debitEntry.resultingAvailablePaisa, 68000);
    assert.equal(debitEntry.resultingPendingPaisa, 100000);
  });

  it('11. should be idempotent: duplicate withdrawal request does not double debit', async () => {
    await mockPrisma.providerWallet.create({
      data: {
        providerId: providerProfileVerified.id,
        availableBalancePaisa: 168000,
      },
    });

    // Request 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/wallet/payouts',
      headers: {
        authorization: `Bearer ${tokenVerifiedProvider}`,
        'idempotency-key': 'payout_idem_dup_test',
      },
      payload: { amountPaisa: 100000 },
    });
    assert.equal(res1.statusCode, 201);

    // Request 2 (Duplicate)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/wallet/payouts',
      headers: {
        authorization: `Bearer ${tokenVerifiedProvider}`,
        'idempotency-key': 'payout_idem_dup_test',
      },
      payload: { amountPaisa: 100000 },
    });
    assert.equal(res2.statusCode, 201);

    const wallet = await financialService.getProviderWalletSummary(providerProfileVerified.id);
    assert.equal(wallet.availableBalancePaisa, 68000, 'Must not debit twice');
    assert.equal(wallet.pendingBalancePaisa, 100000, 'Pending must remain 100,000');
  });

  it('12. should complete payout when status is marked PAID', async () => {
    // Setup wallet with 100,000 pending and a PROCESSING payout
    const wallet = await mockPrisma.providerWallet.create({
      data: {
        providerId: providerProfileVerified.id,
        availableBalancePaisa: 68000,
        pendingBalancePaisa: 100000,
        paidOutBalancePaisa: 0,
      },
    });

    const payout = await mockPrisma.providerPayout.create({
      data: {
        id: 'pout_proc_01',
        providerId: providerProfileVerified.id,
        grossAmountPaisa: 100000,
        platformDeductionPaisa: 0,
        tdsDeductionPaisa: 0,
        netPayoutPaisa: 100000,
        status: 'PROCESSING',
      },
    });

    // Admin marks as PAID
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/financial/payouts/${payout.id}/status`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: {
        status: 'PAID',
        payoutReference: 'UTR_HDFC_99887711',
      },
    });

    assert.equal(res.statusCode, 200);

    // Verify wallet state: pending: 0, paidOut: 100,000, available: 68,000
    const updatedWallet = await financialService.getProviderWalletSummary(providerProfileVerified.id);
    assert.equal(updatedWallet.availableBalancePaisa, 68000);
    assert.equal(updatedWallet.pendingBalancePaisa, 0);
    assert.equal(updatedWallet.paidOutBalancePaisa, 100000);
    assert.equal(updatedWallet.totalEarnedPaisa, 168000);

    // Invariant check: available + pending + paidOut = 168,000
    assert.equal(
      updatedWallet.availableBalancePaisa +
        updatedWallet.pendingBalancePaisa +
        updatedWallet.paidOutBalancePaisa,
      168000
    );
  });

  it('13. should safely reverse funds to available balance when payout FAILS', async () => {
    // Setup wallet with 0 available, 68,000 pending, and 100,000 paidOut
    await mockPrisma.providerWallet.create({
      data: {
        providerId: providerProfileVerified.id,
        availableBalancePaisa: 0,
        pendingBalancePaisa: 68000,
        paidOutBalancePaisa: 100000,
      },
    });

    const payout = await mockPrisma.providerPayout.create({
      data: {
        id: 'pout_fail_test_01',
        providerId: providerProfileVerified.id,
        grossAmountPaisa: 68000,
        platformDeductionPaisa: 0,
        tdsDeductionPaisa: 0,
        netPayoutPaisa: 68000,
        status: 'PROCESSING',
      },
    });

    // Mark payout as FAILED (e.g. invalid bank IFSC)
    const failRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/financial/payouts/${payout.id}/status`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: {
        status: 'FAILED',
        failureReason: 'Account beneficiary name mismatch',
      },
    });
    assert.equal(failRes.statusCode, 200);

    // Verify funds restored to available balance
    const wallet = await financialService.getProviderWalletSummary(providerProfileVerified.id);
    assert.equal(wallet.availableBalancePaisa, 68000, 'Funds must be restored to available balance');
    assert.equal(wallet.pendingBalancePaisa, 0, 'Pending balance cleared');
    assert.equal(wallet.paidOutBalancePaisa, 100000);
    assert.equal(wallet.totalEarnedPaisa, 168000);
  });

  // ===========================================================================
  // 4. Admin Financial Visibility & Manual Adjustments
  // ===========================================================================

  it('14. should allow admin to inspect provider wallet and ledger', async () => {
    await mockPrisma.providerWallet.create({
      data: {
        providerId: providerProfileVerified.id,
        availableBalancePaisa: 68000,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/financial/wallets/${providerProfileVerified.id}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.data.providerId, providerProfileVerified.id);
    assert.equal(body.data.availableBalancePaisa, 68000);
    assert.ok(Array.isArray(body.data.walletLedger));
  });

  it('15. should block non-admin from accessing admin financial endpoints', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/financial/wallets/${providerProfileVerified.id}`,
      headers: { authorization: `Bearer ${tokenVerifiedProvider}` },
    });

    assert.equal(res.statusCode, 403, 'Provider cannot access admin endpoints');
  });

  it('16. should execute audited admin manual credit adjustment with reason', async () => {
    await mockPrisma.providerWallet.create({
      data: {
        providerId: providerProfileVerified.id,
        availableBalancePaisa: 68000,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/financial/adjustments',
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: {
        providerId: providerProfileVerified.id,
        amountPaisa: 25000, // ₹250 compensation credit
        direction: 'CREDIT',
        reason: 'Compensation for customer cancellation inconvenience',
      },
    });

    assert.equal(res.statusCode, 201);

    // Verify balance increased by 25,000 paisa: 68,000 + 25,000 = 93,000
    const wallet = await financialService.getProviderWalletSummary(providerProfileVerified.id);
    assert.equal(wallet.availableBalancePaisa, 93000);

    // Verify ledger entry
    const ledger = await mockPrisma.walletLedgerEntry.findMany({
      where: { providerId: providerProfileVerified.id, entryType: 'ADMIN_ADJUSTMENT' },
    });
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].direction, 'CREDIT');
    assert.equal(ledger[0].amountPaisa, 25000);
    assert.match(ledger[0].description, /Compensation for customer cancellation/);

    // Verify audit log created
    assert.ok(mockPrisma._store.auditLogs.some((l: any) => l.action === 'ADMIN_WALLET_ADJUSTMENT_CREDIT'));
  });

  it('17. should reject admin manual debit if amount exceeds available balance', async () => {
    await mockPrisma.providerWallet.create({
      data: {
        providerId: providerProfileVerified.id,
        availableBalancePaisa: 50000,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/financial/adjustments',
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: {
        providerId: providerProfileVerified.id,
        amountPaisa: 999999, // Exceeds balance
        direction: 'DEBIT',
        reason: 'Penalty deduction exceeding balance',
      },
    });

    assert.equal(res.statusCode, 422, 'Debit exceeding balance must fail');
  });

  it('18. should provide paginated ledger query with direction filter', async () => {
    await mockPrisma.providerWallet.create({
      data: {
        providerId: providerProfileVerified.id,
        availableBalancePaisa: 50000,
      },
    });
    await mockPrisma.walletLedgerEntry.create({
      data: {
        walletId: 'wal_test_01',
        providerId: providerProfileVerified.id,
        entryType: 'ADMIN_ADJUSTMENT',
        direction: 'CREDIT',
        amountPaisa: 10000,
        currency: 'INR',
        resultingAvailablePaisa: 60000,
        resultingPendingPaisa: 0,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/financial/ledger?direction=CREDIT',
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.meta.total >= 1);
    for (const entry of body.data) {
      assert.equal(entry.direction, 'CREDIT');
    }
  });
});
