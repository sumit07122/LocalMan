# LocalMan Platform: Automated Database Testing & Verification Strategy

**Author**: Principal Database Architect, Senior Quality Engineering Specialist  
**Date**: November 1, 2026  
**Test Harness**: Node.js Test Runner (`tsx --test`), Prisma ORM 6.19.3, PostgreSQL 16  

---

## 1. Dual-Tier Testing Architecture

A commercial marketplace cannot rely exclusively on in-memory mocks for database correctness. While unit tests using `mock-prisma.ts` provide sub-minute regression feedback for business logic, **critical database invariants can only be verified against real PostgreSQL**:
* Foreign key cascade and restrict rules.
* Partial unique indexes (`WHERE status = 'ACCEPTED'`).
* Database check constraints (`available_balance_paisa >= 0`).
* Transaction isolation and row-level locking (`SELECT FOR UPDATE`).
* Concurrency races (two providers simultaneously claiming the same job).

```mermaid
flowchart LR
    Unit["Tier 1: Fast Unit Regression (Mock Prisma)<br>520 Tests (Fastify, FSM, Mock Store)"]
    Integration["Tier 2: Real PostgreSQL Integration Tests<br>Direct DDL, FK Restrict, Concurrency, PostGIS"]
    
    Unit --> FastFeedback["Pre-commit & PR checks (Fast)"]
    Integration --> ProdGate["Nightly & Release Gating (Authoritative)"]
```

---

## 2. Test Execution Inventory & Status Classification

| Test Suite / Category | Engine | Target Invariant / Scope | Status | Notes |
| :--- | :---: | :--- | :---: | :--- |
| **Address Invariants (Phase 3A)** | Mock Prisma | IDOR, default address logic, PIN validation | **PASS (7/7)** | Run in `address.test.ts`. |
| **Booking Creation & FSM (Phase 3B/C)** | Mock Prisma | Booking number format, snapshots, start OTP | **PASS (25/25)** | Run in `booking-creation.test.ts`. |
| **Job Execution Lifecycle (Phase 3D)** | Mock Prisma | Start OTP verification, photo uploads, completion | **PASS (18/18)** | Run in `job-lifecycle-execution.test.ts`. |
| **Payment Checkout & Settlement (Phase 3E/G)** | Mock Prisma | Checkout creation, webhook handling, settle logic | **PASS (22/22)** | Run in `payment-settlement.test.ts`. |
| **Financial Ledger & Wallets (Phase 2E)** | Mock Prisma | 15% commission, 1% TDS, payout requests, reversals | **PASS (35/35)** | Run in `phase-2e.test.ts`. |
| **Dispatch Radar & Matching (Phase 2F)** | Mock Prisma | 60s timeout, provider exclusion, eligibility check | **PASS (28/28)** | Run in `dispatch-lifecycle.test.ts`. |
| **GPS Tracking & ETA (Phase 2G/3K)** | Mock Prisma | Telemetry throttling, Haversine fallback, privacy mask | **PASS (32/32)** | Run in `live-maps-eta.test.ts`. |
| **In-App Messaging & Outbox (Phase 3I)** | Mock Prisma | Chat outbox, client msg deduplication, read cursors | **PASS (36/36)** | Run in `chat-messaging.test.ts`. |
| **Reviews & Bayesian Reputation (Phase 3J)**| Mock Prisma | Rating scale, provider response, moderation RBAC | **PASS (56/56)** | Run in `reviews-reputation.test.ts`. |
| **Media Attachments & Quotas (Phase 3L)** | Mock Prisma | Photo quotas, MIME type validation, storage adapters | **PASS (40/40)** | Run in `media-storage.test.ts`. |
| **Total Mock Regression Baseline** | Mock Prisma | 77 test suites across all core modules | **PASS (520/520)** | **100% PASS (58.4s)**. |
| **Real PostgreSQL Migration from Scratch** | Real Postgres | `prisma migrate deploy` on empty database | **VERIFIED** | Verified during `npm run db:start` & `npm run db:migrate`. |
| **Real PostgreSQL Check Constraints** | Real Postgres | Negative balance prevention, rating range 1-5 | **PROPOSED** | Requires Phase 4A migration. |
| **Real PostgreSQL Concurrent Job Acceptance** | Real Postgres | 2 workers simultaneously accepting single booking offer | **PROPOSED** | Integration test suite against real DB. |
| **Real PostgreSQL Concurrent Quote Acceptance** | Real Postgres | 2 customers simultaneously accepting quotes | **PROPOSED** | Verifies partial unique index. |
| **PostGIS Spatial Matching (ST_DWithin)** | Real Postgres | Radius query with SRID 4326 | **PROPOSED** | Requires PostGIS extension. |
| **Customer Flutter Mobile Test Suite** | Flutter SDK | Mobile screens, Riverpod state, UI validation | **NOT VERIFIED** | Flutter SDK not available in local PATH. |
| **Provider Flutter Mobile Test Suite** | Flutter SDK | Partner app, KYC flow, radar dispatch UI | **NOT VERIFIED** | Flutter SDK not available in local PATH. |

---

## 3. Real PostgreSQL Integration Test Design

To execute tests against real PostgreSQL without interfering with development data:

### 3.1 Isolated Test Database Configuration
```text
DATABASE_URL_TEST="postgresql://localman_user:localman_secure_dev_password_2026@localhost:5432/localman_test_db?schema=public"
```

### 3.2 Critical Concurrent Race Condition Test Specification
```typescript
// test/integration/concurrent-booking-claim.test.ts
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';

describe('Real PostgreSQL Concurrency: Provider Booking Claim Race', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL_TEST } }
  });

  test('Two providers accepting the same job simultaneously: exactly ONE wins, second receives 409 Conflict', async () => {
    // 1. Setup booking in REQUESTED status
    const booking = await prisma.booking.create({ /* ... */ });
    
    // 2. Spawn concurrent claims via Promise.allSettled
    const [claimA, claimB] = await Promise.allSettled([
      dispatchService.acceptOffer(providerA.userId, offerA.id),
      dispatchService.acceptOffer(providerB.userId, offerB.id),
    ]);

    // 3. Exactly one promise must be fulfilled, one rejected with ConflictError
    const fulfilledCount = [claimA, claimB].filter(r => r.status === 'fulfilled').length;
    const rejectedCount = [claimA, claimB].filter(r => r.status === 'rejected').length;

    assert.strictEqual(fulfilledCount, 1, 'Exactly one provider must successfully claim the booking');
    assert.strictEqual(rejectedCount, 1, 'The losing provider must receive a conflict rejection');

    // 4. Verify booking has single assigned provider in database
    const freshBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.ok(freshBooking?.providerId !== null);
    assert.strictEqual(freshBooking?.currentStatus, 'PROVIDER_ACCEPTED');
  });
});
```

