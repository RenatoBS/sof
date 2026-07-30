-- Handoff de profissional + contador de "não entendi" no Employee
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "botUnresolvedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WhatsappHandoff" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "WhatsappHandoff" ADD COLUMN IF NOT EXISTS "party" TEXT NOT NULL DEFAULT 'client';

CREATE INDEX IF NOT EXISTS "WhatsappHandoff_employeeId_idx" ON "WhatsappHandoff"("employeeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WhatsappHandoff_employeeId_fkey'
  ) THEN
    ALTER TABLE "WhatsappHandoff"
      ADD CONSTRAINT "WhatsappHandoff_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
