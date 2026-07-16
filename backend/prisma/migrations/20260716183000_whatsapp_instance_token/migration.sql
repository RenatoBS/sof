-- AlterTable
ALTER TABLE "Account" ADD COLUMN "whatsappInstanceToken" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Account" ADD COLUMN "whatsappConnectedAt" TIMESTAMP(3);
