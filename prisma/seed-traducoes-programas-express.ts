import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 69: traduções EN/ES dos 5 templates PREMIUM com tag EXPRESS e suas
// sessões — mesmo padrão idempotente de
// prisma/seed-traducoes-programas-premium-emagrecimento.ts.
interface ProgramTranslation {
  name: string;
  EN: string;
  ES: string;
  description: { EN: string; ES: string };
  sessions: Array<{ name: string; EN: string; ES: string }>;
}

const PROGRAM_TRANSLATIONS: ProgramTranslation[] = [
  {
    name: "Hipertrofia Express 3X",
    EN: "Express Hypertrophy 3X",
    ES: "Hipertrofia Express 3X",
    description: {
      EN: "Express 3x/week training for beginners to build muscle with lean 4-exercise sessions, prioritizing compound movements and good technique in about 30 minutes per session.",
      ES: "Entrenamiento express de 3x por semana para que los principiantes ganen hipertrofia con sesiones ágiles de 4 ejercicios, priorizando movimientos compuestos y buena técnica en unos 30 minutos por sesión.",
    },
    sessions: [
      { name: "Peito, Ombro e Tríceps", EN: "Chest, Shoulders & Triceps", ES: "Pecho, Hombros y Tríceps" },
      { name: "Costas, Bíceps e Core", EN: "Back, Biceps & Core", ES: "Espalda, Bíceps y Core" },
      { name: "Pernas e Panturrilha", EN: "Legs & Calves", ES: "Piernas y Pantorrillas" },
    ],
  },
  {
    name: "Metabolic Burn 40",
    EN: "Metabolic Burn 40",
    ES: "Metabolic Burn 40",
    description: {
      EN: "High metabolic density Push/Pull/Legs split for sessions of up to 40 minutes, combining supersets and rest-pause to maximize hypertrophic stimulus with reduced volume.",
      ES: "División Push/Pull/Legs de alta densidad metabólica para sesiones de hasta 40 minutos, combinando bi-sets y rest-pause para maximizar el estímulo hipertrófico con volumen reducido.",
    },
    sessions: [
      { name: "Push (Peito, Ombro e Tríceps)", EN: "Push (Chest, Shoulders & Triceps)", ES: "Push (Pecho, Hombros y Tríceps)" },
      { name: "Pull (Costas e Bíceps)", EN: "Pull (Back & Biceps)", ES: "Pull (Espalda y Bíceps)" },
      { name: "Legs (Pernas)", EN: "Legs", ES: "Legs (Piernas)" },
    ],
  },
  {
    name: "Esculpimento Express",
    EN: "Express Sculpting",
    ES: "Esculpido Express",
    description: {
      EN: "4-session split focused on definition and muscle symmetry, with a dedicated arms-and-core superset day to optimize time and intensity.",
      ES: "División de 4 sesiones enfocada en la definición y simetría muscular, con un día dedicado a brazos y core en bi-sets antagonistas para optimizar tiempo e intensidad.",
    },
    sessions: [
      { name: "Peito e Ombro", EN: "Chest & Shoulders", ES: "Pecho y Hombros" },
      { name: "Costas", EN: "Back", ES: "Espalda" },
      { name: "Pernas e Glúteo", EN: "Legs & Glutes", ES: "Piernas y Glúteo" },
      { name: "Braços e Core (Bi-Sets)", EN: "Arms & Core (Supersets)", ES: "Brazos y Core (Bi-Sets)" },
    ],
  },
  {
    name: "Força & Volume 40",
    EN: "Strength & Volume 40",
    ES: "Fuerza y Volumen 40",
    description: {
      EN: "Advanced 4-session split combining strength (low reps, heavy loads) with hypertrophic volume, using cluster sets on the heavy basics to sustain intensity within 40 minutes.",
      ES: "División avanzada de 4 sesiones que combina fuerza (bajas repeticiones, cargas altas) con volumen hipertrófico, usando cluster sets en los básicos pesados para sostener la intensidad en 40 minutos.",
    },
    sessions: [
      { name: "Pernas (Força)", EN: "Legs (Strength)", ES: "Piernas (Fuerza)" },
      { name: "Peito e Tríceps", EN: "Chest & Triceps", ES: "Pecho y Tríceps" },
      { name: "Costas e Bíceps", EN: "Back & Biceps", ES: "Espalda y Bíceps" },
      { name: "Ombro e Core", EN: "Shoulders & Core", ES: "Hombro y Core" },
    ],
  },
  {
    name: "Pico de Hipertrofia 5X",
    EN: "Hypertrophy Peak 5X",
    ES: "Pico de Hipertrofia 5X",
    description: {
      EN: "Advanced 5-session split for experienced trainees chasing peak hypertrophy, combining antagonist supersets, rest-pause and myo-reps in a high-density, short-duration protocol.",
      ES: "División avanzada de 5 sesiones para practicantes experimentados que buscan el pico de hipertrofia, combinando bi-sets antagonistas, rest-pause y myo-reps en un protocolo de alta densidad y corta duración.",
    },
    sessions: [
      { name: "Peito", EN: "Chest", ES: "Pecho" },
      { name: "Costas", EN: "Back", ES: "Espalda" },
      { name: "Pernas", EN: "Legs", ES: "Piernas" },
      { name: "Ombro e Trapézio", EN: "Shoulders & Traps", ES: "Hombro y Trapecio" },
      { name: "Braços (Myo-Reps)", EN: "Arms (Myo-Reps)", ES: "Brazos (Myo-Reps)" },
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
