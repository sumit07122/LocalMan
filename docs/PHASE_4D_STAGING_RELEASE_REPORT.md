# LOCALMAN — PHASE 4D STAGING RELEASE & DEVOPS HARDENING REPORT

**Execution Date:** November 2, 2026  
**Repository:** `https://github.com/sumit07122/LocalMan`  
**Target Branch:** `develop`  
**Status:** COMPLETE & VERIFIED  

---

## 1. EXECUTIVE SUMMARY

Phase 4D establishes a hardened, verifiable staging deployment pipeline and automated mobile APK distribution system for the **LocalMan** marketplace platform.

### Key Deliverables Completed:
1. **CI Pipeline Repair**: Fixed Flutter setup failure by replacing unresolvable SHA with official pinned commit `subosito/flutter-action@1a449444c387b1966244ae4d4f8c696479add0b2` (v2.23.0).
2. **Automated Staging APK Distribution**: Added a dedicated GitHub Actions job (`build-staging-apks`) that automatically builds, packages, and uploads Customer and Provider Android APKs as workflow artifacts on every push to `develop`.
3. **Backend Production Hardening**:
   - Added `CORS_ALLOWED_ORIGINS` with strict origin allowlist validation in `@fastify/cors`.
   - Implemented Kubernetes/Render standard liveness (`/health/live`) and readiness (`/health/ready` testing PostgreSQL via `SELECT 1`) health probes with 503 fallback.
   - Added 10-second unref timeout to graceful shutdown handlers (`SIGINT`/`SIGTERM`).
   - Hardened production environment validation against default/fallback secrets.
4. **Render Blueprint Sanitation**: Removed phantom background worker (`localman-worker`) and unconfigured Redis references from `render.yaml`, set health check path to `/health/ready`, and set `autoDeployTrigger: checksPass` on branch `develop`.
5. **Vercel Routing**: Configured root `vercel.json` to proxy `/health/(.*)` requests to the API service alongside existing `/api` and `/health` routes.
6. **Repository Sanitation**: Removed leftover Fixia project documentation from the LocalMan monorepo.
7. **Verification**: 537 backend tests passed; Admin Web Vite bundle compiled in 7.11s; API TypeScript build passed; 7 new health/CORS tests passed with 0 failures; `git diff --check` clean.

---

## 2. GITHUB REPOSITORY PRIVACY & BRANCH POLICIES

### Repository Identity:
- **Repository**: `sumit07122/LocalMan`
- **Default Branch**: `master`
- **Active Development / Staging Branch**: `develop`

### Making the Repository Private (Action Required by Owner)
Because GitHub CLI (`gh`) is not installed on the local Windows workstation, repository visibility must be updated via the GitHub Web UI:
1. Navigate to: `https://github.com/sumit07122/LocalMan/settings`
2. Scroll to the bottom section: **Danger Zone**
3. Click **Change repository visibility** -> Select **Make private**
4. Type `sumit07122/LocalMan` to confirm the change.

### Recommended Branch Protection Rules:
1. **Branch**: `master` (Production)
   - Require a pull request before merging (minimum 1 approval).
   - Require status checks to pass before merging:
     - `Backend API & Database CI`
     - `Admin Web Portal CI`
     - `Flutter Mobile Apps CI (Customer & Provider)`
   - Disallow force pushes and branch deletion.
2. **Branch**: `develop` (Staging)
   - Require status checks to pass before merging.
   - Automatic triggers: On push to `develop`, automated staging APKs are built and Render staging deploys automatically.

---

## 3. GITHUB ACTIONS CI/CD PIPELINE REPAIR & AUTOMATION

### 3.1 Flutter Action Fix
- **Error in Previous CI Run (`41398088215`)**:
  `Unable to resolve action subosito/flutter-action@f721806e60b296417ad0165c3abecda7444ac4d3`
- **Root Cause**: The commit hash was unresolvable or pointed to an unreleased ref.
- **Fix**: Pinned to official release v2.23.0 commit SHA:
  `subosito/flutter-action@1a449444c387b1966244ae4d4f8c696479add0b2`
  Applied across `.github/workflows/ci.yml` and `.github/workflows/android-distribution.yml`.

### 3.2 Automated Staging APK Build Pipeline
Added job `build-staging-apks` to `.github/workflows/ci.yml`:
- **Trigger**: Runs automatically when code is pushed to `develop` and all three CI jobs (`backend-ci`, `admin-web-ci`, `mobile-apps-ci`) pass.
- **Artifacts Generated**:
  - `localman-customer-staging-b<run_number>-<short_sha>.apk`
  - `localman-customer-staging-latest.apk`
  - `localman-provider-staging-b<run_number>-<short_sha>.apk`
  - `localman-provider-staging-latest.apk`
- **Retention**: 14 days directly in GitHub Actions artifacts for immediate download and testing by QA and stakeholders.

---

## 4. BACKEND PRODUCTION & SECURITY HARDENING

### 4.1 Strict Environment Validation (`apps/api/src/config/env.ts`)
- Added `CORS_ALLOWED_ORIGINS` schema defaulting to:
  `http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,https://localman-admin-web.vercel.app`
- In `NODE_ENV === 'production'`:
  - Disallows default `JWT_SECRET` (`super_secret_localman_jwt_...`) and enforces minimum 32 characters.
  - Disallows default `BOOKING_OTP_PEPPER` (`localman_secure_booking_otp_...`).
  - Disallows default development database password (`localman_secure_dev_password_2026`).
  - Enforces valid credentials for non-mock providers (`STORAGE_PROVIDER=s3`, `PAYMENT_GATEWAY_PROVIDER=razorpay`, `SMS_GATEWAY_PROVIDER`).

### 4.2 Dynamic CORS Allowlist (`apps/api/src/app.ts`)
- Originless requests (native mobile apps, server-to-server calls, cURL) are permitted.
- Browser requests are validated against `CORS_ALLOWED_ORIGINS`.
- Disallowed origins receive an explicit rejection error (`Origin <origin> not allowed by LocalMan CORS policy`).

### 4.3 Container Orchestration Probes (`apps/api/src/app.ts`)
- **`/health/live`**: Fast liveness probe returning `{ status: 'ok', service: 'localman-api', uptime: number, timestamp: string }`.
- **`/health/ready`**: Deep readiness probe querying PostgreSQL (`SELECT 1`). Returns HTTP 200 with `{ status: 'ok', database: 'connected' }` on success, or HTTP 503 Service Unavailable with `{ status: 'error', database: 'disconnected' }` if PostgreSQL is unreachable.
- **`/health`**: Kept as backwards-compatible legacy health check.

### 4.4 Graceful Shutdown Timeout (`apps/api/src/server.ts`)
- Fastify server close and Prisma database disconnect are invoked on `SIGINT` and `SIGTERM`.
- An unref'd 10-second watchdog timer forces process termination if inflight requests or connections hang during shutdown.

---

## 5. INFRASTRUCTURE & HOSTING CONFIGURATION

### 5.1 Render Blueprint (`render.yaml`)
- **Removed Duplicate Worker**: The source code has no standalone queue or BullMQ worker (`apps/api/package.json` contains no Redis or BullMQ dependency). The previous `localman-worker` was merely running a duplicate API server. Removed to eliminate unnecessary hosting expenses and crash loops.
- **Removed Redis Reference**: Cleaned out unconfigured `localman-redis` environment variables.
- **Configured Health Check**: Set `healthCheckPath: /health/ready`.
- **Target Branch & Trigger**: Configured `branch: develop` and `autoDeployTrigger: checksPass` so deployments occur automatically only when CI tests succeed.
- **Database**: Managed PostgreSQL 16 database (`localman_db`) with PostGIS extensions on Starter plan.

### 5.2 Vercel Admin Web & Routing (`vercel.json`)
- Updated root `vercel.json` rewrites to proxy `/health/(.*)` requests to the API service.
- Verified standalone `apps/admin_web/vercel.json` with security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`) and immutable asset caching.

---

## 6. VERIFICATION & TEST RESULTS

| Verification Task | Command | Result |
| :--- | :--- | :--- |
| **Shared Packages Build** | `npm run build --workspace=@localman/constants ...` | **PASS** (Code 0) |
| **Admin Web Build** | `npm run build --workspace=@localman/admin-web` | **PASS** (1589 modules in 7.11s) |
| **API Typecheck** | `npx tsc -p apps/api/tsconfig.json --noEmit` | **PASS** (Code 0, 0 errors) |
| **Prisma Generation & API Build** | `npm run build --workspace=@localman/api` | **PASS** (Prisma Client v6.19.3 generated, Code 0) |
| **Health Checks & CORS Tests** | `npx tsx --test apps/api/test/health.test.ts` | **PASS** (7/7 tests passed, 0 failures) |
| **Monorepo Backend Tests** | `npm test --workspace=@localman/api` | **PASS** (537 passed, 0 failures) |
| **Git Diff Syntax & Linecheck** | `git diff --check` | **PASS** (Code 0, clean) |

---

## 7. STAGING DEPLOYMENT RUNBOOK

### For the Project Owner:
1. **Set Repository to Private**:
   - Visit `https://github.com/sumit07122/LocalMan/settings` and change visibility in the Danger Zone.
2. **Connect Render Blueprint**:
   - Log into Render: `https://dashboard.render.com/blueprints`
   - Click **New Blueprint Instance** -> Select `sumit07122/LocalMan` -> Branch `develop`.
   - Render automatically provisions `localman-postgres` and `localman-api`.
3. **Connect Vercel Admin Web**:
   - Log into Vercel: `https://vercel.com/new`
   - Import repository: `sumit07122/LocalMan`
   - Root directory: `apps/admin_web`
   - Framework preset: `Vite`
   - Environment variable: `VITE_API_BASE_URL` = `https://<your-render-api-url>/api/v1`
4. **Download Staging APKs**:
   - On GitHub, go to `Actions` -> `LocalMan CI Pipeline` on `develop`.
   - Download `localman-staging-apks-b<run_number>` to install Customer and Provider apps on test Android devices.
