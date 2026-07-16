-- Login do profissional: e-mail + senha + troca obrigatória no 1º acesso

ALTER TABLE "Employee" ADD COLUMN "email" TEXT;
ALTER TABLE "Employee" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Employee" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
