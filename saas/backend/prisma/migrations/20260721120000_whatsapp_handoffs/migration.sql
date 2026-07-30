-- AlterTable
ALTER TABLE "Account" ADD COLUMN "whatsappHandoffThreshold" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "botUnresolvedCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WhatsappHandoff" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT,
    "customerPhone" TEXT NOT NULL,
    "customerName" TEXT NOT NULL DEFAULT '',
    "lastMessage" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "humanRepliedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappHandoff_accountId_status_openedAt_idx" ON "WhatsappHandoff"("accountId", "status", "openedAt");

-- CreateIndex
CREATE INDEX "WhatsappHandoff_accountId_customerPhone_status_idx" ON "WhatsappHandoff"("accountId", "customerPhone", "status");

-- AddForeignKey
ALTER TABLE "WhatsappHandoff" ADD CONSTRAINT "WhatsappHandoff_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappHandoff" ADD CONSTRAINT "WhatsappHandoff_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
