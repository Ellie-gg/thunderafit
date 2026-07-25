import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 57: traduções EN/ES dos 10 templates "Treinos Premium" (Fase 57) e
// suas sessões — mesmo padrão idempotente de
// prisma/seed-traducoes-programas-treino-pessoal.ts.
interface ProgramTranslation {
  name: string;
  EN: string;
  ES: string;
  sessions: Array<{ name: string; EN: string; ES: string }>;
}

const PROGRAM_TRANSLATIONS: ProgramTranslation[] = [
  {
    name: "Bumbum na Nuca Extreme",
    EN: "Sky-High Booty Extreme",
    ES: "Glúteos Extremos al Cielo",
    sessions: [
      { name: "Quadríceps e Glúteos (Ênfase Anterior)", EN: "Quads & Glutes (Anterior Emphasis)", ES: "Cuádriceps y Glúteos (Énfasis Anterior)" },
      { name: "Membros Superiores e Core", EN: "Upper Body & Core", ES: "Miembros Superiores y Core" },
      { name: "Cadeia Posterior e Glúteos (Ênfase Posterior)", EN: "Posterior Chain & Glutes (Posterior Emphasis)", ES: "Cadena Posterior y Glúteos (Énfasis Posterior)" },
    ],
  },
  {
    name: "Silhueta Ampulheta",
    EN: "Hourglass Silhouette",
    ES: "Silueta de Reloj de Arena",
    sessions: [
      { name: "Glúteos e Abdutores", EN: "Glutes & Abductors", ES: "Glúteos y Abductores" },
      { name: "Costas, Ombros e Core", EN: "Back, Shoulders & Core", ES: "Espalda, Hombros y Core" },
      { name: "Quadríceps e Posterior de Coxa", EN: "Quads & Hamstrings", ES: "Cuádriceps e Isquiotibiales" },
      { name: "Peito, Braços e Abdômen", EN: "Chest, Arms & Abs", ES: "Pecho, Brazos y Abdomen" },
    ],
  },
  {
    name: "Pernas Magníficas",
    EN: "Magnificent Legs",
    ES: "Piernas Magníficas",
    sessions: [
      { name: "Quadríceps Dominante", EN: "Quad Dominant", ES: "Cuádriceps Dominante" },
      { name: "Dorsal, Deltoides e Tríceps", EN: "Lats, Delts & Triceps", ES: "Dorsal, Deltoides y Tríceps" },
      { name: "Posterior de Coxa e Glúteo Máximo", EN: "Hamstrings & Gluteus Maximus", ES: "Isquiotibiales y Glúteo Mayor" },
      { name: "Glúteo Isolado, Abdutores e Core", EN: "Glute Isolation, Abductors & Core", ES: "Glúteo Aislado, Abductores y Core" },
    ],
  },
  {
    name: "Corpo Esculpido Pro",
    EN: "Sculpted Body Pro",
    ES: "Cuerpo Esculpido Pro",
    sessions: [
      { name: "Glúteo Foco Total", EN: "Total Glute Focus", ES: "Glúteo Foco Total" },
      { name: "Costas e Bíceps", EN: "Back & Biceps", ES: "Espalda y Bíceps" },
      { name: "Quadríceps e Adutores", EN: "Quads & Adductors", ES: "Cuádriceps y Aductores" },
      { name: "Ombros, Peito e Tríceps", EN: "Shoulders, Chest & Triceps", ES: "Hombros, Pecho y Tríceps" },
      { name: "Posterior de Coxa, Panturrilhas e Core", EN: "Hamstrings, Calves & Core", ES: "Isquiotibiales, Pantorrillas y Core" },
    ],
  },
  {
    name: "Definição de Conjunto",
    EN: "Total Definition",
    ES: "Definición Total",
    sessions: [
      { name: "Cadeia Anterior (Quadríceps, Peito e Tríceps)", EN: "Anterior Chain (Quads, Chest & Triceps)", ES: "Cadena Anterior (Cuádriceps, Pecho y Tríceps)" },
      { name: "Cadeia Posterior (Glúteos, Posteriores e Costas)", EN: "Posterior Chain (Glutes, Hamstrings & Back)", ES: "Cadena Posterior (Glúteos, Isquiotibiales y Espalda)" },
      { name: "Deltoides, Adutores/Abdutores e Core", EN: "Delts, Adductors/Abductors & Core", ES: "Deltoides, Aductores/Abductores y Core" },
    ],
  },
  {
    name: "Hipertrofia Extrema Pro",
    EN: "Extreme Hypertrophy Pro",
    ES: "Hipertrofia Extrema Pro",
    sessions: [
      { name: "Peito e Tríceps", EN: "Chest & Triceps", ES: "Pecho y Tríceps" },
      { name: "Costas e Bíceps", EN: "Back & Biceps", ES: "Espalda y Bíceps" },
      { name: "Quadríceps e Panturrilhas", EN: "Quads & Calves", ES: "Cuádriceps y Pantorrillas" },
      { name: "Ombros e Trapézio", EN: "Shoulders & Traps", ES: "Hombros y Trapecio" },
      { name: "Posterior de Coxa e Core", EN: "Hamstrings & Core", ES: "Isquiotibiales y Core" },
    ],
  },
  {
    name: "Shape Inabalável",
    EN: "Unshakeable Shape",
    ES: "Shape Inquebrantable",
    sessions: [
      { name: "Peito e Deltoide Anterior/Medial", EN: "Chest & Anterior/Medial Delts", ES: "Pecho y Deltoide Anterior/Medial" },
      { name: "Costas e Deltoide Posterior", EN: "Back & Posterior Delts", ES: "Espalda y Deltoide Posterior" },
      { name: "Membros Inferiores Completo", EN: "Complete Lower Body", ES: "Miembros Inferiores Completo" },
      { name: "Braços (Bíceps/Tríceps/Antebraço) e Core", EN: "Arms (Biceps/Triceps/Forearms) & Core", ES: "Brazos (Bíceps/Tríceps/Antebrazo) y Core" },
    ],
  },
  {
    name: "V-Taper Master",
    EN: "V-Taper Master",
    ES: "V-Taper Master",
    sessions: [
      { name: "Push (Empurrar)", EN: "Push", ES: "Push (Empuje)" },
      { name: "Pull (Puxar)", EN: "Pull", ES: "Pull (Tracción)" },
      { name: "Legs (Pernas e Core)", EN: "Legs & Core", ES: "Legs (Piernas y Core)" },
    ],
  },
  {
    name: "Monster Mass",
    EN: "Monster Mass",
    ES: "Masa Monstruosa",
    sessions: [
      { name: "Peito Dominante", EN: "Chest Dominant", ES: "Pecho Dominante" },
      { name: "Costas e Trapézio", EN: "Back & Traps", ES: "Espalda y Trapecio" },
      { name: "Quadríceps e Panturrilhas", EN: "Quads & Calves", ES: "Cuádriceps y Pantorrillas" },
      { name: "Ombros Completo", EN: "Complete Shoulders", ES: "Hombros Completo" },
      { name: "Posterior, Braços e Core", EN: "Hamstrings, Arms & Core", ES: "Isquiotibiales, Brazos y Core" },
    ],
  },
  {
    name: "Força & Volume Titã",
    EN: "Titan Strength & Volume",
    ES: "Fuerza y Volumen Titán",
    sessions: [
      { name: "Upper Body (Foco Peito e Costas Pesado)", EN: "Upper Body (Heavy Chest & Back Focus)", ES: "Upper Body (Foco Pecho y Espalda Pesado)" },
      { name: "Lower Body (Foco Quadríceps e Panturrilha)", EN: "Lower Body (Quads & Calves Focus)", ES: "Lower Body (Foco Cuádriceps y Pantorrilla)" },
      { name: "Upper Body (Foco Ombros e Braços)", EN: "Upper Body (Shoulders & Arms Focus)", ES: "Upper Body (Foco Hombros y Brazos)" },
      { name: "Lower Body (Foco Posterior, Glúteo e Core)", EN: "Lower Body (Hamstrings, Glutes & Core Focus)", ES: "Lower Body (Foco Isquiotibiales, Glúteo y Core)" },
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
        create: { workoutProgramId: program.id, locale, name: item[locale] },
        update: { name: item[locale] },
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
