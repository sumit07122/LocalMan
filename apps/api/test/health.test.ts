import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { createMockPrisma } from './helpers/mock-prisma.js';

describe('Health Checks & CORS Hardening Tests (Phase 4D)', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    (globalThis as any).__prisma = mockPrisma;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
  });

  it('1. GET /health/live returns 200 OK with uptime and service metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/live',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'localman-api');
    assert.equal(typeof body.uptime, 'number');
    assert.ok(body.timestamp);
  });

  it('2. GET /health/ready returns 200 OK when database is reachable', async () => {
    mockPrisma.$queryRaw = async () => [{ '?column?': 1 }];

    const res = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, 'ok');
    assert.equal(body.database, 'connected');
    assert.ok(body.timestamp);
  });

  it('3. GET /health/ready returns 503 Service Unavailable when database query fails', async () => {
    mockPrisma.$queryRaw = async () => {
      throw new Error('Connection refused to PostgreSQL host');
    };

    const res = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    assert.equal(res.statusCode, 503);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, 'error');
    assert.equal(body.database, 'disconnected');
    assert.equal(body.message, 'Database connection check failed');
    assert.ok(body.timestamp);
  });

  it('4. GET /health returns 200 OK for legacy probe compatibility', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'localman-api');
  });

  it('5. CORS allows requests with no Origin header (e.g. mobile apps / curl)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/live',
    });

    assert.equal(res.statusCode, 200);
  });

  it('6. CORS allows allowed origins and sets credentials header', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health/live',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
      },
    });

    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  it('7. CORS rejects origins not on the allowlist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: {
        origin: 'http://unauthorized-attacker-site.com',
      },
    });

    assert.equal(res.statusCode, 500);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.ok(body.error.message.includes('not allowed by LocalMan CORS policy'));
  });
});
