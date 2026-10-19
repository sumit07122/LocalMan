import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { createMockPrisma } from './helpers/mock-prisma.js';

describe('Address Management API & Invariants (Phase 3A)', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  const customerA = {
    id: 'usr_customer_a',
    phoneNumber: '9876543210',
    fullName: 'Customer Alice',
    email: 'alice@example.com',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  const customerB = {
    id: 'usr_customer_b',
    phoneNumber: '9876543211',
    fullName: 'Customer Bob',
    email: 'bob@example.com',
    isActive: true,
    userRoles: [{ roleId: 'CUSTOMER' }],
  };

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockPrisma._store.users.set(customerA.id, { ...customerA });
    mockPrisma._store.users.set(customerB.id, { ...customerB });

    (globalThis as any).__prisma = mockPrisma;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
  });

  const generateToken = (userId: string, phoneNumber: string) => {
    return app.jwt.sign(
      { userId, phoneNumber, roles: ['CUSTOMER'] },
      { expiresIn: '1h' }
    );
  };

  it('1. should reject unauthenticated requests to /addresses with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/addresses',
    });
    assert.equal(res.statusCode, 401);
  });

  it('2. should list empty addresses for a new customer', async () => {
    const token = generateToken(customerA.id, customerA.phoneNumber);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/addresses',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.deepEqual(body.data, []);
  });

  it('3. should create first address and automatically mark it as default', async () => {
    const token = generateToken(customerA.id, customerA.phoneNumber);
    const payload = {
      label: 'Home',
      addressLine1: 'Flat 101, Palm Residency',
      addressLine2: 'Main Road',
      landmark: 'Near Metro Station',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      isDefault: false, // Even if requested as false, first address becomes default
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/addresses',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.userId, customerA.id);
    assert.equal(body.data.isDefault, true);
    assert.equal(body.data.postalCode, '560001');
    assert.equal(body.data.city, 'Bengaluru');
  });

  it('4. should create second address and un-default first if isDefault: true', async () => {
    const token = generateToken(customerA.id, customerA.phoneNumber);

    // Create first
    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/addresses',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: 'Home',
        addressLine1: 'Flat 101, Palm Residency',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        latitude: 12.9716,
        longitude: 77.5946,
      },
    });
    const firstAddr = JSON.parse(firstRes.payload).data;

    // Create second as default
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/v1/addresses',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: 'Office',
        addressLine1: 'Tech Park, Whitefield',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560066',
        latitude: 12.9698,
        longitude: 77.7499,
        isDefault: true,
      },
    });
    assert.equal(secondRes.statusCode, 201);
    const secondAddr = JSON.parse(secondRes.payload).data;
    assert.equal(secondAddr.isDefault, true);

    // Verify first address is no longer default
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/addresses/${firstAddr.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(getRes.statusCode, 200);
    const refreshedFirst = JSON.parse(getRes.payload).data;
    assert.equal(refreshedFirst.isDefault, false);
  });

  it('5. should reject address creation with invalid PIN code or out-of-range coordinates', async () => {
    const token = generateToken(customerA.id, customerA.phoneNumber);

    // Invalid PIN
    const resBadPin = await app.inject({
      method: 'POST',
      url: '/api/v1/addresses',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: 'Home',
        addressLine1: '123 Test St',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '012345', // Starts with 0 - invalid Indian PIN
        latitude: 12.9716,
        longitude: 77.5946,
      },
    });
    assert.equal(resBadPin.statusCode, 422);

    // Invalid latitude (> 90)
    const resBadLat = await app.inject({
      method: 'POST',
      url: '/api/v1/addresses',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: 'Home',
        addressLine1: '123 Test St',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        latitude: 105.0,
        longitude: 77.5946,
      },
    });
    assert.equal(resBadLat.statusCode, 422);
  });

  it('6. should strictly enforce IDOR protections across users', async () => {
    const tokenA = generateToken(customerA.id, customerA.phoneNumber);
    const tokenB = generateToken(customerB.id, customerB.phoneNumber);

    // Alice creates an address
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/addresses',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        label: 'Alice Private Home',
        addressLine1: '404 Secret Garden',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        latitude: 12.9716,
        longitude: 77.5946,
      },
    });
    const addrA = JSON.parse(createRes.payload).data;

    // Bob attempts to read Alice's address -> 403 Forbidden
    const bobRead = await app.inject({
      method: 'GET',
      url: `/api/v1/addresses/${addrA.id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(bobRead.statusCode, 403);

    // Bob attempts to update Alice's address -> 403 Forbidden
    const bobUpdate = await app.inject({
      method: 'PUT',
      url: `/api/v1/addresses/${addrA.id}`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: {
        label: 'Hacked by Bob',
      },
    });
    assert.equal(bobUpdate.statusCode, 403);

    // Bob attempts to delete Alice's address -> 403 Forbidden
    const bobDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/addresses/${addrA.id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(bobDelete.statusCode, 403);
  });

  it('7. should promote remaining address to default when default address is deleted', async () => {
    const token = generateToken(customerA.id, customerA.phoneNumber);

    // Create 1st address
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/addresses',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: 'Address 1',
        addressLine1: '1st Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        latitude: 12.9716,
        longitude: 77.5946,
      },
    });
    const addr1 = JSON.parse(res1.payload).data;

    // Create 2nd address as default
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/addresses',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: 'Address 2',
        addressLine1: '2nd Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560002',
        latitude: 12.9720,
        longitude: 77.5950,
        isDefault: true,
      },
    });
    const addr2 = JSON.parse(res2.payload).data;
    assert.equal(addr2.isDefault, true);

    // Delete addr2 (the default address)
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/addresses/${addr2.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(delRes.statusCode, 200);

    // Verify addr1 was promoted to default
    const getRes1 = await app.inject({
      method: 'GET',
      url: `/api/v1/addresses/${addr1.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const refreshedAddr1 = JSON.parse(getRes1.payload).data;
    assert.equal(refreshedAddr1.isDefault, true);
  });
});
