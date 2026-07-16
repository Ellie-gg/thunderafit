// Bootstrap do primeiro usuário ADMIN (Fase 14).
// Não faz parte do `db:seed` automático de propósito — criar um admin não é
// algo que deve acontecer sozinho a cada `docker-compose up`/deploy. Rodar
// manualmente quando precisar: `npm run db:seed:admin`.
//
// Idempotente: se ADMIN_EMAIL já existir, apenas confirma e não sobrescreve
// nada (nem promove um usuário existente de outro role — isso seria uma
// ação distinta e mais perigosa, fora do escopo deste script).
import bcrypt from "bcrypt";
import prisma from "../src/lib/prisma";

const BCRYPT_SALT_ROUNDS = 12;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${key}. Defina ADMIN_EMAIL e ADMIN_PASSWORD antes de rodar este script.`
    );
  }
  return value;
}

async function main() {
  const email = requireEnv("ADMIN_EMAIL");
  const password = requireEnv("ADMIN_PASSWORD");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuário ${email} já existe (role: ${existing.role}). Nada a fazer.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Admin criado: ${admin.email} (id: ${admin.id}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
