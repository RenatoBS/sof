-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'service';
ALTER TABLE "Appointment" ADD COLUMN     "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Appointment" ADD COLUMN     "durationMinutes" INTEGER;
ALTER TABLE "Appointment" ADD COLUMN     "recurrenceGroupId" TEXT;

-- AlterTable: serviceId e clientName passam a opcionais / default
ALTER TABLE "Appointment" ALTER COLUMN "serviceId" DROP NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "clientName" SET DEFAULT '';
ALTER TABLE "Appointment" ALTER COLUMN "price" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "Appointment_recurrenceGroupId_idx" ON "Appointment"("recurrenceGroupId");
