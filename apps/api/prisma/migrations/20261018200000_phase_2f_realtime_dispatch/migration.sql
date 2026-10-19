-- CreateEnum
CREATE TYPE "DispatchOfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "dispatch_offers" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "status" "DispatchOfferStatus" NOT NULL DEFAULT 'OFFERED',
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_dispatch_offers_booking" ON "dispatch_offers"("booking_id", "status");

-- CreateIndex
CREATE INDEX "idx_dispatch_offers_provider" ON "dispatch_offers"("provider_id", "status");

-- CreateIndex
CREATE INDEX "idx_dispatch_offers_expiration" ON "dispatch_offers"("expires_at", "status");

-- AddForeignKey
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
