-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "job_description" TEXT,
ADD COLUMN "address_snapshot" JSONB,
ADD COLUMN "pricing_snapshot" JSONB,
ADD COLUMN "service_snapshot" JSONB,
ADD COLUMN "idempotency_key" VARCHAR(100),
ADD COLUMN "idempotency_payload_hash" VARCHAR(64),
ADD COLUMN "attachments" JSONB;

-- CreateIndex
CREATE INDEX "idx_bookings_customer_idempotency" ON "bookings"("customer_id", "idempotency_key");
