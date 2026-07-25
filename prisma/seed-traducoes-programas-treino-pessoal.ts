import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 55: traduções EN/ES do NOME dos 6 templates "Meu treino pessoal"
// (3 "Treino em Casa" + 3 "Treinos Prontos") e suas ~18 sessões — mesmo
// padrão de prisma/seed-traducoes-treino-em-casa.ts (upsert idempotente por
// nome PT exato, nunca cria linha de tradução em PT).
interface ProgramTranslation {
  name: string;
  EN: string;
  ES: string;
  sessions: Array<{ name: string; EN: string; ES: string }>;
}

const PROGRAM_TRANSLATIONS: ProgramTranslation[] = [
  {
    name: "Hipertrofia & Força em Casa",
    EN: "Strength & Hypertrophy at Home",
    ES: "Hipertrofia y Fuerza en Casa",
    sessions: [
      { name: "Peito, Ombro e Tríceps", EN: "Chest, Shoulders & Triceps", ES: "Pecho, Hombro y Tríceps" },
      { name: "Membros Inferiores", EN: "Lower Body", ES: "Miembros Inferiores" },
      {
        name: "Costas, Bíceps, Antebraço e Core",
        EN: "Back, Biceps, Forearms & Core",
        ES: "Espalda, Bíceps, Antebrazo y Core",
      },
    ],
  },
  {
    name: "Seca Barriga em Casa",
    EN: "Belly Fat Burn at Home",
    ES: "Quema Abdomen en Casa",
    sessions: [
      { name: "Full Body Burn & Cardio", EN: "Full Body Burn & Cardio", ES: "Quema Full Body y Cardio" },
      { name: "Core Extremo e Definição", EN: "Extreme Core & Definition", ES: "Core Extremo y Definición" },
      { name: "Agilidade e Resistência", EN: "Agility & Endurance", ES: "Agilidad y Resistencia" },
    ],
  },
  {
    name: "Bumbum na Lua, Pernas & Core em Casa",
    EN: "Glutes, Legs & Core at Home",
    ES: "Glúteos, Piernas y Core en Casa",
    sessions: [
      { name: "Glúteos e Isquiotibiais", EN: "Glutes & Hamstrings", ES: "Glúteos e Isquiotibiales" },
      { name: "Coxas, Adutores e Abdutores", EN: "Thighs, Adductors & Abductors", ES: "Muslos, Aductores y Abductores" },
      {
        name: "Core, Quadril e Estabilidade Postural",
        EN: "Core, Hips & Postural Stability",
        ES: "Core, Cadera y Estabilidad Postural",
      },
    ],
  },
  {
    name: "Glúteos & Coxas Definitivo (ABC - Feminino)",
    EN: "Ultimate Glutes & Thighs (ABC - Female)",
    ES: "Glúteos y Piernas Definitivo (ABC - Femenino)",
    sessions: [
      { name: "Glúteos & Posterior", EN: "Glutes & Hamstrings", ES: "Glúteos y Posterior" },
      { name: "Membros Superiores & Postura", EN: "Upper Body & Posture", ES: "Miembros Superiores y Postura" },
      { name: "Quadríceps, Adutores & Panturrilha", EN: "Quads, Adductors & Calves", ES: "Cuádriceps, Aductores y Pantorrilla" },
    ],
  },
  {
    name: "Corpo Esculpido & Tônus (ABC - Feminino)",
    EN: "Sculpted Body & Tone (ABC - Female)",
    ES: "Cuerpo Esculpido y Tono (ABC - Femenino)",
    sessions: [
      { name: "Coxas, Glúteos & Panturrilhas", EN: "Thighs, Glutes & Calves", ES: "Muslos, Glúteos y Pantorrillas" },
      { name: "Costas, Peito, Ombro & Braços", EN: "Back, Chest, Shoulders & Arms", ES: "Espalda, Pecho, Hombro y Brazos" },
      { name: "Glúteos, Posterior & Cintura", EN: "Glutes, Hamstrings & Waist", ES: "Glúteos, Posterior y Cintura" },
    ],
  },
  {
    name: "Shape V: Hipertrofia (ABCD - Masculino/Geral)",
    EN: "V-Shape: Hypertrophy (ABCD - Male/General)",
    ES: "Shape V: Hipertrofia (ABCD - Masculino/General)",
    sessions: [
      { name: "Peito & Tríceps", EN: "Chest & Triceps", ES: "Pecho y Tríceps" },
      { name: "Costas & Bíceps", EN: "Back & Biceps", ES: "Espalda y Bíceps" },
      { name: "Pernas Completo", EN: "Complete Legs", ES: "Piernas Completo" },
      { name: "Ombros, Trapézio & Core", EN: "Shoulders, Traps & Core", ES: "Hombros, Trapecio y Core" },
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
