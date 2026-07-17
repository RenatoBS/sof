-- AlterTable
ALTER TABLE "Client" ADD COLUMN "botPausedPermanent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN "botPausedUntil" TIMESTAMP(3);
