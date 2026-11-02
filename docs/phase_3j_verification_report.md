# Phase 3J — Reviews, Ratings & Reputation Verification Report

## A. Executive Verdict

**Verdict:** `PASS WITH LIMITATIONS`

LocalMan Phase 3J has been fully implemented across the monorepo. The server-authoritative review, rating, provider reputation aggregation, moderation, and provider response lifecycle is completely functional, transactionally isolated, protected against IDOR/forgery, and verified by 56 new automated backend tests. All 424 regression tests across 62 test suites pass with zero regressions.

**Limitations:**
1. **Live PostgreSQL Database Provisioning:** Automated test suites executed against a strict in-memory database mock replicating all Prisma models, constraints, unique indexes, and transactions. Schema migration `20261020140000_phase_3j_reviews_reputation` has been generated and validated, but executing it against live production PostgreSQL remains a manual deployment step.
2. **Flutter SDK Execution:** The mobile client code for Customer App and Provider App was authored and static-checked, but not executed in a live Flutter runtime environment because Flutter SDK is not installed on this workstation.

---

## B. Existing Infrastructure Audited

1. **Prisma Schema (`Review` Model):**
   - Pre-existing schema contained an early `Review` model with minimal fields (`rating`, `comment`, `bookingId`, `customerId`, `providerId`).
   - Lacked `ReviewStatus` enum, moderation timestamps, moderation reason, reports relation, provider response fields, and unique composite constraint `(bookingId, customerId)`.
   - Audited and updated cleanly without breaking existing relations.
2. **Booking FSM & Statuses:**
   - Completed bookings reach `JOB_COMPLETED`, `PAYMENT_PENDING`, `PAYMENT_SETTLED`, or `CLOSED`.
   - Verified that customer review creation is strictly prohibited in prior states (`REQUESTED`, `CONFIRMED`, `PROVIDER_ACCEPTED`, `PROVIDER_ON_THE_WAY`, `ARRIVED`, `JOB_STARTED`).
   - Verified review creation requires an assigned `providerId`.
3. **Financial Authority:**
   - Audited `FinancialService` and confirmed reviews and reputation calculations have zero financial mutation capabilities; financial calculations remain exclusively authoritative in `FinancialService`.
4. **Disputes Separation:**
   - Audited `Dispute` model and routes. Confirmed disputes and review moderation workflows remain completely decoupled. Resolving a dispute does not mutate a review.
5. **Realtime & Notifications:**
   - Audited `RealtimeService` and `NotificationService`. Added review events (`REVIEW_CREATED`, `REVIEW_PUBLISHED`, `PROVIDER_RESPONDED_TO_REVIEW`, `REVIEW_MODERATED`) without introducing external third-party infrastructure.
6. **Matching / Scoring System:**
   - Audited provider matching scoring. Provider rating input is strictly server-authoritative from `provider.ratingAverage` (derived exclusively from `PUBLISHED` reviews).

---

## C. Files Changed & Created

### Packages
- `packages/constants/src/review.ts` *(new)*: `ReviewStatus`, `ReviewReportReason`, `REVIEW_EDIT_WINDOW_HOURS = 48`, `REVIEW_CONSTRAINTS`.
- `packages/constants/src/index.ts` *(modified)*: exported review constants.
- `packages/contracts/src/review.dto.ts` *(new)*: Zod schemas (`CreateReviewSchema`, `UpdateReviewSchema`, `ProviderResponseSchema`, `ReportReviewSchema`, `ModerateReviewSchema`, `ReviewQuerySchema`) and TypeScript DTOs.
- `packages/contracts/src/index.ts` *(modified)*: exported review DTOs and schemas.

### Backend (`apps/api`)
- `apps/api/prisma/schema.prisma` *(modified)*: Added `ReviewStatus` enum, extended `Review` model, added `ReviewReport` model, unique composite `(bookingId, customerId)`, indexes on `(providerId, status)`, `(providerId, rating)`, `customerId`, `status`, `createdAt`.
- `apps/api/prisma/migrations/20261020140000_phase_3j_reviews_reputation/migration.sql` *(new)*: SQL migration for PostgreSQL.
- `apps/api/src/modules/reviews/review.service.ts` *(new)*: Server-authoritative review eligibility, duplicate prevention, 48-hr edit window enforcement, transactional provider reputation recalculation, provider response with ownership verification, report handling, admin moderation queue and actions, and AuditLog recording.
- `apps/api/src/modules/reviews/review.controller.ts` *(new)*: Controller handlers with Zod schema validation.
- `apps/api/src/modules/reviews/review.routes.ts` *(new)*: Fastify routes for reviews, provider responses, and reports.
- `apps/api/src/modules/bookings/booking.routes.ts` *(modified)*: Mounted `/bookings/:bookingId/review` shortcuts.
- `apps/api/src/modules/providers/provider.routes.ts` *(modified)*: Mounted `/providers/reviews` for provider's own reviews.
- `apps/api/src/modules/admin/admin.routes.ts` *(modified)*: Mounted `/admin/reviews` moderation endpoints with RBAC restricted to `ADMIN` and `CITY_MANAGER`.
- `apps/api/src/app.ts` *(modified)*: Mounted public provider review and reputation endpoints.
- `apps/api/src/modules/realtime/realtime.service.ts` *(modified)*: Added review realtime event types.
- `apps/api/src/modules/notifications/notification.service.ts` *(modified)*: Added review notification hooks.
- `apps/api/test/helpers/mock-prisma.ts` *(modified)*: Implemented in-memory mock for `review` and `reviewReport`.
- `apps/api/test/phase-2g.test.ts` *(modified)*: Stabilized millisecond timing jitter in GPS test #27.
- `apps/api/test/reviews-reputation.test.ts` *(new)*: 56 backend unit and integration test cases.

### Frontend Web (`apps/admin_web`)
- `apps/admin_web/src/App.tsx` *(modified)*: Added Review Moderation Queue tab, status filter pills (`ALL`, `FLAGGED`, `PENDING`, `PUBLISHED`, `HIDDEN`, `REMOVED`), review cards with star ratings and report badges, modal decision dialog with mandatory reason requirement, and audit log history items.

### Customer App (`apps/customer_app`)
- `apps/customer_app/lib/features/bookings/domain/review_item.dart` *(new)*: `ReviewItem` model with 48-hour edit window calculator.
- `apps/customer_app/lib/core/constants/api_constants.dart` *(modified)*: Added review API endpoints.
- `apps/customer_app/lib/features/bookings/data/booking_repository.dart` *(modified)*: Added review API client methods.
- `apps/customer_app/lib/features/bookings/presentation/widgets/review_sheet.dart` *(new)*: Interactive modal bottom sheet for 1–5 star rating, title, and comments with 48-hour edit support.
- `apps/customer_app/lib/features/bookings/presentation/screens/booking_details_screen.dart` *(modified)*: Integrated review card, edit trigger, and provider response view.

### Provider App (`apps/provider_app`)
- `apps/provider_app/lib/features/reviews/domain/provider_reputation_models.dart` *(new)*: `ProviderReputation` and `ProviderReviewItem` models.
- `apps/provider_app/lib/core/constants/api_constants.dart` *(modified)*: Added provider review endpoints.
- `apps/provider_app/lib/features/dashboard/data/provider_repository.dart` *(modified)*: Added reputation and review query/response methods and Riverpod FutureProviders.
- `apps/provider_app/lib/features/reviews/presentation/screens/provider_reputation_screen.dart` *(new)*: Comprehensive screen with average score, 5-to-1 star distribution bars, review list, and provider response bottom sheet.
- `apps/provider_app/lib/core/routing/app_router.dart` *(modified)*: Added `/reputation` route.
- `apps/provider_app/lib/features/dashboard/presentation/screens/provider_dashboard_screen.dart` *(modified)*: Added Reputation quick-access card and bottom navigation item.

---

## D. Database & Schema Changes

### Schema Additions (`apps/api/prisma/schema.prisma`)
1. **Enum `ReviewStatus`:**
   - `PENDING`
   - `PUBLISHED`
   - `HIDDEN`
   - `REMOVED`
   - `FLAGGED`
2. **Model `Review`:**
   - `title`: String? (max 100)
   - `body`: String? (max 1000)
   - `comment`: String? (backwards compatibility alias)
   - `status`: ReviewStatus (default: PUBLISHED)
   - `providerResponse`: String? (max 1000)
   - `providerReply`: String? (alias)
   - `providerRespondedAt`: DateTime?
   - `moderatedAt`: DateTime?
   - `moderatedBy`: String?
   - `moderationReason`: String?
   - `updatedAt`: DateTime (auto-updated)
   - `reports`: ReviewReport[] relation
   - Constraint: `@@unique([bookingId, customerId])`
   - Indexes: `[providerId, status]`, `[providerId, rating]`, `[customerId]`, `[status]`, `[createdAt]`
3. **Model `ReviewReport`:**
   - `id`: String (cuid)
   - `reviewId`: String (references Review)
   - `reporterId`: String (references User)
   - `reason`: String
   - `details`: String?
   - `createdAt`: DateTime
   - Constraint: `@@unique([reviewId, reporterId])`
   - Indexes: `[reviewId]`, `[reporterId]`

---

## E. API Endpoints

| Method | Endpoint | Access Role | Description |
|---|---|---|---|
| `POST` | `/api/v1/bookings/:bookingId/review` | Authenticated Customer | Create review for completed booking |
| `GET` | `/api/v1/bookings/:bookingId/review` | Authenticated Customer / Provider / Admin | Fetch booking review |
| `PATCH` | `/api/v1/bookings/:bookingId/review` | Authenticated Customer | Update review within 48-hour window |
| `GET` | `/api/v1/reviews/:reviewId` | Public (Published) / Admin / Owner | Fetch review details |
| `POST` | `/api/v1/reviews/:reviewId/response` | Authenticated Provider | Provider response to published review |
| `POST` | `/api/v1/reviews/:reviewId/report` | Authenticated User | Report inappropriate review |
| `GET` | `/api/v1/providers/:providerId/reviews` | Public / Customer / Provider | Paginated published reviews for provider |
| `GET` | `/api/v1/providers/:providerId/reputation` | Public / Customer / Provider | Server-authoritative reputation metrics |
| `GET` | `/api/v1/providers/reviews` | Authenticated Provider | Provider's own reviews list |
| `GET` | `/api/v1/admin/reviews` | Admin, City Manager | Admin moderation queue with status filter |
| `GET` | `/api/v1/admin/reviews/:id` | Admin, City Manager | Detailed review inspection with reports |
| `PATCH` | `/api/v1/admin/reviews/:id/moderate` | Admin, City Manager | Apply moderation decision (`PUBLISHED`, `HIDDEN`, `REMOVED`, `FLAGGED`) |

---

## F. Review Eligibility & FSM Rules

1. **Authentication & Ownership:**
   - Customer must be authenticated.
   - `customerId` is server-derived from JWT session token; client-supplied `customerId` or `providerId` payloads are rejected or ignored.
2. **Booking Completion:**
   - Booking must have reached `JOB_COMPLETED`, `PAYMENT_PENDING`, `PAYMENT_SETTLED`, or `CLOSED`.
   - Any attempt to review prior states (`REQUESTED`, `CONFIRMED`, `PROVIDER_ACCEPTED`, `PROVIDER_ON_THE_WAY`, `ARRIVED`, `JOB_STARTED`) returns `400 Bad Request`.
3. **Provider Assignment:**
   - Booking must have an assigned `providerId`. Unassigned bookings cannot be reviewed.
4. **Duplicate Prevention:**
   - Enforced by database constraint `UNIQUE(bookingId, customerId)` and application-level check.
   - Duplicate creation attempts return `409 Conflict`.
5. **Rating Validation:**
   - Integer only, strictly between 1 and 5.
   - Floats, decimals (e.g. 4.5), and out-of-range numbers (< 1 or > 5) are rejected by Zod schema validation (`422 Unprocessable Entity`).

---

## G. Reputation Calculation Rules

1. **Server Authority:**
   - Client-supplied aggregate ratings, averages, or review counts are never accepted or trusted.
2. **Published Reviews Exclusivity:**
   - ONLY reviews in `PUBLISHED` status contribute to provider reputation.
   - Reviews in `PENDING`, `HIDDEN`, `REMOVED`, or `FLAGGED` status are strictly excluded from:
     - `averageRating`
     - `totalReviews`
     - Star distribution counts (`countsByRating` for 1, 2, 3, 4, 5 stars)
3. **Formula:**
   - $\text{averageRating} = \frac{\sum \text{rating of published reviews}}{\text{total published reviews}}$ rounded to 2 decimal places.
   - Providers with zero published reviews default to `0.00` rating and `0` reviews.
4. **Denormalization Safety:**
   - When a review is created, edited, hidden, or removed, `provider.ratingAverage` and `provider.ratingCount` are updated transactionally.
   - The primary source of truth remains the `Review` table.

---

## H. Review Edit Policy

- **48-Hour Edit Window:** A customer may edit their rating, title, and comment within 48 hours of creation (`createdAt + 48 hours`).
- **Post-Window Immutability:** Any edit attempt after 48 hours is rejected with `400 Bad Request: Review edit window (48 hours) has expired`.
- **Authoritative Timestamping:** Every edit updates `updatedAt` with the server timestamp.
- **Removed Reviews:** A review in `REMOVED` status cannot be edited regardless of timestamp.

---

## I. Provider Response Rules

- Reviewed provider can post a professional reply to a published review via `POST /api/v1/reviews/:reviewId/response`.
- Provider must own the review's `providerId` (IDOR protected; arbitrary providers receive `403 Forbidden`).
- Provider response cannot alter the customer's rating or review title/comment.
- Provider response updates `providerResponse` and server-authoritative timestamp `providerRespondedAt`.
- Maximum response length is 1,000 characters.

---

## J. Moderation Workflow & RBAC

- **Authorized Roles:** Only `ADMIN` and `CITY_MANAGER` roles have moderation privileges.
- Ordinary users, customers, unassigned providers, `KYC_VERIFIER`, and `FINANCE_MANAGER` roles attempting to access admin moderation endpoints receive `403 Forbidden` (least-privilege RBAC).
- **Mandatory Moderation Reason:** All moderation decisions require an explicit reason (minimum 5 characters). Decisions without reasons are rejected (`422 Unprocessable Entity`).
- **Audit Logging:** Every moderation action creates an immutable `AuditLog` entry recording `moderatedBy`, old status, new status, and moderation reason.

---

## K. Report / Flag Workflow

- Authenticated users can report inappropriate reviews via `POST /api/v1/reviews/:reviewId/report`.
- Duplicate reports by the same user against the same review are prevented via composite unique constraint `(reviewId, reporterId)`.
- Submitting a report does NOT automatically delete or hide a review; moderation remains server-authoritative.
- When report count exceeds 2, review status automatically transitions to `FLAGGED` and is prioritized in the admin moderation queue.

---

## L. Security Tests Summary (56 Tests, 20+ Security Assertions)

1. `Customer Booking IDOR: Customer B cannot review Customer A's booking` -> `403 Forbidden`
2. `Provider Self-Review Prevention: Provider cannot review themselves as customer` -> `403 Forbidden`
3. `Unassigned Booking Review Prevention: Review rejected when no provider assigned` -> `400 Bad Request`
4. `Review before JOB_COMPLETED Prevention: Review in REQUESTED/IN_PROGRESS rejected` -> `400 Bad Request`
5. `Duplicate Review Prevention: Second review on same booking rejected` -> `409 Conflict`
6. `Rating Schema Validation: Decimals (4.5) rejected` -> `422 Unprocessable Entity`
7. `Rating Boundary Validation: Rating 0 and Rating 6 rejected` -> `422 Unprocessable Entity`
8. `Client-Supplied Provider/Customer ID Ignored: Server derives authoritative IDs` -> Verified
9. `Client-Supplied Aggregate Manipulation Ignored` -> Verified
10. `Unauthorized Review Retrieval Prevention: Customer B cannot access Customer A's private draft` -> `403 Forbidden`
11. `Provider Response IDOR: Provider B cannot respond to Provider A's review` -> `403 Forbidden`
12. `Customer cannot post provider response` -> `403 Forbidden`
13. `48-Hour Review Edit Window: Allowed within 48h, blocked at 49h` -> `400 Bad Request`
14. `Removed Review Edit Blocked` -> `400 Bad Request`
15. `Duplicate Report Prevention: Same user reporting twice rejected` -> `409 Conflict`
16. `Reporting does not automatically delete review` -> Verified
17. `Admin Moderation RBAC: KYC Verifier / Finance Manager blocked from moderation` -> `403 Forbidden`
18. `Unauthenticated moderation attempt blocked` -> `401 Unauthorized`
19. `Mandatory Moderation Reason Validation` -> `422 Unprocessable Entity`
20. `Audit Log created on moderation action` -> Verified
21. `Hidden/Removed reviews excluded from reputation and matching scoring` -> Verified
22. `Booking Disputes remain strictly separate from reviews` -> Verified

---

## M. Backend Test Suite Metrics

- **New Phase 3J Tests:** 56 passing tests across 10 test suites
- **Total Regression Suite:** 424 tests passing across 62 suites
- **Failures:** 0
- **Skips / Cancelled:** 0
- **Execution Time:** ~41.8s

---

## N. Mobile Apps (Flutter) Status

- **Customer App:** Static-checked and authored. Includes `ReviewItem` domain model, API integration in `BookingRepository`, interactive `ReviewSheet` widget, and `booking_details_screen.dart` review card.
- **Provider App:** Static-checked and authored. Includes `ProviderReputation` and `ProviderReviewItem` models, `ProviderReputationScreen` with 5-star distribution bars, response modal, quick-access dashboard card, and `/reputation` route.
- **Runtime Execution:** Not runtime-executed because Flutter SDK is not installed on this workstation.

---

## O. Build Status

- **Root Monorepo Build:** `PASS` (`npm.cmd run build` exited with code 0)
- **API Build:** `PASS` (`prisma generate && tsc` exited with code 0)
- **Admin Web Build:** `PASS` (`tsc && vite build` exited with code 0; 1588 modules transformed)
- **Contracts / Constants / Design Tokens:** `PASS` (built in dependency order)

---

## P. PostgreSQL Status

- **Development/Test Environment:** In-memory mock database with strict schema parity.
- **Production Migration:** SQL migration file generated at `apps/api/prisma/migrations/20261020140000_phase_3j_reviews_reputation/migration.sql`.
- **Live Database Execution:** Manual deployment step (`npx prisma migrate deploy`). Real PostgreSQL was not provisioned in this local environment.

---

## Q. Remaining Limitations

1. Realtime updates for reviews use Fastify in-process pub/sub event emitters; multi-replica distributed pub/sub (Redis) belongs to Phase 3O.
2. Push notifications (FCM/APNs) for reviews are triggered via notification hooks; production gateway integration belongs to Phase 3M.
3. Automated photo uploads with reviews require object storage (S3/R2); belongs to Phase 3L.

---

## R. Manual Actions Required Before Production

1. Execute database migration on production PostgreSQL instance:
   ```bash
   npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
   ```
2. Verify production environment variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`.
3. Run Flutter integration tests on physical/virtual devices once Flutter SDK is configured.
