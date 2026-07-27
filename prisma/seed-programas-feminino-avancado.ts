import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 70: 4 novos programas PREMIUM femininos (2 Iniciante, 2 Avançado),
// com tags de nível (Fase 70: INICIANTE/INTERMEDIARIO/AVANCADO) + FEMININO —
// mesmo padrão idempotente de prisma/seed-programas-express.ts.
interface ExerciseEntry {
  name: string;
  sets: number;
  repsRange: string;
  restSeconds: number;
  notes?: string;
}
interface SessionEntry {
  letter: string;
  name: string;
  exercises: ExerciseEntry[];
}
interface ProgramEntry {
  name: string;
  description: string;
  tags: ("FEMININO" | "INICIANTE" | "INTERMEDIARIO" | "AVANCADO")[];
  sessions: SessionEntry[];
}

const DROP_SET = "Técnica Drop-set: ao falhar com a carga da série, reduza o peso em 20-30% sem descansar e continue até uma nova falha.";
const DROP_SET_DUPLO = "Técnica Drop-set duplo: ao falhar, reduza a carga em ~25% e continue até falhar de novo; reduza mais ~25% e vá até a falha final.";
const DROP_SET_TRIPLO = "Técnica Drop-set triplo: ao falhar, reduza a carga em 20-30% e continue; repita a redução mais duas vezes até a falha final.";
const REST_PAUSE = "Técnica Rest-Pause: ao falhar, descanse 10 a 15 segundos mantendo a posição e continue com a mesma carga até falhar de novo.";
const CLUSTER_SET =
  "Técnica Cluster Set: fracione a série em mini-blocos com pausas intra-série de 10-15s, movendo cargas maiores com o volume sob tensão preservado.";
function picoContracao(segundos: number) {
  return `Técnica Pico de Contração: sustente a fase de máxima contração por ${segundos}s antes de voltar à fase excêntrica.`;
}
function biSet(outro: string) {
  return `Técnica Bi-set: execute em sequência imediata com "${outro}", sem descanso entre os dois.`;
}

const PROGRAMS: ProgramEntry[] = [
  {
    name: "Cintura Fina & Bumbum VIP",
    description:
      "Fortalecimento da região pélvica e glúteos, firmeza de coxa e tonificação do core para efeito de cintura fina, em divisão AB de 4 dias por semana.",
    tags: ["FEMININO", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Glúteos, Quadríceps e Core",
        exercises: [
          { name: "Agachamento Goblet", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Elevação Pélvica no Solo", sets: 3, repsRange: "15", restSeconds: 45 },
          { name: "Leg Press 45", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Cadeira Abdutora", sets: 3, repsRange: "15", restSeconds: 45 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "30-45s", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Posterior, Superiores e Abdômen",
        exercises: [
          { name: "Stiff com Halteres", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Mesa Flexora", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Desenvolvimento na Máquina", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Crucifixo Reto com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Abdominal Supra no Solo", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Curvas Definidas Pro",
    description:
      "Desenvolvimento harmonioso das linhas corporais femininas, fortalecimento de costas e ombros para postura e estímulo gradual de hipertrofia muscular, em divisão ABC de 3 a 5 dias por semana.",
    tags: ["FEMININO", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Coxas e Glúteos (Ênfase Anterior)",
        exercises: [
          { name: "Agachamento na Máquina Smith", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Leg Press 45", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Elevação Pélvica no Solo", sets: 3, repsRange: "15", restSeconds: 45 },
          { name: "Panturrilha em Pé", sets: 3, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Dorsal, Ombros e Tonificação de Braços",
        exercises: [
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Elevação Lateral com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Rosca Alternada com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Posterior de Coxa, Glúteos e Abdômen",
        exercises: [
          { name: "Mesa Flexora", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Stiff com Halteres", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Cadeira Abdutora", sets: 3, repsRange: "15", restSeconds: 45 },
          { name: "Exercício Ostra (Clamshell)", sets: 3, repsRange: "15 (por lado)", restSeconds: 30 },
          { name: "Abdominal Infra no Solo", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Glúteos de Ouro Extreme",
    description:
      "Hipertrofia profunda e desenho do glúteo máximo, médio e mínimo com técnicas de sobrecarga progressiva e alta tensão mecânica, em divisão ABCD de 4 dias por semana.",
    tags: ["FEMININO", "AVANCADO"],
    sessions: [
      {
        letter: "A",
        name: "Glúteo Foco Isolado & Abdutores",
        exercises: [
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "8-10", restSeconds: 60, notes: CLUSTER_SET },
          { name: "Agachamento Búlgaro", sets: 3, repsRange: "10 por perna", restSeconds: 60 },
          { name: "Abdução de Quadril no Cabo em Pé", sets: 4, repsRange: "12-15", restSeconds: 45, notes: DROP_SET },
          { name: "Cadeira Abdutora", sets: 4, repsRange: "15-20", restSeconds: 45, notes: picoContracao(3) },
        ],
      },
      {
        letter: "B",
        name: "Postural, Dorsal e Deltóides",
        exercises: [
          { name: "Puxada Alta Aberta", sets: 4, repsRange: "10", restSeconds: 60 },
          { name: "Remada Curvada com Halteres", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Elevação Lateral no Cabo", sets: 4, repsRange: "12-15", restSeconds: 45, notes: DROP_SET },
          { name: "Face Pull na Corda para Ombro", sets: 3, repsRange: "12-15", restSeconds: 45, notes: picoContracao(2) },
          { name: "Prancha Isométrica", sets: 4, repsRange: "45s", restSeconds: 30 },
        ],
      },
      {
        letter: "C",
        name: "Quadríceps e Adutores",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Hack Squat na Máquina", sets: 3, repsRange: "10-12", restSeconds: 60, notes: REST_PAUSE },
          { name: "Cadeira Extensora", sets: 4, repsRange: "12-15", restSeconds: 45, notes: DROP_SET_TRIPLO },
          { name: "Cadeira Adutora", sets: 4, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "D",
        name: "Cadeia Posterior & Core",
        exercises: [
          { name: "Levantamento Terra Romeno", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Cadeira Flexora Sentado", sets: 4, repsRange: "10-12", restSeconds: 45, notes: DROP_SET },
          { name: "Glúteo Cabo Joelho Estendido", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 4, repsRange: "10-12", restSeconds: 45 },
        ],
      },
    ],
  },
  {
    name: "Efeito Sereia Sculpt",
    description:
      "Lapidação estética detalhada, máximo volume de membros inferiores e simetria postural V-Shape feminina para afinamento visual da cintura e densidade muscular, em divisão ABCDE de 5 dias por semana.",
    tags: ["FEMININO", "AVANCADO"],
    sessions: [
      {
        letter: "A",
        name: "Glúteo Máximo e Volume",
        exercises: [
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "8-10", restSeconds: 60, notes: picoContracao(2) },
          { name: "Step Up Lateral com Halteres", sets: 3, repsRange: "10 por perna", restSeconds: 60 },
          { name: "Elevação Pélvica na Máquina", sets: 4, repsRange: "10-12", restSeconds: 45, notes: DROP_SET },
          { name: "Abdução de Quadril no Banco 45°", sets: 3, repsRange: "12-15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Dorsal, Deltóides e Estabilização",
        exercises: [
          { name: "Puxada Frontal na Polia", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "10-12", restSeconds: 60, notes: picoContracao(2) },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "12-15", restSeconds: 45, notes: REST_PAUSE },
          { name: "Prancha Isométrica", sets: 4, repsRange: "60s", restSeconds: 30 },
        ],
      },
      {
        letter: "C",
        name: "Quadríceps e Densidade",
        exercises: [
          { name: "Agachamento Frontal", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Leg Press 45", sets: 4, repsRange: "10-12", restSeconds: 60, notes: REST_PAUSE },
          { name: "Passada com Halteres", sets: 3, repsRange: "12 passos por perna", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 4, repsRange: "12-15", restSeconds: 45, notes: DROP_SET },
        ],
      },
      {
        letter: "D",
        name: "Posterior de Coxa e Panturrilha",
        exercises: [
          { name: "Stiff com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Mesa Flexora", sets: 4, repsRange: "10-12", restSeconds: 45, notes: DROP_SET },
          { name: "Pull-Through no Cabo", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Panturrilha em Pé", sets: 4, repsRange: "15-20", restSeconds: 45, notes: picoContracao(2) },
        ],
      },
      {
        letter: "E",
        name: "Braços, Abdômen e Polimento",
        exercises: [
          {
            name: "Tríceps Corda na Polia Alta",
            sets: 3,
            repsRange: "12",
            restSeconds: 0,
            notes: biSet("Rosca Martelo no Cabo com Corda"),
          },
          {
            name: "Rosca Martelo no Cabo com Corda",
            sets: 3,
            repsRange: "12",
            restSeconds: 60,
            notes: biSet("Tríceps Corda na Polia Alta"),
          },
          { name: "Rotação Russa (Russian Twist)", sets: 3, repsRange: "20", restSeconds: 30 },
          { name: "Abdominal Canivete no Cabo", sets: 3, repsRange: "15", restSeconds: 45 },
          { name: "Cadeira Abdutora", sets: 4, repsRange: "20", restSeconds: 45, notes: DROP_SET_DUPLO },
        ],
      },
    ],
  },
];

async function createProgram(entry: ProgramEntry): Promise<void> {
  const existing = await prisma.workoutProgram.findFirst({
    where: { name: entry.name, origin: "SELF", isTemplate: true },
  });
  if (existing) {
    console.log(`  Já existe: "${entry.name}" — pulado.`);
    return;
  }

  const program = await prisma.workoutProgram.create({
    data: {
      name: entry.name,
      description: entry.description,
      origin: "SELF",
      personalId: null,
      isTemplate: true,
      sessionScheme: "LETTER",
      category: "PREMIUM",
      tags: entry.tags,
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
          notes: ex.notes ?? null,
        },
      });
    }
  }

  console.log(`  Criado: "${entry.name}" (${entry.sessions.length} sessões, tags: ${entry.tags.join(", ")}).`);
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
