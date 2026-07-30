-- AlterTable
ALTER TABLE "Plan" ADD COLUMN "entitlements" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "planId" TEXT;

-- CreateIndex
CREATE INDEX "Account_planId_idx" ON "Account"("planId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill planId by exact name match, then legacy aliases
UPDATE "Account" AS a
SET "planId" = p.id
FROM "Plan" AS p
WHERE a."planId" IS NULL
  AND a.plan = p.name;

UPDATE "Account" AS a
SET "planId" = p.id
FROM "Plan" AS p
WHERE a."planId" IS NULL
  AND a.plan = 'Essencial'
  AND p.name = 'Solo';

UPDATE "Account" AS a
SET "planId" = p.id
FROM "Plan" AS p
WHERE a."planId" IS NULL
  AND a.plan = 'Estúdio'
  AND p.name = 'Equipe';
