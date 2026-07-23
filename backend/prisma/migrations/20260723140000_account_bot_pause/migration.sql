-- AlterTable
ALTER TABLE "Account" ADD COLUMN "botPausedPermanent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "botPausedUntil" TIMESTAMP(3);
