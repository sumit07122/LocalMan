# LocalMan Platform: Relational Database Normalization Report

**Author**: Principal Database Architect, Senior PostgreSQL Engineer  
**Date**: November 1, 2026  
**Target Schema**: `apps/api/prisma/schema.prisma` (PostgreSQL 16+)  

---

## 1. Normalization Methodology & Framework

The LocalMan relational model is audited across all four classical normal forms:
* **First Normal Form (1NF)**: Atomic scalar values, unique row identifiers (Primary Keys), elimination of repeating groups.
* **Second Normal Form (2NF)**: Strict 1NF compliance, plus the elimination of partial functional dependencies on composite candidate keys.
* **Third Normal Form (3NF)**: Strict 2NF compliance, plus the elimination of transitive dependencies (every non-key attribute depends directly on the primary key, the whole key, and nothing but the key).
* **Boyce-Codd Normal Form (BCNF)**: For every non-trivial functional dependency $X \rightarrow Y$, $X$ must be a superkey.

### Critical Distinction: Intentional Denormalization vs. Accidental Redundancy

A commercial marketplace cannot maintain pure 3NF across all entities because business transactions are **temporal events**. When a customer books a plumber at ₹499 with 18% GST:
* If the service catalog price later increases to ₹599, the past booking **must not change**.
* If the customer updates their primary profile address tomorrow, past completed bookings **must retain the historical service address**.
* If platform commission or statutory TDS changes from 15% to 18%, past ledger entries **must remain immutable**.

Therefore, the audit categorizes non-3NF attributes into two distinct classes:
1. **Class A: Intentional Temporal Snapshots (Preserve)**: `address_snapshot`, `pricing_snapshot`, `service_snapshot`, `applied_commission_rate`, `applied_tds_rate`, `resulting_available_paisa`.
2. **Class B: Accidental Redundancy & Schema Drift (Correct)**: `Review.comment` vs `Review.body`, `Review.provider_reply` vs `Review.provider_response`, missing `idempotency_key` on `Refund`, and unconstrained default address flags.

---

## 2. Table-by-Table Normalization & Dependency Audit

| Table | Current Problem / Observations | Normalization Concern | Proposed Correction | Migration Risk |
| :--- | :--- | :--- | :--- | :--- |
| **`roles`** | Clean lookup table. PK is string code (`CUSTOMER`, `PROVIDER`, `ADMIN`). | Fully compliant (BCNF). Natural PK is candidate key. | Retain as is. | None. |
| **`users`** | `phone_number` and `email` are unique, but soft-deletion (`deleted_at`) prevents re-registration after deletion. | 3NF compliant. Functional dependency: $id \rightarrow \{phone, email, fullName, isActive\}$. | Replace global unique constraint with partial unique indexes `WHERE deleted_at IS NULL`. | Low. Existing records unaffected. |
| **`user_roles`** | Junction table. Composite PK `(user_id, role_id)`. | Fully compliant (BCNF). Both attributes form candidate key; no partial dependencies. | Retain as is. | None. |
| **`otp_verifications`** | Transient table storing phone OTP hashes. Missing foreign key to `users` because OTP occurs before user creation. | 1NF compliant. Functional dependency: $id \rightarrow \{phone, hash, expiresAt, isConsumed\}$. | Retain separate table. Add index on `expires_at` for TTL cleanup. | Low. |
| **`addresses`** | Multiple addresses can have `is_default = true` for the same `user_id` under concurrent writes. | 3NF compliant, but missing relational uniqueness invariant: $(\text{user\_id}) \rightarrow \text{single default address}$. | Add partial unique index: `UNIQUE (user_id) WHERE is_default = TRUE`. | Low. Requires resolving existing duplicates if any exist in prod. |
| **`providers`** | 1. Aggregated rating statistics (`rating_average`, `rating_count`) stored directly on profile.<br>2. Real-time GPS telemetry (`current_latitude`, `current_longitude`, `speed`, `heading`, `last_location_at`) updated every 5 seconds on the primary profile row. | 1. Transitive dependency: Ratings derive functionally from aggregate of `reviews`.<br>2. High-frequency write amplification violates single-responsibility principle of the core profile row. | 1. Retain rating fields as read-model cache, but add database check constraints (`rating_average BETWEEN 1 AND 5`).<br>2. In high-scale phase, decouple live telemetry into `provider_live_telemetry` table. | Low-Medium. Keep cached columns for query speed; enforce validation. |
| **`provider_documents`** | Stores KYC documents (Aadhaar, PAN). Plaintext `document_number` stored alongside document type. | 2NF compliant. Functional dependency: $id \rightarrow \{providerId, docType, docNumber, status\}$. | Document number must be encrypted or masked to comply with Indian data protection laws. | Low. Add encryption layer in application/DB. |
| **`provider_service_areas`** | Relational mapping of provider operational radius per city. Missing index on `(city)` or spatial point. | 3NF compliant. Functional dependency: $id \rightarrow \{providerId, city, radius, centerLat, centerLon\}$. | Add PostGIS `geography(Point, 4326)` column or spatial index to allow efficient spatial filtering. | Low. Add generated column or direct geometry field. |
| **`provider_availability`** | Maps weekly schedule. Lacks unique constraint on `(provider_id, day_of_week)`. | 3NF compliant, but allows conflicting duplicate schedule rows for same weekday. | Add `UNIQUE (provider_id, day_of_week)`. | Low. Clean duplicate schedules before adding constraint. |
| **`service_categories`** | Self-referencing tree via `parent_id`. | Fully compliant (3NF/BCNF). | Retain as is. | None. |
| **`services`** | Service catalog items with default pricing and platform commission. | 3NF compliant. Functional dependency: $id \rightarrow \{categoryId, name, slug, pricingModel, basePrice\}$. | Add check constraints: `base_price_paisa >= 0`, `platform_commission_percent BETWEEN 0 AND 100`. | Low. Verify seed data conforms. |
| **`provider_services`** | Junction table with price override: `custom_price_paisa`. | Fully compliant (BCNF). Composite key `(provider_id, service_id)`. | Add check constraint: `custom_price_paisa >= 0`. | None. |
| **`bookings`** | 1. JSON snapshots (`address_snapshot`, `pricing_snapshot`, `service_snapshot`).<br>2. Itemized financial totals (`base`, `extra`, `materials`, `discount`, `tax`, `platform_fee`, `total`, `provider_earning`).<br>3. `attachments` stored as JSON array on booking row.<br>4. Missing row version column for optimistic concurrency. | **Intentional Denormalization (Class A)**: Snapshots protect temporal invariants against catalog/address mutations. Storing financial breakdowns avoids re-computation anomalies.<br>**Accidental Redundancy**: `attachments` JSON should ideally be normalized into `booking_attachments` table. | 1. Preserve all JSON snapshots for temporal auditability.<br>2. Add check constraints ensuring financial integrity (`total >= 0`).<br>3. Add `version INT DEFAULT 1` for optimistic locking.<br>4. Plan `booking_attachments` table for normalized photo storage. | Medium. Backward compatible; keep `attachments` column during expand-and-contract phase. |
| **`booking_status_history`** | Immutable append-only FSM audit log. | Fully compliant (3NF). Historical event sourcing record. | Retain as is. | None. |
| **`booking_materials`** | Extra parts and materials purchased by provider during job execution. | 3NF compliant. Functional dependency: $id \rightarrow \{bookingId, itemName, qty, unitPrice, totalPrice\}$. | Add check constraint: `total_price_paisa = ROUND(quantity * unit_price_paisa)`. | Low. Enforces arithmetic integrity. |
| **`booking_quotes`** | Custom negotiation quotes for complex inspection jobs. Lacks database-level guarantee that at most ONE quote can be accepted. | 3NF compliant, but relational constraint missing: At most one `status = 'ACCEPTED'` row per `booking_id`. | Add partial unique index: `UNIQUE (booking_id) WHERE status = 'ACCEPTED'`. | Low. Essential to prevent concurrent quote acceptance races. |
| **`payments`** | 1:1 settlement record per booking. `booking_id` is unique. | 3NF compliant. Functional dependency: $id \rightarrow \{bookingId, gateway, amount, status, idempotencyKey\}$. | Add check constraint: `amount_paisa > 0`. Add indexes on `gateway_payment_id` and `gateway_order_id` for webhook lookups. | Low. High performance gain for webhook processing. |
| **`payment_transactions`** | Gateway payload and callback audit trail. | Fully compliant (3NF). Append-only transaction log. | Retain as is. | None. |
| **`refunds`** | Records refunds issued against payments. Completely lacks `idempotency_key` column; encodes key in `reason` string. | 2NF compliant, but missing dedicated idempotency candidate key violates 3NF principles. | Add `idempotency_key VARCHAR(120) UNIQUE` to schema. Add check constraint `amount_paisa > 0`. | Low. Migrate existing records cleanly. |
| **`provider_payouts`** | Withdrawal settlement records with commission and statutory TDS rates. | 3NF compliant. Applied commission and TDS rates are intentional historical snapshots. | Add check constraint: `gross_amount_paisa = net_payout_paisa + platform_deduction_paisa + tds_deduction_paisa`. | Low. Enforces mathematical reconciliation. |
| **`provider_wallets`** | Stores `available_balance_paisa`, `pending_balance_paisa`, `paid_out_balance_paisa`. | 3NF compliant, but critical invariant `available + pending + paidOut == totalEarned` is unenforced at DB level. | Add check constraints: `available_balance_paisa >= 0`, `pending_balance_paisa >= 0`, `paid_out_balance_paisa >= 0`. Add `version INT DEFAULT 1`. | Low. Prevents negative wallet exploitation. |
| **`wallet_ledger_entries`** | Double-entry append-only financial journal. Tracks `resulting_available_paisa` and `resulting_pending_paisa`. | **Intentional Denormalization (Class A)**: Resulting balances preserve point-in-time financial audit trail for fast ledger reconciliation without full-table re-aggregation. | Add check constraint: `amount_paisa > 0`. Add index on `source_reference_id`. | Low. Critical for accounting auditability. |
| **`reviews`** | Customer reviews. Contains redundant column pairs: `body` and `comment`, and `provider_response` and `provider_reply`. | Accidental redundancy / schema drift from rapid phase iteration. Violates 1NF clean attribute naming. | Consolidate onto canonical fields `body` and `provider_response`. Keep legacy fields nullable or drop via safe deprecation migration. Add check: `rating BETWEEN 1 AND 5`. | Low. Application service already coalesces them. |
| **`review_reports`** | Flags submitted against reviews. Unique on `(review_id, reporter_id)`. | Fully compliant (BCNF). | Retain as is. | None. |
| **`complaints`** | Customer dispute and complaint tickets. | 3NF compliant. Functional dependency: $ticket\_number \rightarrow \{bookingId, category, status\}$. | Retain as is. | None. |
| **`audit_logs`** | Security and admin action log. | Fully compliant (3NF). Append-only audit record. | Retain as is. | None. |
| **`coupons`** | Marketing promotional discounts. | 3NF compliant. Functional dependency: $code \rightarrow \{discountType, value, usageLimit, validity\}$. | Add check constraint: `usage_count <= usage_limit` when `usage_limit IS NOT NULL`. | Low. |
| **`refresh_tokens`** | Cryptographic session tokens. | Fully compliant (BCNF). `token_hash` is candidate key. | Retain as is. | None. |
| **`dispatch_offers`** | Ephemeral job broadcast offers to providers with 60s expiration countdown. | 3NF compliant, but lacks constraint preventing multiple active `OFFERED` offers for same booking. | Add partial unique index: `UNIQUE (booking_id) WHERE status = 'OFFERED'`. | Low. Prevents duplicate simultaneous broadcasts. |
| **`provider_location_logs`**| High-frequency append-only GPS telemetry. | 1NF compliant. High-write append log. | Plan declarative monthly table partitioning (`PARTITION BY RANGE (created_at)`) to prevent single-table index bloat. | Medium. Non-destructive if planned during scaling. |
| **`conversations`** | 1:1 chat room linked to booking. | Fully compliant (BCNF). | Retain as is. | None. |
| **`conversation_participants`**| Junction table linking users to conversations with read cursors. | Fully compliant (BCNF). Composite key `(conversation_id, user_id)`. | Retain as is. | None. |
| **`messages`** | Individual chat messages with client deduplication and threading. | Fully compliant (3NF). Candidate keys: `id`, `(conversation_id, client_message_id)`. | Add composite index `(conversation_id, id)` for efficient cursor pagination. | None. |
| **`chat_outbox_events`** | Transactional Outbox Pattern for reliable real-time messaging delivery. | Fully compliant (3NF). | Add index on `(is_delivered, created_at)` for outbox polling. (Already present). | None. |

---

## 3. Normalization Summary & Verdict

The database design demonstrates strong relational fundamentals with appropriate junction tables and foreign keys. The intentional denormalizations (`address_snapshot`, `pricing_snapshot`, `service_snapshot`, and running balances in `wallet_ledger_entries`) are architecturally sound and necessary to preserve temporal immutability and financial audit trails.

The critical normalization repairs required are:
1. Adding partial unique constraints to enforce single-state invariants (`addresses.is_default`, `booking_quotes.status = 'ACCEPTED'`, `dispatch_offers.status = 'OFFERED'`).
2. Adding formal `idempotency_key` column to `refunds`.
3. Consolidating duplicate text attributes in `reviews` (`body`/`comment`, `provider_response`/`provider_reply`).
4. Adding check constraints across financial, rating, coordinate, and balance columns.

