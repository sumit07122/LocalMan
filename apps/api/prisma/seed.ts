import {
  PrismaClient,
  PricingModelEnum,
  BookingStatusEnum,
  VerificationStatus,
  ReviewStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding LocalMan database with realistic demo data...');

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

  // 2. Seed Admin User
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

  // 3. Seed Service Categories & Services (5 main categories + pest control)
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
          platformCommissionPercent: 15.0,
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
          platformCommissionPercent: 15.0,
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
          platformCommissionPercent: 15.0,
        },
        {
          name: 'Full Home Deep Cleaning (2 BHK)',
          slug: 'full-home-cleaning-2bhk',
          description: 'Complete scrubbing of bedrooms, living room, kitchen degreasing, and balcony.',
          pricingModel: PricingModelEnum.FIXED_PRICE,
          basePricePaisa: 299900, // ₹2,999
          estimatedDurationMinutes: 240,
          isMaterialAllowed: false,
          platformCommissionPercent: 15.0,
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
          platformCommissionPercent: 15.0,
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

  const servicesMap: Record<string, any> = {};

  for (const catData of categoriesData) {
    const { services, ...categoryFields } = catData;

    const category = await prisma.serviceCategory.upsert({
      where: { slug: categoryFields.slug },
      update: categoryFields,
      create: categoryFields,
    });

    for (const service of services) {
      const savedService = await prisma.service.upsert({
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
      servicesMap[service.slug] = savedService;
    }
  }

  console.log(`✅ Seeded ${categoriesData.length} service categories and services.`);

  // 4. Seed 5 Realistic Customers with addresses
  const customersData = [
    {
      phone: '9876543210',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      address: {
        id: 'addr_cust_01',
        label: 'Home',
        addressLine1: 'Flat 402, Sai Residency',
        addressLine2: '12th Main, Indiranagar',
        landmark: 'Near Indiranagar Metro Station',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        latitude: 12.9784,
        longitude: 77.6408,
      },
    },
    {
      phone: '9876543211',
      name: 'Priya Sundaram',
      email: 'priya.sundaram@example.com',
      address: {
        id: 'addr_cust_02',
        label: 'Villa',
        addressLine1: 'Villa 14, Prestige Palms',
        addressLine2: 'ECC Road, Whitefield',
        landmark: 'Opposite GR Tech Park',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560066',
        latitude: 12.9698,
        longitude: 77.7500,
      },
    },
    {
      phone: '9876543212',
      name: 'Vikram Malhotra',
      email: 'vikram.malhotra@example.com',
      address: {
        id: 'addr_cust_03',
        label: 'Apartment',
        addressLine1: 'Tower 3, Apt 3B, Sobha Iris',
        addressLine2: 'Outer Ring Road, Bellandur / Koramangala',
        landmark: 'Near Central Mall',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560034',
        latitude: 12.9352,
        longitude: 77.6245,
      },
    },
    {
      phone: '9876543213',
      name: 'Ananya Iyer',
      email: 'ananya.iyer@example.com',
      address: {
        id: 'addr_cust_04',
        label: 'Home',
        addressLine1: 'House 28, 5th Cross',
        addressLine2: 'Sampige Road, Malleshwaram',
        landmark: 'Near CTR Hotel',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560003',
        latitude: 13.0031,
        longitude: 77.5643,
      },
    },
    {
      phone: '9876543214',
      name: 'Rohan Varma',
      email: 'rohan.varma@example.com',
      address: {
        id: 'addr_cust_05',
        label: 'Condo',
        addressLine1: 'Tower 2, Apt 901, Brigade Gateway',
        addressLine2: 'Dr. Rajkumar Road, Rajajinagar',
        landmark: 'Next to Orion Mall',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560055',
        latitude: 13.0112,
        longitude: 77.5550,
      },
    },
  ];

  const seededCustomers: any[] = [];
  const seededAddresses: any[] = [];

  for (const c of customersData) {
    const user = await prisma.user.upsert({
      where: { phoneNumber: c.phone },
      update: {
        fullName: c.name,
        email: c.email,
        isActive: true,
        isPhoneVerified: true,
      },
      create: {
        phoneCountryCode: '+91',
        phoneNumber: c.phone,
        fullName: c.name,
        email: c.email,
        isActive: true,
        isPhoneVerified: true,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: 'CUSTOMER',
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: 'CUSTOMER',
      },
    });

    const addr = await prisma.address.upsert({
      where: { id: c.address.id },
      update: {
        ...c.address,
        userId: user.id,
        isDefault: true,
      },
      create: {
        ...c.address,
        userId: user.id,
        isDefault: true,
      },
    });

    seededCustomers.push(user);
    seededAddresses.push(addr);
  }

  console.log(`✅ Seeded ${seededCustomers.length} realistic verified customers with addresses.`);

  // 5. Seed 10 Providers across 5 categories (2 providers per category)
  const providersData = [
    // Category 1: Plumbing
    {
      phone: '9876500001',
      name: 'Ramesh Kumar',
      email: 'ramesh.plumber@localman.test',
      businessName: 'Ramesh Quick Plumbers',
      bio: 'Master certified plumber with 8+ years experience in bathroom leakages and fittings.',
      experienceYears: 8,
      lat: 12.9750,
      lng: 77.6350,
      ratingAverage: 4.85,
      ratingCount: 42,
      upiId: 'ramesh@okhdfcbank',
      bankHolder: 'Ramesh Kumar',
      serviceSlugs: ['tap-shower-repair', 'drain-cleaning-blockage', 'plumber-hourly'],
    },
    {
      phone: '9876500002',
      name: 'Ganesh Murthy',
      email: 'ganesh.plumbing@localman.test',
      businessName: 'Ganesh Hydro Solutions',
      bio: 'Fast response plumbing expert covering Koramangala & BTM Layout.',
      experienceYears: 6,
      lat: 12.9340,
      lng: 77.6200,
      ratingAverage: 4.90,
      ratingCount: 58,
      upiId: 'ganesh@okaxis',
      bankHolder: 'Ganesh Murthy',
      serviceSlugs: ['tap-shower-repair', 'drain-cleaning-blockage'],
    },
    // Category 2: Electrical
    {
      phone: '9876500003',
      name: 'Suresh Nair',
      email: 'suresh.electrical@localman.test',
      businessName: 'Suresh Express Electric',
      bio: 'Licensed wireman with 10 years experience in residential switchboards, MCBs & fans.',
      experienceYears: 10,
      lat: 12.9760,
      lng: 77.6420,
      ratingAverage: 4.75,
      ratingCount: 36,
      upiId: 'suresh@okicici',
      bankHolder: 'Suresh Nair',
      serviceSlugs: ['switch-socket-repair', 'ceiling-fan-installation', 'house-wiring-quotation'],
    },
    {
      phone: '9876500004',
      name: 'Amit Patel',
      email: 'amit.power@localman.test',
      businessName: 'Amit Smart Electricals',
      bio: 'Expert in home lighting, short circuit diagnostics & heavy appliance wiring.',
      experienceYears: 7,
      lat: 12.9680,
      lng: 77.7450,
      ratingAverage: 4.80,
      ratingCount: 29,
      upiId: 'amit@oksbi',
      bankHolder: 'Amit Patel',
      serviceSlugs: ['switch-socket-repair', 'ceiling-fan-installation'],
    },
    // Category 3: AC & Appliance Repair
    {
      phone: '9876500005',
      name: 'Mohammed Rafiq',
      email: 'rafiq.ac@localman.test',
      businessName: 'CoolTech AC Specialists',
      bio: 'Split AC jet servicing, compressor repair, and gas refilling specialist.',
      experienceYears: 9,
      lat: 12.9360,
      lng: 77.6180,
      ratingAverage: 4.92,
      ratingCount: 84,
      upiId: 'rafiq@okaxis',
      bankHolder: 'Mohammed Rafiq',
      serviceSlugs: ['ac-jet-service', 'refrigerator-repair'],
    },
    {
      phone: '9876500006',
      name: 'Rajesh Kulkarni',
      email: 'rajesh.appliances@localman.test',
      businessName: 'Kulkarni Appliance Care',
      bio: 'Diagnostic expert for refrigerators, washing machines, and microwave ovens.',
      experienceYears: 5,
      lat: 13.0010,
      lng: 77.5680,
      ratingAverage: 4.68,
      ratingCount: 23,
      upiId: 'rajesh@okhdfcbank',
      bankHolder: 'Rajesh Kulkarni',
      serviceSlugs: ['refrigerator-repair', 'washing-machine-repair'],
    },
    // Category 4: Carpentry
    {
      phone: '9876500007',
      name: 'Harish Carpenter',
      email: 'harish.wood@localman.test',
      businessName: 'Harish Custom Woodworks',
      bio: 'Modular furniture assembly, door locks, hinges, and wooden repairs.',
      experienceYears: 12,
      lat: 13.0120,
      lng: 77.5530,
      ratingAverage: 4.88,
      ratingCount: 47,
      upiId: 'harish@okicici',
      bankHolder: 'Harish Carpenter',
      serviceSlugs: ['door-lock-repair', 'carpenter-hourly'],
    },
    {
      phone: '9876500008',
      name: 'Manjunath Gowda',
      email: 'manju.carpenter@localman.test',
      businessName: 'Namma Carpenter Services',
      bio: '15 years experience in master carpentry, wardrobe sliders, and door latches.',
      experienceYears: 15,
      lat: 12.9730,
      lng: 77.6390,
      ratingAverage: 4.72,
      ratingCount: 31,
      upiId: 'manju@oksbi',
      bankHolder: 'Manjunath Gowda',
      serviceSlugs: ['door-lock-repair', 'carpenter-hourly'],
    },
    // Category 5: Cleaning & Pest Control
    {
      phone: '9876500009',
      name: 'Sunita Devi',
      email: 'sunita.cleaning@localman.test',
      businessName: 'ShineBright Deep Cleaners',
      bio: 'Professional bathroom and full home deep cleaning with industrial tools.',
      experienceYears: 6,
      lat: 12.9320,
      lng: 77.6280,
      ratingAverage: 4.95,
      ratingCount: 65,
      upiId: 'sunita@okhdfcbank',
      bankHolder: 'Sunita Devi',
      serviceSlugs: ['bathroom-deep-cleaning', 'full-home-cleaning-2bhk'],
    },
    {
      phone: '9876500010',
      name: 'Deepa Rao',
      email: 'deepa.pestcontrol@localman.test',
      businessName: 'PestGuard Solutions',
      bio: 'Safe herbal gel pest control and anti-termite drill treatments.',
      experienceYears: 8,
      lat: 12.9710,
      lng: 77.7480,
      ratingAverage: 4.82,
      ratingCount: 39,
      upiId: 'deepa@okaxis',
      bankHolder: 'Deepa Rao',
      serviceSlugs: ['cockroach-herbal-treatment', 'termite-treatment-quote'],
    },
  ];

  const seededProviders: any[] = [];

  for (let i = 0; i < providersData.length; i++) {
    const p = providersData[i];

    const user = await prisma.user.upsert({
      where: { phoneNumber: p.phone },
      update: {
        fullName: p.name,
        email: p.email,
        isActive: true,
        isPhoneVerified: true,
      },
      create: {
        phoneCountryCode: '+91',
        phoneNumber: p.phone,
        fullName: p.name,
        email: p.email,
        isActive: true,
        isPhoneVerified: true,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: 'PROVIDER',
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: 'PROVIDER',
      },
    });

    const provider = await prisma.provider.upsert({
      where: { userId: user.id },
      update: {
        businessName: p.businessName,
        bio: p.bio,
        experienceYears: p.experienceYears,
        verificationStatus: VerificationStatus.VERIFIED,
        isOnline: true,
        currentLatitude: p.lat,
        currentLongitude: p.lng,
        ratingAverage: p.ratingAverage,
        ratingCount: p.ratingCount,
        bankAccountHolder: p.bankHolder,
        bankAccountNumberEnc: `ENC_ACC_9182${i}001`,
        bankIfscCode: 'HDFC0001234',
        upiId: p.upiId,
      },
      create: {
        userId: user.id,
        businessName: p.businessName,
        bio: p.bio,
        experienceYears: p.experienceYears,
        verificationStatus: VerificationStatus.VERIFIED,
        isOnline: true,
        currentLatitude: p.lat,
        currentLongitude: p.lng,
        ratingAverage: p.ratingAverage,
        ratingCount: p.ratingCount,
        bankAccountHolder: p.bankHolder,
        bankAccountNumberEnc: `ENC_ACC_9182${i}001`,
        bankIfscCode: 'HDFC0001234',
        upiId: p.upiId,
      },
    });

    // Ensure Provider Wallet
    await prisma.providerWallet.upsert({
      where: { providerId: provider.id },
      update: {},
      create: {
        providerId: provider.id,
        availableBalancePaisa: 250000, // ₹2,500
        pendingBalancePaisa: 50000,
        paidOutBalancePaisa: 1500000,
      },
    });

    // Link services
    for (const slug of p.serviceSlugs) {
      const s = servicesMap[slug];
      if (s) {
        await prisma.providerService.upsert({
          where: {
            providerId_serviceId: {
              providerId: provider.id,
              serviceId: s.id,
            },
          },
          update: { isEnabled: true },
          create: {
            providerId: provider.id,
            serviceId: s.id,
            isEnabled: true,
          },
        });
      }
    }

    // Service area
    await prisma.providerServiceArea.upsert({
      where: { id: `sa_provider_${i + 1}` },
      update: {
        city: 'Bengaluru',
        serviceRadiusMeters: 15000,
        centerLatitude: p.lat,
        centerLongitude: p.lng,
      },
      create: {
        id: `sa_provider_${i + 1}`,
        providerId: provider.id,
        city: 'Bengaluru',
        serviceRadiusMeters: 15000,
        centerLatitude: p.lat,
        centerLongitude: p.lng,
      },
    });

    seededProviders.push(provider);
  }

  console.log(`✅ Seeded ${seededProviders.length} providers across 5 categories with wallets and service areas.`);

  // 6. Seed 20 Realistic Bookings in Distinct States
  const bookingConfigs = [
    // 1-2: REQUESTED
    {
      num: 'BK-20261027-001',
      custIdx: 0,
      provIdx: 0,
      serviceSlug: 'tap-shower-repair',
      status: BookingStatusEnum.REQUESTED,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 19900,
      total: 23482,
      earning: 16915,
      timeSlot: '02:00 PM - 04:00 PM',
      notes: 'Master bathroom showerhead leaking continuously.',
    },
    {
      num: 'BK-20261027-002',
      custIdx: 1,
      provIdx: 2,
      serviceSlug: 'switch-socket-repair',
      status: BookingStatusEnum.REQUESTED,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 14900,
      total: 17582,
      earning: 12665,
      timeSlot: '04:00 PM - 06:00 PM',
      notes: 'Kitchen microwave 16A socket sparking.',
    },
    // 3-4: PROVIDER_ACCEPTED
    {
      num: 'BK-20261027-003',
      custIdx: 2,
      provIdx: 1,
      serviceSlug: 'drain-cleaning-blockage',
      status: BookingStatusEnum.PROVIDER_ACCEPTED,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 34900,
      total: 41182,
      earning: 29665,
      timeSlot: '11:00 AM - 01:00 PM',
      notes: 'Kitchen sink drain blocked with food waste.',
    },
    {
      num: 'BK-20261027-004',
      custIdx: 3,
      provIdx: 3,
      serviceSlug: 'ceiling-fan-installation',
      status: BookingStatusEnum.PROVIDER_ACCEPTED,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 19900,
      total: 23482,
      earning: 16915,
      timeSlot: '10:00 AM - 12:00 PM',
      notes: 'New BLDC fan needs to be hung in guest room.',
    },
    // 5-6: CONFIRMED
    {
      num: 'BK-20261027-005',
      custIdx: 4,
      provIdx: 4,
      serviceSlug: 'ac-jet-service',
      status: BookingStatusEnum.CONFIRMED,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 49900,
      total: 58882,
      earning: 40918,
      timeSlot: '09:00 AM - 11:00 AM',
      notes: '1.5 ton split AC needs complete foaming jet service.',
    },
    {
      num: 'BK-20261027-006',
      custIdx: 0,
      provIdx: 6,
      serviceSlug: 'door-lock-repair',
      status: BookingStatusEnum.CONFIRMED,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 24900,
      total: 29382,
      earning: 21165,
      timeSlot: '03:00 PM - 05:00 PM',
      notes: 'Main door Godrej lock latch sticking.',
    },
    // 7-8: PROVIDER_ON_THE_WAY
    {
      num: 'BK-20261027-007',
      custIdx: 1,
      provIdx: 0,
      serviceSlug: 'tap-shower-repair',
      status: BookingStatusEnum.PROVIDER_ON_THE_WAY,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 19900,
      total: 23482,
      earning: 16915,
      timeSlot: '01:00 PM - 03:00 PM',
      notes: 'Geyser inlet angle valve replacement.',
    },
    {
      num: 'BK-20261027-008',
      custIdx: 2,
      provIdx: 2,
      serviceSlug: 'switch-socket-repair',
      status: BookingStatusEnum.PROVIDER_ON_THE_WAY,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 14900,
      total: 17582,
      earning: 12665,
      timeSlot: '02:00 PM - 04:00 PM',
      notes: 'Balcony switchboard replacement.',
    },
    // 9-10: ARRIVED
    {
      num: 'BK-20261027-009',
      custIdx: 3,
      provIdx: 5,
      serviceSlug: 'refrigerator-repair',
      status: BookingStatusEnum.ARRIVED,
      pricingModel: PricingModelEnum.INSPECTION_QUOTE,
      base: 24900,
      total: 29382,
      earning: 21165,
      timeSlot: '11:00 AM - 01:00 PM',
      notes: 'Double door fridge freezing lower compartment.',
    },
    {
      num: 'BK-20261027-010',
      custIdx: 4,
      provIdx: 7,
      serviceSlug: 'carpenter-hourly',
      status: BookingStatusEnum.ARRIVED,
      pricingModel: PricingModelEnum.HOURLY,
      base: 34900,
      total: 41182,
      earning: 29665,
      timeSlot: '12:00 PM - 02:00 PM',
      notes: 'Wardrobe sliding door jumping off track.',
    },
    // 11-12: JOB_STARTED
    {
      num: 'BK-20261027-011',
      custIdx: 0,
      provIdx: 8,
      serviceSlug: 'bathroom-deep-cleaning',
      status: BookingStatusEnum.JOB_STARTED,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 44900,
      total: 52982,
      earning: 35920,
      timeSlot: '10:00 AM - 12:00 PM',
      notes: 'Hard water scale removal on glass partition.',
      startedAt: new Date(Date.now() - 40 * 60 * 1000), // 40 mins ago
    },
    {
      num: 'BK-20261027-012',
      custIdx: 1,
      provIdx: 9,
      serviceSlug: 'cockroach-herbal-treatment',
      status: BookingStatusEnum.JOB_STARTED,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 89900,
      total: 106082,
      earning: 73718,
      timeSlot: '09:30 AM - 11:30 AM',
      notes: 'Modular kitchen cabinets anti-cockroach gel application.',
      startedAt: new Date(Date.now() - 25 * 60 * 1000), // 25 mins ago
    },
    // 13: JOB_EXTENDED
    {
      num: 'BK-20261027-013',
      custIdx: 2,
      provIdx: 0,
      serviceSlug: 'plumber-hourly',
      status: BookingStatusEnum.JOB_EXTENDED,
      pricingModel: PricingModelEnum.HOURLY,
      base: 29900,
      extraDuration: 19900,
      total: 58764,
      earning: 42330,
      timeSlot: '08:00 AM - 10:00 AM',
      notes: 'Complex concealed pipe repair requiring extra hour.',
      startedAt: new Date(Date.now() - 90 * 60 * 1000),
    },
    // 14: JOB_COMPLETED
    {
      num: 'BK-20261027-014',
      custIdx: 3,
      provIdx: 2,
      serviceSlug: 'house-wiring-quotation',
      status: BookingStatusEnum.JOB_COMPLETED,
      pricingModel: PricingModelEnum.INSPECTION_QUOTE,
      base: 19900,
      total: 23482,
      earning: 17512,
      timeSlot: '08:00 AM - 09:30 AM',
      notes: 'Full house electrical audit completed with safety checklist.',
      startedAt: new Date(Date.now() - 120 * 60 * 1000),
      completedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    // 15: PAYMENT_PENDING
    {
      num: 'BK-20261027-015',
      custIdx: 4,
      provIdx: 4,
      serviceSlug: 'ac-jet-service',
      status: BookingStatusEnum.PAYMENT_PENDING,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 49900,
      total: 58882,
      earning: 40918,
      timeSlot: '09:00 AM - 11:00 AM',
      notes: 'AC cleaned, awaiting customer online payment verification.',
      startedAt: new Date(Date.now() - 150 * 60 * 1000),
      completedAt: new Date(Date.now() - 60 * 60 * 1000),
    },
    // 16: PAYMENT_SETTLED
    {
      num: 'BK-20261027-016',
      custIdx: 0,
      provIdx: 1,
      serviceSlug: 'drain-cleaning-blockage',
      status: BookingStatusEnum.PAYMENT_SETTLED,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 34900,
      total: 41182,
      earning: 29665,
      timeSlot: 'Yesterday 04:00 PM - 06:00 PM',
      notes: 'Payment settled via UPI.',
      startedAt: new Date(Date.now() - 24 * 3600 * 1000),
      completedAt: new Date(Date.now() - 23 * 3600 * 1000),
    },
    // 17-18: REVIEWED
    {
      num: 'BK-20261027-017',
      custIdx: 1,
      provIdx: 3,
      serviceSlug: 'switch-socket-repair',
      status: BookingStatusEnum.REVIEWED,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 14900,
      total: 17582,
      earning: 12665,
      timeSlot: '2 days ago',
      notes: 'Switches repaired perfectly.',
      startedAt: new Date(Date.now() - 48 * 3600 * 1000),
      completedAt: new Date(Date.now() - 47 * 3600 * 1000),
      review: {
        rating: 5,
        title: 'Super fast & polite electrician!',
        body: 'Amit arrived right on time, diagnosed the faulty MCB switch immediately, and completed the job cleanly. Very professional!',
      },
    },
    {
      num: 'BK-20261027-018',
      custIdx: 2,
      provIdx: 8,
      serviceSlug: 'full-home-cleaning-2bhk',
      status: BookingStatusEnum.REVIEWED,
      pricingModel: PricingModelEnum.FIXED_PRICE,
      base: 299900,
      total: 353882,
      earning: 239920,
      timeSlot: '3 days ago',
      notes: 'Deep cleaning before housewarming.',
      startedAt: new Date(Date.now() - 72 * 3600 * 1000),
      completedAt: new Date(Date.now() - 68 * 3600 * 1000),
      review: {
        rating: 5,
        title: 'Sparkling clean home!',
        body: 'Sunita and team spent 4 hours meticulously cleaning kitchen chimneys, bathroom tiles, and balconies. Totally worth every rupee.',
      },
    },
    // 19: CANCELLED
    {
      num: 'BK-20261027-019',
      custIdx: 3,
      provIdx: 6,
      serviceSlug: 'carpenter-hourly',
      status: BookingStatusEnum.CANCELLED,
      pricingModel: PricingModelEnum.HOURLY,
      base: 34900,
      total: 41182,
      earning: 0,
      timeSlot: 'Yesterday',
      notes: 'Customer had an unexpected travel emergency.',
      cancellationReason: 'Customer emergency - requested reschedule',
      cancelledBy: 'CUSTOMER',
      cancelledAt: new Date(Date.now() - 20 * 3600 * 1000),
    },
    // 20: DISPUTED
    {
      num: 'BK-20261027-020',
      custIdx: 4,
      provIdx: 5,
      serviceSlug: 'washing-machine-repair',
      status: BookingStatusEnum.DISPUTED,
      pricingModel: PricingModelEnum.INSPECTION_QUOTE,
      base: 24900,
      total: 29382,
      earning: 0,
      timeSlot: 'Yesterday',
      notes: 'Issue not resolved after inspection.',
      complaint: {
        ticketNumber: 'CMP-20261027-001',
        category: 'SERVICE_QUALITY',
        description: 'Customer claims the washing machine still makes rattling noise after diagnosis.',
        priority: 'HIGH',
        status: 'OPEN',
      },
    },
  ];

  for (let i = 0; i < bookingConfigs.length; i++) {
    const b = bookingConfigs[i];
    const customer = seededCustomers[b.custIdx];
    const address = seededAddresses[b.custIdx];
    const provider = seededProviders[b.provIdx];
    const service = servicesMap[b.serviceSlug];

    if (!service) continue;

    const booking = await prisma.booking.upsert({
      where: { bookingNumber: b.num },
      update: {
        currentStatus: b.status,
      },
      create: {
        bookingNumber: b.num,
        customerId: customer.id,
        providerId: provider.id,
        serviceId: service.id,
        addressId: address.id,
        currentStatus: b.status,
        pricingModel: b.pricingModel,
        scheduledDate: new Date(),
        scheduledTimeSlot: b.timeSlot,
        startOtp: '482910',
        completionOtp: '918234',
        startedAt: b.startedAt ?? null,
        completedAt: b.completedAt ?? null,
        baseAmountPaisa: b.base,
        extraDurationAmountPaisa: b.extraDuration ?? 0,
        taxAmountPaisa: Math.round(b.base * 0.18),
        platformFeePaisa: Math.round(b.base * 0.15),
        totalAmountPaisa: b.total,
        providerEarningPaisa: b.earning,
        customerNotes: b.notes,
        cancellationReason: b.cancellationReason ?? null,
        cancelledBy: b.cancelledBy ?? null,
        cancelledAt: b.cancelledAt ?? null,
        serviceSnapshot: {
          id: service.id,
          name: service.name,
          slug: service.slug,
          basePricePaisa: service.basePricePaisa,
        },
        addressSnapshot: {
          line1: address.addressLine1,
          line2: address.addressLine2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          lat: address.latitude,
          lng: address.longitude,
        },
        pricingSnapshot: {
          baseAmountPaisa: b.base,
          totalAmountPaisa: b.total,
          providerEarningPaisa: b.earning,
        },
      },
    });

    // Seed status history entry
    await prisma.bookingStatusHistory.upsert({
      where: { id: `bsh_seed_${i + 1}` },
      update: {
        toState: b.status,
      },
      create: {
        id: `bsh_seed_${i + 1}`,
        bookingId: booking.id,
        fromState: null,
        toState: b.status,
        actorId: customer.id,
        actorRole: 'CUSTOMER',
        reason: `Initial seed state: ${b.status}`,
      },
    });

    // Seed review if specified
    if (b.review) {
      await prisma.review.upsert({
        where: { bookingId: booking.id },
        update: {
          rating: b.review.rating,
          title: b.review.title,
          body: b.review.body,
          comment: b.review.body,
          status: ReviewStatus.PUBLISHED,
        },
        create: {
          bookingId: booking.id,
          customerId: customer.id,
          providerId: provider.id,
          rating: b.review.rating,
          title: b.review.title,
          body: b.review.body,
          comment: b.review.body,
          status: ReviewStatus.PUBLISHED,
        },
      });
    }

    // Seed complaint if specified
    if (b.complaint) {
      await prisma.complaint.upsert({
        where: { ticketNumber: b.complaint.ticketNumber },
        update: {
          bookingId: booking.id,
          raisedBy: customer.id,
          category: b.complaint.category,
          description: b.complaint.description,
          priority: b.complaint.priority,
          status: b.complaint.status,
        },
        create: {
          ticketNumber: b.complaint.ticketNumber,
          bookingId: booking.id,
          raisedBy: customer.id,
          category: b.complaint.category,
          description: b.complaint.description,
          priority: b.complaint.priority,
          status: b.complaint.status,
        },
      });
    }
  }

  console.log(`✅ Seeded ${bookingConfigs.length} realistic bookings across 10 distinct states.`);
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
