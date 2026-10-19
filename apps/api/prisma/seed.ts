import { PrismaClient, PricingModelEnum } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding LocalMan database...');

  // 1. Seed Roles
  const roles = [
    { id: 'CUSTOMER', name: 'Customer', description: 'End user seeking services' },
    { id: 'PROVIDER', name: 'Provider', description: 'Verified service professional' },
    { id: 'ADMIN', name: 'Super Admin', description: 'Platform super administrator' },
    { id: 'CITY_MANAGER', name: 'City Manager', description: 'Regional operations manager' },
    { id: 'KYC_VERIFIER', name: 'KYC Verifier', description: 'Document verification officer' },
    { id: 'SUPPORT_AGENT', name: 'Support Agent', description: 'Customer & partner support' },
    { id: 'FINANCE_MANAGER', name: 'Finance Manager', description: 'Payouts and settlements' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: {},
      create: role,
    });
  }
  console.log(`✅ Roles seeded: ${roles.length}`);

  // 2. Seed Initial Admin User
  const adminUser = await prisma.user.upsert({
    where: { phoneNumber: '9999999999' },
    update: {},
    create: {
      phoneCountryCode: '+91',
      phoneNumber: '9999999999',
      fullName: 'System Administrator',
      email: 'admin@localman.in',
      isActive: true,
      isPhoneVerified: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: 'ADMIN',
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: 'ADMIN',
    },
  });
  console.log(`✅ Admin user seeded: ${adminUser.phoneNumber}`);

  // 3. Seed Service Categories & Services
  const categoriesData = [
    {
      name: 'Plumbing Services',
      slug: 'plumbing',
      iconUrl: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=128&auto=format&fit=crop',
      imageUrl: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=800&auto=format&fit=crop',
      displayOrder: 1,
      services: [
        {
          name: 'Tap & Shower Repair / Replacement',
          slug: 'tap-shower-repair',
          description: 'Repair leaking taps, faucets, showerheads, or install new fittings.',
          pricingModel: PricingModelEnum.FIXED_PRICE,
          basePricePaisa: 19900, // ₹199
          estimatedDurationMinutes: 45,
          isMaterialAllowed: true,
          platformCommissionPercent: 15.0,
        },
        {
          name: 'Blockage & Drain Cleaning',
          slug: 'drain-cleaning-blockage',
          description: 'Clearing clogged sinks, washbasins, bathroom drains, and pipes.',
          pricingModel: PricingModelEnum.FIXED_PRICE,
          basePricePaisa: 34900, // ₹349
          estimatedDurationMinutes: 60,
          isMaterialAllowed: true,
          platformCommissionPercent: 15.0,
        },
        {
          name: 'General Plumber by the Hour',
          slug: 'plumber-hourly',
          description: 'Dedicated plumber for complex bathroom fitting, multiple installations, or pipe alterations.',
          pricingModel: PricingModelEnum.HOURLY,
          basePricePaisa: 29900, // ₹299 first hour
          hourlyRatePaisa: 19900, // ₹199 each subsequent hour
          estimatedDurationMinutes: 60,
          isMaterialAllowed: true,
          platformCommissionPercent: 15.0,
        },
      ],
    },
    {
      name: 'Electrician & Wiring',
      slug: 'electrician',
      iconUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=128&auto=format&fit=crop',
      imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop',
      displayOrder: 2,
      services: [
        {
          name: 'Switch & Socket Installation / Repair',
          slug: 'switch-socket-repair',
          description: 'Replacement or repair of burnt switches, power sockets, or MCB switchboards.',
          pricingModel: PricingModelEnum.FIXED_PRICE,
          basePricePaisa: 14900, // ₹149
          estimatedDurationMinutes: 30,
          isMaterialAllowed: true,
          platformCommissionPercent: 15.0,
        },
        {
          name: 'Ceiling Fan Installation & Repair',
          slug: 'ceiling-fan-installation',
          description: 'New fan hanging, regulator replacement, bearing noise fix.',
          pricingModel: PricingModelEnum.FIXED_PRICE,
          basePricePaisa: 19900, // ₹199
          estimatedDurationMinutes: 45,
          isMaterialAllowed: true,
          platformCommissionPercent: 15.0,
        },
        {
          name: 'Complete House Wiring Inspection & Quotation',
          slug: 'house-wiring-quotation',
          description: 'Inspection of full home electrical load, MCB distribution board, and custom quotation.',
          pricingModel: PricingModelEnum.INSPECTION_QUOTE,
          basePricePaisa: 19900, // ₹199 inspection fee
          inspectionFeePaisa: 19900,
          estimatedDurationMinutes: 60,
          isMaterialAllowed: true,
          platformCommissionPercent: 12.0,
        },
      ],
    },
    {
      name: 'AC & Appliance Repair',
      slug: 'ac-appliance-repair',
      iconUrl: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=128&auto=format&fit=crop',
      imageUrl: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&auto=format&fit=crop',
      displayOrder: 3,
      services: [
        {
          name: 'Split / Window AC Deep Jet Service',
          slug: 'ac-jet-service',
          description: 'High-pressure foam jet cleaning of indoor and outdoor coils, drain tray, and filter.',
          pricingModel: PricingModelEnum.FIXED_PRICE,
          basePricePaisa: 49900, // ₹499
          estimatedDurationMinutes: 60,
          isMaterialAllowed: true,
          platformCommissionPercent: 18.0,
        },
        {
          name: 'Refrigerator Not Cooling / Diagnostic',
          slug: 'refrigerator-repair',
          description: 'Gas leakage check, thermostat, relay, or compressor diagnostic.',
          pricingModel: PricingModelEnum.INSPECTION_QUOTE,
          basePricePaisa: 24900, // ₹249 visit/inspection fee
          inspectionFeePaisa: 24900,
          estimatedDurationMinutes: 45,
          isMaterialAllowed: true,
          platformCommissionPercent: 15.0,
        },
        {
          name: 'Washing Machine Repair & Checkup',
          slug: 'washing-machine-repair',
          description: 'Diagnostic for motor, drum spin, water intake valve, or drainage issue.',
          pricingModel: PricingModelEnum.INSPECTION_QUOTE,
          basePricePaisa: 24900,
          inspectionFeePaisa: 24900,
          estimatedDurationMinutes: 45,
          isMaterialAllowed: true,
          platformCommissionPercent: 15.0,
        },
      ],
    },
    {
      name: 'Carpentry & Furniture',
      slug: 'carpentry',
      iconUrl: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=128&auto=format&fit=crop',
      imageUrl: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&auto=format&fit=crop',
      displayOrder: 4,
      services: [
        {
          name: 'Door Lock / Latch Repair & Installation',
          slug: 'door-lock-repair',
          description: 'Handle, mortise lock, cylindrical lock, or tower bolt repair/installation.',
          pricingModel: PricingModelEnum.FIXED_PRICE,
          basePricePaisa: 24900, // ₹249
          estimatedDurationMinutes: 45,
          isMaterialAllowed: true,
          platformCommissionPercent: 15.0,
        },
        {
          name: 'Carpenter by the Hour',
          slug: 'carpenter-hourly',
          description: 'Custom furniture assembly, drawer slider fix, hinge alignment, or minor woodwork.',
          pricingModel: PricingModelEnum.HOURLY,
          basePricePaisa: 34900, // ₹349 first hour
          hourlyRatePaisa: 24900, // ₹249 next hour
          estimatedDurationMinutes: 60,
          isMaterialAllowed: true,
          platformCommissionPercent: 15.0,
        },
      ],
    },
    {
      name: 'Home Deep Cleaning',
      slug: 'cleaning',
      iconUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=128&auto=format&fit=crop',
      imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop',
      displayOrder: 5,
      services: [
        {
          name: 'Bathroom Deep Cleaning',
          slug: 'bathroom-deep-cleaning',
          description: 'Removal of hard water stains, tile scrubbing, mirror polishing, and sanitization.',
          pricingModel: PricingModelEnum.FIXED_PRICE,
          basePricePaisa: 44900, // ₹449
          estimatedDurationMinutes: 75,
          isMaterialAllowed: false,
          platformCommissionPercent: 20.0,
        },
        {
          name: 'Full Home Deep Cleaning (2 BHK)',
          slug: 'full-home-cleaning-2bhk',
          description: 'Complete scrubbing of bedrooms, living room, kitchen degreasing, and balcony.',
          pricingModel: PricingModelEnum.FIXED_PRICE,
          basePricePaisa: 299900, // ₹2,999
          estimatedDurationMinutes: 240,
          isMaterialAllowed: false,
          platformCommissionPercent: 20.0,
        },
      ],
    },
    {
      name: 'Pest Control Services',
      slug: 'pest-control',
      iconUrl: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=128&auto=format&fit=crop',
      imageUrl: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=800&auto=format&fit=crop',
      displayOrder: 6,
      services: [
        {
          name: 'Cockroach & Ant Herbal Gel Treatment',
          slug: 'cockroach-herbal-treatment',
          description: 'Odorless, safe herbal gel and spray application with 90-day warranty.',
          pricingModel: PricingModelEnum.FIXED_PRICE,
          basePricePaisa: 89900, // ₹899
          estimatedDurationMinutes: 45,
          isMaterialAllowed: false,
          platformCommissionPercent: 18.0,
        },
        {
          name: 'Termite Inspection & Treatment',
          slug: 'termite-treatment-quote',
          description: 'Drill-fill-seal chemical barrier treatment with 2-year warranty.',
          pricingModel: PricingModelEnum.INSPECTION_QUOTE,
          basePricePaisa: 29900,
          inspectionFeePaisa: 29900,
          estimatedDurationMinutes: 60,
          isMaterialAllowed: true,
          platformCommissionPercent: 15.0,
        },
      ],
    },
  ];

  for (const catData of categoriesData) {
    const { services, ...categoryFields } = catData;

    const category = await prisma.serviceCategory.upsert({
      where: { slug: categoryFields.slug },
      update: categoryFields,
      create: categoryFields,
    });

    for (const service of services) {
      await prisma.service.upsert({
        where: { slug: service.slug },
        update: {
          ...service,
          categoryId: category.id,
        },
        create: {
          ...service,
          categoryId: category.id,
        },
      });
    }
  }

  console.log(`✅ Seeded ${categoriesData.length} service categories with real Indian service offerings.`);

  // 4. Seed Synthetic Development Users & Provider Accounts
  const devCustomer = await prisma.user.upsert({
    where: { phoneNumber: '9876543210' },
    update: {},
    create: {
      phoneCountryCode: '+91',
      phoneNumber: '9876543210',
      fullName: 'Dev Customer (Synthetic)',
      email: 'customer.dev@localman.test',
      isActive: true,
      isPhoneVerified: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: devCustomer.id,
        roleId: 'CUSTOMER',
      },
    },
    update: {},
    create: {
      userId: devCustomer.id,
      roleId: 'CUSTOMER',
    },
  });

  const devAddress = await prisma.address.upsert({
    where: { id: 'addr_dev_customer_01' },
    update: {},
    create: {
      id: 'addr_dev_customer_01',
      userId: devCustomer.id,
      label: 'Home',
      addressLine1: 'Flat 402, Sai Residency',
      addressLine2: '12th Main, Indiranagar',
      landmark: 'Near Metro Station',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      latitude: 12.9784,
      longitude: 77.6408,
      isDefault: true,
    },
  });

  // Synthetic Provider 1
  const devProviderUser1 = await prisma.user.upsert({
    where: { phoneNumber: '9876500001' },
    update: {},
    create: {
      phoneCountryCode: '+91',
      phoneNumber: '9876500001',
      fullName: 'Dev Provider Ramesh (Synthetic)',
      email: 'ramesh.provider@localman.test',
      isActive: true,
      isPhoneVerified: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: devProviderUser1.id,
        roleId: 'PROVIDER',
      },
    },
    update: {},
    create: {
      userId: devProviderUser1.id,
      roleId: 'PROVIDER',
    },
  });

  const devProvider1 = await prisma.provider.upsert({
    where: { userId: devProviderUser1.id },
    update: {},
    create: {
      userId: devProviderUser1.id,
      businessName: 'Ramesh Quick Plumbers (Synthetic)',
      bio: 'Certified master plumber with 8+ years experience in Indiranagar & Domlur.',
      experienceYears: 8,
      verificationStatus: 'VERIFIED',
      isOnline: true,
      currentLatitude: 12.9750,
      currentLongitude: 77.6350,
      ratingAverage: 4.85,
      ratingCount: 42,
      bankAccountHolder: 'Ramesh Kumar',
      bankAccountNumberEnc: '918273645019',
      bankIfscCode: 'HDFC0001234',
      upiId: 'ramesh@okhdfcbank',
    },
  });

  // Link Service to Provider 1
  const tapService = await prisma.service.findUnique({
    where: { slug: 'tap-shower-repair' },
  });

  if (tapService) {
    await prisma.providerService.upsert({
      where: {
        providerId_serviceId: {
          providerId: devProvider1.id,
          serviceId: tapService.id,
        },
      },
      update: {},
      create: {
        providerId: devProvider1.id,
        serviceId: tapService.id,
        isEnabled: true,
      },
    });

    // Synthetic Provider Service Area
    await prisma.providerServiceArea.upsert({
      where: { id: 'sa_dev_provider1_01' },
      update: {},
      create: {
        id: 'sa_dev_provider1_01',
        providerId: devProvider1.id,
        city: 'Bengaluru',
        serviceRadiusMeters: 10000,
        centerLatitude: 12.9750,
        centerLongitude: 77.6350,
      },
    });

    // Synthetic Booking for Provider 1 in REQUESTED state
    const devBooking1 = await prisma.booking.upsert({
      where: { bookingNumber: 'BK-SYN-20261018-001' },
      update: {},
      create: {
        bookingNumber: 'BK-SYN-20261018-001',
        customerId: devCustomer.id,
        providerId: devProvider1.id,
        serviceId: tapService.id,
        addressId: devAddress.id,
        currentStatus: 'REQUESTED',
        pricingModel: 'FIXED_PRICE',
        scheduledDate: new Date(),
        scheduledTimeSlot: '10:00 AM - 12:00 PM',
        startOtp: '482910',
        baseAmountPaisa: 19900,
        taxAmountPaisa: 3582,
        platformFeePaisa: 2985,
        totalAmountPaisa: 23482,
        providerEarningPaisa: 16915,
        customerNotes: 'Master bathroom showerhead has zero pressure and pipe is vibrating.',
      },
    });

    await prisma.bookingStatusHistory.upsert({
      where: { id: 'bsh_dev_booking1_01' },
      update: {},
      create: {
        id: 'bsh_dev_booking1_01',
        bookingId: devBooking1.id,
        fromState: null,
        toState: 'REQUESTED',
        actorId: devCustomer.id,
        actorRole: 'CUSTOMER',
        reason: 'Initial synthetic booking placed by customer for dev testing',
      },
    });
  }

  // Synthetic Provider 2 (Isolation / IDOR verification)
  const devProviderUser2 = await prisma.user.upsert({
    where: { phoneNumber: '9876500002' },
    update: {},
    create: {
      phoneCountryCode: '+91',
      phoneNumber: '9876500002',
      fullName: 'Dev Provider Suresh (Synthetic)',
      email: 'suresh.provider@localman.test',
      isActive: true,
      isPhoneVerified: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: devProviderUser2.id,
        roleId: 'PROVIDER',
      },
    },
    update: {},
    create: {
      userId: devProviderUser2.id,
      roleId: 'PROVIDER',
    },
  });

  const devProvider2 = await prisma.provider.upsert({
    where: { userId: devProviderUser2.id },
    update: {},
    create: {
      userId: devProviderUser2.id,
      businessName: 'Suresh Multi-Services (Synthetic)',
      bio: 'Electrical & appliance diagnostics.',
      experienceYears: 5,
      verificationStatus: 'VERIFIED',
      isOnline: false,
      currentLatitude: 12.9250,
      currentLongitude: 77.5850,
      ratingAverage: 4.70,
      ratingCount: 19,
    },
  });

  console.log(`✅ Seeded synthetic dev users, providers (${devProvider1.businessName}, ${devProvider2.businessName}) and test bookings.`);
  console.log('🎉 LocalMan database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
