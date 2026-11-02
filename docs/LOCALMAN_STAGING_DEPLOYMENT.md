# LocalMan — Staging Environment & First Release Deployment Guide

**Date:** November 2026  
**Auditor:** Principal Cloud Architect & Release Engineer  
**Target Environments:** Staging Backend (`api-staging.localman.in`), Staging Admin (`admin-staging.localman.in`), Staging Android APKs  
**Repository:** `https://github.com/sumit07122/LocalMan` (Private)  

---

## 1. Staging Release Strategy

LocalMan utilizes an isolated staging tier to guarantee that all database migrations, API endpoints, web dashboards, and mobile APKs are verified end-to-end prior to commercial production traffic.

The staging release target branch is **`develop`**.

```text
LocalMan Monorepo
   ├── apps/api           ──> Render Staging Service (api-staging.localman.in)
   ├── apps/admin_web     ──> Vercel Staging Project (admin-staging.localman.in)
   ├── apps/customer_app  ──> Staging APK (localman-customer-staging.apk)
   └── apps/provider_app  ──> Staging APK (localman-provider-staging.apk)
```

---

## 2. Staging Backend Deployment on Render

### Step 1: Link Render to `develop` Branch
1. In Render Dashboard, create a new Blueprint deployment pointing to `https://github.com/sumit07122/LocalMan.git`.
2. Select branch `develop`.
3. Set Environment variables for staging:
   - `NODE_ENV`: `production` (enables production optimizations with staging configs)
   - `STORAGE_PROVIDER`: `mock` or staging S3 bucket
   - `SMS_GATEWAY_PROVIDER`: `mock`
   - `PAYMENT_GATEWAY_PROVIDER`: `mock` (or Razorpay Test Key)

### Step 2: Automated Migrations & Health Verification
- `preDeployCommand`: Render executes `npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma` automatically before container switch.
- Verify health check: `GET https://api-staging.localman.in/health` -> `{"status":"ok",...}`.

---

## 3. Staging Admin Web Deployment on Vercel

### Step 1: Create Separate Vercel Project
> [!IMPORTANT]
> Do NOT use the FIXIA Vercel project. Create a new, dedicated project on Vercel named `localman-admin-web`.

### Step 2: Configure Vercel Settings
- **Repository:** `sumit07122/LocalMan`
- **Root Directory:** `apps/admin_web` (Enable *"Include files outside root"*)
- **Framework Preset:** `Vite`
- **Build Command:** `cd ../.. && npm run build --workspace=@localman/admin-web`
- **Output Directory:** `dist`
- **Environment Variables:**
  - `VITE_API_BASE_URL` = `https://api-staging.localman.in/api/v1`

---

## 4. Staging Android APK Packaging

Trigger the GitHub Actions workflow [`.github/workflows/android-distribution.yml`](file:///.github/workflows/android-distribution.yml):
1. Select target environment: `staging`.
2. Select target app: `all`.
3. Download the resulting artifacts `localman-android-apks-staging-bXX.zip`.
4. Install on physical test devices using ADB:
   ```bash
   adb install -r dist/apks/localman-customer-staging.apk
   adb install -r dist/apks/localman-provider-staging.apk
   ```

---

## 5. End-to-End Staging Verification Checklist

- [ ] Fastify API `/health` responds with HTTP 200.
- [ ] PostGIS spatial queries work on PostgreSQL 16.
- [ ] Admin dashboard loads on Vercel and routes direct URLs without 404.
- [ ] Customer app connects to staging API via HTTPS.
- [ ] Provider app connects to staging API via HTTPS.
- [ ] Start OTP verification succeeds with HMAC pepper.
- [ ] Booking status transitions and wallet credits execute cleanly.
