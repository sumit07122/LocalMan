# LocalMan — Vercel Services Deployment Guide

## 1. Architecture Overview

LocalMan is configured for deployment using **Vercel Services** via a single root-level [vercel.json](file:///c:/Users/hp/OneDrive/Desktop/antigravity%20workspace/localman/vercel.json):

```
LocalMan/
├── apps/
│   ├── customer_app/       # Flutter Android/iOS (NOT deployed to Vercel)
│   ├── provider_app/       # Flutter Android/iOS (NOT deployed to Vercel)
│   ├── admin_web/          # Vite SPA — deployed as Vercel web service "admin_web"
│   └── api/                # Fastify Node API — deployed as Vercel backend service "api"
├── packages/
│   ├── constants/          # Shared workspace constants
│   ├── contracts/          # Shared zod validation schemas & API contracts
│   └── design_tokens/      # Shared styling tokens
└── vercel.json             # Root Vercel Services configuration
```

### Services Breakdown:
- **`admin_web`** (`apps/admin_web`): React 18 / Vite 6 Single Page Application built to `dist/`. Exposes the administrative dashboard.
- **`api`** (`apps/api`): Fastify v5 TypeScript backend running on Vercel Node runtime. Dual-mode entrypoint (`src/server.ts`) supports serverless request execution on Vercel while preserving standard `app.listen()` for local development and containerized workloads.
- **Flutter apps** (`apps/customer_app`, `apps/provider_app`): Mobile client apps built for Play Store / App Store, completely excluded from Vercel deployment.

---

## 2. Public Routing & Rewrites

Vercel Services isolates services by default. The root [vercel.json](file:///c:/Users/hp/OneDrive/Desktop/antigravity%20workspace/localman/vercel.json) configures explicit public rewrites:

| Route Match | Destination Service | Description |
| :--- | :--- | :--- |
| `/api` | `api` | Base API endpoint |
| `/api/(.*)` | `api` | All REST endpoints (e.g. `/api/v1/auth/login`, `/api/v1/bookings`) |
| `/health` | `api` | API health check endpoint |
| `/(.*)` | `admin_web` | Admin web frontend SPA and static assets |

---

## 3. Environment Variables Reference

### 3.1 Admin Web (`admin_web`)
The Admin Web frontend is a client-side SPA. All API calls are made relatively to `/api` on the same origin (routed via Vercel rewrites).
- **Required Secrets in Browser**: **NONE**.
- **Important**: Never expose database credentials, JWT secrets, payment secrets, SMS credentials, or Redis connections to `admin_web`.

### 3.2 Backend API (`api`)
The Fastify API strictly validates environment variables using Zod in [apps/api/src/config/env.ts](file:///c:/Users/hp/OneDrive/Desktop/antigravity%20workspace/localman/apps/api/src/config/env.ts).

When `NODE_ENV=production`, the application actively enforces that development default fallback secrets are **not** present.

| Variable | Required in Prod? | Description & Constraints |
| :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | Set to `production`. |
| `PORT` | Optional | Auto-managed by Vercel serverless environment (defaults to 4000 locally). |
| `HOST` | Optional | Defaults to `0.0.0.0`. |
| `API_PREFIX` | Optional | Defaults to `/api/v1`. |
| `DATABASE_URL` | **Yes (Secret)** | Connection string to managed PostgreSQL + PostGIS (e.g., Supabase, Neon, AWS RDS). Cannot use development password in production. |
| `JWT_SECRET` | **Yes (Secret)** | High-entropy string (min 32 chars). Cannot use hardcoded development key in production. |
| `JWT_EXPIRES_IN` | Optional | Access token lifetime (default: `15m`). |
| `REFRESH_TOKEN_EXPIRES_IN` | Optional | Refresh token lifetime (default: `30d`). |
| `REDIS_HOST` | **Yes** | Host of managed Redis instance (e.g., Upstash, AWS ElastiCache). |
| `REDIS_PORT` | **Yes** | Port of Redis instance (default: `6379`). |
| `REDIS_PASSWORD` | **Yes (Secret)** | Auth token/password for Redis. |
| `SMS_GATEWAY_PROVIDER` | **Yes** | `fast2sms`, `msg91`, or `twilio` in production (`mock` in development). |
| `SMS_GATEWAY_API_KEY` | **Yes (Secret)** | Production SMS gateway API key. |
| `SMS_SENDER_ID` | Optional | DLT registered sender ID for India (default: `LCLMAN`). |
| `PAYMENT_GATEWAY_PROVIDER` | **Yes** | `razorpay` or `cashfree` in production (`mock` in development). |
| `RAZORPAY_KEY_ID` | **Yes** | Production Razorpay key ID. |
| `RAZORPAY_KEY_SECRET` | **Yes (Secret)** | Production Razorpay secret. Cannot use `rzp_secret_example` in production. |
| `RAZORPAY_WEBHOOK_SECRET` | **Yes (Secret)** | Razorpay webhook signature secret for payment verification. |
| `STORAGE_PROVIDER` | **Yes** | `s3` or `r2` in production (`mock` in development). |
| `S3_BUCKET_NAME` | **Yes** | S3 bucket name for documents and KYC verification photos. |
| `S3_REGION` | **Yes** | AWS / Cloudflare R2 region (e.g. `ap-south-1`). |
| `S3_ACCESS_KEY_ID` | **Yes (Secret)** | IAM credentials for S3 / Cloudflare R2. |
| `S3_SECRET_ACCESS_KEY` | **Yes (Secret)** | IAM secret key for S3 / Cloudflare R2. |
| `S3_ENDPOINT` | Optional | Endpoint URL if using Cloudflare R2 or MinIO. |
| `GOOGLE_MAPS_API_KEY` | **Yes (Secret)** | Production Google Maps API key with Geocoding and Places API enabled. |
| `LOCATION_FRESHNESS_THRESHOLD_SECONDS`| Optional | GPS freshness window (default: `900` = 15 min). |
| `LOCATION_THROTTLE_SECONDS` | Optional | Minimum interval between provider location updates (default: `5`). |

---

## 4. Database Setup & External Dependencies

1. **PostgreSQL + PostGIS**:
   - Vercel does not host relational databases directly. A managed PostgreSQL instance with PostGIS enabled (PostGIS extension installed: `CREATE EXTENSION IF NOT EXISTS postgis;`) must be provisioned.
   - Run Prisma migrations against the remote database before first deployment:
     ```bash
     npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
     ```
2. **Managed Redis**:
   - Fastify services use Redis for caching, rate limiting, and real-time coordination. Provision a serverless Redis (e.g., Upstash) or managed Redis instance.

---

## 5. Deployment Steps on Vercel Dashboard

1. **Import Repository**:
   - Connect the GitHub repository `sumit07122/LocalMan` to Vercel.
2. **Root Directory**:
   - Keep Root Directory as `./` (the repository root). Vercel Services requires the root-level `vercel.json` to configure services.
3. **Configure Environment Variables**:
   - In Project Settings > Environment Variables, add the production variables listed above.
   - Assign variables specifically to the **Production** environment.
4. **Deploy**:
   - Trigger the deployment. Vercel will build `@localman/admin-web` and configure `@localman/api` as defined in `vercel.json`.
