# CLAUDE.md — LocalMan Project Guide

Permanent engineering documentation for AI/human contributors. Keep this file current: update it whenever architecture, commands, status, or rules change.

## 1. What LocalMan is
On-demand home-services marketplace for India. Three-sided platform:
1. **Customer app** (Flutter, Android/Web) — discovery, booking, payments, tracking, support.
2. **Provider app** (Flutter, Android/Web) — onboarding, KYC, job requests, execution, earnings.
3. **Admin web** (React + Vite + TS) — operations, bookings, provider verification, catalog, payments, analytics.

Goal: secure, production-ready marketplace (not a prototype).

## 2. Repository
- GitHub: https://github.com/sumit07122/LocalMan
- Work on **`develop`** (default branch on GitHub is `master`). Baseline commit audited: `c67e921` (Phase 4E UI/UX redesign) stabilized in Phase 4F.
- npm-workspaces monorepo (`packages/*`, `apps/*`):

| Path | Purpose |
|---|---|
| `apps/api` | Fastify + TypeScript API, Prisma (PostgreSQL/PostGIS). Modules in `src/modules/`: addresses, admin, auth, bookings, cancellations, catalog, chat, dispatch, disputes, financial, location, media, notifications, payments, providers, quotes, realtime, refunds, reviews, storage |
| `apps/admin_web` | React/Vite/TS admin portal |
| `apps/customer_app` | Flutter customer app (Riverpod, go_router, dio) |
| `apps/provider_app` | Flutter provider app |
| `packages/constants` | Shared enums/constants (booking, payment, provider, roles...) |
| `packages/contracts` | Shared DTOs (TS) |
| `packages/design_tokens` | Shared design tokens |
| `docs/` | Architecture, audits, phase reports, runbooks |
| `scripts/` | dev-all, local DB, preview server, secret audit |
| `.github/workflows` | `ci.yml` (backend-ci, admin-web-ci, customer-flutter-ci, provider-flutter-ci, staging APKs guarded by `STAGING_API_BASE_URL`), `android-distribution.yml` |
| `render.yaml`, `vercel.json` | Planned hosting (API on Render, Admin on Vercel) — **not deployed without owner approval** |

Prisma: 34 models, 9 migrations (`apps/api/prisma`). API tests: 26 files in `apps/api/test` (node `--test` via tsx, `--test-concurrency=1`).

## 3. Commands
```bash
npm ci                         # runs postinstall: builds shared packages + prisma generate
npm run build:packages         # constants, contracts, design-tokens
npm run dev:all                # scripts/dev-all.ts (local stack)
npm run db:start | db:migrate | db:seed
npm test --workspace=@localman/api         # needs Postgres+PostGIS, Redis, env vars (see ci.yml)
npm run build --workspace=@localman/admin-web
# Flutter (per app dir): flutter pub get && flutter analyze --no-fatal-infos && flutter test
```
CI test env uses mock providers: `STORAGE_PROVIDER=mock SMS_GATEWAY_PROVIDER=mock PAYMENT_GATEWAY_PROVIDER=mock`.

## 4. Non-negotiable business rules
- Platform commission **15%**; TDS **1%** (`FinancialService.DEFAULT_COMMISSION_PERCENT`, `STATUTORY_TDS_PERCENT` in `apps/api/src/modules/financial/financial.service.ts`).
- All money stored as **integer paisa**. No floats persisted.
- **Backend owns all financial calculations.** Clients never compute authoritative amounts.
- Booking and Payment are **separate state machines** (`BookingStatusEnum`, `PaymentStatusEnum`).
- Secure OTP verification and protected KYC data are mandatory.
- Do **not change financial rules** without explicit owner approval.

## 5. Working rules for agents
- Inspect existing code before changing it. Never rebuild from scratch.
- Work on `develop`; small, reviewable commits; never force-push or overwrite owner work.
- Never commit secrets; never deploy production infrastructure without approval.
- Don't claim "works" without evidence: state what was actually run and what was not.
- Keep docs and this file in sync with changes.

## 6. Baseline audit & Verification
- `npm ci --ignore-scripts`: OK. Shared packages build: OK. **Admin web `tsc && vite build`: OK.**
- **Customer Flutter analyzer (RESOLVED)**: Fixed 6 compiler diagnostics on nullable `formattedDuration` across `booking_creation_screen.dart`, `category_services_screen.dart`, `service_detail_screen.dart`, and `service_search_screen.dart`. Verified: `flutter analyze --no-fatal-infos` exits with code 0; 107/107 tests pass.
- **Provider Flutter analyzer**: Verified with `flutter analyze --no-fatal-infos` (0 errors, exits with code 0); 31/31 tests pass.
- **Backend test suite**: Fully verified against local PostgreSQL + PostGIS test instance: 546 tests pass across 83 test suites (0 failures).
- **Secret scan (`scripts/audit-secrets.js`)**: Tightened scanner to ignore 40-character hex commit hashes, Flutter metadata revisions, and file paths with slashes. Working tree is verified clean of active secrets.

## 7. Known issues / risks (prioritized)
1. **P0 — RESOLVED: Customer Flutter analyzer errors in CI.** Fixed nullable access and verified clean `flutter analyze --no-fatal-infos` and `flutter test` (107/107 passed) on Customer App and Provider App (31/31 passed).
2. **P1 — RESOLVED: Consolidated fee math.** Consolidated inline commission arithmetic into canonical methods `FinancialService.calculatePlatformFee` and `FinancialService.deriveBookingPricing`. Backed by 7 unit tests in `contracts.test.ts`.
3. **P1 — RESOLVED (Phase 4F.1): Commission & TDS Governance.**
   - All seeded catalog services in `apps/api/prisma/seed.ts` unified to canonical 15.0% commission.
   - `POST /api/v1/catalog/services` strictly requires `ADMIN` role for non-15.0% commission rates (`ForbiddenError` for `CITY_MANAGER`, `PROVIDER`, `CUSTOMER`) and automatically generates `SERVICE_COMMISSION_OVERRIDE_CREATED` audit logs.
   - Financial adjustments (`/financial/adjustments`) and payout status updates strictly restricted to `ADMIN` and `FINANCE_MANAGER`.
   - Backed by 11 unit/integration tests in `apps/api/test/security-financial-invariants.test.ts`.
4. **P2 — RESOLVED (Phase 4F.1): CI & Secrets Hygiene:**
   - Isolated ephemeral CI test secrets with `ci-test-only-ephemeral-` prefix and prominent warning headers prohibiting reuse.
   - Hardened `android-distribution.yml`: removed unverified hardcoded domain fallbacks, requiring verified repository variables or secrets.
   - Converted `deprecated_member_use: ignore` &rarr; `deprecated_member_use: info` in both mobile apps.
5. **P2 — Default branch vs working branch:**
   - GitHub default branch is `master`, while feature work and CI staging APK builds target `develop`. Release promotion strategy (PR from `develop` -> `master`) to be documented.
6. **Production readiness gaps to configure next (requires cloud accounts/keys):**
   - Live Razorpay merchant keys and webhook secret.
   - Live SMS/OTP gateway (MSG91/Twilio DLT approved templates).
   - Live AWS S3 / Cloudflare R2 bucket with server-side KMS encryption.
   - Ingress rate limiting with Redis cluster, automated daily PostgreSQL snapshots.

## 8. Status log
- 2026-11-02: Initial audit and baseline established.
- 2026-11-02: Fixed P0 Customer Flutter analyzer errors (nullable `formattedDuration`). Both Customer and Provider apps now pass `flutter analyze --no-fatal-infos` with exit code 0.
- 2026-11-02: Consolidated P1 fee math into `FinancialService.calculatePlatformFee` and `FinancialService.deriveBookingPricing`, eliminating duplicated inline calculations across `booking.service.ts` and `quote.service.ts`.
- 2026-11-02: Tightened `scripts/audit-secrets.js` to eliminate false positives on Git commit hashes and Flutter revisions.
- 2026-11-03: Phase 4F Engineering Baseline & CI Stabilization complete:
  - Fixed Customer App analysis failures across 4 files without force unwraps (`!`).
  - Verified both Customer (107/107) and Provider (31/31) test suites pass cleanly.
  - Decoupled mobile CI into `customer-flutter-ci` and `provider-flutter-ci` in `.github/workflows/ci.yml`.
  - Added staging environment guard in CI (`vars.STAGING_API_BASE_URL`) to prevent building non-functional APKs with dummy URLs.
  - Audited Admin Catalog take-rate slider: renamed to "Service Catalog & Take-Rate Yield Simulator", added explicit 15% platform commission / 1% TDS server authority notes.
  - Audited Android release configurations, package IDs, SDK levels, and safe QA signing workflows via GitHub Secrets.
  - Generated `docs/PHASE_4F_ENGINEERING_BASELINE_REPORT.md`.
- 2026-11-03: Phase 4F.1 Security Audit Remediation complete:
  - Synchronized all 15 seeded catalog services to canonical 15.0% commission.
  - Enforced `ADMIN`-only restriction on non-standard commission rates with `AuditLog` recording.
  - Hardened RBAC on manual financial adjustments and payouts (`ADMIN` & `FINANCE_MANAGER` only).
  - Implemented automated KYC document masking in `AdminService.getPendingKycDocuments()`.
  - Isolated CI test mock secrets with `ci-test-only-ephemeral-` prefix and warning headers.
  - Converted Flutter `deprecated_member_use` from `ignore` to `info`.
  - Added 11 automated security tests in `security-financial-invariants.test.ts`.
  - Generated `docs/PHASE_4F_1_SECURITY_REMEDIATION_REPORT.md`.
- 2026-11-03: Phase 4G End-to-End Marketplace Integration complete:
  - Created master multi-sided integration suite `apps/api/test/e2e-marketplace-integration.test.ts` (1,320+ lines, 14 tests, 5 suites, 100% pass rate).
  - Verified complete 18-step customer journey (registration -> OTP -> catalog search -> booking -> dispatch matching -> map tracking -> chat -> start OTP -> checkout -> settlement -> review).
  - Verified complete 15-step provider journey (registration -> trade setup -> Aadhaar/PAN KYC -> verification -> duty activation -> offer accept -> navigation -> arrival -> start OTP verification -> execution -> wallet -> payout request).
  - Verified complete 10-step admin operations journey (metrics -> KYC queue review -> live bookings -> radar dispatch -> ledger audit -> payout approval -> review moderation -> catalog management -> audit logs).
  - Verified 11 adversarial failure scenarios (atomic offer claim race condition 409 conflict, brute-force start OTP throttle 422, forged payment signature rejection 400, idempotent cancellation refund, deduplication).
  - Resolved `NaN` amount poisoning in `completeJob()` and `updateBookingStatus()` caused by uninitialized extra duration fields.
  - Aligned `PaymentService.createCheckoutSession` with canonical 15% platform commission / 1% TDS integer paisa math.
  - Verified entire monorepo: API build (0 errors), Admin Web build (0 errors, Vite 2.25s), Customer App (107/107 tests), Provider App (31/31 tests), secret audit (clean).
  - Generated `docs/PHASE_4G_END_TO_END_INTEGRATION_REPORT.md`.
- 2026-11-03: Phase 4H Native Android Build & Device QA complete:
  - Toolchain certified: Flutter SDK 3.47.8, Dart 3.13.7, Android Studio OpenJDK 21.0.10 JBR, Android SDK 36.1.0, ADB 1.0.41.
  - Native Customer release APK built: `in.localman.customer` (version 1.0.0, compileSdk 36, targetSdk 36, 61.8 MB).
  - Native Provider release APK built: `in.localman.provider` (version 1.0.0, compileSdk 36, targetSdk 36, 59.8 MB).
  - Cryptographically verified QA signing via `apksigner` (Signature Scheme v2 verified, 1 signer, debug keystore isolation).
  - Audited strictly necessary foreground permissions (INTERNET, LOCATION, NOTIFICATIONS); zero background tracking.
  - Saved binaries to local git-ignored folder `release-apks/qa-release-phase-4h/` with computed SHA-256 hashes.
  - Documented physical device installation via ADB and LAN reverse port forwarding.
  - Generated `docs/PHASE_4H_ANDROID_DEVICE_QA_REPORT.md`.
- 2026-11-03: Phase 4I Cloud Staging Deployment complete:
  - Audited and updated `render.yaml` for Fastify API + PostgreSQL 16 PostGIS in Singapore region targeting `develop` branch.
  - Replaced outdated serverless root `vercel.json` with dedicated `@localman/admin-web` Vite SPA deployment configuration with strict security headers.
  - Enhanced CORS in `app.ts` to dynamically allow Vercel staging preview domains (`*.vercel.app`).
  - Created step-by-step owner deployment runbook with cost/billing breakdown ($14/mo) and zero committed secrets.
  - Generated `docs/PHASE_4I_STAGING_DEPLOYMENT_REPORT.md`.
- 2026-11-03: Phase 4J External Service Integrations complete:
  - Implemented concrete multi-gateway SMS adapters (Fast2SMS DLT, MSG91 Enterprise, Twilio, Mock) with 60s resend cooldown, 3 req/15 min limit, 10 min expiry, 5 attempt lock, and log masking.
  - Hardened Razorpay payment and webhook signatures via `crypto.timingSafeEqual`, implemented server-side refund execution with integer paisa, and maintained zero trust of frontend payment claims.
  - Enforced mandatory `x-amz-server-side-encryption: AES256` for all private S3/R2 presigned upload URLs with 60-minute time-limited read URLs and strict MIME/size boundaries.
  - Implemented Firebase Cloud Messaging HTTP v1 provider with thread-safe device token registry, automatic unregistered token pruning on 404, retry backoff on 429/503, and automated privacy redaction of secrets/OTPs.
  - Added geocoding support and in-memory 30s cache TTL to GoogleMapsService, protected by 60 req/min and 5000 req/day budget limits with zero-cost Haversine fallback.
  - Verified full test suite: 24/24 external service integration tests passed, 107/107 customer app tests passed, 31/31 provider app tests passed, 0 TypeScript build errors across all workspaces.
  - Generated `docs/PHASE_4J_EXTERNAL_INTEGRATIONS_REPORT.md`.
