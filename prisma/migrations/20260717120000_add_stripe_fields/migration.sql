-- Fase 20 (billing Stripe): vínculo do User com o Stripe. Aditiva.
-- Colunas nullable (usuário FREE nunca teve interação com o Stripe) e índice
-- único em stripeCustomerId para o lookup reverso do webhook (customer -> user).
ALTER TABLE "users" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "users" ADD COLUMN "stripeSubscriptionId" TEXT;
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");
