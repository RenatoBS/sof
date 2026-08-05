-- Reverte o campo acidental na Account; o link de pagamento fica só em Product.
ALTER TABLE "Account" DROP COLUMN IF EXISTS "paymentLinkUrl";
