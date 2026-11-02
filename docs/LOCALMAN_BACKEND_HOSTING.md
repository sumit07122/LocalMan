# LocalMan — Backend & Database Production Hosting Guide (Render)

**Application:** `@localman/api` (Fastify + TypeScript + Prisma)  
**Database:** Managed PostgreSQL 16 + PostGIS  
**Cache & PubSub:** Managed Redis 7  
**Hosting Platform:** Render Cloud  
**Regions:** Singapore (`singapore`) — recommended for minimal latency to Indian mobile users  

---

## 1. Hosting Architecture Overview

The LocalMan backend requires a stateful, long-lived server architecture:
- **Fastify API Service:** Persistent HTTP & WebSocket server for customer/provider mobile apps and admin dashboard.
- **Background Worker:** Asynchronous worker processing dispatch timers, refund settlements, and notification dispatches.
- **Managed PostgreSQL with PostGIS:** Authoritative relational store handling transactions, geospatial radius matching (`ST_DWithin`, `ST_Point`), and partial unique indexes.
- **Managed Redis:** In-memory queue storage and real-time pub/sub bus.

All infrastructure components are codified in [`render.yaml`](file:///render.yaml).

---

## 2. Setting Up on Render via Blueprint

### Step 1: Connect Repository to Render
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New + > Blueprint**.
3. Connect your GitHub repository `localman` and select branch `master` (for production) or `develop` (for staging).
4. Render will parse [`render.yaml`](file:///render.yaml) and automatically create:
   - Web Service: `localman-api`
   - Background Worker: `localman-worker`
   - Managed Database: `localman-postgres`

### Step 2: Enable PostGIS Extension on Managed PostgreSQL
Render PostgreSQL 16 supports PostGIS out of the box, but the extension must be activated once upon database initialization:
1. In Render Dashboard, open your database `localman-postgres`.
2. Click **Connect > PSQL Command** or use the External Connection String.
3. Run the SQL statement:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
4. Verify PostGIS is active:
   ```sql
   SELECT PostGIS_Version();
   ```

### Step 3: Automated Database Migrations via `preDeployCommand`
The web service definition includes:
```yaml
preDeployCommand: npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```
During every deployment, Render automatically executes `preDeployCommand` *before* the new application container is brought online. If migrations fail, the deployment is aborted immediately, leaving the existing container running safely without downtime.

---

## 3. Environment Variables Reference

| Variable Name | Required | Staging Value Example | Production Strategy | Description |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | `production` | Enables production optimizations & strict security validations |
| `PORT` | Yes | `10000` | `10000` | Render listening port |
| `HOST` | Yes | `0.0.0.0` | `0.0.0.0` | Bind host address |
| `API_PREFIX` | Yes | `/api/v1` | `/api/v1` | Global API route prefix |
| `DATABASE_URL` | Yes | *(From Render DB)* | *(From Render DB)* | PostgreSQL connection string |
| `REDIS_HOST` | Yes | *(From Render Redis)* | *(From Render Redis)* | Redis hostname for BullMQ & pub/sub |
| `REDIS_PORT` | Yes | `6379` | `6379` | Redis port |
| `JWT_SECRET` | Yes | Auto-generated (64-char) | Auto-generated (64-char) | Secret for signing mobile & admin JWT tokens |
| `BOOKING_OTP_PEPPER` | Yes | Auto-generated (64-char) | Auto-generated (64-char) | Server-secret pepper for HMAC-SHA256 Start OTP hashing |
| `SMS_GATEWAY_PROVIDER` | Yes | `mock` / `fast2sms` | `fast2sms` / `msg91` | OTP SMS dispatch provider |
| `SMS_GATEWAY_API_KEY` | No (if mock) | Empty | Secret API Key | SMS provider authorization credential |
| `PAYMENT_GATEWAY_PROVIDER` | Yes | `mock` | `razorpay` | Payment processor |
| `RAZORPAY_KEY_ID` | No (if mock) | `rzp_test_...` | `rzp_live_...` | Razorpay Merchant Key ID |
| `RAZORPAY_KEY_SECRET` | No (if mock) | Test Secret | Live Secret | Razorpay API Secret |
| `RAZORPAY_WEBHOOK_SECRET`| No (if mock) | Webhook Secret | Live Webhook Secret | Signature verification for Razorpay Webhook |
| `STORAGE_PROVIDER` | Yes | `mock` / `s3` | `s3` or `r2` | Document & media storage provider |
| `S3_BUCKET_NAME` | No (if mock) | `localman-staging` | `localman-documents-prod` | AWS S3 or Cloudflare R2 bucket name |
| `S3_REGION` | No (if mock) | `ap-south-1` | `ap-south-1` (or `auto` for R2) | S3 region |
| `S3_ACCESS_KEY_ID` | No (if mock) | IAM User Key | IAM User Key | Cloud storage access key |
| `S3_SECRET_ACCESS_KEY` | No (if mock) | IAM User Secret | IAM User Secret | Cloud storage secret key |

---

## 4. Health Checks & Zero-Downtime Rolling Deployments

- **Health Check Endpoint:** `/health`
- **Port:** `10000`
- Fastify responds with `200 OK` and `{ status: "ok", timestamp: "..." }`.
- Render pings `/health` continuously. When deploying a new release:
  1. `preDeployCommand` applies pending migrations to PostgreSQL.
  2. The new application instance starts up and initializes database/Redis connections.
  3. Render waits for `/health` to return `200 OK`.
  4. Incoming HTTP and WebSocket traffic is seamlessly switched to the new instance.
  5. The old instance is gracefully terminated.

---

## 5. Scaling & Performance Recommendations

1. **Connection Pooling:** For high traffic, use Render's built-in PgBouncer connection pooling string (available in Render PostgreSQL dashboard). Set Prisma connection limit:
   ```
   DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"
   ```
2. **Vertical Scaling:**
   - Development/Staging: `Starter` plan ($7/mo web service, $7/mo DB).
   - Commercial Production Launch: `Standard` plan (2 GB RAM, 1 CPU for API; 4 GB RAM for PostgreSQL).
3. **Database Backups:**
   - Render automatically performs daily automated backups of managed PostgreSQL retained for 7 days.
   - Point-in-time recovery (PITR) is available on production database plans.

