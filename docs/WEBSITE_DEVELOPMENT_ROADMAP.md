# LOCALMAN — WEBSITE DEVELOPMENT ROADMAP
## Milestone-Based Execution Plan for Complete Marketplace Web Platform

**Date:** 2026-11-03  
**Target Branch:** `develop`  
**Repository:** `https://github.com/sumit07122/LocalMan`  
**Current Baseline Commit:** `d768a23`  
**Technical Lead:** Senior Product Architect, Senior Full-Stack Engineer, UI/UX Designer & Technical Lead  
**Scope:** Phased, milestone-driven engineering roadmap to build, integrate, and deploy the complete LocalMan website across Customer, Worker, and Admin experiences.

---

## 1. Executive Roadmap Summary & Phasing Strategy

This roadmap details the sequential implementation plan to deliver the complete, premium LocalMan website. In accordance with the owner's strategic directive:
- **Immediate Focus:** Complete web platform (Customer, Worker, Admin).
- **Postponed Features:** Android mobile app builds, Play Store launch, live Razorpay transactions, live SMS OTP gateways, real-time GPS tracking, automated dispatch radar, and automated payout disbursements.
- **Controlled Scope:** Work is structured into **seven distinct milestones (Milestones 0 to 6)**. Each milestone has clear technical boundaries, verifiable acceptance criteria, and explicit dependencies.

```
+---------------------------------------------------------------------------------------------------------+
|                                  LOCALMAN WEBSITE IMPLEMENTATION TIMELINE                               |
+---------------------------------------------------------------------------------------------------------+
| Milestone 0: Repository Audit & Architecture Alignment                      [COMPLETED IN THIS PHASE]   |
| Milestone 1: Web Foundation, Router & Premium Design System                 [NEXT IMMEDIATE MILESTONE]  |
| Milestone 2: Customer Experience — Discovery & Service Catalog              [PENDING M1]                |
| Milestone 3: Customer Experience — Booking Flow & Status Tracking           [PENDING M2]                |
| Milestone 4: Worker Portal — Onboarding, Jobs & Earnings                    [PENDING M3]                |
| Milestone 5: Admin Operations — Real Data Integration & Manual Assignment   [PENDING M4]                |
| Milestone 6: End-to-End System Integration, Security Review & Staging QA    [PENDING M5]                |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. Detailed Milestone Specifications

### Milestone 0: Repository Audit & Architecture Alignment
- **Status:** **COMPLETED**
- **Objective:** Establish the true state of the codebase, verify running backend and database services, identify frontend gaps, and establish the unified web architecture.
- **Key Deliverables:**
  1. `docs/WEBSITE_REPOSITORY_AUDIT.md`: Exhaustive audit of all packages, models, routes, and frontend state.
  2. `docs/WEBSITE_ARCHITECTURE_PLAN.md`: Unified React/Vite SPA architecture blueprint with role-based namespaces.
  3. `docs/WEBSITE_DEVELOPMENT_ROADMAP.md`: Phased execution roadmap.
- **Verification:** Verified clean working tree, 112/112 backend tests passing, 0 TypeScript compile errors.

---

### Milestone 1: Web Foundation, Router & Premium Design System
- **Status:** **NEXT IMMEDIATE MILESTONE**
- **Objective:** Transform `apps/admin_web` into a unified web application foundation supporting multi-role routing, shared authentication, and an atomic premium design system.
- **Deliverables & Tasks:**
  1. **Dependencies:** Install `react-router-dom` in `apps/admin_web`.
  2. **Routing Structure (`src/routes/`):**
     - Root router configuring `/`, `/services/*`, `/book/*`, `/worker/*`, `/admin/*`.
     - Layout hierarchy: `CustomerLayout`, `WorkerLayout`, `AdminLayout`, `AuthLayout`.
  3. **Centralized Auth & RBAC Context (`src/context/AuthContext.tsx`):**
     - Reactive user state, token management (`sessionStorage`), login/logout methods.
     - Role-based route guard component (`<ProtectedRoute allowedRoles={...}>`).
  4. **API Client Foundation (`src/api/client.ts`):**
     - Axios/fetch client with `VITE_API_BASE_URL`, Bearer token interceptor, and unified error mapping.
  5. **Premium Atomic UI Component Library (`src/components/common/`):**
     - `Button` (Primary, Secondary, Outline, Danger with loading states).
     - `Input` & `Select` (Form fields with label, error message, and focus ring).
     - `Card` (Clean elevated card with hover states).
     - `Badge` (Status indicators: New, In Progress, Completed, Cancelled).
     - `Modal` (Accessible dialog with backdrop blur and keyboard escape).
     - `Toast` (Non-intrusive alert notification system).
     - `Skeleton` (Shimmer loading placeholders).
     - `EmptyState` (Human-friendly zero-data views with clear action buttons).
  6. **Design System Integration:**
     - Harmonize `index.css` with `@localman/design-tokens` (Deep Ink `#101828`, Accent Blue `#315EFB`, Emerald Green `#12A879`, Amber `#F5A524`).
- **Acceptance Criteria:**
  - `npm run build --workspace=@localman/admin-web` compiles cleanly with zero TypeScript errors.
  - Navigation between `/`, `/worker`, and `/admin` routes functions smoothly without full-page reloads.
  - Route guards prevent unauthorized access and redirect to respective login views.
  - All UI components render consistently across desktop and mobile screen sizes.

---

### Milestone 2: Customer Experience — Discovery & Service Catalog
- **Status:** PENDING (Depends on M1)
- **Objective:** Build the public-facing customer experience for exploring LocalMan services in Mathura, UP.
- **Deliverables & Tasks:**
  1. **Premium Homepage (`/`):**
     - Hero section: "Trusted Local Experts for Your Home in Mathura".
     - Trust badges: Verified background checks, transparent pricing, 7-day service warranty.
     - Category Showcase grid (Plumbing, Electrical, AC & Appliances, Carpentry, Cleaning, Pest Control).
     - "How LocalMan Works" 3-step visual guide (Choose Service &rarr; Expert Arrives &rarr; Pay After Satisfaction).
     - Mathura pilot service coverage notice (honest notice stating pilot phase).
     - Customer Testimonials & FAQ accordion.
     - Footer with legal disclosures, terms, grievance officer, and support channels.
  2. **Service Discovery Page (`/services`):**
     - Category filter pills / tabs.
     - Debounced instant search bar.
     - Service listing cards displaying: service name, category, estimated duration, pricing model badge, base price in Rupee format (`₹XXX`), and "Book Now" CTA.
  3. **Individual Service Detail Page (`/services/:slug`):**
     - Full service description and what's included / excluded.
     - Pricing model explanation (Fixed Price vs. Hourly vs. Inspection).
     - Service duration and preparation requirements.
     - Prominent "Book Service" CTA leading directly to the booking request flow.
  4. **Customer Auth Flow (`/login`, `/register`):**
     - Indian phone number input (+91).
     - OTP verification view (with dev/staging instant-fill banner).
     - Profile creation (Full name, email optional).
- **Acceptance Criteria:**
  - Category and service data rendered directly from `GET /api/v1/catalog/categories` and `GET /api/v1/catalog/services`.
  - Search and filtering operate responsively without lag.
  - Pricing is rendered accurately from backend integer paisa (`paisa / 100`).
  - Mobile responsive drawer and navigation menu provide seamless phone experience.

---

### Milestone 3: Customer Experience — Booking Flow & Status Tracking
- **Status:** PENDING (Depends on M2)
- **Objective:** Enable customers to submit booking requests, manage saved addresses, and track real-time job progression.
- **Deliverables & Tasks:**
  1. **Customer Address Management (`/customer/addresses`):**
     - List saved addresses (`GET /api/v1/addresses`).
     - Add new address modal (`POST /api/v1/addresses`) with Mathura city/pincode validation.
  2. **4-Step Booking Request Flow (`/book/:slug`):**
     - **Step 1: Service Scope:** Select specific options, enter hours (if HOURLY), add special instructions.
     - **Step 2: Service Address:** Choose existing saved address or add a new Mathura address.
     - **Step 3: Schedule Date & Time Slot:** Date picker (next 7 days) and slot selection (Morning, Afternoon, Evening).
     - **Step 4: Price Review & Confirmation:** Authoritative pricing breakdown (Base price, platform fee, taxes, total). Explains Cash on Service / Manual payment.
  3. **Booking Confirmation View:**
     - Generates unique booking reference (e.g., `LM-20261103-XXXX`).
     - Explains next steps: "Our team will assign a verified expert in your area."
  4. **Customer Booking Tracking (`/customer/bookings/:id`):**
     - Real-time job status timeline (*Requested &rarr; Assigned &rarr; On The Way &rarr; Arrived &rarr; Work In Progress &rarr; Completed*).
     - Assigned worker details (business name, rating, trade).
     - **Customer Start OTP Card:** Prominently displays the 6-digit Start OTP for the customer to share with the worker upon arrival.
     - Booking cancellation request button (when eligible).
  5. **Customer Booking History (`/customer/bookings`):**
     - Tabbed list of Active and Past bookings.
- **Acceptance Criteria:**
  - Submitting booking calls `POST /api/v1/bookings` and receives authoritative 201 response.
  - Out-of-zone bookings display a friendly Mathura geofence explanation.
  - Customer Start OTP is visible to the customer and hidden after work begins.
  - Cancellation conforms to FSM transition rules.

---

### Milestone 4: Worker Portal — Onboarding, Jobs & Earnings
- **Status:** PENDING (Depends on M3)
- **Objective:** Provide a dedicated, professional web portal for service professionals to onboard, manage duty status, execute assigned jobs, and track earnings.
- **Deliverables & Tasks:**
  1. **Worker Onboarding & Registration (`/worker/join`):**
     - Multi-step onboarding: Personal details, trade selection, experience years, business name.
     - Document upload interface: Aadhaar front/back, PAN card, trade certificate.
  2. **Worker Authentication (`/worker/login`):**
     - Partner login via Phone OTP with automatic `PROVIDER` role check.
  3. **Worker Portal Dashboard (`/worker/dashboard`):**
     - Verification Status Banner (`VERIFIED`, `PENDING_VERIFICATION`, `REJECTED`).
     - **Duty Status Toggle:** Switch between "Online / Ready for Work" and "Offline" (`POST /api/v1/providers/toggle-online`).
     - Quick summary cards: Active Jobs, Completed Jobs, Wallet Balance.
  4. **Assigned Job Cards & Details (`/worker/jobs/:id`):**
     - Job details: Service type, scheduled date/slot, customer address line & landmark.
     - **Job Progression Action Bar:**
       - "I Am On The Way" (`POST /api/v1/providers/bookings/:id/on-the-way`).
       - "I Have Arrived at Location" (`POST /api/v1/providers/bookings/:id/arrived`).
       - **Start Work Verification:** Input field for the worker to enter the customer's 6-digit Start OTP (`POST /api/v1/providers/bookings/:id/start`).
       - "Mark Job Completed" (`POST /api/v1/providers/bookings/:id/complete`).
     - Material logging (add extra materials used with customer consent).
  5. **Worker Earnings & Wallet View (`/worker/earnings`):**
     - Available balance, pending payouts, total earned.
     - Transparent breakdown per job: Gross booking amount, 15% platform commission, 0.1% statutory TDS deducted, net earnings.
     - Request Payout button (`POST /api/v1/providers/wallet/payout-request`).
- **Acceptance Criteria:**
  - Workers can only access `/worker/*` routes with a valid `PROVIDER` role JWT.
  - Workers cannot view customer phone/address until assigned to the booking.
  - Start job fails if an incorrect Start OTP is entered.
  - Earnings match backend ledger invariants exactly.

---

### Milestone 5: Admin Operations — Real Data Integration & Manual Assignment
- **Status:** PENDING (Depends on M4)
- **Objective:** Upgrade the Admin Web interface from a prototype to a fully connected operations control room with real database metrics, KYC review, and manual worker assignment.
- **Deliverables & Tasks:**
  1. **Admin Backend Enhancement:**
     - Implement `POST /api/v1/admin/bookings/:id/assign` in `admin.routes.ts` and `admin.service.ts` allowing administrators to assign a verified provider to a `REQUESTED` booking.
  2. **Secure Admin Authentication (`/admin/login`):**
     - Protected login requiring `ADMIN` or `CITY_MANAGER` credentials.
  3. **Live Operational Radar (`/admin/radar`):**
     - Connect metrics cards to `GET /api/v1/admin/pilot-metrics`.
     - Displays genuine Mathura pilot KPIs, active booking counts, and online provider counts.
  4. **Booking Management & Manual Assignment (`/admin/bookings`):**
     - Live data table of all bookings with status filter.
     - **Manual Assignment Drawer:** For any `REQUESTED` booking, admin can select an eligible, verified provider and assign them directly.
     - Booking detail view with full status timeline and customer/worker snapshots.
  5. **Worker Directory & KYC Review Queue (`/admin/workers`):**
     - Live list of pending documents (`GET /api/v1/admin/kyc/pending`).
     - Document inspection modal with UIDAI-masked Aadhaar and PAN numbers.
     - Approve / Reject action with mandatory rejection reason logging.
  6. **Service Catalog & Take-Rate Simulator (`/admin/catalog`):**
     - View and manage service categories and prices.
     - Clear indicator that platform commission is authoritative at 15.0%.
  7. **Financial Ledger & Disbursement Oversight (`/admin/financial`):**
     - Live ledger view (`GET /api/v1/admin/financial/ledger`).
     - Payout requests list (`GET /api/v1/admin/financial/payouts`).
     - Visual warning indicating that live disbursements (`PAID`) are blocked pending CA approval.
- **Acceptance Criteria:**
  - Zero hardcoded mock arrays remaining in `apps/admin_web`.
  - Manual assignment successfully updates booking in database and notifies worker.
  - Approving KYC transitions provider status to `VERIFIED`.
  - Non-admin tokens are strictly rejected with 403 Forbidden.

---

### Milestone 6: End-to-End System Integration, Security Review & Staging Deployment
- **Status:** PENDING (Depends on M5)
- **Objective:** Conduct end-to-end multi-user testing across all three experiences, perform security audits, and deploy to staging.
- **Deliverables & Tasks:**
  1. **End-to-End Journey Testing:**
     - Journey 1: Customer registers &rarr; discovers plumbing service &rarr; books for tomorrow in Mathura.
     - Journey 2: Admin views booking &rarr; manually assigns verified electrician/plumber.
     - Journey 3: Worker receives job &rarr; marks On The Way &rarr; arrives &rarr; inputs customer Start OTP &rarr; marks completed.
     - Journey 4: Customer sees job completed &rarr; leaves review.
     - Journey 5: Worker wallet credited &rarr; earnings ledger verified.
  2. **Security & Data Isolation Review:**
     - Verify IDOR protection across all web endpoints.
     - Verify UIDAI/DPDPA KYC privacy on all screens.
     - Verify rate limits and input validation.
  3. **Staging Build & Deployment:**
     - Production bundle optimization (`npm run build`).
     - Deploy static SPA to Cloudflare Pages (or Vercel).
     - Connect to staging Fastify API and Neon PostgreSQL database.
     - Produce final pre-launch verification report.
- **Acceptance Criteria:**
  - 100% of end-to-end user journeys pass without error.
  - Zero console errors or warnings in production web build.
  - Full regression test suite passes.
  - Staging URL is live and operational for owner preview.

---

## 3. Owner Decision Gates & External Dependencies Matrix

The table below lists decisions and external resources required from the platform owner during the roadmap execution:

| Milestone | Gate / Decision Item | Owner Action Required | Impact if Postponed |
|:---:|:---|:---|:---|
| **M2** | **Mathura Pilot Pincodes** | Confirm target postal codes in Mathura (e.g., 281001, 281003, 281004). | Geofence warning displayed for unlisted areas. |
| **M2** | **Support Phone / Email** | Provide operational customer support phone/WhatsApp number. | Placeholder contacts rendered with clear notice. |
| **M4** | **Initial Worker Recruitment** | Recruit initial 5-10 local workers in Mathura for beta testing. | Workers can be created via seed/onboarding script. |
| **M5** | **CA Tax Policy Sign-Off** | Obtain written CA determination for Section 194-O to enable live disbursements. | Payouts remain in `PENDING` state safely. |
| **M6** | **Cloudflare Pages Account** | Connect Cloudflare Pages / Vercel account for free hosting. | Local preview server used until account connected. |

---

## 4. Quality Gates & Non-Negotiable Rules

Throughout all milestones, the following constraints remain strictly enforced:
1. **Never alter financial rules:** 15.0% platform commission, 0.1% statutory TDS, integer paisa precision.
2. **Never break existing mobile apps:** Flutter codebases in `apps/customer_app` and `apps/provider_app` must remain intact.
3. **Never expose unmasked KYC data:** Aadhaar (`XXXXXXXX1234`) and PAN (`ABXXXXXX4F`) must always be masked.
4. **Never trust frontend pricing:** All booking totals and ledger entries must be computed by the backend.
5. **Always maintain test coverage:** Every new feature must be verified through builds and tests before progressing.
