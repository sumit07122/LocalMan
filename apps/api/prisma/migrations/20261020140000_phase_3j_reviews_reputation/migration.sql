-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN', 'REMOVED', 'FLAGGED');

-- AlterTable
ALTER TABLE "reviews" 
    ADD COLUMN "title" VARCHAR(120),
    ADD COLUMN "body" TEXT,
    ADD COLUMN "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN "provider_response" TEXT,
    ADD COLUMN "provider_responded_at" TIMESTAMP(3),
    ADD COLUMN "moderated_at" TIMESTAMP(3),
    ADD COLUMN "moderated_by" TEXT,
    ADD COLUMN "moderation_reason" TEXT,
    ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "review_reports" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "details" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_reviews_booking_customer" ON "reviews"("booking_id", "customer_id");
CREATE INDEX "idx_reviews_provider_status" ON "reviews"("provider_id", "status");
CREATE INDEX "idx_reviews_customer" ON "reviews"("customer_id");
CREATE INDEX "idx_reviews_status" ON "reviews"("status");
CREATE INDEX "idx_reviews_created_at" ON "reviews"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_review_report_per_user" ON "review_reports"("review_id", "reporter_id");
CREATE INDEX "idx_review_reports_review" ON "review_reports"("review_id");
CREATE INDEX "idx_review_reports_reporter" ON "review_reports"("reporter_id");
CREATE INDEX "idx_review_reports_status" ON "review_reports"("status");

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
