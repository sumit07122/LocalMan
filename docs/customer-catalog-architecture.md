# LocalMan Customer Service Catalog, Discovery & Service Detail Architecture (Phase 3B)

## 1. Executive Summary

Phase 3B establishes the production-grade, authoritative customer service catalog, discovery, search, and service detail layer for the LocalMan marketplace.

The catalog architecture enforces strict backend authority, data sanitization (eliminating sensitive internal margins and admin fields from customer responses), integer-paisa financial precision, and comprehensive pricing model communication for:
1. `FIXED_PRICE`: Authoritative fixed price with zero hidden surprises.
2. `HOURLY`: Authoritative hourly rate with minimum billing duration.
3. `INSPECTION_QUOTE`: Transparent on-site professional inspection and visiting fee.
4. `CUSTOM_QUOTE`: Custom requirements with competitive quote solicitation.

All discovery paths in the Flutter customer application consume real, authoritative backend endpoints. No mock catalog data, hardcoded service arrays, fake provider availability, or simulated delays exist in customer runtime paths.

---

## 2. Catalog Entities & Data Model

### 2.1 Backend / Database (Prisma)

The persistence layer uses PostgreSQL with the following authoritative models and constraints:

- **`ServiceCategory`**:
  - `id`: Unique CUID string.
  - `name`: Category display name (e.g., "Plumbing", "Electrical").
  - `slug`: Unique, URL-safe slug with database index (`@unique`).
  - `description`: Optional comprehensive description.
  - `icon`: Optional icon/image reference.
  - `parentId`: Optional reference to parent category for hierarchical taxonomy (`@relation("CategoryHierarchy")`).
  - `isActive`: Boolean flag; inactive categories are strictly filtered out of customer endpoints.
  - `sortOrder`: Integer for deterministic catalog sorting.
  - `createdAt`, `updatedAt`: Timestamps.

- **`Service`**:
  - `id`: Unique CUID string.
  - `categoryId`: Foreign key with referential action `Restrict` on deletion to prevent orphaned bookings.
  - `name`: Service display name (e.g., "Tap Leak Repair", "AC Deep Clean").
  - `slug`: Unique URL-safe slug with database index (`@unique`).
  - `description`: Detailed service overview and scope.
  - `shortDescription`: Concise summary for list cards.
  - `pricingModel`: Enum (`FIXED_PRICE`, `HOURLY`, `INSPECTION_QUOTE`, `CUSTOM_QUOTE`).
  - `basePricePaisa`: Integer paisa (1 INR = 100 paisa) for fixed-price services.
  - `hourlyRatePaisa`: Integer paisa for hourly services.
  - `minimumHours`: Integer minimum billable hours for hourly services.
  - `inspectionFeePaisa`: Integer paisa for visiting/diagnosis fees.
  - `estimatedDurationMinutes`: Duration estimate for customer planning.
  - `platformCommissionPercent`: **Internal commercial margin; strictly stripped from customer responses**.
  - `isActive`: Boolean flag; inactive services are strictly filtered from discovery and search.
  - `sortOrder`: Integer for deterministic ordering.
  - `createdAt`, `updatedAt`: Timestamps.

---

## 3. API Endpoints & Customer Contracts

Customer discovery endpoints are public/read-safe with bounded pagination, case-insensitive search, and sanitized DTOs:

| Method | Endpoint | Description | Auth Requirement |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/categories` | Returns all active root categories with active subcategories & service counts | Public |
| `GET` | `/api/v1/categories/:idOrSlug` | Returns category detail with active services & active subcategories | Public |
| `GET` | `/api/v1/services` | Search and filter active services with pagination and sorting | Public |
| `GET` | `/api/v1/services/:idOrSlug` | Returns active service detail with full pricing metadata and category | Public |

### 3.1 Query Parameters for `GET /api/v1/services`

- `query` / `search`: Optional case-insensitive text search over service `name` and `description`.
- `categoryId`: Optional filter by category ID or slug.
- `pricingModel`: Optional filter by pricing model (`FIXED_PRICE`, `HOURLY`, `INSPECTION_QUOTE`, `CUSTOM_QUOTE`).
- `sort`: Ordering option (`name_asc`, `name_desc`, `price_asc`, `price_desc`, `sort_order`). Defaults to `sort_order`.
- `page`: 1-indexed page number (default: 1).
- `limit`: Items per page (default: 20, max: 50). Unbounded requests are rejected.

### 3.2 Response Contracts (`packages/contracts`)

All requests and responses conform to typed Zod schemas:
- `CategoryResponseSchema`
- `CategoryDetailResponseSchema`
- `ServiceResponseSchema`
- `ServiceDetailResponseSchema`
- `ServicePricingSchema`
- `CatalogPaginationSchema`
- `SearchServicesQuerySchema`

---

## 4. Pricing Model Representation & Financial Invariants

All monetary values remain strictly integer paisa in backend, database, and contract payloads:

1. **`FIXED_PRICE`**:
   - `basePricePaisa`: e.g., `49900`
   - Customer UI: `₹499`
   - Badge: `Fixed Price`
   - Communication: "Fixed upfront price with no surprise charges."
2. **`HOURLY`**:
   - `hourlyRatePaisa`: e.g., `29900`
   - Customer UI: `₹299/hr`
   - Badge: `Hourly Rate`
   - Communication: "Charged by time: ₹299 per recorded hour. Minimum 1 hour."
3. **`INSPECTION_QUOTE`**:
   - `inspectionFeePaisa`: e.g., `9900`
   - Customer UI: `Inspection Quote`
   - Badge: `Inspection Quote`
   - Communication: "Inspection required — final price determined after on-site professional inspection." Shows visiting fee if configured.
4. **`CUSTOM_QUOTE`**:
   - Customer UI: `Request Quote`
   - Badge: `Quote Based`
   - Communication: "Request the service and receive competitive quotes from verified local providers."

---

## 5. Security & Invariant Protections

1. **Information Leakage Prevention**:
   - `platformCommissionPercent` is an internal administrative rate between LocalMan and providers. It is stripped in `catalog.service.ts` and `catalog.controller.ts` before serializing responses.
2. **Unauthorized Mutation Rejection**:
   - Customer tokens or unauthenticated clients cannot perform `POST`, `PUT`, `PATCH`, or `DELETE` on categories or services (protected by RBAC guards, returning 401/403).
3. **Inactive Record Isolation**:
   - Inactive categories and services (`isActive: false`) are strictly omitted from discovery, search, and category detail. If an inactive service is requested directly by ID or slug, the API returns a 404 Not Found.
4. **Bounded Pagination & Injection Protection**:
   - Page limits are strictly clamped to a maximum of 50 to prevent memory exhaustion / DoS attacks.
   - Text search uses parameterized Prisma ORM queries with `mode: 'insensitive'` to prevent SQL injection.
5. **No Fake / Prototype Shortcuts**:
   - No hardcoded services or fake provider ratings are displayed.
   - Address context comes directly from the customer's authenticated address store from Phase 3A.
   - GPS permission is not requested merely to browse the catalog.

---

## 6. Customer Mobile Discovery Flow (Flutter)

The customer discovery experience is built upon clean architecture:

```
apps/customer_app/lib/features/services/
├── domain/
│   ├── category.dart
│   ├── service.dart
│   ├── service_pricing.dart
│   └── catalog_pagination.dart
├── data/
│   └── catalog_repository.dart
└── presentation/
    ├── controllers/
    │   ├── catalog_providers.dart
    │   └── service_search_controller.dart
    └── screens/
        ├── category_services_screen.dart
        ├── service_search_screen.dart
        └── service_detail_screen.dart
```

### Discovery Journey:
1. **Home Screen (`CustomerHomeScreen`)**:
   - Hero: "What do you need done?"
   - Active address context from Phase 3A.
   - Interactive search bar triggers navigation to `/search`.
   - Dynamic Category Grid powered by `categoriesFutureProvider`.
   - Tapping category routes to `/category/:id`.
2. **Category Screen (`CategoryServicesScreen`)**:
   - Displays category header, description, and available service count.
   - In-category quick search and subcategory filter chips.
   - Service cards with duration chips and authoritative price badges.
   - Tapping service routes to `/service/:id`.
3. **Search Screen (`ServiceSearchScreen`)**:
   - Debounced text search (350ms) with cancellation and stale-request protection.
   - Horizontal category filter chips.
   - Quick pricing model filter chips (`Fixed Price`, `Hourly`, `Inspection`, `Quote`).
   - Infinite scroll / pagination loading.
4. **Service Detail (`ServiceDetailScreen`)**:
   - Service title, category chip, estimated duration.
   - Authoritative Pricing Breakdown Card.
   - Inclusions and material charges notice ("Replacement parts require your explicit in-app authorization").
   - Service address context.
   - **Controlled Phase 3C Booking Boundary**: Tapping "Book Service" opens an informative bottom sheet explaining that booking creation and scheduling will be activated in Phase 3C. No booking execution is performed in Phase 3B.

---

## 7. Relationship to Future Booking Flow (Phase 3C)

Phase 3B delivers the complete discovery and price transparency foundation.
In Phase 3C:
- The "Book Service" CTA will open the booking flow wizard.
- Scheduled timeslot selection, address confirmation, customer problem description/photos, and dispatch initiation will consume the authoritative service pricing model established in Phase 3B.
