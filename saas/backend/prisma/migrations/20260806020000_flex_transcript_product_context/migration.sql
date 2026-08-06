-- AlterTable
ALTER TABLE "WhatsappHandoff" ADD COLUMN "contextJson" JSONB;

-- AlterTable
ALTER TABLE "WhatsappMessage" ALTER COLUMN "handoffId" DROP NOT NULL;
