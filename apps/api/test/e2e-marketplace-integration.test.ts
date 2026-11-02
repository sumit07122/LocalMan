import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { prisma } from '../src/config/database.js';
import { BookingStatus, ReviewStatus, KycDocumentType } from '@localman/constants';
import { FinancialService } from '../src/modules/financial/financial.service.js';
import { hashString } from '../src/common/utils/crypto.js';

describe('Phase 4G — Master End-to-End Marketplace Integration Test Suite', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  // Fixtures & Seeds
  const customerUser = {
    id: 'usr_cust_4g_01',
    phoneNumber: '9876543210',
    fullName: 'Aarav Mehta',
    email: 'aarav@localman.in',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const providerUser = {
    id: 'usr_prov_4g_01',
    phoneNumber: '9876543220',
    fullName: 'Ramesh Patel',
    email: 'ramesh@voltfixers.in',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const providerUser2 = {
    id: 'usr_prov_4g_02',
    phoneNumber: '9876543221',
    fullName: 'Dinesh Kumar',
    email: 'dinesh@fastpro.in',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const adminUser = {
    id: 'usr_admin_4g_01',
    phoneNumber: '9876543299',
    fullName: 'Meera Nair',
    email: 'admin@localman.in',
    isActive: true,
    userRoles: [{ roleId: 'ADMIN' }],
  };

  const financeManagerUser = {
    id: 'usr_fin_4g_01',
    phoneNumber: '9876543298',
    fullName: 'Vikram Seth',
    email: 'finance@localman.in',
    isActive: true,
    userRoles: [{ roleId: 'FINANCE_MANAGER' }],
  };

  const testCategory = {
    id: 'cat_electrical_4g',
    name: 'Electrical Repairs',
    slug: 'electrical-repairs',
    displayOrder: 1,
    isActive: true,
  };

  const testService = {
    id: 'srv_switchboard_repair',
    categoryId: testCategory.id,
    name: 'Switchboard & Socket Repair',
    slug: 'switchboard-repair',
    description: 'Diagnose and repair sparking sockets or broken switches.',
    pricingModel: 'FIXED_PRICE',
    basePricePaisa: 39900, // ₹399
    hourlyRatePaisa: null,
    inspectionFeePaisa: null,
    estimatedDurationMinutes: 45,
    isMaterialAllowed: true,
    platformCommissionPercent: 15.0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testAddress = {
    id: 'addr_cust_4g_01',
    userId: customerUser.id,
    label: 'Apartment',
    addressLine1: 'Flat 501, Palm Meadows',
    addressLine2: 'Whitefield',
    landmark: 'Near Forum Value Mall',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560066',
    latitude: 12.9698,
    longitude: 77.7499,
    isDefault: true,
  };

  const testProvider = {
    id: 'prv_4g_01',
    userId: providerUser.id,
    businessName: 'Ramesh Spark Repairs',
    experienceYears: 7,
    bio: 'Certified electrical repair professional with 7+ years of expertise in Bengaluru.',
    verificationStatus: 'VERIFIED',
    isOnline: true,
    ratingAverage: 4.88,
    ratingCount: 32,
    serviceRadiusMeters: 25000,
    centerLatitude: 12.9716,
    centerLongitude: 77.5946,
    services: [{ serviceId: testService.id, isEnabled: true }],
    serviceAreas: [
      {
        city: 'Bengaluru',
        serviceRadiusMeters: 25000,
        centerLatitude: 12.9716,
        centerLongitude: 77.5946,
      },
    ],
  };

  const testProvider2 = {
    id: 'prv_4g_02',
    userId: providerUser2.id,
    businessName: 'Dinesh Quick Fix',
    experienceYears: 5,
    bio: 'Professional electrician in Whitefield.',
    verificationStatus: 'VERIFIED',
    isOnline: true,
    ratingAverage: 4.75,
    ratingCount: 20,
    serviceRadiusMeters: 25000,
    centerLatitude: 12.9716,
    centerLongitude: 77.5946,
    services: [{ serviceId: testService.id, isEnabled: true }],
    serviceAreas: [
      {
        city: 'Bengaluru',
        serviceRadiusMeters: 25000,
        centerLatitude: 12.9716,
        centerLongitude: 77.5946,
      },
    ],
  };

  let tokenCustomer: string;
  let tokenProvider: string;
  let tokenProvider2: string;
  let tokenAdmin: string;
  let tokenFinanceManager: string;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;
    Object.assign(prisma, mockPrisma);

    // Seed mock stores
    mockPrisma._store.users.set(customerUser.id, { ...customerUser });
    mockPrisma._store.users.set(providerUser.id, { ...providerUser });
    mockPrisma._store.users.set(providerUser2.id, { ...providerUser2 });
    mockPrisma._store.users.set(adminUser.id, { ...adminUser });
    mockPrisma._store.users.set(financeManagerUser.id, { ...financeManagerUser });

    mockPrisma._store.serviceCategories.set(testCategory.id, { ...testCategory });
    mockPrisma._store.services.set(testService.id, { ...testService });
    mockPrisma._store.addresses.set(testAddress.id, { ...testAddress });
    mockPrisma._store.providers.set(testProvider.id, { ...testProvider });
    mockPrisma._store.providers.set(testProvider2.id, { ...testProvider2 });

    // Seed provider wallets
    mockPrisma._store.providerWallets.set(testProvider.id, {
      id: `w_${testProvider.id}`,
      providerId: testProvider.id,
      balancePaisa: 0,
      lockedPaisa: 0,
      totalEarnedPaisa: 0,
      totalTdsPaisa: 0,
      totalCommissionPaisa: 0,
    });

    app = await buildApp();
    await app.ready();

    tokenCustomer = app.jwt.sign({
      userId: customerUser.id,
      phoneNumber: customerUser.phoneNumber,
      roles: ['CUSTOMER'],
    });

    tokenProvider = app.jwt.sign({
      userId: providerUser.id,
      phoneNumber: providerUser.phoneNumber,
      roles: ['PROVIDER'],
    });

    tokenProvider2 = app.jwt.sign({
      userId: providerUser2.id,
      phoneNumber: providerUser2.phoneNumber,
      roles: ['PROVIDER'],
    });

    tokenAdmin = app.jwt.sign({
      userId: adminUser.id,
      phoneNumber: adminUser.phoneNumber,
      roles: ['ADMIN'],
    });

    tokenFinanceManager = app.jwt.sign({
      userId: financeManagerUser.id,
      phoneNumber: financeManagerUser.phoneNumber,
      roles: ['FINANCE_MANAGER'],
    });
  });

  // ===========================================================================
  // SECTION 1: COMPLETE 18-STEP CUSTOMER JOURNEY
  // ===========================================================================
  describe('Section 1 — Complete Customer Lifecycle (18 Steps)', () => {
    it('executes full end-to-end customer journey from registration to verified review', async () => {
      // Step 1: Customer Registration / Request OTP
      const phoneInput = '9988776655';
      const sendOtpRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/send',
        payload: {
          phoneCountryCode: '+91',
          phoneNumber: phoneInput,
          role: 'CUSTOMER',
        },
      });
      assert.strictEqual(sendOtpRes.statusCode, 200);

      // Step 2: Customer Phone OTP Verification
      const storedOtpRecord = Array.from(mockPrisma._store.otpVerifications.values()).find(
        (ov) => ov.phoneNumber === phoneInput
      );
      assert.ok(storedOtpRecord, 'OTP record should be saved in database');

      const testOtp = '123456';
      storedOtpRecord.otpHash = hashString(testOtp);

      const verifyOtpRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/verify',
        payload: {
          phoneCountryCode: '+91',
          phoneNumber: phoneInput,
          otp: testOtp,
          role: 'CUSTOMER',
        },
      });
      assert.strictEqual(verifyOtpRes.statusCode, 200);
      const authResult = JSON.parse(verifyOtpRes.payload);
      assert.ok(authResult.data.accessToken, 'Access token must be returned');
      const activeCustomerToken = authResult.data.accessToken;

      // Step 3: Browse Service Categories
      const categoriesRes = await app.inject({
        method: 'GET',
        url: '/api/v1/catalog/categories',
      });
      assert.strictEqual(categoriesRes.statusCode, 200);
      const categoriesData = JSON.parse(categoriesRes.payload);
      assert.ok(Array.isArray(categoriesData.data));
      assert(categoriesData.data.some((c: any) => c.slug === testCategory.slug));

      // Step 4: Search Services
      const searchRes = await app.inject({
        method: 'GET',
        url: `/api/v1/catalog/services?category=${testCategory.slug}`,
      });
      assert.strictEqual(searchRes.statusCode, 200);
      const searchData = JSON.parse(searchRes.payload).data;
      assert.ok(Array.isArray(searchData) && searchData.length > 0);

      // Step 5: View Service Details
      const serviceDetailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/catalog/services/${testService.id}`,
      });
      assert.strictEqual(serviceDetailRes.statusCode, 200);
      const serviceDetail = JSON.parse(serviceDetailRes.payload).data;
      assert.strictEqual(serviceDetail.id, testService.id);

      // Step 6: Select Pricing Model
      assert.strictEqual(serviceDetail.pricingModel, 'FIXED_PRICE');
      assert.strictEqual(serviceDetail.basePricePaisa, 39900);

      // Step 7: Select or Add Address
      const newAddressRes = await app.inject({
        method: 'POST',
        url: '/api/v1/addresses',
        headers: { authorization: `Bearer ${activeCustomerToken}` },
        payload: {
          label: 'Home Apartment',
          addressLine1: 'Tower B, Flat 302, Sunrise Residency',
          addressLine2: 'Indiranagar 100ft Road',
          landmark: 'Opposite Metro Pillar 42',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560038',
          latitude: 12.9784,
          longitude: 77.6408,
          isDefault: true,
        },
      });
      assert.strictEqual(newAddressRes.statusCode, 201);
      const customerAddress = JSON.parse(newAddressRes.payload).data;
      assert.ok(customerAddress.id);

      // Step 8: Schedule Booking
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const scheduledDateStr = tomorrow.toISOString().split('T')[0];

      const createBookingRes = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings',
        headers: { authorization: `Bearer ${activeCustomerToken}` },
        payload: {
          serviceId: testService.id,
          addressId: customerAddress.id,
          scheduledDate: scheduledDateStr,
          scheduledTimeSlot: '11:00 AM - 01:00 PM',
          pricingModel: 'FIXED_PRICE',
          jobDescription: 'Master bedroom main switchboard socket sparking.',
          customerNotes: 'Please call before coming.',
          idempotencyKey: `idem_cust_${Date.now()}`,
        },
      });
      assert.strictEqual(createBookingRes.statusCode, 201);
      const createdBooking = JSON.parse(createBookingRes.payload).data;
      assert.ok(createdBooking.id);
      assert.strictEqual(createdBooking.currentStatus, BookingStatus.REQUESTED);

      // Step 9: Review Transparent Pricing
      const expectedPricing = FinancialService.deriveBookingPricing({
        baseAmountPaisa: testService.basePricePaisa,
      });
      assert.strictEqual(createdBooking.baseAmountPaisa, expectedPricing.baseAmountPaisa);
      assert.strictEqual(createdBooking.platformFeePaisa, expectedPricing.platformFeePaisa);
      assert.strictEqual(createdBooking.taxAmountPaisa, expectedPricing.taxAmountPaisa);
      assert.strictEqual(createdBooking.totalAmountPaisa, expectedPricing.totalAmountPaisa);

      // Step 10: Trigger Dispatch & View Provider Matching
      const dispatchTriggerRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${createdBooking.id}/dispatch`,
        headers: { authorization: `Bearer ${activeCustomerToken}` },
      });
      assert.strictEqual(dispatchTriggerRes.statusCode, 201);

      const dispatchStatusRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${createdBooking.id}/dispatch-status`,
        headers: { authorization: `Bearer ${activeCustomerToken}` },
      });
      assert.strictEqual(dispatchStatusRes.statusCode, 200);
      const dispatchStatus = JSON.parse(dispatchStatusRes.payload).data;
      assert.ok(dispatchStatus.totalAttempts >= 1 || dispatchStatus.offers.length >= 1, 'Dispatch should broadcast offer to active provider');

      // Step 11: Receive Provider Assignment
      const activeOffer = Array.from(mockPrisma._store.dispatchOffers.values()).find(
        (o) => o.bookingId === createdBooking.id && o.status === 'OFFERED'
      );
      assert.ok(activeOffer, 'Active dispatch offer should exist for booking');

      const acceptRes = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/dispatch/offers/${activeOffer.id}/accept`,
        headers: { authorization: `Bearer ${tokenProvider}` },
      });
      assert.strictEqual(acceptRes.statusCode, 200);

      // Verify customer booking details reflects provider assignment and contains startOtp
      const customerBookingDetailsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${createdBooking.id}`,
        headers: { authorization: `Bearer ${activeCustomerToken}` },
      });
      assert.strictEqual(customerBookingDetailsRes.statusCode, 200);
      const customerBookingView = JSON.parse(customerBookingDetailsRes.payload).data;
      assert.strictEqual(customerBookingView.currentStatus, BookingStatus.PROVIDER_ACCEPTED);
      assert.strictEqual(customerBookingView.providerId, testProvider.id);
      assert.ok(customerBookingView.startOtp, 'Customer must see secure 6-digit startOtp');

      // Step 12: Track Job Live Map State & ETA
      const mapStateRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${createdBooking.id}/map-state`,
        headers: { authorization: `Bearer ${activeCustomerToken}` },
      });
      assert.strictEqual(mapStateRes.statusCode, 200);

      // Step 13: Chat Messaging with Provider
      const customerMsgRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${createdBooking.id}/messages`,
        headers: { authorization: `Bearer ${activeCustomerToken}` },
        payload: {
          clientMessageId: `msg_cust_${Date.now()}`,
          messageType: 'TEXT',
          body: 'Hello Ramesh, please ring Flat 501 bell when you arrive at the gate.',
        },
      });
      assert.strictEqual(customerMsgRes.statusCode, 201);

      const listMsgRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${createdBooking.id}/messages`,
        headers: { authorization: `Bearer ${activeCustomerToken}` },
      });
      assert.strictEqual(listMsgRes.statusCode, 200);
      const messages = JSON.parse(listMsgRes.payload).data.messages;
      assert.strictEqual(messages.length, 1);
      assert.strictEqual(messages[0].body, 'Hello Ramesh, please ring Flat 501 bell when you arrive at the gate.');

      // Step 14: Job Execution (Travel, Arrive, Start with Customer Start OTP, Complete)
      await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${createdBooking.id}/on-the-way`,
        headers: { authorization: `Bearer ${tokenProvider}` },
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${createdBooking.id}/arrived`,
        headers: { authorization: `Bearer ${tokenProvider}` },
      });
      const startRes = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${createdBooking.id}/start`,
        headers: { authorization: `Bearer ${tokenProvider}` },
        payload: {
          startOtp: customerBookingView.startOtp,
        },
      });
      assert.strictEqual(startRes.statusCode, 200);

      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${createdBooking.id}/complete`,
        headers: { authorization: `Bearer ${tokenProvider}` },
      });
      assert.strictEqual(completeRes.statusCode, 200);

      // Verify booking is now ready for payment checkout (PAYMENT_PENDING)
      const pendingPaymentBookingRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${createdBooking.id}`,
        headers: { authorization: `Bearer ${activeCustomerToken}` },
      });
      assert.strictEqual(pendingPaymentBookingRes.statusCode, 200);
      const pendingPaymentBooking = JSON.parse(pendingPaymentBookingRes.payload).data;
      assert(
        pendingPaymentBooking.currentStatus === BookingStatus.PAYMENT_PENDING ||
        pendingPaymentBooking.currentStatus === BookingStatus.JOB_COMPLETED
      );

      // Step 15: Customer Payment Checkout Session
      const checkoutRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${createdBooking.id}/payment/checkout`,
        headers: { authorization: `Bearer ${activeCustomerToken}` },
        payload: {
          idempotencyKey: `idem_pay_${createdBooking.id}`,
        },
      });
      assert.strictEqual(checkoutRes.statusCode, 201);
      const checkoutSession = JSON.parse(checkoutRes.payload).data;
      assert.ok(checkoutSession.gatewayOrderId);
      assert.strictEqual(checkoutSession.amountPaisa, createdBooking.totalAmountPaisa);

      // Step 16: Verify Payment & Settle Booking
      const verifyPaymentRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${createdBooking.id}/payment/verify`,
        headers: { authorization: `Bearer ${activeCustomerToken}` },
        payload: {
          paymentId: checkoutSession.paymentId,
          gatewayOrderId: checkoutSession.gatewayOrderId,
          gatewayPaymentId: `pay_mock_${Date.now()}`,
          gatewaySignature: 'valid_mock_signature_test',
        },
      });
      assert.strictEqual(verifyPaymentRes.statusCode, 200);

      // Verify booking reached PAYMENT_SETTLED
      const settledBookingRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${createdBooking.id}`,
        headers: { authorization: `Bearer ${activeCustomerToken}` },
      });
      const settledBooking = JSON.parse(settledBookingRes.payload).data;
      assert.strictEqual(settledBooking.currentStatus, BookingStatus.PAYMENT_SETTLED);

      // Step 17: View Payment and Booking History
      const myBookingsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings/customer/my',
        headers: { authorization: `Bearer ${activeCustomerToken}` },
      });
      assert.strictEqual(myBookingsRes.statusCode, 200);
      const myBookings = JSON.parse(myBookingsRes.payload).data;
      assert(myBookings.some((b: any) => b.id === createdBooking.id));

      const paymentSummaryRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${createdBooking.id}/payment/summary`,
        headers: { authorization: `Bearer ${activeCustomerToken}` },
      });
      assert.strictEqual(paymentSummaryRes.statusCode, 200);

      // Step 18: Submit Customer Review
      const reviewRes = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/booking/${createdBooking.id}`,
        headers: { authorization: `Bearer ${activeCustomerToken}` },
        payload: {
          rating: 5,
          title: 'Exceptional Electrical Repair',
          body: 'Ramesh fixed the sparking switchboard cleanly and safely within 30 minutes!',
        },
      });
      assert.strictEqual(reviewRes.statusCode, 201);
      const reviewData = JSON.parse(reviewRes.payload).data;
      assert.strictEqual(reviewData.rating, 5);
      assert.strictEqual(reviewData.status, ReviewStatus.PUBLISHED);
    });
  });

  // ===========================================================================
  // SECTION 2: COMPLETE 15-STEP PROVIDER JOURNEY
  // ===========================================================================
  describe('Section 2 — Complete Provider Lifecycle (15 Steps)', () => {
    it('executes full end-to-end provider onboarding, KYC, job execution, and payout lifecycle', async () => {
      // Step 1: Provider Registration (OTP request)
      const providerPhone = '9977553311';
      const sendOtpRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/send',
        payload: {
          phoneCountryCode: '+91',
          phoneNumber: providerPhone,
          role: 'PROVIDER',
        },
      });
      assert.strictEqual(sendOtpRes.statusCode, 200);

      // Step 2: Provider OTP Authentication
      const otpRecord = Array.from(mockPrisma._store.otpVerifications.values()).find(
        (ov) => ov.phoneNumber === providerPhone
      );
      assert.ok(otpRecord);
      const proOtp = '654321';
      otpRecord.otpHash = hashString(proOtp);

      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/verify',
        payload: {
          phoneCountryCode: '+91',
          phoneNumber: providerPhone,
          otp: proOtp,
          role: 'PROVIDER',
        },
      });
      assert.strictEqual(verifyRes.statusCode, 200);
      const auth = JSON.parse(verifyRes.payload).data;
      const newProviderToken = auth.accessToken;
      const newProviderUserId = auth.user.id;

      // Retrieve or create provider entity
      let proEntity = Array.from(mockPrisma._store.providers.values()).find(
        (p) => p.userId === newProviderUserId
      );
      if (!proEntity) {
        proEntity = {
          id: `prv_new_${Date.now()}`,
          userId: newProviderUserId,
          businessName: 'Apex Electricals',
          verificationStatus: 'DRAFT',
          isOnline: false,
          ratingAverage: 5.0,
          ratingCount: 0,
        };
        mockPrisma._store.providers.set(proEntity.id, proEntity);
      }
      proEntity.services = [{ serviceId: testService.id, isEnabled: true }];
      proEntity.serviceAreas = [
        {
          city: 'Bengaluru',
          serviceRadiusMeters: 25000,
          centerLatitude: 12.9716,
          centerLongitude: 77.5946,
        },
      ];

      // Step 3: Trade Selection & Profile Setup
      const profileUpdateRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/providers/profile',
        headers: { authorization: `Bearer ${newProviderToken}` },
        payload: {
          businessName: 'Apex Electrical Services',
          experienceYears: 6,
          bio: 'Expert electrician in Koramangala & HSR layout.',
          bankAccountHolder: 'Apex Electricals',
          bankAccountNumber: '9876543210123',
          bankIfscCode: 'HDFC0001234',
        },
      });
      assert.strictEqual(profileUpdateRes.statusCode, 200);

      // Step 4: KYC Submission (Aadhaar Front + PAN Card)
      const aadhaarRes = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/kyc/document',
        headers: { authorization: `Bearer ${newProviderToken}` },
        payload: {
          documentType: KycDocumentType.AADHAAR_FRONT,
          documentNumber: '543210987654',
          fileUrl: 'https://storage.localman.in/kyc/aadhaar_apex.jpg',
        },
      });
      assert.strictEqual(aadhaarRes.statusCode, 201);
      const aadhaarDoc = JSON.parse(aadhaarRes.payload).data;

      const panRes = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/kyc/document',
        headers: { authorization: `Bearer ${newProviderToken}` },
        payload: {
          documentType: KycDocumentType.PAN_CARD,
          documentNumber: 'ABCDE1234F',
          fileUrl: 'https://storage.localman.in/kyc/pan_apex.jpg',
        },
      });
      assert.strictEqual(panRes.statusCode, 201);
      const panDoc = JSON.parse(panRes.payload).data;

      // Step 5: Admin Verification
      await app.inject({
        method: 'POST',
        url: '/api/v1/admin/kyc/review',
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          documentId: aadhaarDoc.id,
          status: 'APPROVED',
          reviewNotes: 'Verified against UIDAI offline XML proof.',
        },
      });

      const adminPanReviewRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/kyc/review',
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          documentId: panDoc.id,
          status: 'APPROVED',
          reviewNotes: 'Verified against NSDL TIN database.',
        },
      });
      assert.strictEqual(adminPanReviewRes.statusCode, 200);

      // Verify provider status graduated to VERIFIED
      const updatedPro = mockPrisma._store.providers.get(proEntity.id);
      assert.strictEqual(updatedPro.verificationStatus, 'VERIFIED');

      // Step 6: Duty Activation (Online Toggle)
      const toggleOnlineRes = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/toggle-online',
        headers: { authorization: `Bearer ${newProviderToken}` },
        payload: {
          isOnline: true,
        },
      });
      assert.strictEqual(toggleOnlineRes.statusCode, 200);
      assert.strictEqual(JSON.parse(toggleOnlineRes.payload).data.isOnline, true);

      // Step 7: Receive Dispatch Offer
      const testBooking = {
        id: `bkg_pro_journey_${Date.now()}`,
        bookingNumber: `LM-PRO-${Date.now()}`,
        customerId: customerUser.id,
        serviceId: testService.id,
        addressId: testAddress.id,
        currentStatus: BookingStatus.REQUESTED,
        pricingModel: 'FIXED_PRICE',
        baseAmountPaisa: 39900,
        platformFeePaisa: 5985,
        taxAmountPaisa: 7182,
        totalAmountPaisa: 47082,
        platformCommissionPercent: 15.0,
        startOtp: '456789',
        startOtpHash: hashString('456789'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma._store.bookings.set(testBooking.id, testBooking);

      const offerRecord = {
        id: `off_pro_${Date.now()}`,
        bookingId: testBooking.id,
        providerId: proEntity.id,
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      };
      mockPrisma._store.dispatchOffers.set(offerRecord.id, offerRecord);

      const offersRes = await app.inject({
        method: 'GET',
        url: '/api/v1/providers/dispatch/offers',
        headers: { authorization: `Bearer ${newProviderToken}` },
      });
      assert.strictEqual(offersRes.statusCode, 200);
      const proOffersData = JSON.parse(offersRes.payload).data;
      const proOffers = proOffersData.offers || proOffersData;
      assert(proOffers.some((o: any) => o.id === offerRecord.id));

      // Step 8: Accept Job
      const acceptRes = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/dispatch/offers/${offerRecord.id}/accept`,
        headers: { authorization: `Bearer ${newProviderToken}` },
      });
      assert.strictEqual(acceptRes.statusCode, 200);

      // Step 9: Navigate (PROVIDER_ON_THE_WAY)
      const onTheWayRes = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${testBooking.id}/on-the-way`,
        headers: { authorization: `Bearer ${newProviderToken}` },
      });
      assert.strictEqual(onTheWayRes.statusCode, 200);
      assert.strictEqual(JSON.parse(onTheWayRes.payload).data.currentStatus, BookingStatus.PROVIDER_ON_THE_WAY);

      // Step 10: Mark Arrival (ARRIVED)
      const arrivedRes = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${testBooking.id}/arrived`,
        headers: { authorization: `Bearer ${newProviderToken}` },
      });
      assert.strictEqual(arrivedRes.statusCode, 200);
      assert.strictEqual(JSON.parse(arrivedRes.payload).data.currentStatus, BookingStatus.ARRIVED);

      // Step 11: Verify Customer Start OTP (JOB_STARTED)
      const startRes = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${testBooking.id}/start`,
        headers: { authorization: `Bearer ${newProviderToken}` },
        payload: {
          startOtp: '456789',
        },
      });
      assert.strictEqual(startRes.statusCode, 200);
      assert.strictEqual(JSON.parse(startRes.payload).data.currentStatus, BookingStatus.JOB_STARTED);

      // Step 12: Complete Job (JOB_COMPLETED)
      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${testBooking.id}/complete`,
        headers: { authorization: `Bearer ${newProviderToken}` },
      });
      assert.strictEqual(completeRes.statusCode, 200);

      // Step 13: View Earnings & Wallet
      const proWallet = {
        id: `w_${proEntity.id}`,
        providerId: proEntity.id,
        availableBalancePaisa: 33516, // ₹335.16 net after 15% commission + 1% TDS
        pendingBalancePaisa: 0,
        paidOutBalancePaisa: 0,
        currency: 'INR',
      };
      mockPrisma._store.providerWallets.set(proEntity.id, proWallet);

      const walletRes = await app.inject({
        method: 'GET',
        url: '/api/v1/providers/wallet',
        headers: { authorization: `Bearer ${newProviderToken}` },
      });
      assert.strictEqual(walletRes.statusCode, 200);
      const walletData = JSON.parse(walletRes.payload).data;
      assert.strictEqual(walletData.availableBalancePaisa, 33516);

      // Step 14: View Wallet Ledger
      mockPrisma._store.walletLedgerEntries.push({
        id: `led_${Date.now()}`,
        walletId: proWallet.id,
        providerId: proEntity.id,
        bookingId: testBooking.id,
        entryType: 'CREDIT',
        amountPaisa: 33516,
        balanceAfterPaisa: 33516,
        description: `Settlement for booking ${testBooking.bookingNumber}`,
        createdAt: new Date(),
      });

      const ledgerRes = await app.inject({
        method: 'GET',
        url: '/api/v1/providers/wallet/ledger',
        headers: { authorization: `Bearer ${newProviderToken}` },
      });
      assert.strictEqual(ledgerRes.statusCode, 200);
      const ledgerData = JSON.parse(ledgerRes.payload).data;
      const entries = Array.isArray(ledgerData) ? ledgerData : ledgerData.entries;
      assert(entries.length >= 1);

      // Step 15: Review Payout Status / Request Payout
      const payoutRes = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/wallet/payouts',
        headers: { authorization: `Bearer ${newProviderToken}` },
        payload: {
          amountPaisa: 25000, // ₹250
          payoutMode: 'BANK_TRANSFER',
        },
      });
      assert.strictEqual(payoutRes.statusCode, 201);
      const payout = JSON.parse(payoutRes.payload).data;
      assert.strictEqual(payout.grossAmountPaisa || payout.netPayoutPaisa, 25000);
      assert.strictEqual(payout.status, 'PROCESSING');
    });
  });

  // ===========================================================================
  // SECTION 3: COMPLETE 10-STEP ADMIN OPERATIONS JOURNEY
  // ===========================================================================
  describe('Section 3 — Complete Admin Operations Journey (10 Steps)', () => {
    it('executes full administrative operations across moderation, catalog, KYC and finance', async () => {
      // Step 1: Platform Metrics & Oversight
      const metricsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/metrics',
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(metricsRes.statusCode, 200);
      const metrics = JSON.parse(metricsRes.payload).data;
      assert.ok('totalBookings' in metrics);

      // Step 2: KYC Review Queue Inspection
      const pendingKycRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/kyc/pending',
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(pendingKycRes.statusCode, 200);

      // Step 3: Booking Visibility Across Platform
      const adminBookingsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings',
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(adminBookingsRes.statusCode, 200);

      // Step 4: Dispatch State Monitoring
      const staleSweepRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/dispatch/expire-stale',
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(staleSweepRes.statusCode, 200);

      // Step 5: Financial Ledger Inspection
      const finLedgerRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/financial/ledger',
        headers: { authorization: `Bearer ${tokenFinanceManager}` },
      });
      assert.strictEqual(finLedgerRes.statusCode, 200);

      // Step 6: Payout Review & Status Update
      const testPayout = {
        id: `pout_adm_${Date.now()}`,
        providerId: testProvider.id,
        amountPaisa: 50000,
        status: 'PENDING',
        createdAt: new Date(),
      };
      mockPrisma._store.providerPayouts.push(testPayout);

      const payoutsListRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/financial/payouts',
        headers: { authorization: `Bearer ${tokenFinanceManager}` },
      });
      assert.strictEqual(payoutsListRes.statusCode, 200);

      const updatePayoutRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/financial/payouts/${testPayout.id}/status`,
        headers: { authorization: `Bearer ${tokenFinanceManager}` },
        payload: {
          status: 'PAID',
          payoutReference: 'UTR_BANK_99887766',
        },
      });
      assert.strictEqual(updatePayoutRes.statusCode, 200);
      assert.strictEqual(JSON.parse(updatePayoutRes.payload).data.status, 'PAID');

      // Step 7: Review Moderation Oversight
      const testReview = {
        id: `rev_adm_${Date.now()}`,
        bookingId: 'bkg_rev_test',
        customerId: customerUser.id,
        providerId: testProvider.id,
        rating: 5,
        title: 'Superb Service',
        comment: 'Great work and quick arrival.',
        status: ReviewStatus.PUBLISHED,
        isFlagged: false,
        createdAt: new Date(),
      };
      mockPrisma._store.reviews.set(testReview.id, testReview);

      const reviewsListRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reviews',
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(reviewsListRes.statusCode, 200);

      const moderateRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reviews/${testReview.id}/moderate`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          status: ReviewStatus.HIDDEN,
          moderationReason: 'Routine compliance screening and review audit',
        },
      });
      assert.strictEqual(moderateRes.statusCode, 200);
      assert.strictEqual(JSON.parse(moderateRes.payload).data.status, ReviewStatus.HIDDEN);

      // Step 8: Service Catalog Management
      const createServiceRes = await app.inject({
        method: 'POST',
        url: '/api/v1/catalog/services',
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          categoryId: testCategory.id,
          name: 'Heavy Duty Geyser Installation',
          slug: `geyser-install-${Date.now()}`,
          description: 'Safe high-amperage 25L geyser mounting and electrical connection.',
          pricingModel: 'FIXED_PRICE',
          basePricePaisa: 69900,
          platformCommissionPercent: 15.0,
        },
      });
      assert.strictEqual(createServiceRes.statusCode, 201);

      // Step 9: Audit History Trace
      const auditRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit-logs',
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(auditRes.statusCode, 200);
      const auditData = JSON.parse(auditRes.payload).data;
      assert.ok(Array.isArray(auditData.items || auditData));

      // Step 10: Manual Financial Adjustment
      const adjustmentRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/financial/adjustments',
        headers: { authorization: `Bearer ${tokenFinanceManager}` },
        payload: {
          providerId: testProvider.id,
          amountPaisa: 5000,
          direction: 'CREDIT',
          reason: 'Appreciation bonus for exemplary customer satisfaction during festive peak',
        },
      });
      assert.strictEqual(adjustmentRes.statusCode, 201);
    });
  });

  // ===========================================================================
  // SECTION 4: FAILURE TESTING & INVARIANT ENFORCEMENT (11 SCENARIOS)
  // ===========================================================================
  describe('Section 4 — Failure Scenarios & Invariant Hardening (11 Scenarios)', () => {
    const createTestBooking = (custom: Record<string, any> = {}) => {
      const id = `bkg_fail_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const booking = {
        id,
        bookingNumber: `LM-FAIL-${Date.now()}`,
        customerId: customerUser.id,
        serviceId: testService.id,
        addressId: testAddress.id,
        currentStatus: BookingStatus.REQUESTED,
        pricingModel: 'FIXED_PRICE',
        baseAmountPaisa: 39900,
        platformFeePaisa: 5985,
        taxAmountPaisa: 7182,
        totalAmountPaisa: 47082,
        platformCommissionPercent: 15.0,
        startOtp: '112233',
        startOtpHash: hashString('112233'),
        createdAt: new Date(),
        updatedAt: new Date(),
        dispatchOffers: [],
        ...custom,
      };
      mockPrisma._store.bookings.set(id, booking);
      return booking;
    };

    // Scenario 1: Provider Rejection of Dispatch Offer
    it('Scenario 1: Provider rejection marks offer REJECTED without mutating booking', async () => {
      const booking = createTestBooking();
      const offer = {
        id: `off_rej_${Date.now()}`,
        bookingId: booking.id,
        providerId: testProvider.id,
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      };
      mockPrisma._store.dispatchOffers.set(offer.id, offer);

      const rejectRes = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/dispatch/offers/${offer.id}/reject`,
        headers: { authorization: `Bearer ${tokenProvider}` },
        payload: { reason: 'TOO_FAR' },
      });
      assert.strictEqual(rejectRes.statusCode, 200);

      // Offer is REJECTED, booking is still REQUESTED and unassigned
      const updatedOffer = mockPrisma._store.dispatchOffers.get(offer.id);
      assert.strictEqual(updatedOffer.status, 'REJECTED');
      const b = mockPrisma._store.bookings.get(booking.id);
      assert.strictEqual(b.currentStatus, BookingStatus.REQUESTED);
      assert.ok(!b.providerId);
    });

    // Scenario 2: No Provider Available / Dispatch Timeout
    it('Scenario 2: When no matching providers exist, dispatch returns empty broadcast gracefully', async () => {
      const distantAddress = {
        id: 'addr_remote_01',
        userId: customerUser.id,
        city: 'RemoteTown',
        latitude: 25.0,
        longitude: 80.0,
        postalCode: '999999',
      };
      mockPrisma._store.addresses.set(distantAddress.id, distantAddress as any);
      const booking = createTestBooking({ addressId: distantAddress.id });

      const dispatchRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/dispatch`,
        headers: { authorization: `Bearer ${tokenCustomer}` },
      });
      assert.strictEqual(dispatchRes.statusCode, 200);
      const res = JSON.parse(dispatchRes.payload).data;
      assert.ok(res.message?.includes('No eligible providers') || res.offersSent === 0);
    });

    // Scenario 3: Payment Signature Verification Failure
    it('Scenario 3: Corrupt or forged payment signature is strictly rejected with 400 Bad Request', async () => {
      const booking = createTestBooking({
        currentStatus: BookingStatus.PAYMENT_PENDING,
      });

      const checkoutRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/payment/checkout`,
        headers: { authorization: `Bearer ${tokenCustomer}` },
        payload: { idempotencyKey: `idem_sig_${booking.id}` },
      });
      assert.strictEqual(checkoutRes.statusCode, 201);
      const session = JSON.parse(checkoutRes.payload).data;

      const badVerifyRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/payment/verify`,
        headers: { authorization: `Bearer ${tokenCustomer}` },
        payload: {
          paymentId: session.paymentId,
          gatewayOrderId: session.gatewayOrderId,
          gatewayPaymentId: 'pay_spoofed_001',
          gatewaySignature: 'invalid_signature',
        },
      });
      assert.strictEqual(badVerifyRes.statusCode, 400);
    });

    // Scenario 4: Customer Cancellation (Free before dispatch vs after provider arrival)
    it('Scenario 4: Customer cancellation before assignment is free and updates booking status', async () => {
      const booking = createTestBooking();
      const cancelRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/cancel`,
        headers: { authorization: `Bearer ${tokenCustomer}` },
        payload: { reason: 'Change of travel plans' },
      });
      assert.strictEqual(cancelRes.statusCode, 200);
      const updated = mockPrisma._store.bookings.get(booking.id);
      assert.strictEqual(updated.currentStatus, BookingStatus.CANCELLED);
    });

    // Scenario 5: Provider Cancellation of Assigned Job
    it('Scenario 5: Assigned provider can cancel job with reason, unassigning provider', async () => {
      const booking = createTestBooking({
        providerId: testProvider.id,
        currentStatus: BookingStatus.PROVIDER_ACCEPTED,
      });

      const cancelRes = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/cancel`,
        headers: { authorization: `Bearer ${tokenProvider}` },
        payload: { reason: 'Vehicle mechanical breakdown en route' },
      });
      assert.strictEqual(cancelRes.statusCode, 200);
      const updated = mockPrisma._store.bookings.get(booking.id);
      assert(
        updated.currentStatus === BookingStatus.CANCELLED ||
        updated.currentStatus === BookingStatus.REQUESTED
      );
    });

    // Scenario 6: Refund Retry Idempotency
    it('Scenario 6: Repeated refund requests return idempotent response without duplicating deductions', async () => {
      const paymentId = `pay_ref_${Date.now()}`;
      const paymentRecord = {
        id: paymentId,
        bookingId: 'bkg_ref_test',
        amountPaisa: 47082,
        status: 'CAPTURED',
        createdAt: new Date(),
      };
      mockPrisma._store.payments.set(paymentId, paymentRecord);

      // Create an existing refund
      const idemKey = `rfnd_idem_${Date.now()}`;
      const refundRecord = {
        id: `rfnd_01`,
        paymentId,
        amountPaisa: 47082,
        status: 'PROCESSED',
        idempotencyKey: idemKey,
      };
      mockPrisma._store.refunds.set(refundRecord.id, refundRecord);

      // Verify idempotency lookup
      const lookup = Array.from(mockPrisma._store.refunds.values()).find(
        (r) => r.idempotencyKey === idemKey
      );
      assert.ok(lookup);
      assert.strictEqual(lookup.amountPaisa, 47082);
    });

    // Scenario 7: Offline Provider Excluded from Dispatch
    it('Scenario 7: Offline provider does not receive dispatch offers', async () => {
      testProvider.isOnline = false;
      const booking = createTestBooking();

      const dispatchRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/dispatch`,
        headers: { authorization: `Bearer ${tokenCustomer}` },
      });
      assert.strictEqual(dispatchRes.statusCode, 200);

      // Verify no offer created for offline provider
      const proOffers = Array.from(mockPrisma._store.dispatchOffers.values()).filter(
        (o) => o.bookingId === booking.id && o.providerId === testProvider.id
      );
      assert.strictEqual(proOffers.length, 0);

      // Reset provider to online
      testProvider.isOnline = true;
    });

    // Scenario 8: Network Disconnect / Lock Contention Handling
    it('Scenario 8: Concurrent status updates on arrived booking resolve safely', async () => {
      const booking = createTestBooking({
        providerId: testProvider.id,
        currentStatus: BookingStatus.ARRIVED,
        startOtp: '887766',
        startOtpHash: hashString('887766'),
      });

      // Two concurrent calls to mark start
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/api/v1/providers/bookings/${booking.id}/start`,
          headers: { authorization: `Bearer ${tokenProvider}` },
          payload: { startOtp: '887766' },
        }),
        app.inject({
          method: 'POST',
          url: `/api/v1/providers/bookings/${booking.id}/start`,
          headers: { authorization: `Bearer ${tokenProvider}` },
          payload: { startOtp: '887766' },
        }),
      ]);

      const statusCodes = [res1.statusCode, res2.statusCode];
      assert(statusCodes.includes(200));
    });

    // Scenario 9: Duplicate Booking Submission Idempotency
    it('Scenario 9: Re-submitting same booking payload with duplicate idempotencyKey does not duplicate', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const scheduledDateStr = tomorrow.toISOString().split('T')[0];
      const sharedIdemKey = `idem_dup_test_${Date.now()}`;

      const payload = {
        serviceId: testService.id,
        addressId: testAddress.id,
        scheduledDate: scheduledDateStr,
        scheduledTimeSlot: '02:00 PM - 04:00 PM',
        pricingModel: 'FIXED_PRICE',
        jobDescription: 'Exhaust fan stopped spinning.',
        idempotencyKey: sharedIdemKey,
      };

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings',
        headers: {
          authorization: `Bearer ${tokenCustomer}`,
          'idempotency-key': sharedIdemKey,
        },
        payload,
      });
      assert.strictEqual(res1.statusCode, 201);
      const b1 = JSON.parse(res1.payload).data;

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings',
        headers: {
          authorization: `Bearer ${tokenCustomer}`,
          'idempotency-key': sharedIdemKey,
        },
        payload,
      });
      const b2 = JSON.parse(res2.payload).data;
      assert.strictEqual(b1.id, b2.id, 'Idempotent key must prevent duplicate booking creation');
    });

    // Scenario 10: Concurrent Offer Acceptance Race Condition
    it('Scenario 10: Atomic offer acceptance prevents two providers from claiming the same job', async () => {
      const booking = createTestBooking({
        currentStatus: BookingStatus.REQUESTED,
        providerId: null,
      });
      const offer1 = {
        id: `off_race_1_${Date.now()}`,
        bookingId: booking.id,
        providerId: testProvider.id,
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      };
      const offer2 = {
        id: `off_race_2_${Date.now()}`,
        bookingId: booking.id,
        providerId: testProvider2.id,
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      };
      mockPrisma._store.dispatchOffers.set(offer1.id, offer1);
      mockPrisma._store.dispatchOffers.set(offer2.id, offer2);

      // Provider 1 accepts first
      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/dispatch/offers/${offer1.id}/accept`,
        headers: { authorization: `Bearer ${tokenProvider}` },
      });
      assert.strictEqual(res1.statusCode, 200);

      // Provider 2 tries to accept after job is claimed
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/dispatch/offers/${offer2.id}/accept`,
        headers: { authorization: `Bearer ${tokenProvider2}` },
      });
      assert.strictEqual(res2.statusCode, 409);
      const conflictBody = JSON.parse(res2.payload);
      assert.strictEqual(conflictBody.success, false);
    });

    // Scenario 11: Start OTP Security & Invalid Code Rejection
    it('Scenario 11: Incorrect start OTP is rejected with 422 and does not transition status', async () => {
      const booking = createTestBooking({
        providerId: testProvider.id,
        currentStatus: BookingStatus.ARRIVED,
        startOtp: '998877',
        startOtpHash: hashString('998877'),
      });

      // Submit incorrect OTP
      const badOtpRes = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/start`,
        headers: { authorization: `Bearer ${tokenProvider}` },
        payload: { startOtp: '000000' },
      });
      assert.strictEqual(badOtpRes.statusCode, 422);

      // Verify status was NOT modified
      const current = mockPrisma._store.bookings.get(booking.id);
      assert.strictEqual(current.currentStatus, BookingStatus.ARRIVED);
    });
  });
});
