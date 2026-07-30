-- CreateTable
CREATE TABLE "EmployeeService" (
    "employeeId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "EmployeeService_pkey" PRIMARY KEY ("employeeId","serviceId")
);

-- CreateIndex
CREATE INDEX "EmployeeService_serviceId_idx" ON "EmployeeService"("serviceId");

-- AddForeignKey
ALTER TABLE "EmployeeService" ADD CONSTRAINT "EmployeeService_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeService" ADD CONSTRAINT "EmployeeService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: match specialty to service name (case-insensitive / simple aliases)
INSERT INTO "EmployeeService" ("employeeId", "serviceId")
SELECT e."id", s."id"
FROM "Employee" e
INNER JOIN "Service" s ON s."accountId" = e."accountId"
WHERE e."specialty" IS NOT NULL
  AND TRIM(e."specialty") <> ''
  AND (
    LOWER(TRIM(s."name")) = LOWER(TRIM(e."specialty"))
    OR (
      LOWER(TRIM(e."specialty")) IN ('cortes', 'corte')
      AND LOWER(TRIM(s."name")) = 'corte'
    )
    OR (
      LOWER(TRIM(e."specialty")) = 'barba'
      AND LOWER(TRIM(s."name")) = 'barba'
    )
    OR (
      LOWER(TRIM(e."specialty")) LIKE '%colora%'
      AND LOWER(TRIM(s."name")) LIKE '%colora%'
    )
  )
ON CONFLICT DO NOTHING;

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "specialty";
