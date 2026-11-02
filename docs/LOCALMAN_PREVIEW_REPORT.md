# LOCALMAN — PREVIEW & INTERACTIVE APPLICATION REPORT
**Generated:** November 02, 2026  
**Status:** All 3 Applications & Full Backend Stack Active  
**Repository:** `https://github.com/sumit07122/LocalMan`

---

## 1. Executive Summary & Live Preview URLs

All three applications in the LocalMan platform, along with the live PostgreSQL database engine and Fastify API server, have been launched and are actively listening on local ports on this machine.

| Application | Technology | Local URL | Status | Preview Type |
|---|---|---|---|---|
| **Admin Web Portal** | React 18, Vite, TypeScript | **[http://localhost:5173/](http://localhost:5173/)** | **ONLINE** | Interactive Single Page App |
| **Customer Mobile App** | Flutter 3.47.8, Riverpod, GoRouter | **[http://localhost:5174/](http://localhost:5174/)** | **ONLINE** | Interactive CanvasKit Web App |
| **Provider Mobile App** | Flutter 3.47.8, Riverpod, GoRouter | **[http://localhost:5175/](http://localhost:5175/)** | **ONLINE** | Interactive CanvasKit Web App |
| **Fastify API Server** | Node.js, Fastify, Prisma | **[http://localhost:4000/api/v1](http://localhost:4000/api/v1)** | **ONLINE** | REST API Engine |
| **Local PostgreSQL** | Embedded Postgres 18.4 | **`localhost:5432` (`localman_db`)** | **ONLINE** | Relational Database |

---

## 2. Workstation Device & Toolchain Audit

Before launching the applications, an audit of the local development environment was performed:

- **Flutter SDK:** Flutter 3.47.8 • Dart 3.13.7 (Installed at `C:\Users\hp\flutter\bin`).
- **Chrome Browser:** Google Chrome `156.0.8078.74` available at `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- **Node.js & NPM:** Node.js `v26.12.0` • NPM `11.20.0`.
- **Android SDK & Emulators:**
  - Android SDK 36.1.0 exists on host.
  - `cmdline-tools` component and Android licenses are not yet configured on this Windows machine.
  - `adb devices`: 0 connected physical devices.
  - `flutter emulators`: No Android Virtual Devices (AVDs) configured.
- **Preview Strategy:** Flutter Web with CanvasKit/HTML rendering and React Vite development servers were compiled and served locally. This provides 100% interactive access without needing virtualized Android emulation.

---

## 3. High-Resolution Screenshots Gallery

Nine high-resolution screenshots were captured from live running browser instances and stored in `docs/preview/`:

| Screenshot File | Resolution | Size | Screen Description |
|---|---|---|---|
| `docs/preview/admin_dashboard.png` | 1440 × 900 | 244 KB | **Admin Active Operations Radar:** Live GMV metrics (₹1,42,850), active jobs counter, dispatcher execution table. |
| `docs/preview/admin_kyc_management.png` | 1440 × 900 | 235 KB | **Partner KYC Verification Queue:** Verification cards for Aadhaar, PAN card, and trade certifications. |
| `docs/preview/admin_reviews_moderation.png` | 1440 × 900 | 278 KB | **Customer Reviews Moderation Queue:** Star ratings, feedback flags, and approval/rejection moderation controls. |
| `docs/preview/admin_catalog_management.png` | 1440 × 900 | 233 KB | **Service Catalog & Commission Rates:** Commission tiers for AC Repair, Electrician, Plumbing, and Cleaning. |
| `docs/preview/customer_home.png` | 860 × 1864 (Retina) | 231 KB | **Customer App Home Screen:** Service categories banner, emergency repair shortcut, search bar, active order tracking. |
| `docs/preview/customer_booking.png` | 860 × 1864 (Retina) | 151 KB | **Customer Service Browsing & Booking:** Search interface, category filtering, transparent pricing cards. |
| `docs/preview/provider_home.png` | 860 × 1864 (Retina) | 116 KB | **Provider Partner Onboarding:** Mobile number authentication, trade selection (AC Repair, Electrician, Plumber). |
| `docs/preview/provider_job.png` | 860 × 1864 (Retina) | 47 KB | **Provider Active Job Execution:** Job dispatch status, OTP handover verification, customer address. |
| `docs/preview/provider_kyc.png` | 860 × 1864 (Retina) | 122 KB | **Provider Document KYC Screen:** Government ID upload flow, verification badge status. |

---

## 4. Working Features vs Backend/External Blocked Features

### Working Now in Local Preview

1. **Admin Web Portal:**
   - Switching between radar, KYC, reviews, and catalog tabs via UI or URL query (`?tab=radar|kyc|reviews|catalog`).
   - Interactive filtering by status (All, Under Review, Verified, Rejected).
   - Dynamic commission adjustment sliders and category switches.
2. **Customer Mobile Application:**
   - Real-time catalog navigation and category rendering.
   - Live search input and service detail browsing.
   - Authentication flow (phone number entry with mock OTP dispatch).
3. **Provider Mobile Application:**
   - Partner registration and trade specialization selection.
   - OTP dispatch with automatic mock console logging.
   - Duty status toggle (Online / Offline state handling).
4. **Backend API & Database:**
   - Fastify health endpoints (`/health/live`, `/health/ready`).
   - Live category queries (`/api/v1/categories`).
   - OTP dispatch and verification (`/api/v1/auth/otp/send`, `/api/v1/auth/otp/verify`).
   - 21 seed bookings and 13 service providers actively populated in PostgreSQL.

### Features Requiring External Production Credentials

| Feature | External Dependency | Status in Preview |
|---|---|---|
| **Live SMS Delivery** | Twilio / MSG91 API Keys | Mock gateway active (OTPs printed to server logs). |
| **Payment Gateway Settlement** | Razorpay / Cashfree API Keys | Mock payment tokens supported; bank webhooks require production credentials. |
| **Live Google Maps Tiles** | Google Maps JavaScript API Key | Placeholder map coordinates; vector tiles require API key. |
| **Push Notifications** | Firebase Cloud Messaging (FCM) | Local in-app notifications active; background push requires `google-services.json`. |

---

## 5. Owner Interaction Guide

To see and interact with the platform right now, open any modern browser:

### 1. Admin Web Portal
Navigate to: **[http://localhost:5173/](http://localhost:5173/)**
- Click through the top navigation tabs: **Radar**, **KYC Queue**, **Reviews**, and **Catalog**.
- Direct tab shortcuts:
  - Radar: `http://localhost:5173/?tab=radar`
  - KYC Queue: `http://localhost:5173/?tab=kyc`
  - Reviews: `http://localhost:5173/?tab=reviews`
  - Catalog: `http://localhost:5173/?tab=catalog`

### 2. Customer Mobile Application
Navigate to: **[http://localhost:5174/](http://localhost:5174/)**
- Browse service categories and discover home maintenance services.
- Search for specific repairs using the search bar or direct link: `http://localhost:5174/#/search`.

### 3. Provider Mobile Application
Navigate to: **[http://localhost:5175/](http://localhost:5175/)**
- Select your trade (e.g. Electrician, AC Repair, Plumbing).
- Enter any valid 10-digit mobile number (e.g., `9876543210`) and press **Continue**.
- Retrieve the OTP from the backend terminal log (`task-1800.log`) to verify.
- Direct preview shortcuts:
  - Document KYC: `http://localhost:5175/#/kyc?preview=true`
  - Active Job: `http://localhost:5175/#/job/demo-job-1?preview=true`

### 4. Background Services Management
All background daemons are active:
- Admin Web: `http://localhost:5173`
- Customer App: `http://localhost:5174`
- Provider App: `http://localhost:5175`
- API Backend: `http://localhost:4000/api/v1`
- PostgreSQL: `localhost:5432` (`localman_db`)

