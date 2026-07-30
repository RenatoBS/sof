-- Senha definida no checkout (hash) em vez de senha temporária gerada.
ALTER TABLE "CheckoutSession" RENAME COLUMN "tempPassword" TO "passwordHash";
