import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { createMockPrisma } from './helpers/mock-prisma.js';

describe('Customer Service Catalog & Discovery Tests (Phase 3B)', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  const rootCategory = {
    id: 'cat_plumbing',
    name: 'Plumbing Services',
    slug: 'plumbing',
    displayOrder: 1,
    isActive: true,
  };

  const inactiveCategory = {
    id: 'cat_inactive',
    name: 'Obsolete Category',
    slug: 'obsolete',
    displayOrder: 99,
    isActive: false,
  };

  const activeFixedService = {
    id: 'srv_tap_repair',
    categoryId: 'cat_plumbing',
    name: 'Tap & Shower Repair',
    slug: 'tap-shower-repair',
    description: 'Fix leaking taps and showers.',
    pricingModel: 'FIXED_PRICE',
    basePricePaisa: 19900, // ₹199
    hourlyRatePaisa: null,
    inspectionFeePaisa: null,
    estimatedDurationMinutes: 45,
    isMaterialAllowed: true,
    platformCommissionPercent: 15.0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const activeHourlyService = {
    id: 'srv_hourly_plumber',
    categoryId: 'cat_plumbing',
    name: 'Plumber by the Hour',
    slug: 'plumber-hourly',
    description: 'Hourly rate service for extensive pipe alterations.',
    pricingModel: 'HOURLY',
    basePricePaisa: 29900, // ₹299 first hour
    hourlyRatePaisa: 19900, // ₹199 subsequent hour
    inspectionFeePaisa: null,
    estimatedDurationMinutes: 60,
    isMaterialAllowed: true,
    platformCommissionPercent: 15.0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const inactiveService = {
    id: 'srv_inactive_drain',
    categoryId: 'cat_plumbing',
    name: 'Discontinued Drain Service',
    slug: 'discontinued-drain',
    description: 'Not offered anymore.',
    pricingModel: 'FIXED_PRICE',
    basePricePaisa: 10000,
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrisma = createMockPrisma();

    mockPrisma._store.serviceCategories.set(rootCategory.id, { ...rootCategory });
    mockPrisma._store.serviceCategories.set(inactiveCategory.id, { ...inactiveCategory });

    mockPrisma._store.services.set(activeFixedService.id, { ...activeFixedService });
    mockPrisma._store.services.set(activeHourlyService.id, { ...activeHourlyService });
    mockPrisma._store.services.set(inactiveService.id, { ...inactiveService });

    mockPrisma._store.users.set('usr_customer_1', {
      id: 'usr_customer_1',
      phoneNumber: '9876543210',
      fullName: 'Customer Test',
      isActive: true,
      userRoles: [{ roleId: 'CUSTOMER' }],
    });

    (globalThis as any).__prisma = mockPrisma;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
  });

  it('1. should allow unauthenticated customer access to GET /categories and return only active categories', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/categories',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert(Array.isArray(body.data));
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, 'cat_plumbing');
    assert.equal(body.data[0].name, 'Plumbing Services');
    // Service count should count only active services
    assert.equal(body.data[0].serviceCount, 2);
  });

  it('2. should get category by ID or slug and include its active services', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/categories/plumbing',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.slug, 'plumbing');
    assert.equal(body.data.services.length, 2);
    // Inactive service must not be included
    const serviceIds = body.data.services.map((s: any) => s.id);
    assert(!serviceIds.includes('srv_inactive_drain'));
  });

  it('3. should return 404 when querying an inactive or nonexistent category', async () => {
    const resInactive = await app.inject({
      method: 'GET',
      url: '/api/v1/categories/obsolete',
    });
    assert.equal(resInactive.statusCode, 404);

    const resNonexistent = await app.inject({
      method: 'GET',
      url: '/api/v1/categories/nonexistent_cat_id',
    });
    assert.equal(resNonexistent.statusCode, 404);
  });

  it('4. should search active services with pagination and filter by category', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/services?categoryId=cat_plumbing&query=Shower',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, 'srv_tap_repair');
    assert.equal(body.meta.total, 1);
    assert.equal(body.meta.page, 1);
  });

  it('5. should get service details by ID or slug and verify pricing model serialization', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/services/tap-shower-repair',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    const srv = body.data;

    assert.equal(srv.name, 'Tap & Shower Repair');
    assert.equal(srv.pricingModel, 'FIXED_PRICE');
    assert.equal(srv.basePricePaisa, 19900);
    assert.equal(srv.category.name, 'Plumbing Services');

    // Security invariant: Customer must NOT see internal platform commission percent
    assert.equal(srv.platformCommissionPercent, undefined);
  });

  it('6. should reject unauthenticated/customer mutations to create category or service', async () => {
    // Unauthenticated POST /catalog/categories
    const resUnauth = await app.inject({
      method: 'POST',
      url: '/api/v1/catalog/categories',
      payload: {
        name: 'Malicious Category',
        slug: 'malicious',
      },
    });
    assert.equal(resUnauth.statusCode, 401);

    // Customer authenticated user attempting to create category
    const customerToken = app.jwt.sign(
      { userId: 'usr_customer_1', phoneNumber: '9876543210', roles: ['CUSTOMER'] },
      { expiresIn: '1h' }
    );

    const resForbidden = await app.inject({
      method: 'POST',
      url: '/api/v1/catalog/categories',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: {
        name: 'Hacked Category',
        slug: 'hacked',
      },
    });
    assert.equal(resForbidden.statusCode, 403);
  });

  it('7. should enforce bounded pagination limits on search services', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/services?limit=100', // Exceeds schema max of 50
    });

    assert.equal(res.statusCode, 422); // Validation error on limit > 50
  });

  it('8. should verify backward compatibility with /catalog/categories and /catalog/services', async () => {
    const resCat = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/categories',
    });
    assert.equal(resCat.statusCode, 200);

    const resSrv = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/services',
    });
    assert.equal(resSrv.statusCode, 200);
  });
});
