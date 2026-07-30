-- Agendado (antes confirmed) + Concluído
ALTER TABLE "Appointment" ALTER COLUMN "status" SET DEFAULT 'scheduled';

UPDATE "Appointment"
SET "status" = 'scheduled'
WHERE "status" = 'confirmed';

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
