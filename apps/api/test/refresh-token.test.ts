import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { createMockPrisma } from './helpers/mock-prisma.js';
import { hashString } from '../src/common/utils/crypto.js';

describe('Auth & Refresh Token Rotation Contract Tests', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  const testUser = {
    id: 'usr_test_user_001',
    phoneNumber: '9876543210',
    fullName: 'Test User',
    email: 'test@localman.in',
    isActive: true,
    userRoles: [{ roleId: 'PROVIDER' }],
  };

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockPrisma._store.users.set(testUser.id, { ...testUser });

    // Inject mock into globalThis.__prisma so all imports use it
    (globalThis as any).__prisma = mockPrisma;

    // Dynamically import buildApp so it picks up the mock prisma instance
    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
  });

  it('1. should succeed for a valid refresh token and perform rotation', async () => {
    // Generate valid refresh token JWT
    const initialRefreshToken = app.jwt.sign(
      { userId: testUser.id, type: 'refresh', jti: randomUUID() },
      { expiresIn: '30d' }
    );
    const initialHash = hashString(initialRefreshToken);

    // Save in mock DB
    await mockPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: initialHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isRevoked: false,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: initialRefreshToken },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, true);
    assert(body.data.accessToken, 'Access token must be returned');
    assert(body.data.refreshToken, 'Rotated refresh token must be returned');
    assert.notEqual(
      body.data.refreshToken,
      initialRefreshToken,
      'Rotated refresh token must be different from initial token'
    );

    // Verify database state: old token marked revoked, new token stored
    const oldStored = await mockPrisma.refreshToken.findUnique({
      where: { tokenHash: initialHash },
    });
    assert.equal(oldStored?.isRevoked, true, 'Old token must be marked as revoked');
    assert(oldStored?.replacedBy, 'Old token must reference the new token hash');

    const newHash = hashString(body.data.refreshToken);
    const newStored = await mockPrisma.refreshToken.findUnique({
      where: { tokenHash: newHash },
    });
    assert(newStored, 'New rotated token must be stored in DB');
    assert.equal(newStored?.isRevoked, false, 'New token must be active');
  });

  it('2. should reject an expired refresh token with 401', async () => {
    const expiredRefreshToken = app.jwt.sign(
      { userId: testUser.id, type: 'refresh', jti: randomUUID() },
      { expiresIn: '30d' }
    );
    const expiredHash = hashString(expiredRefreshToken);

    await mockPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
        isRevoked: false,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: expiredRefreshToken },
    });

    assert.equal(response.statusCode, 401);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, false);
    assert.match(body.error.message, /expired/i);
  });

  it('3. should reject a revoked refresh token with 401', async () => {
    const revokedRefreshToken = app.jwt.sign(
      { userId: testUser.id, type: 'refresh', jti: randomUUID() },
      { expiresIn: '30d' }
    );
    const revokedHash = hashString(revokedRefreshToken);

    await mockPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: revokedHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isRevoked: true, // Already revoked
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: revokedRefreshToken },
    });

    assert.equal(response.statusCode, 401);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, false);
    assert.match(body.error.message, /replay detected|invalid/i);
  });

  it('4. should reject an invalid/malformed refresh token with 401 or 422', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'not.a.valid.jwt.token' },
    });

    assert.equal(response.statusCode, 401);
    const body = JSON.parse(response.payload);
    assert.equal(body.success, false);
    assert.match(body.error.message, /invalid|expired/i);
  });

  it('5. should detect refresh-token replay attacks and revoke active sessions', async () => {
    // 1. Issue Token 1
    const token1 = app.jwt.sign(
      { userId: testUser.id, type: 'refresh' },
      { expiresIn: '30d' }
    );
    const token1Hash = hashString(token1);
    await mockPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: token1Hash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isRevoked: false,
      },
    });

    // 2. Legitimate client refreshes Token 1 -> receives Token 2
    const firstRefresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: token1 },
    });
    assert.equal(firstRefresh.statusCode, 200);
    const token2 = JSON.parse(firstRefresh.payload).data.refreshToken;
    const token2Hash = hashString(token2);

    // Verify Token 2 is active and Token 1 is revoked
    let storedToken2 = await mockPrisma.refreshToken.findUnique({
      where: { tokenHash: token2Hash },
    });
    assert.equal(storedToken2?.isRevoked, false);

    // 3. Attacker replays Token 1 (already rotated)
    const replayAttempt = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: token1 },
    });

    assert.equal(replayAttempt.statusCode, 401);
    const replayBody = JSON.parse(replayAttempt.payload);
    assert.equal(replayBody.success, false);
    assert.match(replayBody.error.message, /replay detected/i);

    // 4. Verify that ALL tokens for this user were invalidated as a security countermeasure
    storedToken2 = await mockPrisma.refreshToken.findUnique({
      where: { tokenHash: token2Hash },
    });
    assert.equal(
      storedToken2?.isRevoked,
      true,
      'Active session token must be revoked when replay is detected'
    );
  });
});
