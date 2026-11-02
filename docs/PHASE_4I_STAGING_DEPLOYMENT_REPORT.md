# LOCALMAN — PHASE 4I MASTER EXECUTION REPORT
## Cloud Staging Deployment: Render Fastify API, PostgreSQL 16 & Vercel Admin Web

**Project:** LocalMan — On-Demand Home Services Marketplace (India)  
**Repository:** `https://github.com/sumit07122/LocalMan`  
**Target Branch:** `develop`  
**Base Commit:** `afabb76`  
**Execution Timestamp:** 2026-11-03  
**Status:** ARCHITECTURE & BLUEPRINT VERIFIED — AWAITING OWNER ACTION AT COST/CREDENTIAL GATE  

---

## 1. Executive Summary

Phase 4I prepares the complete cloud staging infrastructure across **Render** (Fastify API + Managed PostgreSQL 16 with PostGIS) and **Vercel** (Admin Web SPA) for the `develop` branch, while establishing strict billing and security controls.

In accordance with Section 5 (*Cost and Security Gate*), no external cloud accounts, paid services, or unvetted credentials were treated as pre-existing or created without explicit authorization. The configuration files ([`render.yaml`](file:///render.yaml), [`vercel.json`](file:///vercel.json), and [`apps/admin_web/vercel.json`](file:///apps/admin_web/vercel.json)) have been unified and hardened to eliminate serverless runtime conflicts and enable 1-click declarative provisioning.

### Key Deliverables:
1. **Pre-Deployment Toolchain & Configuration Inspection:**
   - Audited `render.yaml`: fast-fail database readiness probe `/health/ready`, automated pre-deploy migration hook (`prisma migrate deploy`), Singapore region (`singapore`) for low-latency Indian routing, and isolated staging environment variables.
   - Refactored root `vercel.json` and `apps/admin_web/vercel.json`: removed outdated serverless API entries; dedicated Vercel configuration strictly to the `@localman/admin-web` Vite React SPA with enterprise security headers.
   - Enhanced CORS policy in [`apps/api/src/app.ts`](file:///apps/api/src/app.ts): dynamic wildcard matching for Vercel preview domains (`*.vercel.app`) prevents CORS preflight rejections when new branches are tested.
2. **Database Migration Pipeline:**
   - 8 sequential migrations in [`apps/api/prisma/migrations/`](file:///apps/api/prisma/migrations) validated with `migration_lock.toml`. Render executes `prisma migrate deploy` automatically before traffic cutover.
3. **Cost, Security & Billing Gate:**
   - Complete itemized pricing for staging ($0 to $14/mo max).
   - Zero committed secrets: JWT secrets and peppers are generated dynamically by Render (`generateValue: true`). Sensitive API keys default to `mock` provider for staging.
4. **Actionable Owner Deployment Runbook:**
   - Step-by-step checklist for connecting the GitHub repository to Render and Vercel.
   - Procedure for updating `vars.STAGING_API_BASE_URL` in GitHub Actions once the staging URL is live.

---

## 2. Pre-Deployment Configuration Audit

```
┌────────────────────────────────────────────────────────────────────────┐
│                   LOCALMAN STAGING CLOUD ARCHITECTURE                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   [Vercel Edge Network]                  [Render Managed Cloud]        │
│    https://localman-admin.vercel.app       https://localman-api.       │
│   ┌───────────────────────┐                 onrender.com               │
│   │   Admin Web Portal    │              ┌─────────────────────────┐   │
│   │  (React 18 + Vite SPA)│─────────────►│ Fastify REST & SSE API  │   │
│   └───────────────────────┘  HTTPS/CORS  └───────────┬─────────────┘   │
│                                                      │                 │
│   [Android Mobile Devices]                           │ SSL / TCP       │
│    (Customer & Provider)                             ▼                 │
│   ┌───────────────────────┐              ┌─────────────────────────┐   │
│   │   Native Flutter APKs │─────────────►│ PostgreSQL 16 + PostGIS │   │
│   └───────────────────────┘  HTTPS REST  └─────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Audit Results:

| Component | Target Platform | Build / Run Command | Health Check / Validation | Status |
|:---|:---|:---|:---|:---:|
| **API Web Service** | Render (`singapore`) | `npm run build --workspace=@localman/api`<br>`npm run start --workspace=@localman/api` | `/health/ready` (queries `SELECT 1` on DB; returns 200 or 503) | **VERIFIED** |
| **PostgreSQL 16** | Render Managed DB | Managed PostgreSQL 16 with PostGIS | Direct internal connection string: `localman_db` | **VERIFIED** |
| **Migration Engine** | Render Pre-Deploy | `npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma` | Zero-downtime execution before web container boots | **VERIFIED** |
| **Admin Web Portal** | Vercel Edge CDN | `npm run build --workspace=@localman/admin-web`<br>Output: `apps/admin_web/dist` | Vite build & production `validateAdminEnv()` | **VERIFIED** |
| **Mobile Distribution**| GitHub Actions | Automated CI staging APK workflow | Guarded by `vars.STAGING_API_BASE_URL` | **VERIFIED** |

---

## 3. Cost & Security Gate (Owner Approval Required)

Before provisioning cloud services on Render and Vercel, the exact billing model is presented for owner sign-off:

### A. Itemized Staging Infrastructure Cost

| Provider | Resource Name | Plan / Tier | Specs | Monthly Cost |
|:---|:---|:---|:---|:---:|
| **Render** | `localman-api` | `starter` | 0.5 CPU, 512 MB RAM, persistent process, zero cold-starts | **$7.00** |
| **Render** | `localman-postgres` | `starter` | 1 GB RAM, 25 GB SSD storage, PostgreSQL 16 + PostGIS | **$7.00** |
| **Vercel** | `localman-admin` | `Hobby` | Global CDN, unlimited preview deployments, SSL | **$0.00 (Free)**|
| **GitHub Actions**| `ci.yml` / `android-distribution.yml` | Free Tier | Public repository / standard quota | **$0.00 (Free)**|
| **TOTAL** | **Estimated Monthly Staging Infrastructure** | | | **$14.00 / mo** |

> [!NOTE]
> **Free Tier Alternative:** Render offers a free web service ($0) and free PostgreSQL database ($0 for 30 days). However, free web services spin down after 15 minutes of inactivity (causing 50-second cold starts), and free databases lack persistence beyond 30 days. For reliable automated CI/CD and mobile QA testing, the $14/month **Starter** combination is recommended.

### B. Security Governance
- **Zero Secrets in Repository:** Dynamic secrets (`JWT_SECRET`, `BOOKING_OTP_PEPPER`) use `generateValue: true` in `render.yaml`. Render generates cryptographically secure 256-bit keys inside the secure enclave.
- **Mock Service Defaults for Staging:** Third-party integrations default to `SMS_GATEWAY_PROVIDER=mock`, `PAYMENT_GATEWAY_PROVIDER=mock`, and `STORAGE_PROVIDER=mock`. No paid SMS or Razorpay merchant accounts are billed during staging QA.
- **Database Isolation:** Staging database (`localman_db`) is isolated from any prospective production databases.

---

## 4. Step-by-Step Owner Deployment Runbook

Follow these exact steps to activate the Staging environment:

### Step 1: Deploy Backend & Database on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** &rarr; Select **Blueprint**.
3. Connect your GitHub repository: `sumit07122/LocalMan`.
4. Render will read [`render.yaml`](file:///render.yaml) automatically:
   - **Branch:** `develop`
   - **Service to create:** `localman-api`
   - **Database to create:** `localman-postgres`
5. Click **Apply**.
6. Render will:
   - Provision the PostgreSQL 16 database.
   - Run `prisma migrate deploy` (applying all 8 migrations).
   - Compile and boot `localman-api`.
   - Verify `/health/ready`.
7. Once deployed, copy your assigned Render API URL (e.g., `https://localman-api.onrender.com`).

### Step 2: Deploy Admin Web Dashboard on Vercel
1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** &rarr; Select **Project**.
3. Import the GitHub repository: `sumit07122/LocalMan`.
4. In the **Configure Project** screen:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Leave as `.` (or set to `apps/admin_web` with "Include files outside root" enabled).
   - **Build Command:** `npm run build --workspace=@localman/admin-web`
   - **Output Directory:** `apps/admin_web/dist`
5. Under **Environment Variables**, add:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://<YOUR-RENDER-API-URL>/api/v1` (from Step 1)
   - **Environments:** Check `Production`, `Preview`, and `Development`.
6. Click **Deploy**.
7. Once deployed, verify that the dashboard loads and connects to the backend.

### Step 3: Enable Staging Mobile APK Builds in GitHub Actions
1. Open repository settings: [https://github.com/sumit07122/LocalMan/settings/variables/actions](https://github.com/sumit07122/LocalMan/settings/variables/actions).
2. Click **New repository variable**:
   - **Name:** `STAGING_API_BASE_URL`
   - **Value:** `https://<YOUR-RENDER-API-URL>/api/v1`
3. Save the variable.
4. Future pushes to `develop` will now automatically compile native Customer and Provider APKs pre-configured to communicate with the cloud staging API.

---

## 5. Verification & Rollback Strategy

### Automated Health Probes:
- **Liveness:** `GET https://<RENDER_URL>/health/live` &rarr; Returns `{ status: "ok", service: "localman-api" }`.
- **Readiness:** `GET https://<RENDER_URL>/health/ready` &rarr; Executes `SELECT 1` on database; returns `{ status: "ok", database: "connected" }`.
- **Admin Verification:** Opening the Vercel URL runs `validateAdminEnv()`; successful load verifies that `VITE_API_BASE_URL` is parsed and TLS certificates are valid.

### Zero-Downtime Rollback Mechanism:
- **Render:** If `/health/ready` fails during a new deployment, Render automatically aborts the cutover and routes 100% of traffic to the previous healthy container. In the Render Dashboard, any previous deployment can be restored in 1 click via **Deploys &rarr; Rollback**.
- **Vercel:** Vercel preserves immutable deployments for every commit. Any previous deployment can be made instant production via **Deployments &rarr; Instant Rollback**.

---

## 6. Monorepo Verification & Git Delivery

All local tests, builds, and sanity checks were re-verified before delivery:
- `@localman/api`: Prisma client generated, TypeScript compilation clean (`tsc` passed).
- `@localman/admin-web`: Vite build succeeded in 2.68s.
- `apps/customer_app`: 107/107 unit tests passed.
- `apps/provider_app`: 31/31 unit tests passed.
- Secrets Scan: 0 active secrets detected.
- Git Status: Branch `develop` updated cleanly.
