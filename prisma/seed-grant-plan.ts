// Bootstrap de teste: concede um degrau pago (BASE/PLUS) a um usuário sem
// passar pelo Stripe de verdade. Usado só por specs E2E que testam recursos
// gated por plano (ex: disponibilidade no diretório) quando simular o
// checkout completo não é o que está sob teste — mesmo espírito de
// seed-admin.ts (bootstrap de estado sem caminho de self-service via HTTP).
// Nunca faz parte de nenhum fluxo de produção.
import prisma from "../src/lib/prisma";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${key}.`);
  }
  return value;
}

async function main() {
  const email = requireEnv("GRANT_EMAIL");
  const tier = requireEnv("GRANT_TIER");
  if (tier !== "BASE" && tier !== "PLUS") {
    throw new Error(`GRANT_TIER deve ser BASE ou PLUS, recebido: ${tier}`);
  }

  const limiteAlunos = tier === "PLUS" ? 1_000_000 : 20;
  const user = await prisma.user.update({
    where: { email },
    data: { planoAssinatura: tier, limiteAlunos },
  });
  console.log(`${user.email} agora está no plano ${tier}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
