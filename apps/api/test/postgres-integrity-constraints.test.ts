import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';

describe('Real PostgreSQL Engine — Phase 4A Integrity & Constraint Verification', () => {
  let prisma: PrismaClient;

  before(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  after(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('1. Enforces onDelete: Restrict on Provider -> ProviderWallet', async () => {
    const testUserId = `usr_test_restrict_${Date.now()}`;
    const testPhone = `+919999${Math.floor(100000 + Math.random() * 900000)}`;

    // Create user and provider
    const user = await prisma.user.create({
      data: {
        id: testUserId,
        phoneNumber: testPhone,
        fullName: 'Test Provider Restrict',
      },
    });

    const provider = await prisma.provider.create({
      data: {
        userId: user.id,
        businessName: 'Restrict Plumbing',
      },
    });

    // Create wallet for provider
    await prisma.providerWallet.create({
      data: {
        providerId: provider.id,
        availableBalancePaisa: 50000,
      },
    });

    // Attempt to delete provider directly while wallet exists
    let deleteFailed = false;
    try {
      await prisma.provider.delete({
        where: { id: provider.id },
      });
    } catch (err: any) {
      deleteFailed = true;
      // Foreign key constraint violation code in PostgreSQL is 23503 (P2003 in Prisma)
      assert.ok(
        err.message.includes('Foreign key constraint violated') ||
          err.code === 'P2003' ||
          err.message.includes('provider_wallets_provider_id_fkey'),
        `Expected foreign key restriction error, got: ${err.message}`
      );
    }

    assert.strictEqual(deleteFailed, true, 'Provider deletion must be rejected when active wallet exists');

    // Cleanup: delete wallet first, then provider, then user
    await prisma.providerWallet.delete({ where: { providerId: provider.id } });
    await prisma.provider.delete({ where: { id: provider.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('2. Enforces PostgreSQL CHECK constraint on non-negative wallet balance', async () => {
    const testUserId = `usr_test_neg_${Date.now()}`;
    const testPhone = `+919998${Math.floor(100000 + Math.random() * 900000)}`;

    const user = await prisma.user.create({
      data: {
        id: testUserId,
        phoneNumber: testPhone,
        fullName: 'Test Balance Check',
      },
    });

    const provider = await prisma.provider.create({
      data: {
        userId: user.id,
        businessName: 'Negative Test Services',
      },
    });

    let checkViolated = false;
    try {
      // Direct raw insert or prisma create with negative available balance
      await prisma.$executeRawUnsafe(
        `INSERT INTO provider_wallets (id, provider_id, available_balance_paisa, pending_balance_paisa, paid_out_balance_paisa, currency, created_at, updated_at)
         VALUES ($1, $2, -500, 0, 0, 'INR', NOW(), NOW())`,
        `wlt_neg_${Date.now()}`,
        provider.id
      );
    } catch (err: any) {
      checkViolated = true;
      assert.ok(
        err.message.includes('chk_provider_wallets_available_non_negative') ||
          err.message.includes('violates check constraint'),
        `Expected check constraint error, got: ${err.message}`
      );
    }

    assert.strictEqual(checkViolated, true, 'Negative wallet balance must be rejected by PostgreSQL CHECK constraint');

    await prisma.provider.delete({ where: { id: provider.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('3. Enforces single default address partial unique constraint', async () => {
    const testUserId = `usr_addr_test_${Date.now()}`;
    const testPhone = `+919997${Math.floor(100000 + Math.random() * 900000)}`;

    const user = await prisma.user.create({
      data: {
        id: testUserId,
        phoneNumber: testPhone,
        fullName: 'Address Default Tester',
      },
    });

    // Create first default address
    await prisma.address.create({
      data: {
        userId: user.id,
        addressLine1: 'Flat 101, Test Tower',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        latitude: 12.9716,
        longitude: 77.5946,
        isDefault: true,
      },
    });

    // Attempt to insert second default address for the same user
    let duplicateRejected = false;
    try {
      await prisma.address.create({
        data: {
          userId: user.id,
          addressLine1: 'Flat 202, Another Tower',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560002',
          latitude: 12.972,
          longitude: 77.595,
          isDefault: true,
        },
      });
    } catch (err: any) {
      duplicateRejected = true;
      assert.ok(
        err.message.includes('uq_customer_single_default_address') ||
          err.code === 'P2002' ||
          err.message.includes('Unique constraint failed'),
        `Expected partial unique index error, got: ${err.message}`
      );
    }

    assert.strictEqual(duplicateRejected, true, 'Second default address must be rejected by partial unique index');

    // Inserting non-default address should succeed
    const nonDefault = await prisma.address.create({
      data: {
        userId: user.id,
        addressLine1: 'Flat 303, Non Default Tower',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560003',
        latitude: 12.973,
        longitude: 77.596,
        isDefault: false,
      },
    });
    assert.ok(nonDefault.id);

    // Cleanup
    await prisma.address.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('4. Enforces single accepted quote partial unique constraint per booking', async () => {
    const custId = `usr_cust_q_${Date.now()}`;
    const prov1Id = `usr_prov1_q_${Date.now()}`;
    const prov2Id = `usr_prov2_q_${Date.now()}`;

    const cust = await prisma.user.create({
      data: { id: custId, phoneNumber: `+919991${Math.floor(100000 + Math.random() * 900000)}` },
    });
    const prov1User = await prisma.user.create({
      data: { id: prov1Id, phoneNumber: `+919992${Math.floor(100000 + Math.random() * 900000)}` },
    });
    const prov2User = await prisma.user.create({
      data: { id: prov2Id, phoneNumber: `+919993${Math.floor(100000 + Math.random() * 900000)}` },
    });

    const provider1 = await prisma.provider.create({ data: { userId: prov1User.id } });
    const provider2 = await prisma.provider.create({ data: { userId: prov2User.id } });

    const category = await prisma.serviceCategory.create({
      data: { name: 'Quote Test Cat', slug: `quote-cat-${Date.now()}` },
    });

    const service = await prisma.service.create({
      data: {
        name: 'Quote Test Service',
        slug: `quote-srv-${Date.now()}`,
        categoryId: category.id,
        pricingModel: 'CUSTOM_QUOTE',
      },
    });

    const address = await prisma.address.create({
      data: {
        userId: cust.id,
        addressLine1: '123 Main St',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        latitude: 12.9,
        longitude: 77.6,
      },
    });

    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `BKQ${Date.now()}`,
        customerId: cust.id,
        serviceId: service.id,
        addressId: address.id,
        pricingModel: 'CUSTOM_QUOTE',
        scheduledDate: new Date(),
        scheduledTimeSlot: '10:00 - 12:00',
        startOtp: '123456',
        currentStatus: 'REQUESTED',
      },
    });

    // Provider 1 submits quote and it gets accepted
    await prisma.bookingQuote.create({
      data: {
        bookingId: booking.id,
        providerId: provider1.id,
        quoteAmountPaisa: 150000,
        status: 'ACCEPTED',
      },
    });

    // Provider 2 attempts to also transition quote to ACCEPTED
    let secondAcceptFailed = false;
    try {
      await prisma.bookingQuote.create({
        data: {
          bookingId: booking.id,
          providerId: provider2.id,
          quoteAmountPaisa: 140000,
          status: 'ACCEPTED',
        },
      });
    } catch (err: any) {
      secondAcceptFailed = true;
      assert.ok(
        err.message.includes('uq_booking_single_accepted_quote') ||
          err.code === 'P2002' ||
          err.message.includes('Unique constraint failed'),
        `Expected partial unique index violation, got: ${err.message}`
      );
    }

    assert.strictEqual(secondAcceptFailed, true, 'Second accepted quote must be rejected by PostgreSQL partial unique index');

    // Cleanup
    await prisma.bookingQuote.deleteMany({ where: { bookingId: booking.id } });
    await prisma.booking.delete({ where: { id: booking.id } });
    await prisma.address.delete({ where: { id: address.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
    await prisma.provider.delete({ where: { id: provider1.id } });
    await prisma.provider.delete({ where: { id: provider2.id } });
    await prisma.user.deleteMany({ where: { id: { in: [custId, prov1Id, prov2Id] } } });
  });

  it('5. Enforces unique constraint on refund idempotencyKey', async () => {
    const custId = `usr_ref_idemp_${Date.now()}`;
    const cust = await prisma.user.create({
      data: { id: custId, phoneNumber: `+919994${Math.floor(100000 + Math.random() * 900000)}` },
    });

    const category = await prisma.serviceCategory.create({
      data: { name: 'Refund Cat', slug: `ref-cat-${Date.now()}` },
    });

    const service = await prisma.service.create({
      data: {
        name: 'Refund Service',
        slug: `ref-srv-${Date.now()}`,
        categoryId: category.id,
      },
    });

    const address = await prisma.address.create({
      data: {
        userId: cust.id,
        addressLine1: 'Refund Address',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        latitude: 12.9,
        longitude: 77.6,
      },
    });

    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `BKREF${Date.now()}`,
        customerId: cust.id,
        serviceId: service.id,
        addressId: address.id,
        pricingModel: 'FIXED_PRICE',
        scheduledDate: new Date(),
        scheduledTimeSlot: '10:00 - 12:00',
        startOtp: '123456',
        currentStatus: 'CONFIRMED',
      },
    });

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        gateway: 'RAZORPAY',
        amountPaisa: 50000,
        status: 'CAPTURED',
        idempotencyKey: `idemp_pay_${Date.now()}`,
      },
    });

    const testIdempKey = `idemp_rfnd_${Date.now()}`;

    // Create initial refund
    await prisma.refund.create({
      data: {
        paymentId: payment.id,
        amountPaisa: 25000,
        reason: 'Customer request',
        initiatedBy: cust.id,
        status: 'SUCCEEDED',
        idempotencyKey: testIdempKey,
      },
    });

    // Attempt second refund with exact same idempotencyKey
    let duplicateRejected = false;
    try {
      await prisma.refund.create({
        data: {
          paymentId: payment.id,
          amountPaisa: 25000,
          reason: 'Duplicate retry',
          initiatedBy: cust.id,
          status: 'PROCESSING',
          idempotencyKey: testIdempKey,
        },
      });
    } catch (err: any) {
      duplicateRejected = true;
      assert.ok(
        err.message.includes('refunds_idempotency_key_key') ||
          err.code === 'P2002' ||
          err.message.includes('Unique constraint failed'),
        `Expected unique idempotency key error, got: ${err.message}`
      );
    }

    assert.strictEqual(duplicateRejected, true, 'Duplicate refund idempotency key must be rejected by unique index');

    // Cleanup
    await prisma.refund.deleteMany({ where: { paymentId: payment.id } });
    await prisma.payment.delete({ where: { id: payment.id } });
    await prisma.booking.delete({ where: { id: booking.id } });
    await prisma.address.delete({ where: { id: address.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
    await prisma.user.delete({ where: { id: cust.id } });
  });

  it('6. Enforces review rating range CHECK constraint (1 to 5)', async () => {
    let checkViolated = false;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO reviews (id, booking_id, customer_id, provider_id, rating, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 6, 'PUBLISHED', NOW(), NOW())`,
        `rev_check_${Date.now()}`,
        `bkg_fake_${Date.now()}`,
        `cust_fake_${Date.now()}`,
        `prov_fake_${Date.now()}`
      );
    } catch (err: any) {
      checkViolated = true;
      assert.ok(
        err.message.includes('chk_reviews_rating_range') ||
          err.message.includes('violates check constraint'),
        `Expected rating check constraint error, got: ${err.message}`
      );
    }

    assert.strictEqual(checkViolated, true, 'Review rating > 5 must be rejected by PostgreSQL CHECK constraint');
  });
});

