import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 55: `applySelfTemplateToAluno` passou a copiar `bannerImageUrl` do
// template pra instância aplicada, mas instâncias aplicadas ANTES dessa
// correção ficaram com o banner nulo mesmo tendo um template-fonte com
// banner. Script único, idempotente (só atualiza quando o banner difere),
// pareando por nome do programa contra os templates SELF que têm banner.
async function main() {
  const applied = await prisma.workoutProgram.findMany({
    where: { origin: "SELF", isTemplate: false, bannerImageUrl: null },
  });

  if (applied.length === 0) {
    console.log("Nenhuma instância aplicada com banner nulo — nada a fazer.");
    return;
  }

  let updated = 0;
  for (const instance of applied) {
    const sourceTemplate = await prisma.workoutProgram.findFirst({
      where: { origin: "SELF", isTemplate: true, name: instance.name, bannerImageUrl: { not: null } },
    });
    if (!sourceTemplate) {
      console.log(`  Sem template-fonte com banner pra "${instance.name}" (id=${instance.id}) — pulado.`);
      continue;
    }
    await prisma.workoutProgram.update({
      where: { id: instance.id },
      data: { bannerImageUrl: sourceTemplate.bannerImageUrl },
    });
    console.log(`  Atualizado: "${instance.name}" (id=${instance.id}) <- banner de "${sourceTemplate.name}"`);
    updated++;
  }

  console.log(`Instâncias aplicadas verificadas: ${applied.length}, atualizadas: ${updated}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
