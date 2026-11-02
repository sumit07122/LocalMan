# LocalMan — First Production Launch Checklist for Repository Owner

**Date:** November 2026  
**Audience:** Repository Owner & Project Lead  
**Classification:** Operational Guide  

---

## 1. Overview

This checklist outlines the exact, sequential steps required for the repository owner to deploy LocalMan to staging and production environments.

Follow each phase in sequence. Check off each box `[x]` as steps are completed.

---

## 2. Pre-Requisite External Accounts

Ensure the following accounts and credentials are created:

- [ ] **GitHub Account & Repository:** Ensure repo permissions allow configuring GitHub Actions Secrets.
- [ ] **Render Account:** [https://render.com](https://render.com) (for Fastify API, Worker, PostgreSQL + PostGIS, Redis).
- [ ] **Vercel Account:** [https://vercel.com](https://vercel.com) (for Admin Web Dashboard).
- [ ] **Razorpay Merchant Account:** [https://razorpay.com](https://razorpay.com) (Standard Indian Payment Gateway).
  - Obtain `Key ID` and `Key Secret` from Settings > API Keys.
  - Set Webhook URL: `https://api.localman.in/api/v1/payments/webhook`.
  - Copy `Webhook Secret`.
- [ ] **SMS Gateway Account:** Fast2SMS ([https://fast2sms.com](https://fast2sms.com)) or MSG91 ([https://msg91.com](https://msg91.com)).
  - Generate API Key.
  - Register DLT entity and sender ID (`LCLMAN`).
- [ ] **Cloud Storage Account:** AWS S3 ([https://aws.amazon.com/s3](https://aws.amazon.com/s3)) or Cloudflare R2 ([https://cloudflare.com](https://cloudflare.com)).
  - Create private bucket: `localman-documents`.
  - Create IAM User with `PutObject`, `GetObject`, `DeleteObject` permissions.
  - Save Access Key ID and Secret Access Key.
- [ ] **Google Maps Platform:** [https://console.cloud.google.com](https://console.cloud.google.com).
  - Enable *Geocoding API*, *Distance Matrix API*, and *Places API*.
  - Generate API Key with HTTP referrer / IP restrictions.

---

## 3. GitHub Actions Secrets Configuration

In your GitHub repository, navigate to **Settings > Secrets and variables > Actions > New repository secret** and add:

| Secret Name | Value | Purpose |
| :--- | :--- | :--- |
| `STAGING_API_BASE_URL` | `https://api-staging.localman.in/api/v1` | Injected into staging Android APK builds |
| `PRODUCTION_API_BASE_URL` | `https://api.localman.in/api/v1` | Injected into production Android APK builds |
| `FIREBASE_TOKEN` *(Optional)* | Firebase CLI CI token | For automated Firebase App Distribution |
| `FIREBASE_CUSTOMER_APP_ID` *(Optional)* | `1:...:android:...` | Firebase Customer App ID |
| `FIREBASE_PROVIDER_APP_ID` *(Optional)* | `1:...:android:...` | Firebase Provider App ID |

---

## 4. Phase-by-Phase Launch Execution

### Phase A: Database & Backend Deployment (Render)
- [ ] **Step A1:** Log in to Render. Click **New + > Blueprint** and select `localman` repository (`master` branch).
- [ ] **Step A2:** Render creates `localman-postgres`, `localman-api`, and `localman-worker`.
- [ ] **Step A3: Activate PostGIS:**
  - In Render Dashboard, click `localman-postgres`.
  - Open **PSQL Command** and run:
    ```sql
    CREATE EXTENSION IF NOT EXISTS postgis;
    ```
- [ ] **Step A4: Configure Production Environment Variables:**
  - In Render `localman-api`, set:
    - `SMS_GATEWAY_PROVIDER`: `fast2sms` (or `msg91`)
    - `SMS_GATEWAY_API_KEY`: *(Your SMS key)*
    - `PAYMENT_GATEWAY_PROVIDER`: `razorpay`
    - `RAZORPAY_KEY_ID`: *(Your Razorpay Key ID)*
    - `RAZORPAY_KEY_SECRET`: *(Your Razorpay Key Secret)*
    - `RAZORPAY_WEBHOOK_SECRET`: *(Your Webhook Secret)*
    - `STORAGE_PROVIDER`: `s3` (or `r2`)
    - `S3_BUCKET_NAME`: `localman-documents`
    - `S3_ACCESS_KEY_ID`: *(Your Cloud Storage Key)*
    - `S3_SECRET_ACCESS_KEY`: *(Your Cloud Storage Secret)*
    - `GOOGLE_MAPS_API_KEY`: *(Your Google Maps Key)*
- [ ] **Step A5: Deploy & Verify Health Check:**
  - Trigger manual deployment in Render.
  - Verify migration output: `preDeployCommand: npx prisma migrate deploy` completes with exit code 0.
  - Open browser to `https://localman-api.onrender.com/health`.
  - Confirm response: `{"status":"ok",...}`.

---

### Phase B: Admin Web Dashboard Deployment (Vercel)
- [ ] **Step B1:** Log in to Vercel. Click **Add New... > Project** and import `localman`.
- [ ] **Step B2:** Set Root Directory to `apps/admin_web` and check *"Include files outside root"*.
- [ ] **Step B3:** In Environment Variables, add:
  - `VITE_API_BASE_URL` = `https://api.localman.in/api/v1` (Production)
  - `VITE_API_BASE_URL` = `https://api-staging.localman.in/api/v1` (Preview)
- [ ] **Step B4:** Click **Deploy**.
- [ ] **Step B5:** Verify Admin login screen loads and HTTPS certificate is valid.
- [ ] **Step B6 (Optional):** Add custom domain `admin.localman.in` in Vercel project domains.

---

### Phase C: Android APK Generation & Distribution
- [ ] **Step C1:** In GitHub repo, go to **Actions > Android APK Distribution**.
- [ ] **Step C2:** Click **Run workflow**:
  - Environment: `staging`
  - App Target: `all`
  - Release Notes: `Initial Staging QA Launch`
- [ ] **Step C3:** Wait for workflow to finish (~10 minutes).
- [ ] **Step C4:** Download `localman-android-apks-staging.zip` from workflow artifacts.
- [ ] **Step C5:** Distribute APKs to internal QA team using [`docs/ANDROID_APK_TESTING_GUIDE.md`](file:///docs/ANDROID_APK_TESTING_GUIDE.md).

---

### Phase D: End-to-End QA Validation Run
Execute the QA verification runbook from [`docs/ANDROID_APK_TESTING_GUIDE.md`](file:///docs/ANDROID_APK_TESTING_GUIDE.md):
- [ ] **D1:** Customer OTP login & address save.
- [ ] **D2:** Provider KYC document upload & admin verification in Vercel dashboard.
- [ ] **D3:** Provider goes online; customer creates booking.
- [ ] **D4:** Real-time dispatch alert received on Provider device.
- [ ] **D5:** Provider accepts; advances to Arrived; verifies customer Start OTP.
- [ ] **D6:** Job completion, simulated payment settlement, wallet balance credit.
- [ ] **D7:** Payout request created and visible in Admin dashboard.
- [ ] **D8:** Customer leaves review & rating.

---

### Phase E: Commercial Production Go-Live
- [ ] **E1:** Switch Razorpay from Test Mode to Live Mode.
- [ ] **E2:** Switch SMS Gateway from test credits to production plan.
- [ ] **E3:** Trigger production Android APK build in GitHub Actions with target `production`.
- [ ] **E4:** Announce launch!

