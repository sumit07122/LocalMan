# LocalMan Platform: Relational Model & Referential Integrity Specification

**Author**: Principal Database Architect, Senior PostgreSQL Engineer  
**Date**: November 1, 2026  
**Target Schema**: `apps/api/prisma/schema.prisma` (PostgreSQL 16+)  

---

## 1. Relational Map & Cardinality Matrix

Every relationship across the 27 entities in LocalMan is verified for ownership, cardinality, referential integrity, and cascade actions:

| Parent Entity | Child Entity | Cardinality | FK Column | Cascade On Delete | Orphan Risk & Protection Strategy | Historical Retention Requirement |
| :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| `roles` | `user_roles` | 1:N | `role_id` | `CASCADE` | Junction table; cascading clean removal is correct. | Permanent (Static lookup). |
| `users` | `user_roles` | 1:N | `user_id` | `CASCADE` | User roles must be removed if user is physically purged. | Retain until user hard-deleted. |
| `users` | `addresses` | 1:N | `user_id` | `CASCADE` | Addresses cascade delete with user. | Completed bookings retain snapshots; addresses safe to cascade. |
| `users` | `providers` | 1:1 | `user_id` | `CASCADE` | Provider profile belongs strictly to one User account. | High; provider profiles must not be deleted if bookings exist. |
| `users` | `bookings` | 1:N | `customer_id`| `RESTRICT` (Default) | **Zero Orphan Risk**: Prevents customer deletion if bookings exist. | **Permanent Statutory Record** (Financial audit, 7 years). |
| `users` | `reviews` | 1:N | `customer_id`| `RESTRICT` (Default) | Customer deletion blocked if reviews exist. | Permanent public review record. |
| `users` | `complaints` | 1:N | `raised_by` | `RESTRICT` (Default) | Complaint must not lose customer identity. | Permanent compliance record (3 years). |
| `users` | `refresh_tokens`| 1:N | `user_id` | `CASCADE` | Ephemeral auth tokens cascade on user deletion. | Short-lived (Purged after expiration). |
| `users` | `audit_logs` | 1:N | `user_id` | `SET NULL` | Audit logs must persist even if actor user is deleted (`user_id = NULL`). | **Permanent Compliance Record** (Immutable, 7 years). |
| `users` | `conversation_participants` | 1:N | `user_id` | `CASCADE` | Chat participant membership cascades with user. | Retained with conversation history. |
| `users` | `messages` | 1:N | `sender_user_id`| `SET NULL` | Messages remain visible with placeholder (`sender = NULL`) if user deleted. | Permanent chat transcript. |
| `users` | `review_reports`| 1:N | `reporter_id`| `RESTRICT` | Report audit trail preserved. | Retained for moderation history. |
| `providers` | `provider_documents` | 1:N | `provider_id` | `CASCADE` | KYC documents belong exclusively to provider. | Required for 5 years after provider deactivation. |
| `providers` | `provider_service_areas` | 1:N | `provider_id` | `CASCADE` | Operational boundaries cascade with provider profile. | Replaced dynamically. |
| `providers` | `provider_availability` | 1:N | `provider_id` | `CASCADE` | Schedule availability cascades with provider profile. | Replaced dynamically. |
| `providers` | `provider_services` | 1:N | `provider_id` | `CASCADE` | Service offerings cascade with provider profile. | Replaced dynamically. |
| `providers` | `bookings` | 1:N | `provider_id` | `RESTRICT` (Default) | Provider cannot be deleted if assigned to bookings. | **Permanent Statutory Record** (Financial audit, 7 years). |
| `providers` | `booking_quotes`| 1:N | `provider_id` | `CASCADE` | Unaccepted quotes cascade if provider is purged. | Accepted quotes retained with booking snapshots. |
| `providers` | `provider_wallets` | 1:1 | `provider_id` | `CASCADE` | 1:1 financial balance ledger account. | **Permanent Financial Ledger** (Never hard deleted). |
| `providers` | `provider_payouts` | 1:N | `provider_id` | `RESTRICT` (Default) | Bank transfers and TDS records must be preserved. | **Permanent Statutory Record** (Indian Income Tax Act, 7 years). |
| `providers` | `wallet_ledger_entries` | 1:N | `provider_id` | `CASCADE` | Ledger entries linked to provider. | **Permanent Financial Ledger** (Never hard deleted). |
| `providers` | `dispatch_offers` | 1:N | `provider_id` | `CASCADE` | Broadcast dispatch offers cascade. | Ephemeral (Auto-expires in 60s). |
| `providers` | `provider_location_logs` | 1:N | `provider_id` | `CASCADE` | GPS pings cascade with provider profile. | Ephemeral (Pruned after 30-90 days). |
| `service_categories` | `service_categories` | 1:N | `parent_id` | `RESTRICT` (Default) | Parent category cannot be deleted if subcategories exist. | Static catalog structure. |
| `service_categories` | `services` | 1:N | `category_id` | `RESTRICT` (Default) | Category cannot be deleted if services exist. | Static catalog structure. |
| `services` | `provider_services` | 1:N | `service_id` | `CASCADE` | Offerings cascade if catalog service is retired. | Historical bookings preserved via snapshots. |
| `services` | `bookings` | 1:N | `service_id` | `RESTRICT` (Default) | Service cannot be deleted if bookings reference it. | Bookings retain complete `service_snapshot`. |
| `addresses` | `bookings` | 1:N | `address_id` | `RESTRICT` (Default) | Address cannot be deleted if bookings reference it. | Bookings retain complete `address_snapshot`. |
| `bookings` | `booking_status_history` | 1:N | `booking_id` | `CASCADE` | Status history cascades if booking is purged. | Immutable audit trail. |
| `bookings` | `booking_materials` | 1:N | `booking_id` | `CASCADE` | Job materials cascade with booking. | Financial breakdown preserved in ledger. |
| `bookings` | `booking_quotes` | 1:N | `booking_id` | `CASCADE` | Quotes cascade if booking is deleted. | Winning quote snapshot retained. |
| `bookings` | `payments` | 1:1 | `booking_id` | `RESTRICT` (Default) | Payment cannot be deleted if booking exists. | **Permanent Financial Record** (Never hard deleted). |
| `bookings` | `reviews` | 1:1 | `booking_id` | `RESTRICT` (Default) | Review cannot be deleted if booking exists. | Public customer feedback. |
| `bookings` | `complaints` | 1:N | `booking_id` | `RESTRICT` (Default) | Complaint cannot be deleted if booking exists. | Dispute resolution record. |
| `bookings` | `dispatch_offers` | 1:N | `booking_id` | `CASCADE` | Dispatch offers cascade with booking. | Ephemeral broadcast records. |
| `bookings` | `provider_location_logs` | 1:N | `booking_id` | `SET NULL` | GPS logs detach from booking (`booking_id = NULL`) if booking purged. | Telemetry audit. |
| `bookings` | `conversations` | 1:1 | `booking_id` | `CASCADE` | Chat room cascades with booking. | In-app communications transcript. |
| `payments` | `payment_transactions` | 1:N | `payment_id` | `CASCADE` | Gateway transactions cascade with payment. | Payment gateway audit logs. |
| `payments` | `refunds` | 1:N | `payment_id` | `RESTRICT` (Default) | Payment cannot be deleted if refunds exist. | **Permanent Financial Record** (Never hard deleted). |
| `provider_wallets` | `wallet_ledger_entries` | 1:N | `wallet_id` | `CASCADE` | Ledger entries tied to wallet. | **Permanent Double-Entry Ledger** (Immutable). |
| `provider_payouts` | `wallet_ledger_entries` | 1:N | `payout_id` | `SET NULL` | Ledger entry remains if payout metadata purged. | Financial balance record. |
| `reviews` | `review_reports` | 1:N | `review_id` | `CASCADE` | Reports cascade if review is removed. | Moderation audit. |
| `conversations` | `conversation_participants` | 1:N | `conversation_id`| `CASCADE` | Participants cascade with conversation. | Chat membership. |
| `conversations` | `messages` | 1:N | `conversation_id`| `CASCADE` | Messages cascade with conversation. | Chat transcript. |
| `messages` | `messages` (Self) | 1:N | `reply_to_message_id`| `SET NULL` | Replies remain if parent message is deleted (`reply_to = NULL`). | Message thread continuity. |

---

## 2. Referential Integrity Gaps & Cascade Vulnerabilities

### 2.1 The Hard-Delete vs Financial Immutability Conflict
In Prisma, specifying `onDelete: Cascade` on `Provider.wallet` (`wallet ProviderWallet?`) and `ProviderWallet.ledgerEntries` means that executing `prisma.provider.delete()` would automatically trigger a cascading `DELETE` that **obliterates the entire financial ledger and wallet audit history**!

* **Architectural Risk**: **HIGH**. In a financial system, money-related tables (`provider_wallets`, `wallet_ledger_entries`, `provider_payouts`, `payments`, `refunds`) must **NEVER** cascade-delete.
* **Remediation**: Change `onDelete: Cascade` to `onDelete: Restrict` for all financial relations:
  * `ProviderWallet -> Provider`: `ON DELETE RESTRICT`
  * `WalletLedgerEntry -> ProviderWallet`: `ON DELETE RESTRICT`
  * `WalletLedgerEntry -> Provider`: `ON DELETE RESTRICT`
  * `Payment -> Booking`: `ON DELETE RESTRICT`
  * `Refund -> Payment`: `ON DELETE RESTRICT`
* **Rule**: A Provider with financial ledger history or an active wallet **cannot be hard-deleted**. Providers can only be soft-deactivated via `verification_status = 'SUSPENDED'` or `is_active = false`.

### 2.2 Missing Foreign Key Indexes (Cascade Lock Risk)
In PostgreSQL, executing a `DELETE` or `UPDATE` on a parent table requires PostgreSQL to check the foreign key table. If the child foreign key column is **not indexed**, PostgreSQL must perform a **full sequential table scan** on the child table while acquiring a table-level shared lock (`ShareRowExclusiveLock` or similar), causing severe query blocking and transaction timeouts.

The following foreign key columns currently lack explicit database indexes:
1. `addresses.user_id` (Has `idx_addresses_user` - Verified OK)
2. `provider_service_areas.provider_id` (**Missing index!**)
3. `provider_availability.provider_id` (**Missing index!**)
4. `booking_materials.booking_id` (**Missing index!**)
5. `refunds.payment_id` (**Missing index!**)
6. `provider_payouts.provider_id` and `provider_payouts.booking_id` (**Missing indexes!**)
7. `complaints.booking_id` and `complaints.raised_by` (**Missing indexes!**)
8. `audit_logs.user_id` (**Missing index!**)
9. `review_reports.reporter_id` (**Missing index!**)

Adding these indexes is a top-priority performance and lock-mitigation fix.

---

## 3. Polymorphic Relationship Analysis

A critical architectural virtue of LocalMan is that it **avoids generic polymorphic tables** (such as a generic `notes` table with `entity_type` and `entity_id` strings).

* **Entity-Specific Relations**:
  * Reviews link directly to `Booking`, `User`, and `Provider` with true foreign keys.
  * Complaints link directly to `Booking` and `User` with true foreign keys.
  * In-app chat links directly to `Booking` with true foreign keys.
* **The Only Semi-Polymorphic Entity: `audit_logs`**:
  * `audit_logs` contains `resource_type VARCHAR(50)` and `resource_id VARCHAR(100)`.
  * **Architectural Evaluation**: For an operational system audit log, this is standard and appropriate. Attempting to create 25 separate foreign keys on an audit log table creates extreme schema rigidity. The composite index `idx_audit_resource` on `(resource_type, resource_id, created_at)` provides fast lookups without violating relational principles.

