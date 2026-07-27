import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 70: aplica retroativamente a tag de nível (INICIANTE/INTERMEDIARIO/
// AVANCADO) aos templates PREMIUM cujo nível foi confirmado pelo fundador.
const LEVELS: Record<string, "INICIANTE" | "INTERMEDIARIO" | "AVANCADO"> = {
  "Hipertrofia Express 3X": "INICIANTE",
  "Metabolic Burn 40": "INTERMEDIARIO",
  "Esculpimento Express": "INTERMEDIARIO",
  "Força & Volume 40": "AVANCADO",
  "Pico de Hipertrofia 5X": "AVANCADO",
  "Bumbum na Nuca Extreme": "AVANCADO",
  "Corpo Esculpido Pro": "AVANCADO",
  "Corpo Trincado Extreme": "AVANCADO",
  "Definição Total": "INTERMEDIARIO",
  "Força & Volume Titã": "INTERMEDIARIO",
  "Hipertrofia Extrema Pro": "AVANCADO",
  "Metabolic Shred Pro": "AVANCADO",
  "Monster Mass": "INTERMEDIARIO",
  "Pernas Magníficas": "INTERMEDIARIO",
  "Queima Fatal 360": "INTERMEDIARIO",
  "Shape Inabalável": "INTERMEDIARIO",
  "Silhueta Ampulheta": "AVANCADO",
  "V-Taper Master": "INTERMEDIARIO",
};

async function main() {
  for (const [name, level] of Object.entries(LEVELS)) {
    const program = await prisma.workoutProgram.findFirst({
      where: { name, origin: "SELF", isTemplate: true },
    });
    if (!program) {
      console.log(`Aviso: programa "${name}" não encontrado — pulado.`);
      continue;
    }
    if (program.tags.includes(level)) {
      console.log(`  "${name}" já tem a tag ${level} — pulado.`);
      continue;
    }
    const tags = Array.from(new Set([...program.tags, level]));
    await prisma.workoutProgram.update({ where: { id: program.id }, data: { tags } });
    console.log(`  "${name}" -> tags: ${tags.join(", ")}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
