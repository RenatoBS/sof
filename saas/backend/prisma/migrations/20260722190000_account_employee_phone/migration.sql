-- AlterTable
ALTER TABLE "Account" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "CheckoutSession" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';
