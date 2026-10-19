-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('BOOKING_CHARGE', 'CUSTOMER_PAYMENT', 'PLATFORM_COMMISSION', 'STATUTORY_TDS', 'PROVIDER_GROSS_EARNING', 'PROVIDER_NET_EARNING', 'REFUND', 'PAYOUT_CREATED', 'PAYOUT_PROCESSING', 'PAYOUT_COMPLETED', 'PAYOUT_FAILED', 'PAYOUT_REVERSED', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- AlterTable
ALTER TABLE "provider_payouts" ADD COLUMN "applied_commission_rate" DECIMAL(5,2),
ADD COLUMN "applied_tds_rate" DECIMAL(5,2),
ADD COLUMN "failure_reason" TEXT,
ADD COLUMN "idempotency_key" VARCHAR(120);

-- CreateTable
CREATE TABLE "provider_wallets" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "available_balance_paisa" INTEGER NOT NULL DEFAULT 0,
    "pending_balance_paisa" INTEGER NOT NULL DEFAULT 0,
    "paid_out_balance_paisa" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(5) NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledger_entries" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "payout_id" TEXT,
    "entry_type" "LedgerEntryType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount_paisa" INTEGER NOT NULL,
    "currency" VARCHAR(5) NOT NULL DEFAULT 'INR',
    "resulting_available_paisa" INTEGER NOT NULL,
    "resulting_pending_paisa" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(120),
    "source_reference_id" VARCHAR(120),
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_payouts_idempotency_key_key" ON "provider_payouts"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "provider_wallets_provider_id_key" ON "provider_wallets"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_ledger_entries_idempotency_key_key" ON "wallet_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_ledger_provider_created" ON "wallet_ledger_entries"("provider_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_ledger_wallet_created" ON "wallet_ledger_entries"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_ledger_booking" ON "wallet_ledger_entries"("booking_id");

-- AddForeignKey
ALTER TABLE "provider_wallets" ADD CONSTRAINT "provider_wallets_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "provider_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "provider_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
