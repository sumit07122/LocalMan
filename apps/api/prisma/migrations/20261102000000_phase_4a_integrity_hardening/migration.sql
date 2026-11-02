-- Migration: 20261102000000_phase_4a_integrity_hardening
-- Scope: Forward integrity hardening, financial ledger protection, idempotency, security hashing, partial unique indexes, check constraints

-- 1. Financial Ledger Protection: Change Cascade to Restrict
ALTER TABLE "provider_wallets" DROP CONSTRAINT IF EXISTS "provider_wallets_provider_id_fkey";
ALTER TABLE "provider_wallets" ADD CONSTRAINT "provider_wallets_provider_id_fkey" 
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wallet_ledger_entries" DROP CONSTRAINT IF EXISTS "wallet_ledger_entries_wallet_id_fkey";
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_wallet_id_fkey" 
  FOREIGN KEY ("wallet_id") REFERENCES "provider_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wallet_ledger_entries" DROP CONSTRAINT IF EXISTS "wallet_ledger_entries_provider_id_fkey";
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_provider_id_fkey" 
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Refunds Idempotency & Indexing
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(120);
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_idempotency_key_key" ON "refunds"("idempotency_key");
CREATE INDEX IF NOT EXISTS "idx_refunds_payment" ON "refunds"("payment_id");

-- 3. Booking Security & OTP Hashing
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "start_otp_hash" VARCHAR(64);
CREATE INDEX IF NOT EXISTS "idx_bookings_scheduled_date" ON "bookings"("scheduled_date");

-- 4. Provider Document Masking
ALTER TABLE "provider_documents" ADD COLUMN IF NOT EXISTS "masked_document_number" VARCHAR(100);

-- 5. Address Default Indexing & Partial Unique Constraint
CREATE INDEX IF NOT EXISTS "idx_addresses_user_default" ON "addresses"("user_id", "is_default");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_customer_single_default_address" ON "addresses"("user_id") WHERE "is_default" = true;

-- 6. Booking Quote Single Accepted State Protection & Column Alignment
ALTER TABLE "booking_quotes" ADD COLUMN IF NOT EXISTS "subtotal_paisa" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "booking_quotes" ADD COLUMN IF NOT EXISTS "materials_paisa" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "booking_quotes" ADD COLUMN IF NOT EXISTS "tax_paisa" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "booking_quotes" ADD COLUMN IF NOT EXISTS "estimated_duration_minutes" INTEGER;
ALTER TABLE "booking_quotes" ADD COLUMN IF NOT EXISTS "items" JSONB;
ALTER TABLE "booking_quotes" ADD COLUMN IF NOT EXISTS "valid_until" TIMESTAMP(3);
ALTER TABLE "booking_quotes" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "booking_quotes" ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMP(3);
ALTER TABLE "booking_quotes" ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3);
ALTER TABLE "booking_quotes" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "idx_booking_quotes_booking" ON "booking_quotes"("booking_id", "status");
CREATE INDEX IF NOT EXISTS "idx_booking_quotes_provider" ON "booking_quotes"("provider_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_booking_single_accepted_quote" ON "booking_quotes"("booking_id") WHERE "status" = 'ACCEPTED';

-- 7. PostgreSQL CHECK Constraints for Critical Invariants
ALTER TABLE "provider_wallets" ADD CONSTRAINT "chk_provider_wallets_available_non_negative" 
  CHECK ("available_balance_paisa" >= 0);

ALTER TABLE "provider_wallets" ADD CONSTRAINT "chk_provider_wallets_pending_non_negative" 
  CHECK ("pending_balance_paisa" >= 0);

ALTER TABLE "provider_wallets" ADD CONSTRAINT "chk_provider_wallets_paid_out_non_negative" 
  CHECK ("paid_out_balance_paisa" >= 0);

ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "chk_wallet_ledger_amount_positive" 
  CHECK ("amount_paisa" > 0);

ALTER TABLE "reviews" ADD CONSTRAINT "chk_reviews_rating_range" 
  CHECK ("rating" >= 1 AND "rating" <= 5);

ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_amount_positive" 
  CHECK ("amount_paisa" > 0);
