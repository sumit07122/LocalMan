# LOCALMAN — WEBSITE ARCHITECTURE PLAN
## Blueprint for a Unified, Premium, Multi-Experience Marketplace Web Platform

**Date:** 2026-11-03  
**Target Branch:** `develop`  
**Repository:** `https://github.com/sumit07122/LocalMan`  
**Architect:** Senior Product Architect, Senior Full-Stack Engineer, UI/UX Designer & Technical Lead  
**Scope:** Architecture specification for Customer Website, Worker Portal, and Admin Dashboard within a single maintainable, high-performance web application.

---

## 1. Architectural Objective & Core Principles

The primary objective is to deliver a complete, premium, production-quality website connecting all three marketplace participants (customers, workers, administrators) while strictly preserving backend security, financial invariants, and database integrity.

### Core Architectural Principles:
1. **Single Unified Web Application:** Do not fragment the codebase into three separate frontend projects. One modern React/Vite application provides role-based layouts, unified session handling, shared UI tokens, and centralized API integration.
2. **Reuse Existing Foundations:** Maximize reuse of existing assets: Fastify 5 API (`apps/api`), 34 Prisma models, `@localman/constants`, `@localman/contracts`, and `@localman/design-tokens`.
3. **No Unnecessary Framework Overhaul:** Do not introduce Next.js, SSR servers, or Tailwind CSS. The existing Vite + TypeScript + CSS variable design token architecture compiles in under 3 seconds, yields a lightweight SPA (< 250 KB gzip), and deploys to Cloudflare Pages or Vercel with zero server overhead.
4. **Honest, Verified Backend Connectivity:** Eliminate all hardcoded mock arrays. All catalog items, booking states, worker profiles, and admin metrics must flow directly to and from the PostgreSQL database via Fastify API.
5. **Security & Authorization Non-Negotiables:** Backend authorization governs every protected mutation. Route guards in the frontend provide clean UX; Fastify JWT and RBAC middleware enforce data isolation and authorization.

---

## 2. Architecture Evaluation & Decision Matrix

We evaluated three potential architectural configurations for the LocalMan website:

```
+-----------------------------------+-----------------------------------+-----------------------------------+
| Architecture Option               | Advantages                        | Disadvantages & Verdict           |
+-----------------------------------+-----------------------------------+-----------------------------------+
| Option A:                         | Isolated builds for each user     | 3x build maintenance, 3x routing  |
| Three Disconnected Web Apps       | type. Independent deployments.    | packages, duplicated design       |
| (`customer_web`, `worker_web`,    |                                   | tokens, complex CORS, triplicated |
| `admin_web`)                      |                                   | deploy pipelines.                 |
|                                   |                                   | **REJECTED (High Friction)**      |
+-----------------------------------+-----------------------------------+-----------------------------------+
| Option B:                         | Server-side rendering (SSR),      | Introduces new node server infra, |
| Fullstack Next.js 14+ Monolith    | built-in SEO metadata.            | duplicates Fastify API logic,     |
| (Replacing existing frontends)    |                                   | breaks existing CI and static     |
|                                   |                                   | hosting model, high rewrite cost. |
|                                   |                                   | **REJECTED (Unnecessary Risk)**   |
+-----------------------------------+-----------------------------------+-----------------------------------+
| Option C: (RECOMMENDED)           | Single repository, shared auth,   | Slightly larger single bundle     |
| Unified Multi-Experience SPA      | shared design tokens, instant     | (mitigated via Vite code-         |
| (Expanding `apps/admin_web` with  | Vite HMR, single deployment       | splitting into distinct route     |
| Role-Based Route Namespaces)      | pipeline, zero new server costs.  | chunks).                          |
|                                   |                                   | **ACCEPTED & RECOMMENDED**        |
+-----------------------------------+-----------------------------------+-----------------------------------+
```

### Why Option C is the Optimal Path:
- **Builds on verified assets:** The current `apps/admin_web` setup already has Vite 6, TypeScript 5.7, `@localman/design-tokens`, `lucide-react`, and comprehensive CSS variables in `index.css`.
- **Simplifies deployment:** A single static SPA can be hosted for **₹0 on Cloudflare Pages** with automated branch previews and instant global CDN delivery.
- **Zero code duplication:** Customer, worker, and admin experiences share atomic UI components (`Button`, `Card`, `Badge`, `Modal`, `Input`), data contracts, and the HTTP client.

---

## 3. Unified Web Architecture Blueprint

```
                                      +---------------------------------------------+
                                      |             Unified Web Platform            |
                                      |     (React 18 + Vite 6 + TypeScript 5.7)    |
                                      +---------------------------------------------+
                                                             |
                      +--------------------------------------+--------------------------------------+
                      |                                      |                                      |
                      v                                      v                                      v
       +-------------------------------+      +-------------------------------+      +-------------------------------+
       |      Customer Experience      |      |         Worker Portal         |      |        Admin Dashboard        |
       |       (/, /services, ...)     |      |         (/worker/...)         |      |          (/admin/...)         |
       +-------------------------------+      +-------------------------------+      +-------------------------------+
       | - Hero & Value Proposition    |      | - Worker Onboarding / KYC     |      | - Pilot KPI Radar & Health    |
       | - Catalog & Search Discovery  |      | - Duty Toggle (Online/Offline)|      | - Booking Assignment & Monitor|
       | - Service Detail & Pricing    |      | - Assigned Job Cards          |      | - Worker KYC Review Queue     |
       | - 4-Step Booking Flow         |      | - Job Status Progression      |      | - Service Catalog Management  |
       | - Real-time Status Tracking   |      | - Verified Earnings Summary   |      | - Dispute & Review Moderation |
       | - Customer Profile & History  |      | - Start OTP Input at Job Site |      | - Financial Ledger & Payouts  |
       +-------------------------------+      +-------------------------------+      +-------------------------------+
                      |                                      |                                      |
                      +--------------------------------------+--------------------------------------+
                                                             |
                                                             v
                                      +---------------------------------------------+
                                      |        Centralized Auth & API Client        |
                                      |     (JWT Storage, Bearer Interceptor)       |
                                      +---------------------------------------------+
                                                             | HTTP REST (JSON)
                                                             v
                                      +---------------------------------------------+
                                      |               Fastify API 5                 |
                                      |   (/api/v1/auth, /catalog, /bookings, ...)  |
                                      +---------------------------------------------+
                                                             | Prisma ORM
                                                             v
                                      +---------------------------------------------+
                                      |           PostgreSQL 16 + PostGIS           |
                                      |          (34 Models, Mathura Data)          |
                                      +---------------------------------------------+
```

---

## 4. Route Structure & Namespaces

We install `react-router-dom` to govern route namespaces, layout nesting, and role protection:

### 4.1 Public & Customer Routes (`/`)
- `/` — Premium Marketplace Homepage (hero, value prop, popular services, guarantee, Mathura coverage notice).
- `/services` — Service Discovery & Search (category filter, full-text search, pricing model badges).
- `/services/:slug` — Individual Service Detail page (description, estimated duration, transparent pricing, what's included).
- `/book/:slug` — Booking Request Flow (Step 1: Scope, Step 2: Customer Address, Step 3: Date & Slot, Step 4: Transparent Price Review & Confirmation).
- `/login` — Customer Phone OTP Authentication & Registration.
- `/customer/bookings` — Customer Booking History (active, completed, cancelled).
- `/customer/bookings/:id` — Real-time Booking Detail & Tracking (assigned worker info, Start OTP card, job status timeline, cancel request).
- `/customer/profile` — Saved addresses, customer details.
- `/support` — Customer support information, contact channels, and Grievance Officer details.

### 4.2 Worker / Partner Portal Routes (`/worker/*`)
- `/worker/join` — Worker Registration & Onboarding page (trade selection, experience, skills, personal info).
- `/worker/login` — Worker Phone OTP Authentication.
- `/worker/dashboard` — Worker Portal Home (verification status banner, online/offline duty toggle, active assigned jobs).
- `/worker/jobs/:id` — Active Job Execution View (customer contact details, location, status progression: *On The Way &rarr; Arrived &rarr; Enter Customer Start OTP &rarr; Complete Job*, material logging).
- `/worker/jobs` — Completed Job History.
- `/worker/earnings` — Verified Wallet & Earnings Summary (gross earnings, 15% platform fee, 0.1% TDS withheld, net balance, payout request).
- `/worker/profile` — Professional profile, documents, and trade certificate status.

### 4.3 Admin Operations Dashboard Routes (`/admin/*`)
- `/admin/login` — Secure Administrator Phone OTP Login.
- `/admin` &rarr; `/admin/radar` — Platform Overview & Operational Radar (live KPIs, Mathura pilot telemetry, alert counters).
- `/admin/bookings` — Booking Management (filter by status, view details, manual worker assignment drawer).
- `/admin/workers` — Worker Directory & KYC Review Queue (inspect masked Aadhaar/PAN, approve/reject with reason).
- `/admin/customers` — Customer Directory & Booking History.
- `/admin/catalog` — Service Category & Pricing Catalog (edit base prices, hourly rates, active flags).
- `/admin/reviews` — Customer Review Moderation (publish, hide, or flag feedback).
- `/admin/financial` — Financial Ledger, Wallets, and Payout Disbursement Approvals (CA gate notice).
- `/admin/audit` — System Audit Logs & Security Events.

---

## 5. Authentication, Session & Role-Based Routing (RBAC)

### 5.1 Centralized Auth State (`src/context/AuthContext.tsx`)
```typescript
interface UserProfile {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  roles: ('CUSTOMER' | 'PROVIDER' | 'ADMIN' | 'CITY_MANAGER')[];
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, refreshToken: string, user: UserProfile) => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
}
```

### 5.2 Role-Based Route Guard (`src/components/common/ProtectedRoute.tsx`)
```typescript
interface ProtectedRouteProps {
  allowedRoles: string[];
  redirectPath?: string;
  children: React.ReactNode;
}

export function ProtectedRoute({ allowedRoles, redirectPath, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoadingSpinner />;
  }

  if (!user) {
    // If not authenticated, redirect to appropriate login
    const targetLogin = allowedRoles.includes('ADMIN')
      ? '/admin/login'
      : allowedRoles.includes('PROVIDER')
      ? '/worker/login'
      : '/login';
    return <Navigate to={redirectPath || targetLogin} replace />;
  }

  const hasPermission = user.roles.some((r) => allowedRoles.includes(r));
  if (!hasPermission) {
    return <UnauthorizedAccessView requiredRoles={allowedRoles} />;
  }

  return <>{children}</>;
}
```

---

## 6. Layout Hierarchy & Experience Differentiation

The web application uses three dedicated layouts to provide appropriate experiences tailored to each user group:

```
+---------------------------------------------------------------------------------------------------------+
|                                        CUSTOMER LAYOUT (CustomerLayout)                                 |
+---------------------------------------------------------------------------------------------------------+
| [LocalMan Logo] [Mathura, UP Location Badge]   [Search Services...]   [Cart/Bookings] [Login / Profile] |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|                                           PAGE CONTENT OUTLET                                           |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
| [Footer: Categories | How it Works | Trust & Safety | Terms & Privacy | Mathura Support Contacts]       |
+---------------------------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------------------------+
|                                         WORKER LAYOUT (WorkerLayout)                                    |
+---------------------------------------------------------------------------------------------------------+
| [LocalMan Partner Logo]                  [Duty: ONLINE / OFFLINE Switch]        [Earnings] [Profile]     |
+---------------------------------------------------------------------------------------------------------+
| [Subnav: Active Jobs | Job History | Earnings & Wallet | Profile & KYC Documents]                       |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|                                           PAGE CONTENT OUTLET                                           |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------------------------+
|                                         ADMIN LAYOUT (AdminLayout)                                      |
+---------------------------------------------------------------------------------------------------------+
| [Sidebar: Dark Deep Ink #101828]               | [Header: Radar Title | Quick Search | Admin Profile]   |
| - Radar Overview                               +--------------------------------------------------------+
| - Bookings & Assignment                        |                                                        |
| - Worker Management & KYC                      |                  PAGE CONTENT OUTLET                   |
| - Customer Management                          |                                                        |
| - Catalog & Pricing                            |                                                        |
| - Financial Ledger & Payouts                   +--------------------------------------------------------+
| - Audit Logs                                   |                                                        |
+------------------------------------------------+--------------------------------------------------------+
```

---

## 7. API Client Architecture & Integration

All network calls are mediated by a centralized, type-safe API client (`src/api/client.ts`):

### 7.1 Client Specifications:
- **Base URL:** Dynamically resolves from `import.meta.env.VITE_API_BASE_URL || '/api/v1'`.
- **Automatic Auth Injection:** Automatically attaches `Authorization: Bearer <token>` from storage.
- **Unified Error Handling:** Catches 401 Unauthorized errors and triggers clean session refresh via `/api/v1/auth/refresh`; on failure, redirects to the appropriate login portal.
- **Type Safety:** Consumes shared DTOs from `@localman/contracts` (`CreateBookingInput`, `SendOtpInput`, `VerifyOtpInput`).

### 7.2 Service Modules:
- `src/api/catalog.api.ts`: `getCategories()`, `getCategoryBySlug()`, `searchServices()`, `getServiceBySlug()`.
- `src/api/booking.api.ts`: `createBooking()`, `getMyBookings()`, `getBookingDetails()`, `cancelBooking()`.
- `src/api/worker.api.ts`: `getWorkerProfile()`, `toggleDuty()`, `getMyJobs()`, `updateJobStatus()`, `getEarnings()`.
- `src/api/admin.api.ts`: `getPilotMetrics()`, `listBookings()`, `assignWorker()`, `listPendingKyc()`, `reviewKyc()`.

---

## 8. Simplification Strategy Implementation (Postponed Features Alignment)

In strict accordance with the owner's simplification strategy for the initial website release, complex or high-overhead subsystems are simplified safely:

| Postponed Feature | Initial Website Implementation Strategy | Security & Data Integrity Preservation |
|:---|:---|:---|
| **Payment Gateway Integration** | Cash on Service / Manual Payment confirmation. Customer sees transparent pricing breakdown. Admin or worker marks payment method upon job completion. | No simulated payment success. Price amounts remain integer paisa. Server calculates all fees. |
| **Automated SMS OTP** | Server-side OTP generation preserved. In development/staging mode, an unobtrusive banner or debug helper displays the generated OTP for instant verification without SMS provider costs. | Zero OTP leakage in production mode. Rate limits, expiry, and attempt limits remain fully enforced. |
| **Automated Dispatch Engine** | Admin manual assignment interface (`POST /api/v1/admin/bookings/:id/assign`). | Real-time dispatch is bypassed without modifying dispatch code. Admin selects from verified, active workers. |
| **Live GPS Tracking** | Static customer address snapshot and landmark display. Simple status timeline (*Assigned &rarr; On The Way &rarr; Arrived &rarr; Work In Progress &rarr; Completed*). | Workers never receive full customer phone/address until booking is assigned and accepted. |
| **Automated Tax/Payouts** | Payout records created with `status: PENDING`. Live disbursement blocked pending owner/CA determination. | Financial invariants (15% commission, 0.1% TDS) strictly maintained in ledger. |

---

## 9. Security & Privacy Architecture

1. **Authentication Token Storage:** JWT tokens are stored in `sessionStorage` (or `localStorage` with explicit user consent) and automatically wiped upon logout or 401 expiration.
2. **KYC Privacy & UIDAI Compliance:** Only masked document numbers (`XXXXXXXX1234` for Aadhaar, `ABXXXXXX4F` for PAN) are rendered in the Admin Web portal. Raw documents are never fetched or displayed in HTML plaintext.
3. **Customer Privacy Isolation:** Worker views of bookings do not expose customer personal details until the booking is assigned to that specific worker. Unassigned or out-of-duty workers receive zero customer contact data.
4. **Server-Side Financial Authority:** The website UI **never calculates net earnings, platform commission, or taxes locally**. It renders the exact values returned by the backend financial service.

---

## 10. Architectural Conclusion

The unified React + Vite architecture provides the simplest, cleanest, and most maintainable foundation for the LocalMan website. By transforming `apps/admin_web` into a multi-experience web platform, we eliminate duplicated code, maintain 100% compatibility with existing backend contracts, preserve the paused Flutter applications, and deliver a premium, production-quality experience for customers, workers, and administrators alike.
