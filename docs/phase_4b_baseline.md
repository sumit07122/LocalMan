# LOCALMAN — PHASE 4B BASELINE AND DATA SAFETY REPORT

**Document ID:** `LM-DOC-PHASE-4B-BASELINE`  
**Execution Date:** November 1, 2026  
**Auditor:** Principal DevOps Engineer, Cloud Architect, Release Manager, Senior Flutter Engineer  
**Status:** Baseline Audited & Recorded — Staging Area Clean (0 Staged)

---

## 1. Git State & Working Tree Audit

* **Current Branch:** `master`
* **Upstream Remote:** `origin/master` (`https://github.com/sumit07122/LocalMan.git`)
* **Tracking Status:** Ahead of `origin/master` by 2 commits (`f91e288`, `b807fb4` — workspace build fixes and clean CI pipeline preparation).
* **Staged Files:** **0 staged files**. Staging area is completely clean.
* **Modified Tracked Files:** 78 files across monorepo (`apps/api`, `apps/admin_web`, `apps/customer_app`, `apps/provider_app`, `packages/constants`, `packages/contracts`).
* **Deleted Files:** 0 files deleted.
* **Large Files / Dump Files:** The 798.9 MB Android `.hprof` dump (`java_pid20032.hprof`) was previously verified and deleted. `.gitignore` explicitly contains `*.hprof`.
* **Data Safety Invariant:** Zero destructive Git commands (`git reset`, `git clean`, `git checkout`, `git restore`) were executed. The working tree remains completely recoverable and reviewable.

---

## 2. Existing Deployment & Cloud Configuration

* **Vercel Configuration:** `vercel.json` exists at repository root using the Vercel Services schema (`admin_web` on Vite, `api` on Fastify/Node).
* **Render Configuration:** No `render.yaml` exists yet.
* **GitHub Actions Workflows:** No `.github/workflows/` directory exists yet.
* **Environment Configuration:**
  - `apps/api/.env` and `.env.example` exist.
  - `apps/admin_web/.env.example` exists.
  - `apps/customer_app/.env.example` and `apps/provider_app/.env.example` exist.

---

## 3. Mobile (Android & Flutter) Baseline

* **LocalMan Customer (`apps/customer_app`):**
  - Package ID / Application ID: `in.localman.customer`
  - Compile SDK: `36`
  - Target SDK: `36`
  - Min SDK: Flutter default (`21`)
  - Java Compatibility: Java 17
  - Core Library Desugaring: `com.android.tools:desugar_jdk_libs:2.1.4`
  - Base URL Resolution: `EnvConfig.baseUrl` resolved via `--dart-define=API_BASE_URL=...` and `--dart-define=ENV=...`
* **LocalMan Provider (`apps/provider_app`):**
  - Package ID / Application ID: `in.localman.provider`
  - Compile SDK: `36`
  - Target SDK: `36`
  - Min SDK: Flutter default (`21`)
  - Java Compatibility: Java 17
  - Core Library Desugaring: `com.android.tools:desugar_jdk_libs:2.1.4`
  - Base URL Resolution: `EnvConfig.baseUrl` resolved via `--dart-define=API_BASE_URL=...`

---

## 4. Database Migration History & Current Schema State

Total of 8 Prisma migrations present in `apps/api/prisma/migrations/`:
1. `20261018000000_init` (Core marketplace schema)
2. `20261018180000_phase_2e_financial_ledger` (Wallets, ledger entries, payouts)
3. `20261018200000_phase_2f_realtime_dispatch` (Dispatch offers and timeouts)
4. `20261019120000_phase_2g_location_tracking` (Provider location logs and beacons)
5. `20261019150000_phase_3c_booking_snapshots` (Address, price, service snapshots)
6. `20261020120000_phase_3i_chat_messaging` (Conversations, messages, chat outbox)
7. `20261020140000_phase_3j_reviews_reputation` (Reviews, rating stats, moderation)
8. `20261102000000_phase_4a_integrity_hardening` (Foreign key restrict, negative balance checks, positive amount checks, rating range checks, partial unique indexes on single accepted quote and default address, refund idempotency key, start OTP hash)

All 8 migrations are deployed and verified on real PostgreSQL 18.4 (`localman_db` on port 5432).

---

## 5. Test Baseline

* **Backend Tests:** **526 passed** across **78 test suites**, 0 failed, 0 skipped.
* **Real PostgreSQL Tests:** 6/6 tests passing against live PostgreSQL 18.4 engine (`apps/api/test/postgres-integrity-constraints.test.ts`).
* **Root Monorepo Build:** Clean exit code 0 (`tsc` + `vite build` + `prisma generate`).

