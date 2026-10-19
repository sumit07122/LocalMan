-- AlterTable
ALTER TABLE "providers" ADD COLUMN "last_location_at" TIMESTAMP(3),
ADD COLUMN "current_accuracy_meters" DOUBLE PRECISION,
ADD COLUMN "current_heading" DOUBLE PRECISION,
ADD COLUMN "current_speed" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "idx_providers_online_location" ON "providers"("is_online", "last_location_at");

-- CreateTable
CREATE TABLE "provider_location_logs" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "source" VARCHAR(50) NOT NULL DEFAULT 'FOREGROUND_APP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_location_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_location_logs_provider_created" ON "provider_location_logs"("provider_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_location_logs_booking" ON "provider_location_logs"("booking_id");

-- AddForeignKey
ALTER TABLE "provider_location_logs" ADD CONSTRAINT "provider_location_logs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_location_logs" ADD CONSTRAINT "provider_location_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
