-- CreateTable
CREATE TABLE "EmployeePasswordToken" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePasswordToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePasswordToken_tokenHash_key" ON "EmployeePasswordToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmployeePasswordToken_employeeId_idx" ON "EmployeePasswordToken"("employeeId");

-- AddForeignKey
ALTER TABLE "EmployeePasswordToken" ADD CONSTRAINT "EmployeePasswordToken_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
