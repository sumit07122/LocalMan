# LOCALMAN — PHASE 4J MASTER EXECUTION REPORT
## External Service Integrations Architecture & Production Verification

**Date:** 2026-11-03  
**Target Branch:** `develop`  
**Repository:** `https://github.com/sumit07122/LocalMan`  
**Execution Lead:** Senior Backend Architect, DevSecOps & Release Engineering Lead  
**Scope:** LocalMan Monorepo (`apps/api`, `apps/customer_app`, `apps/provider_app`, `apps/admin_web`, `packages/*`)

---

## 1. Executive Summary

Phase 4J establishes the enterprise production integration architecture across all external service domains required for the LocalMan marketplace:
1. **SMS & OTP Dispatch:** Concrete multi-gateway adapters for Indian and global delivery (Fast2SMS DLT, MSG91 Enterprise OTP, Twilio SMS, and deterministic Mock SMS). Enforced 60-second resend cooldown, 3 requests per 15-minute rolling rate limit, 10-minute expiry, and 5-attempt brute-force lock with zero plaintext OTP leaks in production logs.
2. **Razorpay Payments & Webhooks:** Authoritative server-side order creation in integer paisa, cryptographic payment signature verification (`crypto.timingSafeEqual`), genuine webhook signature verification, server-side refund execution via `/v1/payments/{id}/refund`, and zero client trust.
3. **Private Cloud Storage:** AWS S3 and Cloudflare R2 object storage with SigV4 pre-signed PUT/GET URLs, mandatory Server-Side Encryption (`x-amz-server-side-encryption: AES256`), 60-minute time-limited read URLs, and strict MIME/size boundary enforcement (5 MB photos, 10 MB PDFs).
4. **Push Notifications (FCM HTTP v1):** Google Firebase Cloud Messaging HTTP v1 REST provider with in-memory thread-safe device token registry, automatic invalid/unregistered token pruning on HTTP 404/UNREGISTERED, exponential backoff retries on 429/503, and automated privacy redaction of sensitive credentials and OTPs.
5. **Google Maps & Location Services:** Google Directions & Geocoding integrations backed by an in-memory 30-second TTL cache, request budget guards (60 req/min, 5,000 req/day), and zero-cost Haversine straight-line distance fallback with explicit null ETAs (preventing fake ETAs).
6. **Credential Gates & Owner Action Checklist:** Zero hardcoded or invented production keys. Every integration includes a certified mock/sandbox fallback path for CI and local staging, accompanied by an explicit owner onboarding checklist for live third-party accounts.

---

## 2. Integration Architecture & Provider Status Matrix

| Domain | Supported Providers | Status | Credential Gate / Mode | Test Verification |
|:---|:---|:---:|:---|:---|
| **SMS / OTP** | Fast2SMS (India DLT)<br>MSG91 (India Enterprise)<br>Twilio (Global)<br>Mock Gateway | **IMPLEMENTED & SANDBOX-TESTED** | `SMS_GATEWAY_PROVIDER`<br>`SMS_GATEWAY_API_KEY`<br>`SMS_SENDER_ID`<br>`TWILIO_ACCOUNT_SID`<br>`MSG91_TEMPLATE_ID` | 7 automated tests passed (`external-services-integration.test.ts`) |
| **Payments** | Razorpay (India Card/UPI/NetBanking)<br>Mock Payment Adapter | **IMPLEMENTED & SANDBOX-TESTED** | `PAYMENT_GATEWAY_PROVIDER`<br>`RAZORPAY_KEY_ID`<br>`RAZORPAY_KEY_SECRET`<br>`RAZORPAY_WEBHOOK_SECRET` | 6 automated tests passed (signatures, webhooks, refunds) |
| **Object Storage** | AWS S3 (ap-south-1)<br>Cloudflare R2 (S3-compatible)<br>Mock Storage Provider | **IMPLEMENTED & SANDBOX-TESTED** | `STORAGE_PROVIDER`<br>`S3_BUCKET_NAME`<br>`S3_ACCESS_KEY_ID`<br>`S3_SECRET_ACCESS_KEY` | 3 automated tests passed (SigV4, SSE-AES256, read URLs) |
| **Push Notifications** | Firebase Cloud Messaging (FCM HTTP v1)<br>Dev Notification Adapter | **IMPLEMENTED & SANDBOX-TESTED** | `NOTIFICATION_PROVIDER`<br>`FCM_PROJECT_ID`<br>`FCM_SERVICE_ACCOUNT_KEY` | 4 automated tests passed (registry, pruning, retry, redaction) |
| **Maps & Location** | Google Maps (Directions & Geocoding)<br>Haversine Fallback | **IMPLEMENTED & SANDBOX-TESTED** | `GOOGLE_MAPS_API_KEY`<br>`LOCATION_FRESHNESS_THRESHOLD_SECONDS` | 4 automated tests passed (routes, geocode, cache, budget) |

---

## 3. SMS & OTP Integration Architecture

### 3.1 Gateway Implementations
- **Fast2SMS (`Fast2SmsGateway`):** Calls `POST https://www.fast2sms.com/dev/bulkV2` using Authorization header with 10-digit Indian number formatting (`9876543210`) and DLT route configuration (`route: 'otp'`).
- **MSG91 (`Msg91Gateway`):** Calls `POST https://control.msg91.com/api/v5/otp` supporting Indian DLT registered templates (`template_id`), authkey header, and OTP variables.
- **Twilio (`TwilioGateway`):** Calls `POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json` using HTTP Basic Authentication and form-urlencoded body (`To`, `From`, `Body`).
- **Mock Gateway (`MockSmsGateway`):** Safe development and CI adapter. Formats and records dispatches. In production environments, OTP codes are masked (`******`) in logs to prevent log leakage.

### 3.2 Security Controls
- **60-Second Resend Cooldown:** `AuthService.sendOtp()` queries `prisma.otpVerification` for requests within the past 60 seconds; throws `AppError(429, 'RESEND_COOLDOWN')` with exact seconds remaining if triggered.
- **Rolling Rate Limit:** Maximum 3 OTP dispatches per 15-minute window (`RATE_LIMIT_EXCEEDED`).
- **Brute-Force Protection:** Maximum 5 failed verification attempts per OTP; locks OTP upon 5th failure (`OTP_LOCKED`).
- **Time Expiry:** Fixed 10-minute validity (`600s`), hashed with SHA-256 before database persistence.

---

## 4. Razorpay Payments & Webhook Architecture

### 4.1 Server-Side Order & Settlement Flow
- **Order Creation:** Executed exclusively on the backend (`PaymentService.createCheckoutSession`). Server calculates authoritative amounts in integer paisa (base amount + approved materials + statutory GST).
- **Payment Signature Verification:** `RazorpayAdapter.verifyPaymentSignature()` validates the HMAC-SHA256 signature over `${gatewayOrderId}|${gatewayPaymentId}` using `crypto.timingSafeEqual` against `RAZORPAY_KEY_SECRET`. Rejects mismatched length or tampered payload in constant time.
- **Webhook Signature Verification:** `RazorpayAdapter.verifyWebhookSignature()` validates the HMAC-SHA256 signature of the raw incoming request payload against `RAZORPAY_WEBHOOK_SECRET`.
- **Server-Side Refunds:** `RazorpayAdapter.processRefund()` executes `POST https://api.razorpay.com/v1/payments/{payment_id}/refund` using Basic Auth with amount in integer paisa and custom notes. Returns authoritative `gatewayRefundId`.

---

## 5. Private Cloud Storage Architecture (S3 / R2)

### 5.1 Pre-signed Upload & Download Architecture
- **Pre-signed Upload (`generatePresignedUploadUrl`):** Generates pre-signed PUT URLs via AWS SDK v3 (`PutObjectCommand` with `@aws-sdk/s3-request-presigner`) and a native crypto fallback SigV4 signer.
- **Mandatory Server-Side Encryption:** Upload URLs require and validate `x-amz-server-side-encryption: AES256` to ensure all KYC identity documents and service images are encrypted at rest.
- **Time-Limited Private Access (`generatePresignedReadUrl`):** All KYC documents and problem/evidence photos are stored in private buckets. Read access is granted via 60-minute time-limited pre-signed GET URLs.
- **Strict Boundary Validation:**
  - Whitelist: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`.
  - Max Sizes: 5 MB for photos (`MAX_PHOTO_SIZE_BYTES`), 10 MB for documents (`MAX_DOCUMENT_SIZE_BYTES`).
  - Storage Key Nonce: Formatted as `media/{purpose}/{entityId}/{timestamp}_{randomHex}.{ext}` to eliminate enumeration attacks.

---

## 6. Push Notifications Architecture (FCM HTTP v1)

### 6.1 Google Firebase Cloud Messaging HTTP v1
- **REST Endpoint:** Dispatches push notifications to `POST https://fcm.googleapis.com/v1/projects/{projectId}/messages:send`.
- **Device Token Registry:** `DeviceTokenRegistry` maintains active customer and provider FCM tokens across Android, iOS, and Web platforms.
- **Automatic Pruning:** When FCM returns HTTP 404 or `UNREGISTERED` error code, the provider automatically prunes the invalid token from the active registry.
- **Exponential Backoff:** Automatically handles FCM rate limits (HTTP 429) and server busy (HTTP 503) with retry backoff.
- **Privacy Preservation:** `FcmNotificationProvider.sanitizePayload()` inspects payload data and automatically redacts sensitive keywords (`otp`, `password`, `secret`, `cvv`, `card`) to ensure credentials never appear in mobile push notifications.

---

## 7. Google Maps & Location Architecture

### 7.1 Directions, Geocoding & Budget Controls
- **Directions & Distance Matrix:** Resolves real-world driving distance and transit duration when a valid `GOOGLE_MAPS_API_KEY` is configured.
- **Geocoding Support (`geocodeAddress`):** Resolves lat/lng coordinates and formatted addresses with in-memory caching and fallback support.
- **In-Memory Cache (30s TTL):** Caches origin-destination route computations for 30 seconds to suppress rapid re-querying during active tracking.
- **Budget Rate Guard:** Enforces strict upper thresholds:
  - Max 60 requests per rolling minute.
  - Max 5,000 requests per calendar day.
- **Haversine Fallback:** When the budget is reached or when running without a live API key, automatically computes straight-line distance via Haversine formula and returns `durationSeconds: null` and `etaMinutes: null` (strictly preventing fabricated or false ETAs).

---

## 8. Credential Gates & Owner Action Checklist

To activate live external services in production, configure the following verified environment variables in Render / Cloud hosting:

| Service | Environment Variable | Required For | Where to Obtain |
|:---|:---|:---|:---|
| **SMS Gateway** | `SMS_GATEWAY_PROVIDER` | `fast2sms`, `msg91`, or `twilio` | Provider selection |
| | `SMS_GATEWAY_API_KEY` | Fast2SMS API key / MSG91 authkey | Fast2SMS / MSG91 Dashboard |
| | `SMS_SENDER_ID` | Registered 6-character DLT Header | India DLT Portal (e.g. Jio/Airtel) |
| | `TWILIO_ACCOUNT_SID` | Twilio Account SID (if using Twilio) | Twilio Console |
| | `TWILIO_AUTH_TOKEN` | Twilio Auth Token (if using Twilio) | Twilio Console |
| | `TWILIO_FROM_NUMBER` | Twilio phone number | Twilio Console |
| | `MSG91_TEMPLATE_ID` | MSG91 DLT Flow / Template ID | MSG91 Flow Builder |
| **Razorpay** | `PAYMENT_GATEWAY_PROVIDER` | `razorpay` | Provider selection |
| | `RAZORPAY_KEY_ID` | Razorpay Key ID | Razorpay Dashboard &rarr; API Keys |
| | `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | Razorpay Dashboard &rarr; API Keys |
| | `RAZORPAY_WEBHOOK_SECRET` | Webhook verification secret | Razorpay Dashboard &rarr; Webhooks |
| **Object Storage** | `STORAGE_PROVIDER` | `s3` or `r2` | Storage engine selection |
| | `S3_BUCKET_NAME` | Private bucket name | AWS S3 / Cloudflare R2 |
| | `S3_REGION` | AWS Region (e.g. `ap-south-1`) | AWS Console |
| | `S3_ACCESS_KEY_ID` | IAM User Access Key | AWS IAM / Cloudflare API Tokens |
| | `S3_SECRET_ACCESS_KEY` | IAM User Secret Key | AWS IAM / Cloudflare API Tokens |
| | `S3_ENDPOINT` | Custom endpoint (for Cloudflare R2) | Cloudflare R2 Account Details |
| **Push Notifications** | `NOTIFICATION_PROVIDER` | `fcm` | Notification engine selection |
| | `FCM_PROJECT_ID` | Firebase Project ID | Firebase Console &rarr; Project Settings |
| | `FCM_SERVICE_ACCOUNT_KEY` | Service Account JSON / Private Key | Firebase Console &rarr; Service Accounts |
| **Google Maps** | `GOOGLE_MAPS_API_KEY` | Directions, Distance Matrix, Geocoding | Google Cloud Console &rarr; Credentials |

---

## 9. Verification & Test Evidence

### 9.1 External Services Integration Test Suite (`external-services-integration.test.ts`)
```
▶ Phase 4J: External Service Integrations Architecture & Verification
  ▶ 1. SMS & OTP Gateway Suite
    ✔ 1.1 MockSmsGateway records message and safely logs OTP without throwing (25.7ms)
    ✔ 1.2 Fast2SmsGateway rejects unconfigured API key gracefully (0.4ms)
    ✔ 1.3 Fast2SmsGateway dispatches DLT OTP payload when configured (0.6ms)
    ✔ 1.4 Msg91Gateway rejects unconfigured authkey (0.6ms)
    ✔ 1.5 Msg91Gateway dispatches OTP request via enterprise API (0.4ms)
    ✔ 1.6 TwilioGateway rejects unconfigured credentials (0.3ms)
    ✔ 1.7 TwilioGateway formats basic auth and form body correctly (0.3ms)
  ✔ 1. SMS & OTP Gateway Suite (29.5ms)
  ▶ 2. Razorpay Payments & Webhooks
    ✔ 2.1 Verifies valid payment signature using timingSafeEqual (2.1ms)
    ✔ 2.2 Rejects tampered payment signature (0.2ms)
    ✔ 2.3 Rejects signature when length differs without leaking timing (0.2ms)
    ✔ 2.4 Verifies genuine Razorpay webhook signature over raw payload (0.2ms)
    ✔ 2.5 Rejects tampered or unauthenticated webhook payload (0.1ms)
    ✔ 2.6 Executes server-side refund with Basic Auth & integer paisa (0.4ms)
  ✔ 2. Razorpay Payments & Webhooks (3.5ms)
  ▶ 3. Cloud Storage (S3 / R2 / AES256 SSE)
    ✔ 3.1 Generates presigned upload URL with mandatory AES256 server-side encryption header (0.3ms)
    ✔ 3.2 Generates time-limited presigned read URL for private document access (0.1ms)
    ✔ 3.3 S3StorageProvider creates SigV4 presigned upload with AWS4 credentials (0.7ms)
  ✔ 3. Cloud Storage (S3 / R2 / AES256 SSE) (1.3ms)
  ▶ 4. Push Notifications & FCM HTTP v1 Integration
    ✔ 4.1 DeviceTokenRegistry stores, retrieves, and prunes user device tokens (0.2ms)
    ✔ 4.2 FcmNotificationProvider redacts sensitive secrets from push payload data (0.3ms)
    ✔ 4.3 FcmNotificationProvider automatically prunes UNREGISTERED device tokens on 404 (0.5ms)
    ✔ 4.4 FcmNotificationProvider retries with backoff on 429/503 rate limit (114.4ms)
  ✔ 4. Push Notifications & FCM HTTP v1 Integration (116.1ms)
  ▶ 5. Google Maps, Directions, Geocoding & Budget Controls
    ✔ 5.1 Calculates accurate Haversine straight-line distance with zero real-time flags (0.5ms)
    ✔ 5.2 Uses in-memory cache to return cached route within 30-second TTL (0.4ms)
    ✔ 5.3 Budget rate limiter stops calls when minute quota exceeded and falls back gracefully (0.3ms)
    ✔ 5.4 geocodeAddress resolves coordinates with fallback and caching (0.4ms)
  ✔ 5. Google Maps, Directions, Geocoding & Budget Controls (1.8ms)
✔ Phase 4J: External Service Integrations Architecture & Verification (152.9ms)
ℹ tests 24
ℹ suites 6
ℹ pass 24
ℹ fail 0
```

### 9.2 Mobile & Web Workspaces Health Summary
- `apps/api`: All TypeScript builds (`prisma generate && tsc`) succeeded with 0 errors.
- `apps/admin_web`: Production Vite bundle (`tsc && vite build`) succeeded with 0 errors.
- `apps/customer_app`: 107/107 Flutter unit and widget tests passed.
- `apps/provider_app`: 31/31 Flutter unit and widget tests passed.
- `scripts/audit-secrets.js`: Working tree verified free of active secrets.
- Git Status: Branch `develop` updated cleanly with zero uncommitted artifacts.
