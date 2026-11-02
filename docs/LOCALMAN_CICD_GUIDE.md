# LocalMan — Continuous Integration & Continuous Delivery (CI/CD) Guide

**Date:** November 2026  
**Auditor:** Principal DevSecOps Engineer & Release Architect  
**Platform:** GitHub Actions  
**Repository:** `https://github.com/sumit07122/LocalMan` (Private)  

---

## 1. CI/CD Architecture Overview

The LocalMan monorepo utilizes two automated GitHub Actions workflows designed according to OpenSSF / SLSA Level 2 supply chain security standards:

1. **`LocalMan CI Pipeline` ([`.github/workflows/ci.yml`](file:///.github/workflows/ci.yml)):** Triggered on all pushes and pull requests to `master` and `develop`. Validates backend compilation, database migrations, unit/integration tests, web frontend builds, and Flutter mobile code health.
2. **`Android APK Distribution` ([`.github/workflows/android-distribution.yml`](file:///.github/workflows/android-distribution.yml)):** Triggered manually (`workflow_dispatch`) or on SemVer tag release (`v*.*.*`). Builds, signs, packages, and archives Android release APKs for staging or production testing.

---

## 2. Supply Chain Security Hardening

- **Top-Level Least-Privilege Permissions:** Both workflows specify `permissions: contents: read` globally, preventing automated tasks from acquiring write or administrative permissions.
- **Pinned Full Commit SHAs:** All third-party GitHub Actions are pinned to immutable 40-character commit SHAs:
  - `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2)
  - `actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af` (v4.1.0)
  - `actions/setup-java@3a4f6e1af504cf6a31855fa899c6aa5355ba6c12` (v4.7.0)
  - `actions/upload-artifact@65c4c4a1ddee5b72f698fdd19549f0f0fb45cf08` (v4.6.0)
  - `subosito/flutter-action@f721806e60b296417ad0165c3abecda7444ac4d3` (v2.18.0)
- **Isolated Disposable Services:** The backend test job provisions ephemeral PostgreSQL 16 with PostGIS (`postgis/postgis:16-3.4`) and Redis 7 (`redis:7-alpine`) service containers using disposable credentials. Production credentials are **never** injected into CI.

---

## 3. Workflow Jobs & Verification Gates

### 3.1 Job: `backend-ci`
- **Dependencies:** Node.js 22, PostgreSQL 16 + PostGIS, Redis 7.
- **Execution Order:**
  1. `npm ci`
  2. Build `@localman/constants`, `@localman/contracts`, `@localman/design-tokens`.
  3. `prisma generate`
  4. `prisma migrate deploy` (Applies all 7 SQL migrations against PostgreSQL container).
  5. `npm run build --workspace=@localman/api` (TypeScript typecheck & compile).
  6. `npm test --workspace=@localman/api` (Runs 536 tests sequentially).

### 3.2 Job: `admin-web-ci`
- **Dependencies:** Node.js 22.
- **Execution Order:**
  1. `npm ci`
  2. Build shared workspace packages.
  3. `npm run build --workspace=@localman/admin-web` (Vite production bundle & TypeScript typecheck).

### 3.3 Job: `mobile-apps-ci`
- **Dependencies:** Java 17 Temurin, Flutter stable channel.
- **Execution Order:**
  1. Customer App: `flutter pub get`, `flutter analyze --no-fatal-infos`, `flutter test`.
  2. Provider App: `flutter pub get`, `flutter analyze --no-fatal-infos`, `flutter test`.

---

## 4. Android APK Distribution & Artifact Packaging

When triggered, the distribution workflow compiles release APKs using `--dart-define` to inject the appropriate backend API URL:

| Parameter | Staging Value | Production Value |
| :--- | :--- | :--- |
| `API_BASE_URL` | `${{ secrets.STAGING_API_BASE_URL }}` (or `https://api-staging.localman.in/api/v1`) | `${{ secrets.PRODUCTION_API_BASE_URL }}` (or `https://api.localman.in/api/v1`) |
| `ENV` | `staging` | `production` |

### Artifact Naming Convention:
All compiled APKs are stored in `dist/apks/` with full release metadata:
```text
localman-customer-staging-v1.0.0-b42-a1b2c3d.apk
localman-provider-staging-v1.0.0-b42-a1b2c3d.apk
```
Canonical aliases are also created for fast scripting:
```text
localman-customer-staging.apk
localman-provider-staging.apk
```
The artifacts are uploaded via `actions/upload-artifact` with a 14-day retention period.

---

## 5. Firebase App Distribution Setup (Optional)

If automated distribution to tester groups is desired:
1. In Firebase Console, create an Android app for `in.localman.customer` and `in.localman.provider`.
2. Generate a Firebase CI token via `firebase login:ci`.
3. Add repository secrets:
   - `FIREBASE_TOKEN`: Firebase CI token.
   - `FIREBASE_CUSTOMER_APP_ID`: `1:...:android:...`
   - `FIREBASE_PROVIDER_APP_ID`: `1:...:android:...`
4. When present, the workflow automatically deploys to registered QA testers.
