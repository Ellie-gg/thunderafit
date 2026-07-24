-- Evolui PlanoAssinatura de 2 estados (FREE/PAGO) para 3 degraus
-- (FREE/BASE/PLUS). Nenhum usuário real tem PAGO hoje (Stripe segue inativo
-- em produção, sem STRIPE_* configurado), mas a migration mapeia PAGO -> BASE
-- de forma segura mesmo assim, em vez de assumir que a tabela está vazia.

ALTER TYPE "PlanoAssinatura" RENAME TO "PlanoAssinatura_old";

CREATE TYPE "PlanoAssinatura" AS ENUM ('FREE', 'BASE', 'PLUS');

ALTER TABLE "users" ALTER COLUMN "planoAssinatura" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "planoAssinatura" TYPE "PlanoAssinatura" USING (
  CASE "planoAssinatura"::text
    WHEN 'PAGO' THEN 'BASE'
    ELSE "planoAssinatura"::text
  END::"PlanoAssinatura"
);
ALTER TABLE "users" ALTER COLUMN "planoAssinatura" SET DEFAULT 'FREE';

DROP TYPE "PlanoAssinatura_old";
