// Fase 54: 3 programas curados de "Treinos Prontos" (category: PRONTOS,
// grátis, mesmo padrão de carrossel de seed-programas-treino-em-casa.ts),
// conteúdo pedido pelo fundador com sessões/exercícios/séries/reps exatos —
// foco em academia (aparelhos/polias/halteres/barra), nível iniciante e
// intermediário. Mesmo padrão idempotente dos scripts anteriores (casamento
// por NAME, não por id; não faz parte do db:seed automático).
//
// restSeconds não foi especificado pelo fundador (só séries x reps) —
// escolhido por padrão de academia: 60s pra maioria (hipertrofia/tônus
// clássico), 90s no primeiro exercício composto mais pesado de cada sessão
// (geralmente 4 séries), 45s em isolamentos leves/isométricos de core.
import prisma from "../src/lib/prisma";

interface ExerciseLine {
  name: string;
  sets: number;
  repsRange: string;
  restSeconds: number;
  notes?: string;
}

interface SessionSpec {
  letter: string;
  name: string;
  exercises: ExerciseLine[];
}

interface ProgramSpec {
  name: string;
  sessions: SessionSpec[];
}

const PROGRAMS: ProgramSpec[] = [
  {
    name: "Glúteos & Coxas Definitivo (ABC - Feminino)",
    sessions: [
      {
        letter: "A",
        name: "Glúteos & Posterior",
        exercises: [
          { name: "Elevação Pélvica na Máquina", sets: 4, repsRange: "10-12", restSeconds: 90 },
          { name: "Mesa Flexora", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Cadeira Flexora Sentado", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Cadeira Abdutora", sets: 3, repsRange: "15-20", restSeconds: 60 },
          { name: "Abdução de Quadril no Cabo em Pé", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Abdominal na Máquina", sets: 3, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Membros Superiores & Postura",
        exercises: [
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Crucifixo na Máquina Voador", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Elevação Lateral com Halteres", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Rosca Martelo", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "30-45s", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Quadríceps, Adutores & Panturrilha",
        exercises: [
          { name: "Leg Press 45", sets: 4, repsRange: "10-12", restSeconds: 90 },
          { name: "Agachamento Goblet", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Cadeira Adutora", sets: 3, repsRange: "15-20", restSeconds: 60 },
          { name: "Panturrilha Sentado", sets: 4, repsRange: "15", restSeconds: 45 },
          { name: "Abdominal Supra no Solo", sets: 3, repsRange: "15-20", restSeconds: 45 },
        ],
      },
    ],
  },
  {
    name: "Corpo Esculpido & Tônus (ABC - Feminino)",
    sessions: [
      {
        letter: "A",
        name: "Coxas, Glúteos & Panturrilhas",
        exercises: [
          { name: "Agachamento na Máquina Smith", sets: 4, repsRange: "10-12", restSeconds: 90 },
          { name: "Leg Press 45", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Cadeira Flexora Sentado", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Panturrilha em Pé", sets: 4, repsRange: "15", restSeconds: 45 },
          { name: "Abdominal Infra no Solo", sets: 3, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Costas, Peito, Ombro & Braços",
        exercises: [
          { name: "Puxada Alta com Triângulo", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Supino Máquina", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Desenvolvimento com Halteres Sentado", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Crucifixo Inverso na Máquina", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Tríceps Pulley com Corda", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Rosca Direta com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Glúteos, Posterior & Cintura",
        exercises: [
          { name: "Stiff com Halteres", sets: 4, repsRange: "10-12", restSeconds: 90 },
          { name: "Elevação Pélvica na Máquina", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Glúteo Cabo Joelho Estendido", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Cadeira Adutora", sets: 3, repsRange: "15-20", restSeconds: 60 },
          { name: "Prancha Lateral", sets: 3, repsRange: "30s", restSeconds: 45, notes: "De cada lado" },
          { name: "Abdominal Oblíquo no Solo", sets: 3, repsRange: "15", restSeconds: 45, notes: "Por lado" },
        ],
      },
    ],
  },
  {
    name: "Shape V: Hipertrofia (ABCD - Masculino/Geral)",
    sessions: [
      {
        letter: "A",
        name: "Peito & Tríceps",
        exercises: [
          { name: "Supino Reto com Halteres", sets: 4, repsRange: "8-12", restSeconds: 90 },
          { name: "Supino Inclinado na Máquina Smith", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Peck Deck (Voador)", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Tríceps Pulley Barra Reta", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Tríceps Francês com Halteres", sets: 3, repsRange: "10-12", restSeconds: 45 },
          { name: "Abdominal na Máquina", sets: 3, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Costas & Bíceps",
        exercises: [
          { name: "Puxada Frontal na Polia", sets: 4, repsRange: "10-12", restSeconds: 90 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Remada Unilateral com Halter", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Rosca Direta com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Rosca Martelo", sets: 3, repsRange: "10-12", restSeconds: 45 },
          { name: "Rosca Punho", sets: 3, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Pernas Completo",
        exercises: [
          { name: "Leg Press 45", sets: 4, repsRange: "10-12", restSeconds: 90 },
          { name: "Agachamento na Máquina Smith", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Mesa Flexora", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Panturrilha em Pé", sets: 4, repsRange: "15", restSeconds: 45 },
          { name: "Panturrilha Sentado", sets: 3, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "D",
        name: "Ombros, Trapézio & Core",
        exercises: [
          { name: "Desenvolvimento com Halteres", sets: 4, repsRange: "10-12", restSeconds: 90 },
          { name: "Elevação Lateral no Cabo", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Elevação Frontal com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Encolhimento com Halteres", sets: 4, repsRange: "12-15", restSeconds: 60 },
          { name: "Rotação Russa (Russian Twist)", sets: 3, repsRange: "15", restSeconds: 45, notes: "Por lado" },
          { name: "Prancha Isométrica", sets: 3, repsRange: "45-60s", restSeconds: 45 },
        ],
      },
    ],
  },
];

async function main() {
  for (const programSpec of PROGRAMS) {
    const existing = await prisma.workoutProgram.findFirst({
      where: { name: programSpec.name, origin: "SELF", isTemplate: true },
    });
    if (existing) {
      console.log(`Já existe, pulando: "${programSpec.name}"`);
      continue;
    }

    const program = await prisma.workoutProgram.create({
      data: {
        name: programSpec.name,
        origin: "SELF",
        personalId: null,
        isTemplate: true,
        sessionScheme: "LETTER",
        category: "PRONTOS",
      },
    });
    console.log(`Criado programa "${program.name}" (${program.id})`);

    for (const sessionSpec of programSpec.sessions) {
      const workout = await prisma.workout.create({
        data: {
          programId: program.id,
          personalId: null,
          alunoId: null,
          name: sessionSpec.name,
          letter: sessionSpec.letter,
        },
      });
      console.log(`  Sessão ${sessionSpec.letter} — "${sessionSpec.name}" (${workout.id})`);

      let order = 1;
      for (const ex of sessionSpec.exercises) {
        const exercise = await prisma.exercise.findUnique({ where: { name: ex.name } });
        if (!exercise) {
          console.log(`    Aviso: exercício "${ex.name}" não encontrado no catálogo — pulado.`);
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
            notes: ex.notes ?? null,
          },
        });
      }
      console.log(`    ${order - 1} exercício(s) adicionado(s).`);
    }
  }

  const prontosPrograms = await prisma.workoutProgram.count({
    where: { origin: "SELF", isTemplate: true, category: "PRONTOS" },
  });
  console.log(`\nTotal de templates PRONTOS após o seed: ${prontosPrograms}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
