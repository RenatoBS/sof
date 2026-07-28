-- AlterTable
ALTER TABLE "Account" ADD COLUMN "billingSource" TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE "Account" ADD COLUMN "promoExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PromoCoupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "freeDays" INTEGER NOT NULL,
    "maxUses" INTEGER NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoCoupon_code_key" ON "PromoCoupon"("code");

-- CreateIndex
CREATE INDEX "PromoCoupon_active_code_idx" ON "PromoCoupon"("active", "code");

-- CreateIndex
CREATE INDEX "PromoCoupon_planId_idx" ON "PromoCoupon"("planId");

-- CreateIndex
CREATE INDEX "PromoCouponRedemption_accountId_idx" ON "PromoCouponRedemption"("accountId");

-- CreateIndex
CREATE INDEX "PromoCouponRedemption_expiresAt_idx" ON "PromoCouponRedemption"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCouponRedemption_couponId_accountId_key" ON "PromoCouponRedemption"("couponId", "accountId");

-- CreateIndex
CREATE INDEX "Account_status_promoExpiresAt_idx" ON "Account"("status", "promoExpiresAt");

-- AddForeignKey
ALTER TABLE "PromoCoupon" ADD CONSTRAINT "PromoCoupon_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCouponRedemption" ADD CONSTRAINT "PromoCouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "PromoCoupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCouponRedemption" ADD CONSTRAINT "PromoCouponRedemption_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
