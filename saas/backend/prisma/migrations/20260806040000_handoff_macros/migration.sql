-- CreateTable
CREATE TABLE "HandoffMacro" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoffMacro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HandoffMacro_accountId_active_sortOrder_idx" ON "HandoffMacro"("accountId", "active", "sortOrder");

-- AddForeignKey
ALTER TABLE "HandoffMacro" ADD CONSTRAINT "HandoffMacro_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
