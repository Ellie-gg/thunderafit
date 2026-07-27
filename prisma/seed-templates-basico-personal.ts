import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 62: 2 templates "Básico" (origin: PERSONAL_CATALOG) — catálogo
// gratuito oferecido a todo Personal em /personal/programas, curado pelo
// admin. Mesmo padrão idempotente de prisma/seed-programas-premium.ts
// (resolve exercício por nome exato contra o catálogo, avisa e pula se
// algum nome não bater).
interface ExerciseEntry {
  name: string;
  sets: number;
  repsRange: string;
  restSeconds: number;
}
interface SessionEntry {
  letter: string;
  name: string;
  exercises: ExerciseEntry[];
}
interface ProgramEntry {
  name: string;
  description: string;
  sessions: SessionEntry[];
}

const PROGRAMS: ProgramEntry[] = [
  {
    name: "Full Body Iniciante",
    description: "Corpo inteiro em 3 sessões, ideal para quem está começando na academia — foco em movimentos básicos e progressão de carga segura.",
    sessions: [
      {
        letter: "A",
        name: "Full Body A",
        exercises: [
          { name: "Agachamento Livre", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Supino Reto com Barra", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Remada Curvada com Barra", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Panturrilha em Pé", sets: 3, repsRange: "15-20", restSeconds: 45 },
          { name: "Abdominal Supra no Solo", sets: 3, repsRange: "15-20", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Full Body B",
        exercises: [
          { name: "Leg Press 45", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Elevação Lateral com Halteres", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "20-30", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Full Body C",
        exercises: [
          { name: "Stiff com Barra", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Supino Inclinado com Halteres", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Remada Unilateral com Halter", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Rosca Direta com Barra", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Tríceps Pulley Barra Reta", sets: 3, repsRange: "12-15", restSeconds: 60 },
        ],
      },
    ],
  },
  {
    name: "Upper/Lower Básico",
    description: "Divisão clássica de 2 sessões (superiores/inferiores), fácil de encaixar em qualquer rotina semanal.",
    sessions: [
      {
        letter: "A",
        name: "Superiores",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "8-12", restSeconds: 90 },
          { name: "Puxada Frontal na Polia", sets: 4, repsRange: "8-12", restSeconds: 90 },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "10-12", restSeconds: 75 },
          { name: "Rosca Direta com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Tríceps Testa com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
        ],
      },
      {
        letter: "B",
        name: "Inferiores",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "8-12", restSeconds: 90 },
          { name: "Levantamento Terra Romeno", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Mesa Flexora", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Panturrilha em Pé", sets: 4, repsRange: "15-20", restSeconds: 45 },
        ],
      },
    ],
  },
];

async function createProgram(entry: ProgramEntry): Promise<void> {
  const existing = await prisma.workoutProgram.findFirst({
    where: { name: entry.name, origin: "PERSONAL_CATALOG", isTemplate: true },
  });
  if (existing) {
    console.log(`  Já existe: "${entry.name}" — pulado.`);
    return;
  }

  const program = await prisma.workoutProgram.create({
    data: {
      name: entry.name,
      description: entry.description,
      origin: "PERSONAL_CATALOG",
      personalId: null,
      isTemplate: true,
      sessionScheme: "LETTER",
    },
  });

  for (const session of entry.sessions) {
    const workout = await prisma.workout.create({
      data: { programId: program.id, personalId: null, alunoId: null, name: session.name, letter: session.letter },
    });

    let order = 1;
    for (const ex of session.exercises) {
      const exercise = await prisma.exercise.findFirst({ where: { name: ex.name } });
      if (!exercise) {
        console.log(`    Aviso: exercício "${ex.name}" não encontrado no catálogo — pulado (${entry.name} / ${session.letter}).`);
        continue;
      }
      await prisma.workoutExercise.create({
        data: {
          workoutId: workout.id,
          exerciseId: exercise.id,
          sets: ex.sets,
          repsRange: ex.repsRange,
          restSeconds: ex.restSeconds,
          order: order++,
        },
      });
    }
  }

  console.log(`  Criado: "${entry.name}" (${entry.sessions.length} sessões).`);
}

async function main() {
  for (const p of PROGRAMS) await createProgram(p);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
