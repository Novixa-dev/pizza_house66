-- Coupons a customer can be given, and the loyalty counter that earns them.
--
-- A Promotion is the offer; a CouponGrant is one person's single-use claim on
-- it. Splitting them is what lets the same reward go to many regulars as many
-- codes that each work once.

CREATE TYPE "PromotionVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'EARNED');

ALTER TABLE "Promotion"
  ADD COLUMN "perCustomerLimit" INTEGER,
  ADD COLUMN "visibility" "PromotionVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Customer"
  ADD COLUMN "completedOrders" INTEGER NOT NULL DEFAULT 0;

-- Existing customers keep the count they have already earned, so nobody's
-- history is reset to zero by the feature that is meant to reward it.
UPDATE "Customer" AS c
SET "completedOrders" = sub.count
FROM (
  SELECT "customerId", COUNT(*)::int AS count
  FROM "Order"
  WHERE "customerId" IS NOT NULL AND "status" = 'COMPLETED'
  GROUP BY "customerId"
) AS sub
WHERE c."id" = sub."customerId";

CREATE TABLE "CouponGrant" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT 'loyalty',
  "milestone" INTEGER,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "redeemedAt" TIMESTAMP(3),
  "redeemedOrderId" TEXT,
  CONSTRAINT "CouponGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponGrant_code_key" ON "CouponGrant"("code");
CREATE UNIQUE INDEX "CouponGrant_redeemedOrderId_key" ON "CouponGrant"("redeemedOrderId");
CREATE INDEX "CouponGrant_customerId_redeemedAt_idx" ON "CouponGrant"("customerId", "redeemedAt");
CREATE INDEX "CouponGrant_promotionId_idx" ON "CouponGrant"("promotionId");
CREATE INDEX "Promotion_visibility_active_sortOrder_idx" ON "Promotion"("visibility", "active", "sortOrder");

ALTER TABLE "CouponGrant"
  ADD CONSTRAINT "CouponGrant_promotionId_fkey" FOREIGN KEY ("promotionId")
    REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CouponGrant_customerId_fkey" FOREIGN KEY ("customerId")
    REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CouponGrant_redeemedOrderId_fkey" FOREIGN KEY ("redeemedOrderId")
    REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
