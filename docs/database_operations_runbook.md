# LocalMan Platform: Production Database Operations & Reliability Runbook

**Author**: Senior DevOps Engineer, Principal PostgreSQL Reliability Engineer  
**Date**: November 1, 2026  
**Target Environment**: PostgreSQL 16+ / AWS RDS / Neon / Supabase / Embedded Local Dev  

---

## 1. Connection Pooling & Resource Configuration

In production, Fastify Node.js processes interact with PostgreSQL via Prisma ORM. Unbounded connection pools will exhaust PostgreSQL server connections (`max_connections`) and degrade throughput.

### 1.1 Connection String Pooling Parameters
Configure the `DATABASE_URL` with explicit pooling parameters:
```text
postgresql://user:password@pg-host:5432/localman_db?schema=public&connection_limit=20&pool_timeout=10&connect_timeout=10
```
* **`connection_limit`**: Set per Node process. In a containerized setup with 4 replicas: $4 \times 20 = 80\text{ connections}$ (well within PostgreSQL default `max_connections = 100`).
* **`pool_timeout`**: 10 seconds. Fails fast if connection pool is saturated, preventing unbounded request queuing.
* **`connect_timeout`**: 10 seconds. Prevents hung TCP handshakes during network partitions.

### 1.2 PostgreSQL Server Timeout Protections
To prevent rogue long-running queries or deadlocks from freezing application connections, enforce statement timeouts in PostgreSQL:
```sql
-- Global or role-level protection
ALTER ROLE localman_app_user SET statement_timeout = '15s';
ALTER ROLE localman_app_user SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE localman_app_user SET lock_timeout = '5s';
```
* **`statement_timeout` (15s)**: Halts unindexed slow queries before they tie up backend workers.
* **`idle_in_transaction_session_timeout` (30s)**: Immediately terminates connections holding open transactions without executing queries, preventing phantom locks.
* **`lock_timeout` (5s)**: Aborts transactions attempting to acquire conflicting locks if blocked for more than 5 seconds.

---

## 2. Health, Liveness & Readiness Probes

### 2.1 Database Readiness Probe
The backend API exposes a health endpoint at `/health` and `/api/v1/health` that validates active PostgreSQL connectivity:
```typescript
// Readiness verification query
async function checkDatabaseHealth(): Promise<{ status: 'healthy' | 'unhealthy'; latencyMs: number }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1;`;
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'unhealthy', latencyMs: Date.now() - start };
  }
}
```
* **K8s / Cloud Probe Configuration**:
  ```yaml
  readinessProbe:
    httpGet:
      path: /health
      port: 4000
    initialDelaySeconds: 5
    periodSeconds: 10
    timeoutSeconds: 3
    failureThreshold: 3
  ```

---

## 3. Graceful Shutdown & Connection Drainage

When Kubernetes or Docker issues `SIGTERM`, active database transactions must complete without interruption while new requests are rejected:

```typescript
// Graceful termination handler
async function handleGracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Draining database connections...`);
  
  // 1. Stop Fastify server from accepting new HTTP requests
  await app.close();
  
  // 2. Disconnect Prisma Client and drain pool
  await prisma.$disconnect();
  console.log('Database connection pool cleanly closed.');
  
  process.exit(0);
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
```

---

## 4. Backup, Restore & Disaster Recovery (DR)

### 4.1 Automated Logical Backups (`pg_dump`)
Run daily automated logical backups compressed via custom format:
```bash
# Full database backup
pg_dump -h $PGHOST -U $PGUSER -d localman_db -Fc -Z 6 -f "localman_db_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### 4.2 Restoring from Backup (`pg_restore`)
```bash
# 1. Create fresh target database
createdb -h $PGHOST -U $PGUSER localman_db_restored

# 2. Restore schema and data with parallel workers
pg_restore -h $PGHOST -U $PGUSER -d localman_db_restored -j 4 --clean --if-exists localman_db_backup_20261101.dump

# 3. Analyze query planner statistics
psql -h $PGHOST -U $PGUSER -d localman_db_restored -c "VACUUM ANALYZE;"
```

### 4.3 Point-in-Time Recovery (PITR)
For managed cloud providers (AWS RDS / Neon / Supabase):
* Enable automated Continuous WAL Archiving with a **7-day retention window**.
* In the event of catastrophic data corruption or human error, initiate PITR to restore the cluster to 1 minute prior to the incident timestamp.

---

## 5. Local Zero-Dependency Development Environment

For local development without Docker, LocalMan includes a zero-dependency embedded PostgreSQL runner:

1. **Start Database**:
   ```bash
   npm run db:start
   ```
   * Spawns PostgreSQL 16 on `localhost:5432` (`localman_db` / user: `localman_user`).
   * Automatically clears stale `postmaster.pid` lockfiles if previous runs were interrupted.
2. **Apply Migrations**:
   ```bash
   npm run db:migrate
   ```
3. **Seed Realistic Demo Data**:
   ```bash
   npm run db:seed
   ```
   * Populates 5 synthetic customers, 10 verified providers across 5 categories, 20 bookings across all FSM states, and sample reviews. Zero PII.
4. **Verify Database Counts**:
   ```bash
   npx tsx scripts/verify-db-counts.ts
   ```

