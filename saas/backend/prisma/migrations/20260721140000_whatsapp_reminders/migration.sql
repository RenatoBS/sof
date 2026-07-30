-- AlterTable
ALTER TABLE "Account" ADD COLUMN "whatsappReminderMinutes" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "Account" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "reminderClaimedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Appointment_status_reminderSentAt_date_idx" ON "Appointment"("status", "reminderSentAt", "date");
