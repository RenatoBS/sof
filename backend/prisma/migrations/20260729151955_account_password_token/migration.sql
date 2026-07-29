-- CreateTable
CREATE TABLE "AccountPasswordToken" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountPasswordToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountPasswordToken_tokenHash_key" ON "AccountPasswordToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountPasswordToken_accountId_idx" ON "AccountPasswordToken"("accountId");

-- AddForeignKey
ALTER TABLE "AccountPasswordToken" ADD CONSTRAINT "AccountPasswordToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
