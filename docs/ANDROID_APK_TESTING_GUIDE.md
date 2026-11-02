# LocalMan — Android APK Distribution & QA Testing Guide

**Date:** November 2026  
**Version:** 1.0.0  
**Target Applications:**  
- Customer App: `in.localman.customer`  
- Provider App: `in.localman.provider`  

---

## 1. Overview & Build Artifacts

LocalMan provides automated Android APK builds via GitHub Actions workflow [`.github/workflows/android-distribution.yml`](file:///.github/workflows/android-distribution.yml).

| Application | Package ID | Target SDK | Minimum SDK | Java Version |
| :--- | :--- | :--- | :--- | :--- |
| **Customer App** | `in.localman.customer` | 36 (Android 15) | 21 (Android 5.0) | Java 17 |
| **Provider App** | `in.localman.provider` | 36 (Android 15) | 21 (Android 5.0) | Java 17 |

---

## 2. Triggering Builds & Downloading APKs

### 2.1 Triggering via GitHub Actions Web UI
1. Navigate to repository **Actions** tab in GitHub.
2. Select **Android APK Distribution** from the workflow list.
3. Click **Run workflow**:
   - **Target Deployment Environment:** Select `staging` (default) or `production`.
   - **Target Mobile Application:** Select `all`, `customer`, or `provider`.
   - **Release Notes:** Enter a descriptive note for QA tracking.
4. Click the green **Run workflow** button.
5. Once complete (approx 8–12 minutes), download the artifact `localman-android-apks-staging.zip` from the bottom of the workflow summary page.

### 2.2 Local Developer CLI Build
To compile release APKs directly on a development workstation with Flutter SDK:
```bash
# Customer App
cd apps/customer_app
flutter pub get
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api-staging.localman.in/api/v1 \
  --dart-define=ENV=staging

# Provider App
cd ../provider_app
flutter pub get
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api-staging.localman.in/api/v1 \
  --dart-define=ENV=staging
```
Generated APK paths:
- `apps/customer_app/build/app/outputs/flutter-apk/app-release.apk`
- `apps/provider_app/build/app/outputs/flutter-apk/app-release.apk`

---

## 3. Physical Device Installation Instructions

### 3.1 USB Debugging / ADB Installation (Recommended for QA)
1. Enable **Developer Options** and **USB Debugging** on your Android device:
   - Go to **Settings > About Phone** and tap **Build Number** 7 times.
   - Go to **Settings > System > Developer Options** and enable **USB Debugging**.
2. Connect your device via USB cable and verify device recognition:
   ```bash
   adb devices
   ```
3. Install the APK:
   ```bash
   # Customer App
   adb install -r dist/apks/localman-customer-staging.apk

   # Provider App
   adb install -r dist/apks/localman-provider-staging.apk
   ```

### 3.2 Direct Sideloading via Mobile Browser / Storage
1. Transfer the `.apk` file to the device via Google Drive, WhatsApp, Slack, or USB file transfer.
2. Open the file on the Android device.
3. If prompted with *"Install unknown apps"*, tap **Settings** and toggle **Allow from this source**.
4. Tap **Install** and then **Open**.

---

## 4. End-to-End QA Testing Runbook

### 4.1 Customer App QA Scenarios (`in.localman.customer`)

| Scenario ID | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- |
| **CUST-01: Authentication** | Enter mobile number, receive 6-digit OTP, enter OTP. | Profile loads, JWT access/refresh tokens stored securely in EncryptedSharedPreferences. | [ ] |
| **CUST-02: Location & Address** | Tap location picker, grant location permission, select address or drop pin. | Address saved to backend with latitude, longitude, and default tag. | [ ] |
| **CUST-03: Service Browsing** | Browse Electrical, Plumbing, Cleaning categories. | Real-time catalog renders with accurate base prices and descriptions. | [ ] |
| **CUST-04: Booking Request** | Select service, choose time slot, add notes, submit booking. | Booking generated in `REQUESTED` status; Start OTP (6 digits) displayed to customer. | [ ] |
| **CUST-05: Real-time Tracking** | Wait for provider dispatch; monitor status transitions (`ACCEPTED`, `PROVIDER_ON_THE_WAY`, `ARRIVED`). | Live status badges update without manual pull-to-refresh; provider ETA displayed. | [ ] |
| **CUST-06: Job Start OTP** | Provide the 6-digit Start OTP to provider for verification. | Status transitions to `IN_PROGRESS`. | [ ] |
| **CUST-07: Payment & Completion** | Provider completes job; customer reviews summary, simulates Razorpay checkout. | Booking transitions to `PAYMENT_SETTLED` -> `COMPLETED`. | [ ] |
| **CUST-08: Review & Rating** | Customer leaves 5-star rating and written review. | Rating aggregated on provider profile; review visible in feed. | [ ] |

---

### 4.2 Provider App QA Scenarios (`in.localman.provider`)

| Scenario ID | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- |
| **PROV-01: Onboarding & KYC** | Sign up, submit business name, upload Aadhaar card & PAN photo. | Documents uploaded via presigned S3 URLs; KYC status changes to `UNDER_REVIEW`. | [ ] |
| **PROV-02: Availability Toggle** | Toggle switch to "Go Online". | Provider coordinates updated in PostGIS; provider marked eligible for dispatch. | [ ] |
| **PROV-03: Dispatch Alert** | Customer requests matching service within provider service radius. | Push notification / sound alert received; countdown timer begins. | [ ] |
| **PROV-04: Accept & Navigation** | Tap "Accept Job"; tap "On The Way"; tap "Arrived". | Real-time events broadcasted to customer app; status history logged. | [ ] |
| **PROV-05: Start OTP Entry** | Ask customer for 6-digit OTP, enter in app, tap "Verify". | FSM validates HMAC hash; status advances to `IN_PROGRESS`. Invalid OTP shows remaining attempts. | [ ] |
| **PROV-06: Custom Quote / Extra Materials** | Add extra material items (e.g., replacement pipe ₹350), submit quote. | Customer receives quote approval prompt; total booking amount recalculates. | [ ] |
| **PROV-07: Complete & Wallet Credit** | Mark job complete; wait for customer payment settlement. | Net earnings (Gross - 15% commission - 1% TDS) instantly credited to Provider Wallet. | [ ] |
| **PROV-08: Payout Request** | Navigate to Wallet tab, view ledger history, request bank payout for available balance. | `ProviderPayout` record created in `PENDING` status; available balance adjusted. | [ ] |

---

## 5. Required Android Device Permissions

Ensure the following device permissions are granted when prompted:
1. **Location (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`):** Required for service address detection and provider real-time dispatch matching.
2. **Camera (`android.permission.CAMERA`):** Required for capturing KYC identity documents (Provider App) and booking damage attachments.
3. **Storage / Media (`READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE`):** Required for picking gallery photos of completed work or dispute evidence.
4. **Notifications (`POST_NOTIFICATIONS`):** Required for instant booking dispatch alerts and status changes on Android 13+.

---

## 6. QA Defect Reporting Template
When filing a bug discovered during Android testing, include:
- Device Model & Android Version (e.g., *Samsung Galaxy S23, Android 14*)
- Application (`Customer` or `Provider`) and Build Number/Commit SHA
- Steps to reproduce
- Network connectivity (Wi-Fi vs 4G/5G)
- Logcat excerpt (`adb logcat -d | grep -E "flutter|LocalMan"`)

