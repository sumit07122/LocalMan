# LOCALMAN — PHASE 4F MASTER EXECUTION REPORT
## Engineering Baseline, Flutter CI Stabilization & Mobile Release Architecture

**Project:** LocalMan — On-Demand Home Services Marketplace (India)  
**Target Branch:** `develop`  
**Base Commit:** `c67e921a05b4cf4fca0b2244fa3d117b73592f52`  
**Execution Timestamp:** 2026-11-03  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

Phase 4F established a stable, verified, and strictly isolated engineering baseline across the entire LocalMan monorepo following the Phase 4E UI/UX redesign.

Key achievements in Phase 4F:
1. **Flutter Analysis Stabilization:** Diagnosed and surgically resolved all 4 Customer App analysis failures identified in GitHub Actions run `#41495246933`. Eliminated all unsafe force unwraps (`!`), implementing idiomatic Dart local variable type promotion and safe fallback defaults.
2. **Independent Mobile Verification:** Verified both mobile applications (`apps/customer_app` and `apps/provider_app`) independently. Both apps achieve zero static analysis errors (`flutter analyze --no-fatal-infos`) and 100% test pass rates (107/107 Customer tests passed, 31/31 Provider tests passed).
3. **CI/CD Pipeline Decoupling & Hardening:** Split the monolithic `mobile-flutter-ci` job in `.github/workflows/ci.yml` into distinct, parallel `customer-flutter-ci` and `provider-flutter-ci` jobs. Preserved the immutable pinned Flutter action SHA (`subosito/flutter-action@1a449444c387b1966244ae4d4f8c696479add0b2`).
4. **Staging Artifact Guard:** Removed unverified hardcoded staging URLs. Configured the APK build pipeline to ingest `vars.STAGING_API_BASE_URL` with a pre-flight validation step that safely notifies and skips artifact creation when unconfigured, preventing non-functional builds.
5. **Financial & Catalog Take-Rate Guard:** Audited the Admin Web catalog take-rate control. Verified it was purely local React state with zero server mutation. Re-labeled the interface as the **"Service Catalog & Take-Rate Yield Simulator"** with explicit in-app notices confirming the immutable server-authoritative 15.0% commission + 1.0% Section 194O TDS calculation rule in integer paisa.
6. **Android Release Configuration Audit:** Conducted a comprehensive Gradle and AndroidManifest audit for both mobile applications, detailing package identifiers, target SDKs, `--dart-define` parameters, and safe QA signing workflows via GitHub Secrets.

---

## 2. Stage-by-Stage Verification & Implementation

### Stage 1: Repository Inspection & Current State Audit
- Checked current Git branch and commit history:
  - Target branch: `develop` (protected; default branch on GitHub is `master`).
  - Base development baseline: `c67e921a05b4cf4fca0b2244fa3d117b73592f52` (Phase 4E redesign).
  - Uncommitted work: cleanly identified and preserved.
  - Zero modifications to unrelated projects or repositories.

### Stage 2: Flutter Analysis Failures Resolution
- **Root Cause Analysis (GitHub Actions Run #41495246933):**
  In Dart 3 null-safety, class getters (e.g. `service.formattedDuration`) cannot undergo automatic compiler type promotion because a getter may theoretically return different values on consecutive calls. The Phase 4E redesign used direct getter null-checks (`if (service.formattedDuration != null && service.formattedDuration.isNotEmpty)`), resulting in compiler errors:
  - `The property 'isNotEmpty' can't be unconditionally accessed because the receiver can be 'null'.`
  - `The argument type 'String?' can't be assigned to the parameter type 'String'.`
- **Surgical Fix:**
  Promoted property access to local `final` variables within card build methods or data callbacks:
  ```dart
  final duration = service.formattedDuration;
  if (duration != null && duration.isNotEmpty) {
    // Dart compiler safely type-promotes duration to non-nullable String
    Text(duration, ...)
  }
  ```
  Applied across 4 files without introducing any force unwrap (`!`) operators:
  1. `apps/customer_app/lib/features/bookings/presentation/screens/booking_creation_screen.dart`
  2. `apps/customer_app/lib/features/services/presentation/screens/category_services_screen.dart`
  3. `apps/customer_app/lib/features/services/presentation/screens/service_detail_screen.dart`
  4. `apps/customer_app/lib/features/services/presentation/screens/service_search_screen.dart`

### Stage 3: Mobile Apps Verification Matrix
Both Flutter applications were tested independently with clean execution:

| Target | Command | Result | Notes |
|---|---|---|---|
| Customer App | `flutter analyze --no-fatal-infos` | **0 errors** (29 infos) | Exit code 0 |
| Customer App | `flutter test` | **107 / 107 passed** | 0 failures, 0 skipped |
| Provider App | `flutter analyze --no-fatal-infos` | **0 errors** (8 infos) | Exit code 0 |
| Provider App | `flutter test` | **31 / 31 passed** | 0 failures, 0 skipped |

### Stage 4: CI/CD Pipeline Architecture (`.github/workflows/ci.yml`)
The GitHub Actions workflow was refactored for clarity, parallel execution, and build integrity:
1. **Parallelized Mobile Jobs:**
   - `customer-flutter-ci`: runs `flutter analyze` and `flutter test` for `apps/customer_app`.
   - `provider-flutter-ci`: runs `flutter analyze` and `flutter test` for `apps/provider_app`.
2. **Pinned Action Integrity:**
   - Flutter action pinned to SHA: `subosito/flutter-action@1a449444c387b1966244ae4d4f8c696479add0b2 # v2.18.0`.
3. **Artifact Dependency Gate:**
   - `build-staging-apks` requires all four CI jobs to pass:
     ```yaml
     needs: [backend-ci, admin-web-ci, customer-flutter-ci, provider-flutter-ci]
     ```
4. **Staging URL Validation Guard:**
   - Removed hardcoded unverified URL `https://api-staging.localman.in/api/v1`.
   - Ingests repository variable `${{ vars.STAGING_API_BASE_URL }}`.
   - Added pre-build step `Validate Staging Environment Configuration`:
     If `STAGING_API_BASE_URL` is empty, unset, or matches placeholder `https://api-staging.example.com`, the step emits a GitHub Actions notice and sets `configured=false`. Downstream APK builds are safely skipped with an informative log message.

### Stage 5: Financial Architecture & Admin Catalog Take-Rate Audit
- **Audit Findings in `apps/admin_web/src/App.tsx`:**
  - The catalog take-rate slider (`catalogCommission`) was purely in-memory React state (`useState(15)`).
  - No network requests, API mutations, or database updates were triggered by moving the slider.
- **Hardened UI Terminology & Guardrails:**
  - Renamed the section to **"Service Catalog & Take-Rate Yield Simulator"**.
  - Added an in-app architectural compliance banner:
    > "Platform commission is strictly enforced at 15.0% server-authoritative in the financial engine with 1.0% statutory TDS deduction (Section 194O). The take-rate slider below is a local visual yield simulation tool and does not mutate production settlement rules."
  - Updated button label to **"Update Yield Simulation"** and clarified the notification dialog:
    > "Yield simulation updated to X%. (Note: Canonical platform take-rate remains server-enforced at 15.0%)."
- **Backend Settlement Integrity:**
  - Verified `apps/api/src/modules/financial/financial.service.ts`:
    - Platform commission: 15% (`PLATFORM_COMMISSION_BPS = 1500`).
    - TDS: 1% (`TDS_RATE_BPS = 100`).
    - Stored and calculated strictly in integer paisa.

---

## 3. Stage 6: Android Release & Signing Review

### Mobile App Specifications

| Metric / Parameter | Customer App (`apps/customer_app`) | Provider App (`apps/provider_app`) |
|---|---|---|
| **Application ID** | `in.localman.customer` | `in.localman.provider` |
| **Android Namespace** | `in.localman.customer` | `in.localman.provider` |
| **App Name (`android:label`)** | `LocalMan` | `LocalMan Partner` |
| **Compile SDK** | `36` (Android 15+) | `36` (Android 15+) |
| **Target SDK** | `36` | `36` |
| **Min SDK** | `flutter.minSdkVersion` (21) | `flutter.minSdkVersion` (21) |
| **Java Compatibility** | Java 17 (`JavaVersion.VERSION_17`) | Java 17 (`JavaVersion.VERSION_17`) |
| **Desugaring** | `desugar_jdk_libs:2.1.4` | `desugar_jdk_libs:2.1.4` |
| **Default Release Signing** | `signingConfigs.debug` (fallback) | `signingConfigs.debug` (fallback) |
| **Permissions Declared** | `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` |

### Environment Configuration & Dart Defines
Both apps implement `EnvConfig` (`apps/*/lib/core/config/env_config.dart`) which parses compile-time variables:
- `--dart-define=ENV=staging|production|development`
- `--dart-define=API_BASE_URL=https://...`
- **Security Rule Enforced in Code:** When `ENV=production`, `EnvConfig.baseUrl` throws a `StateError` if the URL does not begin with `https://`.

### Recommended Secure Production Signing Architecture (Play Store & Staging)
To generate release-signed APKs / AABs without committing keystores or exposing credentials:
1. **GitHub Secrets Required:**
   - `ANDROID_KEYSTORE_BASE64`: Base64-encoded `.jks` or `.keystore` file.
   - `KEYSTORE_PASSWORD`: Keystore access password.
   - `KEY_ALIAS`: Key alias name (e.g. `localman-release`).
   - `KEY_PASSWORD`: Password for the key alias.
2. **CI Injection Workflow:**
   ```yaml
   - name: Decode Android Keystore
     if: env.HAS_SIGNING_KEYS == 'true'
     run: |
       echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > apps/customer_app/android/app/release.keystore
     env:
       KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
       KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
       KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
   ```
3. **Gradle Configuration Pattern (`android/app/build.gradle`):**
   ```groovy
   signingConfigs {
       release {
           if (System.getenv("KEYSTORE_PASSWORD") != null) {
               storeFile file("release.keystore")
               storePassword System.getenv("KEYSTORE_PASSWORD")
               keyAlias System.getenv("KEY_ALIAS")
               keyPassword System.getenv("KEY_PASSWORD")
           } else {
               signingConfig signingConfigs.debug
           }
       }
   }
   ```
This guarantees that local development and staging CI builds succeed without keystores (using debug signing), while release pipelines automatically switch to production signing when secrets are present.

---

## 4. Full Monorepo Regression Verification

| Workspace / Module | Command | Result |
|---|---|---|
| `@localman/constants` | `tsc` | **Passed (0 errors)** |
| `@localman/contracts` | `tsc` | **Passed (0 errors)** |
| `@localman/design-tokens` | `tsc` | **Passed (0 errors)** |
| `@localman/admin-web` | `tsc && vite build` | **Passed (196.8 kB JS bundle)** |
| `@localman/api` (Prisma) | `prisma generate` | **Passed (v6.19.3 generated)** |
| `@localman/api` (Build) | `tsc` | **Passed (0 errors)** |
| Customer App (Analyze) | `flutter analyze --no-fatal-infos` | **Passed (0 errors)** |
| Customer App (Tests) | `flutter test` | **Passed (107 / 107 tests)** |
| Provider App (Analyze) | `flutter analyze --no-fatal-infos` | **Passed (0 errors)** |
| Provider App (Tests) | `flutter test` | **Passed (31 / 31 tests)** |
| Monorepo Whitespace | `git diff --check` | **Passed (0 errors)** |

---

## 5. Summary of Modified Files

- `.github/workflows/ci.yml`: Decoupled customer and provider mobile CI jobs; added staging URL configuration guard.
- `apps/customer_app/lib/features/bookings/presentation/screens/booking_creation_screen.dart`: Fixed Dart type promotion for duration/description.
- `apps/customer_app/lib/features/services/presentation/screens/category_services_screen.dart`: Fixed Dart type promotion for duration/description.
- `apps/customer_app/lib/features/services/presentation/screens/service_detail_screen.dart`: Fixed Dart type promotion for duration.
- `apps/customer_app/lib/features/services/presentation/screens/service_search_screen.dart`: Fixed Dart type promotion for duration/description.
- `apps/admin_web/src/App.tsx`: Re-labeled catalog take-rate slider as yield simulator and added 15% platform fee governance notice.
- `docs/PHASE_4F_ENGINEERING_BASELINE_REPORT.md`: Comprehensive engineering report.
- `CLAUDE.md`: Updated development guide with Phase 4F verification baseline.
