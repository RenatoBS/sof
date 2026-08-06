-- AlterTable
ALTER TABLE "Account" ADD COLUMN "botMenuOfferHuman" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "botMenuShowAddress" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "botMenuShowHours" BOOLEAN NOT NULL DEFAULT false;
