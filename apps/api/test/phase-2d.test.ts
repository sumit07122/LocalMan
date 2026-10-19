import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { BookingStatus } from '@localman/constants';

let app: FastifyInstance;
let mockPrisma: ReturnType<typeof createMockPrisma>;
let tokenProviderVerified: string;
let tokenProviderUnverified: string;
let tokenCustomer: string;
let tokenAdmin: string;
let tokenOtherCustomer: string;

describe('Phase 2D: Provider KYC, Materials Flow, & Authoritative Settlement Tests', () => {
  beforeEach(async () => {
    mockPrisma = createMockPrisma();

    // Provider A (Unverified / Draft)
    const userPrvUnverified = {
      id: 'usr_prv_draft_01',
      phoneNumber: '9988776655',
      fullName: 'Ramesh Plumber',
      isActive: true,
      roles: ['PROVIDER'],
      userRoles: [{ roleId: 'PROVIDER' }],
    };
    mockPrisma._store.users.set(userPrvUnverified.id, userPrvUnverified);

    const providerDraft = {
      id: 'prv_draft_01',
      userId: userPrvUnverified.id,
      businessName: 'Ramesh Plumbing Services',
      verificationStatus: 'DRAFT',
      isOnline: false,
      ratingAverage: 5.0,
      ratingCount: 0,
    };
    mockPrisma._store.providers.set(providerDraft.id, providerDraft);

    // Provider B (Verified)
    const userPrvVerified = {
      id: 'usr_prv_ver_01',
      phoneNumber: '9988776656',
      fullName: 'Suresh Electrician',
      isActive: true,
      roles: ['PROVIDER'],
      userRoles: [{ roleId: 'PROVIDER' }],
    };
    mockPrisma._store.users.set(userPrvVerified.id, userPrvVerified);

    const providerVerified = {
      id: 'prv_ver_01',
      userId: userPrvVerified.id,
      businessName: 'Suresh Electricals',
      verificationStatus: 'VERIFIED',
      isOnline: false,
      ratingAverage: 5.0,
      ratingCount: 0,
    };
    mockPrisma._store.providers.set(providerVerified.id, providerVerified);

    // Customer
    const userCust = {
      id: 'usr_cust_01',
      phoneNumber: '9911223344',
      fullName: 'Pooja Sharma',
      isActive: true,
      roles: ['CUSTOMER'],
      userRoles: [{ roleId: 'CUSTOMER' }],
    };
    mockPrisma._store.users.set(userCust.id, userCust);

    // Other Customer (for IDOR tests)
    const userOtherCust = {
      id: 'usr_cust_other_01',
      phoneNumber: '9911223399',
      fullName: 'Vikram Singh',
      isActive: true,
      roles: ['CUSTOMER'],
      userRoles: [{ roleId: 'CUSTOMER' }],
    };
    mockPrisma._store.users.set(userOtherCust.id, userOtherCust);

    // Admin
    const userAdmin = {
      id: 'usr_admin_01',
      phoneNumber: '9900000000',
      fullName: 'City Admin',
      isActive: true,
      roles: ['ADMIN'],
      userRoles: [{ roleId: 'ADMIN' }],
    };
    mockPrisma._store.users.set(userAdmin.id, userAdmin);

    // Booking assigned to Verified Provider
    const booking = {
      id: 'bkg_2d_001',
      bookingNumber: 'LM-2D-001',
      customerId: userCust.id,
      providerId: providerVerified.id,
      serviceId: 'srv_ac_001',
      addressId: 'addr_001',
      currentStatus: BookingStatus.JOB_STARTED,
      pricingModel: 'FIXED_PRICE',
      baseAmountPaisa: 50000, // ₹500.00 labor
      platformFeePaisa: 5000,  // ₹50.00 platform fee
      totalAmountPaisa: 50000, // starts at ₹500
      startOtp: '654321',
      startedAt: new Date(),
      service: { id: 'srv_ac_001', name: 'AC Deep Service' },
      provider: providerVerified,
      customer: userCust,
      address: { addressLine1: 'Indiranagar 100ft Rd', city: 'Bengaluru' },
      materials: [],
    };
    mockPrisma._store.bookings.set(booking.id, booking);

    // Set the global mock prisma instance for proxy in database.ts
    (globalThis as any).__prisma = mockPrisma;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();

    tokenProviderUnverified = app.jwt.sign({
      userId: userPrvUnverified.id,
      roles: ['PROVIDER'],
      phoneNumber: userPrvUnverified.phoneNumber,
    });

    tokenProviderVerified = app.jwt.sign({
      userId: userPrvVerified.id,
      roles: ['PROVIDER'],
      phoneNumber: userPrvVerified.phoneNumber,
    });

    tokenCustomer = app.jwt.sign({
      userId: userCust.id,
      roles: ['CUSTOMER'],
      phoneNumber: userCust.phoneNumber,
    });

    tokenOtherCustomer = app.jwt.sign({
      userId: userOtherCust.id,
      roles: ['CUSTOMER'],
      phoneNumber: userOtherCust.phoneNumber,
    });

    tokenAdmin = app.jwt.sign({
      userId: userAdmin.id,
      roles: ['ADMIN'],
      phoneNumber: userAdmin.phoneNumber,
    });
  });

  // ===========================================================================
  // 1. KYC Validation & UIDAI Masking Tests
  // ===========================================================================

  it('1. Provider submitting 12-digit Aadhaar has first 8 digits masked for UIDAI compliance', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/kyc/document',
      headers: { authorization: `Bearer ${tokenProviderUnverified}` },
      payload: {
        documentType: 'AADHAAR_FRONT',
        documentNumber: '1234 5678 9012',
      },
    });

    assert.equal(res.statusCode, 201, `Expected 201, got ${res.payload}`);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.documentNumber, 'XXXXXXXX9012', 'First 8 digits of Aadhaar must be masked');
    assert.equal(body.data.status, 'PENDING');

    // Provider status must advance from DRAFT to SUBMITTED
    const updatedPrv = await mockPrisma.provider.findUnique({ where: { id: 'prv_draft_01' } });
    assert.equal(updatedPrv?.verificationStatus, 'SUBMITTED', 'Status must advance to SUBMITTED');
  });

  it('2. Invalid Aadhaar (not 12 digits) is rejected with 400 / 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/kyc/document',
      headers: { authorization: `Bearer ${tokenProviderUnverified}` },
      payload: {
        documentType: 'AADHAAR_FRONT',
        documentNumber: '12345',
      },
    });

    assert.ok(res.statusCode === 400 || res.statusCode === 422, `Expected 400/422, got ${res.statusCode}`);
  });

  it('3. Provider submitting PAN card formats uppercase and validates PAN regex', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/kyc/document',
      headers: { authorization: `Bearer ${tokenProviderUnverified}` },
      payload: {
        documentType: 'PAN_CARD',
        documentNumber: 'abcde1234f',
      },
    });

    assert.equal(res.statusCode, 201, `Expected 201, got ${res.payload}`);
    const body = JSON.parse(res.payload);
    assert.equal(body.data.documentNumber, 'ABCDE1234F', 'PAN must be uppercase');
  });

  it('4. Invalid PAN format is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/kyc/document',
      headers: { authorization: `Bearer ${tokenProviderUnverified}` },
      payload: {
        documentType: 'PAN_CARD',
        documentNumber: 'INVALID_PAN_123',
      },
    });

    assert.ok(res.statusCode === 400 || res.statusCode === 422);
  });

  // ===========================================================================
  // 2. Banking Details & Duty Gate Tests
  // ===========================================================================

  it('5. Provider updates banking details with secure account masking and valid IFSC', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/providers/profile',
      headers: { authorization: `Bearer ${tokenProviderUnverified}` },
      payload: {
        bankAccountHolder: 'Ramesh Kumar',
        bankAccountNumber: '123456789012',
        bankIfscCode: 'HDFC0001234',
        upiId: 'ramesh@okhdfcbank',
      },
    });

    assert.equal(res.statusCode, 200, `Expected 200, got ${res.payload}`);
    const stored = await mockPrisma.provider.findUnique({ where: { id: 'prv_draft_01' } });
    assert.equal(stored?.bankAccountHolder, 'Ramesh Kumar');
    assert.equal(stored?.bankAccountNumberEnc, 'XXXX9012', 'Bank account should be masked in database');
    assert.equal(stored?.bankIfscCode, 'HDFC0001234');
  });

  it('6. Invalid Indian IFSC code format is rejected with 422', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/providers/profile',
      headers: { authorization: `Bearer ${tokenProviderUnverified}` },
      payload: {
        bankIfscCode: 'INVALID_IFSC',
      },
    });

    assert.equal(res.statusCode, 422);
  });

  it('7. Unverified provider cannot toggle duty online (duty switch gate)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/toggle-online',
      headers: { authorization: `Bearer ${tokenProviderUnverified}` },
      payload: { isOnline: true },
    });

    assert.ok(res.statusCode === 400 || res.statusCode === 422, 'Unverified provider must be rejected from going online');
    const body = JSON.parse(res.payload);
    assert.ok(body.error.message.includes('VERIFIED'));
  });

  it('8. Verified provider CAN toggle duty online successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/toggle-online',
      headers: { authorization: `Bearer ${tokenProviderVerified}` },
      payload: { isOnline: true },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.data.isOnline, true);
  });

  // ===========================================================================
  // 3. Admin KYC Review & Verification Transition
  // ===========================================================================

  it('9. Admin approving Aadhaar and PAN documents transitions provider to VERIFIED', async () => {
    // Add Aadhaar and PAN documents
    const docAadhaar = await mockPrisma.providerDocument.create({
      data: {
        providerId: 'prv_draft_01',
        documentType: 'AADHAAR_FRONT',
        documentNumber: 'XXXXXXXX9012',
        fileUrl: 'https://storage.localman.in/kyc/aadhaar.jpg',
        status: 'PENDING',
      },
    });

    const docPan = await mockPrisma.providerDocument.create({
      data: {
        providerId: 'prv_draft_01',
        documentType: 'PAN_CARD',
        documentNumber: 'ABCDE1234F',
        fileUrl: 'https://storage.localman.in/kyc/pan.jpg',
        status: 'PENDING',
      },
    });

    // Admin approves Aadhaar
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/kyc/review',
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: {
        documentId: docAadhaar.id,
        status: 'APPROVED',
        reviewNotes: 'Aadhaar verified via portal',
      },
    });
    assert.equal(res1.statusCode, 200);

    // Admin approves PAN
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/kyc/review',
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: {
        documentId: docPan.id,
        status: 'APPROVED',
        reviewNotes: 'PAN verified with NSDL',
      },
    });
    assert.equal(res2.statusCode, 200);

    // Provider must now be VERIFIED
    const provider = await mockPrisma.provider.findUnique({ where: { id: 'prv_draft_01' } });
    assert.equal(provider?.verificationStatus, 'VERIFIED');
  });

  it('10. Admin rejecting document sets provider to REJECTED with reason', async () => {
    const doc = await mockPrisma.providerDocument.create({
      data: {
        providerId: 'prv_draft_01',
        documentType: 'PAN_CARD',
        documentNumber: 'ABCDE1234F',
        fileUrl: 'https://storage.localman.in/kyc/pan.jpg',
        status: 'PENDING',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/kyc/review',
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: {
        documentId: doc.id,
        status: 'REJECTED',
        reviewNotes: 'PAN photo is blurry and unreadable',
      },
    });

    assert.equal(res.statusCode, 200);
    const provider = await mockPrisma.provider.findUnique({ where: { id: 'prv_draft_01' } });
    assert.equal(provider?.verificationStatus, 'REJECTED');
    assert.equal(provider?.rejectionReason, 'PAN photo is blurry and unreadable');
  });

  // ===========================================================================
  // 4. In-Job Extra Materials Billing Tests
  // ===========================================================================

  it('11. Assigned provider can add material during JOB_STARTED; sets status to JOB_EXTENDED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/bookings/bkg_2d_001/materials',
      headers: { authorization: `Bearer ${tokenProviderVerified}` },
      payload: {
        itemName: 'Copper Pipe 2m',
        quantity: 1,
        unitPricePaisa: 15000, // ₹150.00
      },
    });

    assert.equal(res.statusCode, 201, `Expected 201, got ${res.payload}`);
    const body = JSON.parse(res.payload);
    assert.equal(body.data.itemName, 'Copper Pipe 2m');
    assert.equal(body.data.totalPricePaisa, 15000);
    assert.equal(body.data.isCustomerApproved, false);

    // Booking status must now be JOB_EXTENDED
    const bkg = await mockPrisma.booking.findUnique({ where: { id: 'bkg_2d_001' } });
    assert.equal(bkg?.currentStatus, BookingStatus.JOB_EXTENDED);
  });

  it('12. IDOR Protection: Non-assigned provider cannot add materials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/bookings/bkg_2d_001/materials',
      headers: { authorization: `Bearer ${tokenProviderUnverified}` }, // Not assigned to bkg_2d_001
      payload: {
        itemName: 'Hose Clamp',
        quantity: 2,
        unitPricePaisa: 5000,
      },
    });

    assert.equal(res.statusCode, 403, 'Non-assigned provider must receive 403 Forbidden');
  });

  it('13. Customer approves requested material; increments booking totalAmountPaisa authoritatively', async () => {
    // Add material
    const mat = await mockPrisma.bookingMaterial.create({
      data: {
        bookingId: 'bkg_2d_001',
        itemName: 'Freon Gas Refill R32',
        quantity: 1,
        unitPricePaisa: 120000, // ₹1200.00
        totalPricePaisa: 120000,
        isCustomerApproved: false,
      },
    });

    const initialTotal = 50000; // ₹500.00

    // Customer approves material
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/bookings/bkg_2d_001/materials/approve',
      headers: { authorization: `Bearer ${tokenCustomer}` },
      payload: {
        materialId: mat.id,
        approved: true,
      },
    });

    assert.equal(res.statusCode, 200, `Expected 200, got ${res.payload}`);
    const body = JSON.parse(res.payload);
    assert.equal(body.data.isCustomerApproved, true);

    // Total must be authoritatively incremented by ₹1200 (120000 paisa)
    const bkg = await mockPrisma.booking.findUnique({ where: { id: 'bkg_2d_001' } });
    assert.equal(bkg?.totalAmountPaisa, initialTotal + 120000, 'totalAmountPaisa must reflect approved material');
  });

  it('14. IDOR Protection: Another customer cannot approve materials for this booking', async () => {
    const mat = await mockPrisma.bookingMaterial.create({
      data: {
        bookingId: 'bkg_2d_001',
        itemName: 'Capacitor 45uF',
        quantity: 1,
        unitPricePaisa: 35000,
        totalPricePaisa: 35000,
        isCustomerApproved: false,
      },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/bookings/bkg_2d_001/materials/approve',
      headers: { authorization: `Bearer ${tokenOtherCustomer}` }, // unauthorized customer
      payload: {
        materialId: mat.id,
        approved: true,
      },
    });

    assert.equal(res.statusCode, 403, 'Unauthorized customer must be blocked with 403');
  });

  // ===========================================================================
  // 5. Payment Settlement to Authoritative Provider Ledger
  // ===========================================================================

  it('15. Payment confirmation creates provider payout with 1% TDS and reflects in wallet endpoint', async () => {
    // Complete the booking with ₹1700 total (₹500 base + ₹1200 approved materials)
    await mockPrisma.booking.update({
      where: { id: 'bkg_2d_001' },
      data: {
        totalAmountPaisa: 170000, // ₹1,700.00
        platformFeePaisa: 17000,   // ₹170.00 (10%)
        currentStatus: BookingStatus.JOB_COMPLETED,
      },
    });

    // Create payment order record
    const payment = await mockPrisma.payment.create({
      data: {
        bookingId: 'bkg_2d_001',
        amountPaisa: 170000,
        currency: 'INR',
        gateway: 'RAZORPAY',
        status: 'INITIATED',
        idempotencyKey: 'idem_test_2d',
      },
    });

    // Confirm Payment
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/confirm',
      payload: {
        paymentId: payment.id,
        gatewayPaymentId: 'pay_rzp_mock_12345',
      },
    });

    assert.equal(res.statusCode, 200, `Expected 200, got ${res.payload}`);

    // Verify booking advanced to PAYMENT_SETTLED
    const settledBooking = await mockPrisma.booking.findUnique({ where: { id: 'bkg_2d_001' } });
    assert.equal(settledBooking?.currentStatus, 'PAYMENT_SETTLED');

    // Verify payout was created authoritatively with 1% TDS:
    // Gross: 170000 paisa (₹1,700)
    // Platform deduction: 17000 paisa (₹170)
    // TDS (1% of 170000): 1700 paisa (₹17)
    // Net: 170000 - 17000 - 1700 = 151300 paisa (₹1,513)
    const payouts = await mockPrisma.providerPayout.findMany({ where: { providerId: 'prv_ver_01' } });
    assert.equal(payouts.length, 1);
    const payout = payouts[0];
    assert.equal(payout.grossAmountPaisa, 170000);
    assert.equal(payout.platformDeductionPaisa, 17000);
    assert.equal(payout.tdsDeductionPaisa, 1700, '1% statutory TDS must be deducted');
    assert.equal(payout.netPayoutPaisa, 151300);

    // Call Provider Wallet API: must reflect this authoritative payout
    const walletRes = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/wallet',
      headers: { authorization: `Bearer ${tokenProviderVerified}` },
    });

    assert.equal(walletRes.statusCode, 200);
    const walletBody = JSON.parse(walletRes.payload);
    assert.equal(walletBody.data.availableBalancePaisa, 151300);
    assert.equal(walletBody.data.totalEarnedPaisa, 151300);
    assert.equal(walletBody.data.ledger.length, 1);
    assert.equal(walletBody.data.ledger[0].netPayoutPaisa, 151300);
  });
});
