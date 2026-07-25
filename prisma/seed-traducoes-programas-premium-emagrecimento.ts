import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 60: traduções EN/ES dos 3 templates PREMIUM de emagrecimento/EPOC e
// suas sessões — mesmo padrão idempotente de
// prisma/seed-traducoes-programas-premium.ts.
interface ProgramTranslation {
  name: string;
  EN: string;
  ES: string;
  description: { EN: string; ES: string };
  sessions: Array<{ name: string; EN: string; ES: string }>;
}

const PROGRAM_TRANSLATIONS: ProgramTranslation[] = [
  {
    name: "Queima Fatal 360",
    EN: "Fatal Burn 360",
    ES: "Quema Fatal 360",
    description: {
      EN: "Accelerated fat loss through high metabolic density, elevated EPOC and lean-mass preservation.",
      ES: "Adelgazamiento acelerado y quema de grasa corporal mediante alta densidad metabólica, elevación del EPOC y preservación de la masa magra.",
    },
    sessions: [
      { name: "Inferiores e Cardio Metabólico", EN: "Lower Body & Metabolic Cardio", ES: "Miembros Inferiores y Cardio Metabólico" },
      { name: "Superiores e Core Metabólico", EN: "Upper Body & Metabolic Core", ES: "Miembros Superiores y Core Metabólico" },
      { name: "Full Body Burn", EN: "Full Body Burn", ES: "Full Body Burn" },
    ],
  },
  {
    name: "Metabolic Shred Pro",
    EN: "Metabolic Shred Pro",
    ES: "Metabolic Shred Pro",
    description: {
      EN: "Fat loss, extreme muscle definition and body recomposition combining major muscle groups with high-intensity metabolic stimuli.",
      ES: "Adelgazamiento, definición muscular extrema y recomposición corporal combinando grandes grupos musculares con estímulos metabólicos de alta intensidad.",
    },
    sessions: [
      { name: "Peito, Costas e Cardio Dense", EN: "Chest, Back & Dense Cardio", ES: "Pecho, Espalda y Cardio Denso" },
      { name: "Quadríceps, Glúteos e Densidade", EN: "Quads, Glutes & Density", ES: "Cuádriceps, Glúteos y Densidad" },
      { name: "Ombros, Braços e Core Burn", EN: "Shoulders, Arms & Core Burn", ES: "Hombros, Brazos y Core Burn" },
      { name: "Posterior, Panturrilhas e HIIT Extreme", EN: "Hamstrings, Calves & Extreme HIIT", ES: "Isquiotibiales, Pantorrillas y HIIT Extremo" },
    ],
  },
  {
    name: "Corpo Trincado Extreme",
    EN: "Shredded Body Extreme",
    ES: "Cuerpo Definido Extremo",
    description: {
      EN: "Maximum weekly caloric deficit driven by high-voltage, high-density training, accelerating fat loss without losing tone.",
      ES: "Máximo déficit calórico semanal inducido por entrenamiento de alto voltaje y densidad muscular, acelerando la quema de grasa sin perder tonicidad.",
    },
    sessions: [
      { name: "Legs & Cardio Burn (Anterior)", EN: "Legs & Cardio Burn (Anterior)", ES: "Legs & Cardio Burn (Anterior)" },
      { name: "Push Shred (Peito, Ombros e Tríceps)", EN: "Push Shred (Chest, Shoulders & Triceps)", ES: "Push Shred (Pecho, Hombros y Tríceps)" },
      { name: "Pull Shred (Costas, Bíceps e Core)", EN: "Pull Shred (Back, Biceps & Core)", ES: "Pull Shred (Espalda, Bíceps y Core)" },
      { name: "Posterior, Glúteo e Hi-Voltage", EN: "Hamstrings, Glutes & Hi-Voltage", ES: "Isquiotibiales, Glúteo y Hi-Voltage" },
      { name: "Full Body Metabolic Conditioning", EN: "Full Body Metabolic Conditioning", ES: "Full Body Metabolic Conditioning" },
    ],
  },
];

async function main() {
  let programsTranslated = 0;
  let sessionsTranslated = 0;

  for (const item of PROGRAM_TRANSLATIONS) {
    const program = await prisma.workoutProgram.findFirst({
      where: { name: item.name, origin: "SELF", isTemplate: true },
      include: { workouts: true },
    });
    if (!program) {
      console.log(`Aviso: programa "${item.name}" não encontrado — pulado.`);
      continue;
    }

    for (const locale of ["EN", "ES"] as const) {
      await prisma.workoutProgramTranslation.upsert({
        where: { workoutProgramId_locale: { workoutProgramId: program.id, locale } },
        create: { workoutProgramId: program.id, locale, name: item[locale], description: item.description[locale] },
        update: { name: item[locale], description: item.description[locale] },
      });
    }
    programsTranslated++;

    for (const sessionItem of item.sessions) {
      const workout = program.workouts.find((w) => w.name === sessionItem.name);
      if (!workout) {
        console.log(`  Aviso: sessão "${sessionItem.name}" não encontrada em "${item.name}" — pulada.`);
        continue;
      }
      for (const locale of ["EN", "ES"] as const) {
        await prisma.workoutTranslation.upsert({
          where: { workoutId_locale: { workoutId: workout.id, locale } },
          create: { workoutId: workout.id, locale, name: sessionItem[locale] },
          update: { name: sessionItem[locale] },
        });
      }
      sessionsTranslated++;
    }
  }

  console.log(`Programas traduzidos: ${programsTranslated}/${PROGRAM_TRANSLATIONS.length}`);
  console.log(`Sessões traduzidas: ${sessionsTranslated}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
