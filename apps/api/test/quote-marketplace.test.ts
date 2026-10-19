import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { prisma } from '../src/config/database.js';
import { BookingStatus, QuoteStatus, PricingModel } from '@localman/constants';
import { quoteService } from '../src/modules/quotes/quote.service.js';
import { paymentService } from '../src/modules/payments/payment.service.js';
import { cancellationPolicyService } from '../src/modules/cancellations/cancellation-policy.service.js';

describe('Phase 3H — Quotes, Custom Jobs & Provider Negotiation Integration Tests', () => {
  let app: FastifyInstance;
  let mockPrisma: any;

  // Actors
  const customerA = {
    id: 'usr_cust_3h_a',
    phoneNumber: '+919876543401',
    fullName: 'Aditi Deshmukh',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const customerB = {
    id: 'usr_cust_3h_b',
    phoneNumber: '+919876543402',
    fullName: 'Vikram Joshi',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const providerUser1 = {
    id: 'usr_pro_3h_1',
    phoneNumber: '+919876543411',
    fullName: 'Ramesh Sharma',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider1 = {
    id: 'prv_3h_1',
    userId: providerUser1.id,
    businessName: 'Sharma Electricals & Custom Wiring',
    verificationStatus: 'VERIFIED',
    isOnline: true,
    experienceYears: 6,
    ratingAverage: 4.8,
    ratingCount: 35,
    commissionRateOverride: null,
    services: [] as any[],
    serviceAreas: [] as any[],
    bookings: [] as any[],
  };

  const providerUser2 = {
    id: 'usr_pro_3h_2',
    phoneNumber: '+919876543412',
    fullName: 'Deepak Verma',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const provider2 = {
    id: 'prv_3h_2',
    userId: providerUser2.id,
    businessName: 'Verma Quick Repairs',
    verificationStatus: 'VERIFIED',
    isOnline: true,
    experienceYears: 4,
    ratingAverage: 4.6,
    ratingCount: 20,
    commissionRateOverride: null,
    services: [] as any[],
    serviceAreas: [] as any[],
    bookings: [] as any[],
  };

  const unverifiedProviderUser = {
    id: 'usr_pro_3h_unv',
    phoneNumber: '+919876543419',
    fullName: 'Unverified Partner',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  const unverifiedProvider = {
    id: 'prv_3h_unv',
    userId: unverifiedProviderUser.id,
    businessName: 'Unverified Services',
    verificationStatus: 'DRAFT',
    isOnline: true,
    services: [] as any[],
    serviceAreas: [] as any[],
    bookings: [] as any[],
  };

  const adminUser = {
    id: 'usr_admin_3h_1',
    phoneNumber: '+919876543499',
    fullName: 'Operations Manager',
    isActive: true,
    userRoles: [{ roleId: 'ADMIN' }],
  };

  const customService = {
    id: 'srv_custom_01',
    categoryId: 'cat_electrical',
    name: 'Custom Electrical Installation',
    slug: 'custom-electrical-installation',
    pricingModel: PricingModel.CUSTOM_QUOTE,
    basePricePaisa: 0,
    platformCommissionPercent: 15.0,
    isActive: true,
  };

  const inspectionService = {
    id: 'srv_inspect_01',
    categoryId: 'cat_plumbing',
    name: 'Plumbing Diagnosis & Inspection',
    slug: 'plumbing-diagnosis-inspection',
    pricingModel: PricingModel.INSPECTION_QUOTE,
    inspectionFeePaisa: 25000, // ₹250
    basePricePaisa: 25000,
    platformCommissionPercent: 15.0,
    isActive: true,
  };

  const fixedService = {
    id: 'srv_fixed_01',
    categoryId: 'cat_appliances',
    name: 'Standard AC Service',
    slug: 'standard-ac-service',
    pricingModel: PricingModel.FIXED_PRICE,
    basePricePaisa: 79900,
    platformCommissionPercent: 15.0,
    isActive: true,
  };

  const customerAddress = {
    id: 'addr_cust_3h_01',
    userId: customerA.id,
    label: 'Home',
    addressLine1: 'Flat 402, Green Towers',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    latitude: 12.9716,
    longitude: 77.5946,
    isDefault: true,
  };

  let tokenCustomerA: string;
  let tokenCustomerB: string;
  let tokenProvider1: string;
  let tokenProvider2: string;
  let tokenUnverified: string;
  let tokenAdmin: string;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;
    Object.assign(prisma, mockPrisma);

    // Link provider services and areas
    provider1.services = [
      { id: 'ps_1_1', providerId: provider1.id, serviceId: customService.id, isEnabled: true },
      { id: 'ps_1_2', providerId: provider1.id, serviceId: inspectionService.id, isEnabled: true },
    ];
    provider1.serviceAreas = [
      { id: 'pa_1_1', providerId: provider1.id, city: 'Bengaluru', serviceRadiusMeters: 25000 },
    ];
    provider1.bookings = [];

    provider2.services = [
      { id: 'ps_2_1', providerId: provider2.id, serviceId: customService.id, isEnabled: true },
      { id: 'ps_2_2', providerId: provider2.id, serviceId: inspectionService.id, isEnabled: true },
    ];
    provider2.serviceAreas = [
      { id: 'pa_2_1', providerId: provider2.id, city: 'Bengaluru', serviceRadiusMeters: 25000 },
    ];
    provider2.bookings = [];

    mockPrisma._store.users.set(customerA.id, { ...customerA });
    mockPrisma._store.users.set(customerB.id, { ...customerB });
    mockPrisma._store.users.set(providerUser1.id, { ...providerUser1 });
    mockPrisma._store.users.set(providerUser2.id, { ...providerUser2 });
    mockPrisma._store.users.set(unverifiedProviderUser.id, { ...unverifiedProviderUser });
    mockPrisma._store.users.set(adminUser.id, { ...adminUser });

    mockPrisma._store.providers.set(provider1.id, { ...provider1, user: providerUser1 });
    mockPrisma._store.providers.set(provider2.id, { ...provider2, user: providerUser2 });
    mockPrisma._store.providers.set(unverifiedProvider.id, { ...unverifiedProvider, user: unverifiedProviderUser });

    mockPrisma._store.addresses.set(customerAddress.id, { ...customerAddress });
    mockPrisma._store.services.set(customService.id, { ...customService });
    mockPrisma._store.services.set(inspectionService.id, { ...inspectionService });
    mockPrisma._store.services.set(fixedService.id, { ...fixedService });

    app = await buildApp();
    await app.ready();

    tokenCustomerA = app.jwt.sign({ userId: customerA.id, roles: ['CUSTOMER'] });
    tokenCustomerB = app.jwt.sign({ userId: customerB.id, roles: ['CUSTOMER'] });
    tokenProvider1 = app.jwt.sign({ userId: providerUser1.id, roles: ['PROVIDER'] });
    tokenProvider2 = app.jwt.sign({ userId: providerUser2.id, roles: ['PROVIDER'] });
    tokenUnverified = app.jwt.sign({ userId: unverifiedProviderUser.id, roles: ['PROVIDER'] });
    tokenAdmin = app.jwt.sign({ userId: adminUser.id, roles: ['ADMIN'] });
  });

  const getErrorMessage = (res: any) => res.json()?.error?.message || res.json()?.message || '';

  // ===========================================================================
  // SECTION 1: QUOTE SUBMISSION & VALIDATION
  // ===========================================================================
  describe('1. Quote Submission & Validation', () => {
    test('1. Eligible provider successfully submits quote for CUSTOM_QUOTE booking', async () => {
      const booking = {
        id: 'bkg_quote_01',
        bookingNumber: 'BK-QUOTE-001',
        customerId: customerA.id,
        serviceId: customService.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
        totalAmountPaisa: 0,
        providerId: null,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          subtotalPaisa: 150000,
          materialsPaisa: 30000,
          taxPaisa: 0,
          totalAmountPaisa: 180000,
          estimatedDurationMinutes: 180,
          breakdownNotes: 'Wiring installation including conduit pipes and 3 switchboards.',
          validityMinutes: 1440,
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const body = response.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.bookingId, booking.id);
      assert.strictEqual(body.data.providerId, provider1.id);
      assert.strictEqual(body.data.totalAmountPaisa, 180000);
      assert.strictEqual(body.data.status, QuoteStatus.SUBMITTED);
      assert.strictEqual(body.data.version, 1);
      assert.strictEqual(body.data.isExpired, false);
    });

    test('2. Provider submits itemized quote with structured material & labor items', async () => {
      const booking = {
        id: 'bkg_quote_02',
        bookingNumber: 'BK-QUOTE-002',
        customerId: customerA.id,
        serviceId: customService.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
        totalAmountPaisa: 0,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const items = [
        { description: 'Copper Wire 2.5mm', quantity: 2, unitPricePaisa: 12000, totalPaisa: 24000 },
        { description: 'Labor Charges', quantity: 1, unitPricePaisa: 50000, totalPaisa: 50000 },
      ];

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          subtotalPaisa: 50000,
          materialsPaisa: 24000,
          totalAmountPaisa: 74000,
          estimatedDurationMinutes: 120,
          breakdownNotes: 'Itemized electrical rewiring job.',
          items,
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const body = response.json();
      assert.strictEqual(body.data.totalAmountPaisa, 74000);
      assert.strictEqual(body.data.items.length, 2);
      assert.strictEqual(body.data.items[0].description, 'Copper Wire 2.5mm');
    });

    test('3. Rejects quote submission if sum of items exceeds total amount (422 Unprocessable)', async () => {
      const booking = {
        id: 'bkg_quote_03',
        customerId: customerA.id,
        serviceId: customService.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const items = [
        { description: 'High-end fixtures', quantity: 1, unitPricePaisa: 90000, totalPaisa: 90000 },
      ];

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          subtotalPaisa: 20000,
          totalAmountPaisa: 50000, // Total is 50000, but items sum is 90000
          breakdownNotes: 'Mismatch itemized quote',
          items,
        },
      });

      assert.strictEqual(response.statusCode, 422);
    });

    test('4. Rejects quote submission on FIXED_PRICE service (400 Bad Request)', async () => {
      const booking = {
        id: 'bkg_quote_fixed',
        customerId: customerA.id,
        serviceId: fixedService.id, // Fixed price service
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          totalAmountPaisa: 60000,
          breakdownNotes: 'Attempting quote on fixed service',
        },
      });

      assert.strictEqual(response.statusCode, 400);
      assert.match(getErrorMessage(response), /CUSTOM_QUOTE or INSPECTION_QUOTE/i);
    });

    test('5. Rejects unverified (KYC DRAFT) provider from quoting (403 Forbidden)', async () => {
      const booking = {
        id: 'bkg_quote_unv',
        customerId: customerA.id,
        serviceId: customService.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenUnverified}` },
        payload: {
          totalAmountPaisa: 80000,
          breakdownNotes: 'Unverified quote submission',
        },
      });

      assert.strictEqual(response.statusCode, 403);
      assert.match(getErrorMessage(response), /KYC verified/i);
    });

    test('6. Rejects partner anti-self-booking: provider cannot quote their own customer booking (403)', async () => {
      const selfBooking = {
        id: 'bkg_quote_self',
        customerId: providerUser1.id, // Same customer as provider
        serviceId: customService.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(selfBooking.id, selfBooking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${selfBooking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          totalAmountPaisa: 50000,
          breakdownNotes: 'Self quotation attempt',
        },
      });

      assert.strictEqual(response.statusCode, 403);
      assert.match(getErrorMessage(response), /own service request/i);
    });

    test('7. Rejects negative or zero amount quote submission (400 / 422)', async () => {
      const booking = {
        id: 'bkg_quote_neg',
        customerId: customerA.id,
        serviceId: customService.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          totalAmountPaisa: -5000,
          breakdownNotes: 'Negative quote amount',
        },
      });

      assert.ok([400, 422].includes(response.statusCode));
    });

    test('8. Rejects quote exceeding platform ceiling ₹5,00,000 bounds (422)', async () => {
      const booking = {
        id: 'bkg_quote_bounds',
        customerId: customerA.id,
        serviceId: customService.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          totalAmountPaisa: 99999999, // ₹9,99,999.99 > 50000000
          breakdownNotes: 'Excessive quote amount',
        },
      });

      assert.strictEqual(response.statusCode, 422);
    });

    test('9. Rejects quote on nonexistent booking with 404 Not Found', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/providers/bookings/bkg_nonexistent_xyz/quotes',
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          totalAmountPaisa: 50000,
          breakdownNotes: 'Nonexistent booking',
        },
      });

      assert.strictEqual(response.statusCode, 404);
    });

    test('10. Prevents duplicate active quote from same provider on same booking (409 Conflict)', async () => {
      const booking = {
        id: 'bkg_quote_dup',
        customerId: customerA.id,
        serviceId: customService.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const quote1 = {
        id: 'q_dup_01',
        bookingId: booking.id,
        providerId: provider1.id,
        quoteAmountPaisa: 60000,
        status: QuoteStatus.SUBMITTED,
        createdAt: new Date(),
      };
      mockPrisma._store.bookingQuotes.set(quote1.id, quote1);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          totalAmountPaisa: 70000,
          breakdownNotes: 'Second quote from same provider',
        },
      });

      assert.strictEqual(response.statusCode, 409);
      assert.match(getErrorMessage(response), /already submitted an active quote/i);
    });
  });

  // ===========================================================================
  // SECTION 2: QUOTE REVISION & WITHDRAWAL
  // ===========================================================================
  describe('2. Quote Revision & Withdrawal Lifecycle', () => {
    test('11. Provider successfully revises active quote (increments version to 2)', async () => {
      const quote = {
        id: 'q_rev_01',
        bookingId: 'bkg_rev_01',
        providerId: provider1.id,
        quoteAmountPaisa: 100000,
        subtotalPaisa: 80000,
        materialsPaisa: 20000,
        status: QuoteStatus.SUBMITTED,
        version: 1,
        validUntil: new Date(Date.now() + 86400000),
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      const booking = {
        id: 'bkg_rev_01',
        customerId: customerA.id,
        serviceId: customService.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/providers/quotes/${quote.id}`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          subtotalPaisa: 90000,
          totalAmountPaisa: 110000,
          breakdownNotes: 'Revised scope: added premium wire fittings.',
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.version, 2);
      assert.strictEqual(body.data.status, QuoteStatus.UPDATED);
      assert.strictEqual(body.data.totalAmountPaisa, 110000);
      assert.match(body.data.breakdownNotes, /premium wire/i);
    });

    test('12. Rejects quote revision after customer acceptance (400 Bad Request)', async () => {
      const quote = {
        id: 'q_rev_acc',
        bookingId: 'bkg_rev_acc',
        providerId: provider1.id,
        quoteAmountPaisa: 100000,
        status: QuoteStatus.ACCEPTED, // Already accepted!
        version: 1,
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/providers/quotes/${quote.id}`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          totalAmountPaisa: 120000,
          breakdownNotes: 'Post-acceptance modification attempt',
        },
      });

      assert.strictEqual(response.statusCode, 400);
      assert.match(getErrorMessage(response), /Cannot revise quote in 'ACCEPTED'/i);
    });

    test('13. Rejects quote revision on expired quote (400 Bad Request)', async () => {
      const quote = {
        id: 'q_rev_exp',
        bookingId: 'bkg_rev_exp',
        providerId: provider1.id,
        quoteAmountPaisa: 50000,
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() - 3600000), // Expired 1 hour ago
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/providers/quotes/${quote.id}`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          totalAmountPaisa: 55000,
        },
      });

      assert.strictEqual(response.statusCode, 400);
      assert.match(getErrorMessage(response), /expired quote/i);
    });

    test('14. Provider successfully withdraws active quote (status moves to WITHDRAWN)', async () => {
      const quote = {
        id: 'q_wdr_01',
        bookingId: 'bkg_wdr_01',
        providerId: provider1.id,
        quoteAmountPaisa: 65000,
        status: QuoteStatus.SUBMITTED,
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/quotes/${quote.id}/withdraw`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          reason: 'Tools unavailable on scheduled date',
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.status, QuoteStatus.WITHDRAWN);
      assert.match(body.data.breakdownNotes, /Tools unavailable/i);
    });

    test('15. Rejects withdrawal of already ACCEPTED quote (400 Bad Request)', async () => {
      const quote = {
        id: 'q_wdr_acc',
        bookingId: 'bkg_wdr_acc',
        providerId: provider1.id,
        status: QuoteStatus.ACCEPTED,
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/quotes/${quote.id}/withdraw`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
      });

      assert.strictEqual(response.statusCode, 400);
    });

    test('16. Customer declines/rejects specific quote proposal (status moves to REJECTED)', async () => {
      const booking = {
        id: 'bkg_cust_rej',
        customerId: customerA.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const quote = {
        id: 'q_cust_rej_01',
        bookingId: booking.id,
        providerId: provider2.id,
        status: QuoteStatus.SUBMITTED,
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/quotes/${quote.id}/reject`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: { reason: 'Price too high for this job.' },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.status, QuoteStatus.REJECTED);
      assert.match(body.data.breakdownNotes, /Price too high/i);
    });
  });

  // ===========================================================================
  // SECTION 3: ATOMIC QUOTE ACCEPTANCE & CONCURRENCY
  // ===========================================================================
  describe('3. Atomic Quote Acceptance & Concurrency', () => {
    test('17. Customer accepts quote: quote -> ACCEPTED, booking -> CONFIRMED, provider assigned', async () => {
      const booking = {
        id: 'bkg_acc_01',
        bookingNumber: 'BK-ACC-001',
        customerId: customerA.id,
        serviceId: customService.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.REQUESTED,
        totalAmountPaisa: 0,
        providerId: null,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const quoteA = {
        id: 'q_win_01',
        bookingId: booking.id,
        providerId: provider1.id,
        quoteAmountPaisa: 150000,
        subtotalPaisa: 130000,
        materialsPaisa: 20000,
        taxPaisa: 0,
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() + 86400000),
      };
      const quoteB = {
        id: 'q_lose_01',
        bookingId: booking.id,
        providerId: provider2.id,
        quoteAmountPaisa: 180000,
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() + 86400000),
      };
      mockPrisma._store.bookingQuotes.set(quoteA.id, quoteA);
      mockPrisma._store.bookingQuotes.set(quoteB.id, quoteB);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/quotes/${quoteA.id}/accept`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.quote.status, QuoteStatus.ACCEPTED);
      assert.strictEqual(body.data.booking.currentStatus, BookingStatus.CONFIRMED);
      assert.strictEqual(body.data.booking.providerId, provider1.id);
      assert.strictEqual(body.data.booking.totalAmountPaisa, 150000);

      // Competing quote B must be automatically REJECTED
      const updatedQuoteB = mockPrisma._store.bookingQuotes.get(quoteB.id);
      assert.strictEqual(updatedQuoteB.status, QuoteStatus.REJECTED);
    });

    test('18. Two concurrent acceptances for different quotes: exactly ONE wins, second gets 409 Conflict', async () => {
      const booking = {
        id: 'bkg_race_01',
        bookingNumber: 'BK-RACE-001',
        customerId: customerA.id,
        serviceId: customService.id,
        currentStatus: BookingStatus.REQUESTED,
        totalAmountPaisa: 0,
        providerId: null,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const quote1 = {
        id: 'q_race_01',
        bookingId: booking.id,
        providerId: provider1.id,
        quoteAmountPaisa: 120000,
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() + 86400000),
      };
      const quote2 = {
        id: 'q_race_02',
        bookingId: booking.id,
        providerId: provider2.id,
        quoteAmountPaisa: 130000,
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() + 86400000),
      };
      mockPrisma._store.bookingQuotes.set(quote1.id, quote1);
      mockPrisma._store.bookingQuotes.set(quote2.id, quote2);

      // Simulate simultaneous acceptance calls
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/api/v1/bookings/${booking.id}/quotes/${quote1.id}/accept`,
          headers: { authorization: `Bearer ${tokenCustomerA}` },
        }),
        app.inject({
          method: 'POST',
          url: `/api/v1/bookings/${booking.id}/quotes/${quote2.id}/accept`,
          headers: { authorization: `Bearer ${tokenCustomerA}` },
        }),
      ]);

      const statuses = [res1.statusCode, res2.statusCode].sort();
      assert.strictEqual(statuses[0], 200, 'One request must succeed');
      assert.strictEqual(statuses[1], 409, 'Competing acceptance must receive 409 Conflict');

      // Check that exactly one quote is ACCEPTED
      const q1 = mockPrisma._store.bookingQuotes.get(quote1.id);
      const q2 = mockPrisma._store.bookingQuotes.get(quote2.id);
      const acceptedCount = (q1.status === QuoteStatus.ACCEPTED ? 1 : 0) + (q2.status === QuoteStatus.ACCEPTED ? 1 : 0);
      assert.strictEqual(acceptedCount, 1);
    });

    test('19. Idempotent retry: Re-accepting the same quote returns 200 without error', async () => {
      const booking = {
        id: 'bkg_idemp_01',
        customerId: customerA.id,
        serviceId: customService.id,
        currentStatus: BookingStatus.REQUESTED,
        totalAmountPaisa: 0,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const quote = {
        id: 'q_idemp_01',
        bookingId: booking.id,
        providerId: provider1.id,
        quoteAmountPaisa: 95000,
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() + 86400000),
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      // First acceptance
      const firstRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/quotes/${quote.id}/accept`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(firstRes.statusCode, 200);

      // Retry acceptance for same quote
      const secondRes = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/quotes/${quote.id}/accept`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });
      assert.strictEqual(secondRes.statusCode, 200);
      assert.strictEqual(secondRes.json().data.quote.status, QuoteStatus.ACCEPTED);
    });

    test('20. Rejects acceptance of an expired quote (400 Bad Request)', async () => {
      const booking = {
        id: 'bkg_exp_acc',
        customerId: customerA.id,
        serviceId: customService.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const expiredQuote = {
        id: 'q_exp_01',
        bookingId: booking.id,
        providerId: provider1.id,
        quoteAmountPaisa: 50000,
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() - 60000), // 1 min ago
      };
      mockPrisma._store.bookingQuotes.set(expiredQuote.id, expiredQuote);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/quotes/${expiredQuote.id}/accept`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 400);
      assert.match(getErrorMessage(response), /expired quote/i);
    });

    test('21. Rejects acceptance of a withdrawn quote (400 Bad Request)', async () => {
      const booking = {
        id: 'bkg_wdr_acc2',
        customerId: customerA.id,
        serviceId: customService.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const quote = {
        id: 'q_wdr_02',
        bookingId: booking.id,
        providerId: provider1.id,
        quoteAmountPaisa: 40000,
        status: QuoteStatus.WITHDRAWN,
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/quotes/${quote.id}/accept`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 400);
    });
  });

  // ===========================================================================
  // SECTION 4: INSPECTION QUOTE FLOW
  // ===========================================================================
  describe('4. Inspection Quote Workflow', () => {
    test('22. Assigned inspection partner conducts visit and submits final quotation', async () => {
      const booking = {
        id: 'bkg_inspect_01',
        bookingNumber: 'BK-INSPECT-001',
        customerId: customerA.id,
        serviceId: inspectionService.id,
        addressId: customerAddress.id,
        currentStatus: BookingStatus.ARRIVED,
        providerId: provider1.id,
        baseAmountPaisa: 25000, // ₹250 visiting fee
        totalAmountPaisa: 29500, // ₹250 + 18% GST
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenProvider1}` },
        payload: {
          subtotalPaisa: 200000,
          materialsPaisa: 80000,
          totalAmountPaisa: 280000,
          breakdownNotes: 'Comprehensive pipe replacement after on-site inspection.',
          estimatedDurationMinutes: 240,
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const body = response.json();
      assert.strictEqual(body.data.totalAmountPaisa, 280000);
    });

    test('23. Non-assigned partner cannot submit final quotation on inspection job (403 Forbidden)', async () => {
      const booking = {
        id: 'bkg_inspect_forbid',
        customerId: customerA.id,
        serviceId: inspectionService.id,
        currentStatus: BookingStatus.ARRIVED,
        providerId: provider1.id, // Assigned to provider 1
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/providers/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenProvider2}` }, // Provider 2 tries to quote
        payload: {
          totalAmountPaisa: 150000,
          breakdownNotes: 'Unassigned partner quote attempt',
        },
      });

      assert.strictEqual(response.statusCode, 403);
      assert.match(getErrorMessage(response), /assigned inspection partner/i);
    });

    test('24. Customer accepts inspection final quotation: overrides booking amount authoritatively', async () => {
      const booking = {
        id: 'bkg_inspect_acc',
        customerId: customerA.id,
        serviceId: inspectionService.id,
        currentStatus: BookingStatus.ARRIVED,
        providerId: provider1.id,
        totalAmountPaisa: 29500, // Original inspection fee
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const finalQuote = {
        id: 'q_inspect_final',
        bookingId: booking.id,
        providerId: provider1.id,
        quoteAmountPaisa: 350000,
        subtotalPaisa: 250000,
        materialsPaisa: 100000,
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() + 86400000),
      };
      mockPrisma._store.bookingQuotes.set(finalQuote.id, finalQuote);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/quotes/${finalQuote.id}/accept`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 200);
      const updatedBooking = mockPrisma._store.bookings.get(booking.id);
      assert.strictEqual(updatedBooking.totalAmountPaisa, 350000);
      assert.strictEqual(updatedBooking.pricingSnapshot.quoteId, finalQuote.id);
    });
  });

  // ===========================================================================
  // SECTION 5: EXPIRY ENGINE & BACKGROUND SWEEP
  // ===========================================================================
  describe('5. Expiry Engine & Background Sweep', () => {
    test('25. Expire stale quotes marks past-validity quotes as EXPIRED', async () => {
      const q1 = {
        id: 'q_stale_1',
        bookingId: 'bkg_stale_01',
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() - 3600000), // 1 hour ago
      };
      const q2 = {
        id: 'q_fresh_1',
        bookingId: 'bkg_stale_01',
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() + 3600000), // 1 hour in future
      };
      mockPrisma._store.bookingQuotes.set(q1.id, q1);
      mockPrisma._store.bookingQuotes.set(q2.id, q2);

      const result = await quoteService.expireStaleQuotes();
      assert.strictEqual(result.expiredCount, 1);

      const updatedQ1 = mockPrisma._store.bookingQuotes.get(q1.id);
      const updatedQ2 = mockPrisma._store.bookingQuotes.get(q2.id);
      assert.strictEqual(updatedQ1.status, QuoteStatus.EXPIRED);
      assert.strictEqual(updatedQ2.status, QuoteStatus.SUBMITTED);
    });

    test('26. Admin can trigger quote expiration sweep via POST /api/v1/admin/quotes/expire-stale', async () => {
      const q = {
        id: 'q_admin_stale',
        bookingId: 'bkg_adm_stale',
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() - 7200000),
      };
      mockPrisma._store.bookingQuotes.set(q.id, q);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/quotes/expire-stale',
        headers: { authorization: `Bearer ${tokenAdmin}` },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.expiredCount, 1);
    });

    test('27. Customer querying quotes sees isExpired: true for expired proposals', async () => {
      const booking = {
        id: 'bkg_list_exp',
        customerId: customerA.id,
        serviceId: customService.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const quote = {
        id: 'q_list_exp_01',
        bookingId: booking.id,
        providerId: provider1.id,
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() - 10000),
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 200);
      const body = response.json();
      assert.strictEqual(body.data.quotes[0].isExpired, true);
      assert.strictEqual(body.data.quotes[0].status, QuoteStatus.EXPIRED);
    });
  });

  // ===========================================================================
  // SECTION 6: SECURITY, AUTHORIZATION & IDOR PROTECTION
  // ===========================================================================
  describe('6. Security, Authorization & IDOR Protection', () => {
    test('28. Customer B cannot view quotes for Customer A booking (Booking IDOR Protection)', async () => {
      const booking = {
        id: 'bkg_idor_01',
        customerId: customerA.id,
        serviceId: customService.id,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenCustomerB}` },
      });

      assert.strictEqual(response.statusCode, 403);
    });

    test('29. Customer B cannot accept quote for Customer A booking (IDOR)', async () => {
      const booking = {
        id: 'bkg_idor_acc',
        customerId: customerA.id,
        serviceId: customService.id,
        currentStatus: BookingStatus.REQUESTED,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const quote = {
        id: 'q_idor_acc',
        bookingId: booking.id,
        providerId: provider1.id,
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() + 86400000),
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/quotes/${quote.id}/accept`,
        headers: { authorization: `Bearer ${tokenCustomerB}` },
      });

      assert.strictEqual(response.statusCode, 403);
    });

    test('30. Provider B cannot edit or withdraw Provider A quote (Quote IDOR Protection)', async () => {
      const quote = {
        id: 'q_idor_pro',
        bookingId: 'bkg_idor_pro',
        providerId: provider1.id, // Belongs to Provider 1
        status: QuoteStatus.SUBMITTED,
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/providers/quotes/${quote.id}`,
        headers: { authorization: `Bearer ${tokenProvider2}` }, // Provider 2 tries to edit
        payload: { totalAmountPaisa: 40000 },
      });

      assert.strictEqual(response.statusCode, 403);
      assert.match(getErrorMessage(response), /edit your own quotes/i);
    });

    test('31. Provider financial bank details and commission rates are NEVER leaked to customer', async () => {
      const booking = {
        id: 'bkg_leak_test',
        customerId: customerA.id,
        serviceId: customService.id,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const quote = {
        id: 'q_leak_01',
        bookingId: booking.id,
        providerId: provider1.id,
        quoteAmountPaisa: 75000,
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() + 86400000),
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${booking.id}/quotes`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 200);
      const rawText = response.payload;
      assert.strictEqual(rawText.includes('bankAccountNumber'), false);
      assert.strictEqual(rawText.includes('bankIfscCode'), false);
      assert.strictEqual(rawText.includes('upiId'), false);
      assert.strictEqual(rawText.includes('platformFeePaisa'), false);
    });

    test('32. Non-admin user cannot access admin quote endpoints (403 Forbidden)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/quotes/expire-stale',
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      assert.strictEqual(response.statusCode, 403);
    });
  });

  // ===========================================================================
  // SECTION 7: FINANCIAL SNAPSHOT & PAYMENT INTEGRATION
  // ===========================================================================
  describe('7. Financial Snapshot & Payment Integration', () => {
    test('33. Accepted quote writes immutable pricing snapshot on booking', async () => {
      const booking = {
        id: 'bkg_snap_01',
        customerId: customerA.id,
        serviceId: customService.id,
        currentStatus: BookingStatus.REQUESTED,
        totalAmountPaisa: 0,
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const quote = {
        id: 'q_snap_01',
        bookingId: booking.id,
        providerId: provider1.id,
        quoteAmountPaisa: 200000,
        subtotalPaisa: 150000,
        materialsPaisa: 50000,
        taxPaisa: 0,
        status: QuoteStatus.SUBMITTED,
        validUntil: new Date(Date.now() + 86400000),
      };
      mockPrisma._store.bookingQuotes.set(quote.id, quote);

      await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/quotes/${quote.id}/accept`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
      });

      const updatedBooking = mockPrisma._store.bookings.get(booking.id);
      assert.ok(updatedBooking.pricingSnapshot);
      assert.strictEqual(updatedBooking.pricingSnapshot.quoteId, quote.id);
      assert.strictEqual(updatedBooking.pricingSnapshot.totalAmountPaisa, 200000);
      // Canonical 15% platform fee on subtotal = 15% of 150000 = 22500
      assert.strictEqual(updatedBooking.pricingSnapshot.platformFeePaisa, 22500);
      assert.strictEqual(updatedBooking.pricingSnapshot.providerEarningPaisa, 177500);
    });

    test('34. Payment checkout session uses authoritative accepted quote amount', async () => {
      const booking = {
        id: 'bkg_pay_quote',
        bookingNumber: 'BK-PAY-Q01',
        customerId: customerA.id,
        serviceId: customService.id,
        currentStatus: BookingStatus.JOB_COMPLETED,
        providerId: provider1.id,
        baseAmountPaisa: 250000,
        totalAmountPaisa: 250000, // ₹2500 from accepted quote
        taxAmountPaisa: 0,
        platformFeePaisa: 0,
        pricingSnapshot: {
          quoteId: 'q_pay_01',
          totalAmountPaisa: 250000,
        },
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/payment/checkout`,
        headers: { authorization: `Bearer ${tokenCustomerA}` },
        payload: {
          gateway: 'RAZORPAY',
          amountPaisa: 100, // Malicious client attempt to pay ₹1
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const body = response.json();
      // Server overrides client tampering and bills authoritative 250000 paisa
      assert.strictEqual(body.data.amountPaisa, 250000);
    });

    test('35. Customer cancellation after quote acceptance evaluates policy against accepted quote amount', async () => {
      const booking = {
        id: 'bkg_canc_quote',
        bookingNumber: 'BK-CANC-Q01',
        customerId: customerA.id,
        serviceId: customService.id,
        currentStatus: BookingStatus.CONFIRMED,
        providerId: provider1.id,
        totalAmountPaisa: 300000, // ₹3000
        payment: { status: 'CAPTURED', amountPaisa: 300000 },
      };
      mockPrisma._store.bookings.set(booking.id, booking);

      const evaluation = cancellationPolicyService.evaluateCustomerCancellation(booking);
      assert.strictEqual(evaluation.isAllowed, true);
      assert.strictEqual(evaluation.cancellationFeePaisa, 5000); // ₹50 standard confirmed fee
      assert.strictEqual(evaluation.refundAmountPaisa, 295000); // 300000 - 5000
    });
  });
});
