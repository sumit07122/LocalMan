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
2. **P1 — RESOLVED: Consolidated fee math.** Consolidated inline commission arithmetic in `bookings/booking.service.ts` and `quotes/quote.service.ts` into canonical methods `FinancialService.calculatePlatformFee` and `FinancialService.deriveBookingPricing`. Backed by 7 unit tests in `contracts.test.ts`.
3. **P1 — Commission/TDS overridable per service/provider.**
   - `platformCommissionPercent` (Service model) is restricted to `ADMIN` and `CITY_MANAGER` roles upon catalog creation.
   - `commissionRateOverride` (Provider model) exists at the Prisma schema level, is read during settlement and quote acceptance, and is not exposed to any public or provider-facing endpoints.
4. **P2 — CI hygiene:**
   - Actions on Node 20 deprecation warning.
   - `ubuntu-latest` runner migration.
   - Separate test-only credentials from staging/prod secrets.
   - Address `deprecated_member_use` Flutter linter notices in `analysis_options.yaml`.
5. **P2 — Default branch vs working branch:**
   - GitHub default branch is `master`, while feature work and CI staging APK builds target `develop`. Release promotion strategy (PR from `develop` -> `master`) to be documented.
6. **Production readiness gaps to audit next:**
   - Real payment gateway integration (Razorpay production keys, webhook signature verification).
   - Real SMS/OTP gateway (Twilio/MSG91 integration replacing mock).
   - Storage/KYC encryption at rest and in transit.
   - Ingress rate limiting, production observability, automated database backups, staging environment deployment.

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
