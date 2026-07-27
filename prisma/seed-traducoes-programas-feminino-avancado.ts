import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 70: traduções EN/ES dos 4 novos templates PREMIUM femininos e suas
// sessões — mesmo padrão idempotente de
// prisma/seed-traducoes-programas-express.ts.
interface ProgramTranslation {
  name: string;
  EN: string;
  ES: string;
  description: { EN: string; ES: string };
  sessions: Array<{ name: string; EN: string; ES: string }>;
}

const PROGRAM_TRANSLATIONS: ProgramTranslation[] = [
  {
    name: "Cintura Fina & Bumbum VIP",
    EN: "Slim Waist & Booty VIP",
    ES: "Cintura Fina y Glúteo VIP",
    description: {
      EN: "Strengthening of the pelvic region and glutes, thigh firmness and core toning for a slim-waist effect, in a 4-day-per-week AB split.",
      ES: "Fortalecimiento de la región pélvica y glúteos, firmeza de muslo y tonificación del core para un efecto de cintura fina, en división AB de 4 días por semana.",
    },
    sessions: [
      { name: "Glúteos, Quadríceps e Core", EN: "Glutes, Quads & Core", ES: "Glúteos, Cuádriceps y Core" },
      { name: "Posterior, Superiores e Abdômen", EN: "Hamstrings, Upper Body & Abs", ES: "Isquiotibiales, Superiores y Abdomen" },
    ],
  },
  {
    name: "Curvas Definidas Pro",
    EN: "Defined Curves Pro",
    ES: "Curvas Definidas Pro",
    description: {
      EN: "Harmonious development of feminine body lines, back and shoulder strengthening for posture, and gradual hypertrophy stimulus, in a 3-to-5-day-per-week ABC split.",
      ES: "Desarrollo armonioso de las líneas corporales femeninas, fortalecimiento de espalda y hombros para la postura y estímulo gradual de hipertrofia muscular, en división ABC de 3 a 5 días por semana.",
    },
    sessions: [
      { name: "Coxas e Glúteos (Ênfase Anterior)", EN: "Thighs & Glutes (Anterior Emphasis)", ES: "Muslos y Glúteos (Énfasis Anterior)" },
      { name: "Dorsal, Ombros e Tonificação de Braços", EN: "Back, Shoulders & Arm Toning", ES: "Dorsal, Hombros y Tonificación de Brazos" },
      { name: "Posterior de Coxa, Glúteos e Abdômen", EN: "Hamstrings, Glutes & Abs", ES: "Isquiotibiales, Glúteos y Abdomen" },
    ],
  },
  {
    name: "Glúteos de Ouro Extreme",
    EN: "Golden Glutes Extreme",
    ES: "Glúteos de Oro Extremo",
    description: {
      EN: "Deep hypertrophy and shaping of the gluteus maximus, medius and minimus with progressive overload and high mechanical tension techniques, in a 4-day-per-week ABCD split.",
      ES: "Hipertrofia profunda y diseño del glúteo mayor, medio y menor con técnicas de sobrecarga progresiva y alta tensión mecánica, en división ABCD de 4 días por semana.",
    },
    sessions: [
      { name: "Glúteo Foco Isolado & Abdutores", EN: "Isolated Glute Focus & Abductors", ES: "Glúteo Foco Aislado y Abductores" },
      { name: "Postural, Dorsal e Deltóides", EN: "Postural, Back & Deltoids", ES: "Postural, Dorsal y Deltoides" },
      { name: "Quadríceps e Adutores", EN: "Quads & Adductors", ES: "Cuádriceps y Aductores" },
      { name: "Cadeia Posterior & Core", EN: "Posterior Chain & Core", ES: "Cadena Posterior y Core" },
    ],
  },
  {
    name: "Efeito Sereia Sculpt",
    EN: "Mermaid Effect Sculpt",
    ES: "Efecto Sirena Sculpt",
    description: {
      EN: "Detailed aesthetic sculpting, maximum lower-body volume and feminine V-shape postural symmetry for a visually slimmer waist and muscle density, in a 5-day-per-week ABCDE split.",
      ES: "Lapidación estética detallada, máximo volumen de miembros inferiores y simetría postural V-Shape femenina para afinar visualmente la cintura y densidad muscular, en división ABCDE de 5 días por semana.",
    },
    sessions: [
      { name: "Glúteo Máximo e Volume", EN: "Max Glute & Volume", ES: "Glúteo Máximo y Volumen" },
      { name: "Dorsal, Deltóides e Estabilização", EN: "Back, Deltoids & Stabilization", ES: "Dorsal, Deltoides y Estabilización" },
      { name: "Quadríceps e Densidade", EN: "Quads & Density", ES: "Cuádriceps y Densidad" },
      { name: "Posterior de Coxa e Panturrilha", EN: "Hamstrings & Calves", ES: "Isquiotibiales y Pantorrilla" },
      { name: "Braços, Abdômen e Polimento", EN: "Arms, Abs & Polishing", ES: "Brazos, Abdomen y Pulido" },
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
