-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "canHandleHandoffs" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WhatsappHandoff" ADD COLUMN "assigneeType" TEXT,
ADD COLUMN "assignedEmployeeId" TEXT,
ADD COLUMN "assignedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WhatsappMessage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "handoffId" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "senderKind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "agentEmployeeId" TEXT,
    "sentByAccountOwner" BOOLEAN NOT NULL DEFAULT false,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappMessage_handoffId_createdAt_idx" ON "WhatsappMessage"("handoffId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappMessage_accountId_customerPhone_createdAt_idx" ON "WhatsappMessage"("accountId", "customerPhone", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappMessage_providerMessageId_idx" ON "WhatsappMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsappHandoff_assignedEmployeeId_idx" ON "WhatsappHandoff"("assignedEmployeeId");

-- AddForeignKey
ALTER TABLE "WhatsappHandoff" ADD CONSTRAINT "WhatsappHandoff_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_handoffId_fkey" FOREIGN KEY ("handoffId") REFERENCES "WhatsappHandoff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_agentEmployeeId_fkey" FOREIGN KEY ("agentEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
