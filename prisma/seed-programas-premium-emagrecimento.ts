import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 60: 3 programas PREMIUM focados em emagrecimento/EPOC (conteúdo
// avançado do fundador) — mesmo padrão de prisma/seed-programas-premium.ts
// (idempotente por nome exato, resolve exercício por nome exato contra o
// catálogo, avisa e pula se algum nome não bater).
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
  sessions: SessionEntry[];
}

const DROP_SET = "Técnica Drop-set: ao falhar com a carga da série, reduza o peso em 20-30% sem descansar e continue até uma nova falha.";
const DROP_SET_TRIPLO = "Técnica Drop-set triplo: ao falhar, reduza a carga em 20-30% e continue; repita a redução mais duas vezes até a falha final.";
const REST_PAUSE = "Técnica Rest-Pause: ao falhar, descanse 10 a 15 segundos mantendo a posição e continue com a mesma carga até falhar de novo.";
function picoContracao(segundos: number) {
  return `Técnica Pico de Contração: sustente a fase de máxima contração por ${segundos}s antes de voltar à fase excêntrica.`;
}
function biSet(outro: string) {
  return `Técnica Bi-set: execute em sequência imediata com "${outro}", sem descanso entre os dois.`;
}
function biSetAntagonista(outro: string) {
  return `Técnica Bi-set Antagonista: execute em sequência imediata com "${outro}" (grupo muscular oposto), sem descanso entre os dois.`;
}
function biSetContraste(outro: string) {
  return `Técnica Bi-set de Contraste: execute em sequência imediata com "${outro}" — carga pesada seguida de movimento metabólico/funcional, sem descanso entre os dois, elevando os batimentos sem perder o estímulo hipertrófico.`;
}
function biSetExaustao(outro: string) {
  return `Técnica Bi-set de Exaustão: execute em sequência imediata com "${outro}" e reduza a carga em 30% se necessário, estendendo o tempo sob tensão pra máxima depleção metabólica.`;
}
function biSetMetabolico(outro: string) {
  return `Técnica Bi-set Metabólico: execute em sequência imediata com "${outro}" até a falha, sem descanso entre os dois.`;
}
function triSetMetabolico(outros: [string, string]) {
  return `Técnica Tri-set Metabólico: execute em sequência com "${outros[0]}" e "${outros[1]}", sem descanso entre os três — só descanse ao final do bloco.`;
}
function circuitoCore(outros: [string, string]) {
  return `Técnica Circuito Core de Alta Densidade: execute em sequência com "${outros[0]}" e "${outros[1]}", descanso mínimo entre eles.`;
}
const CIRCUITO_FINAL =
  "Técnica Circuito Final Metabólico: execute os 4 exercícios em sequência, sem descanso entre eles, por 3 rodadas — descanse 1 minuto só ao final de cada rodada completa.";
function restPauseMetabolico(segundos: number) {
  return `Técnica Rest-Pause Metabólico: ao falhar, pause ${segundos}s mantendo a postura e continue até falhar de novo, mantendo a frequência cardíaca elevada.`;
}

const PROGRAMS: ProgramEntry[] = [
  {
    name: "Queima Fatal 360",
    description:
      "Emagrecimento acelerado e queima de gordura corporal através de alta densidade metabólica, elevação de EPOC e preservação de massa magra.",
    sessions: [
      {
        letter: "A",
        name: "Inferiores e Cardio Metabólico",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Leg Press 45", sets: 3, repsRange: "12", restSeconds: 0, notes: biSetContraste("Polichinelo (Jumping Jacks)") },
          { name: "Polichinelo (Jumping Jacks)", sets: 3, repsRange: "45s", restSeconds: 60, notes: biSetContraste("Leg Press 45") },
          { name: "Afundo Caminhando com Barra", sets: 3, repsRange: "10 passos por perna", restSeconds: 45 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12", restSeconds: 0, notes: triSetMetabolico(["Cadeira Flexora Sentado", "Mountain Climbers"]) },
          { name: "Cadeira Flexora Sentado", sets: 3, repsRange: "12", restSeconds: 0, notes: triSetMetabolico(["Cadeira Extensora", "Mountain Climbers"]) },
          { name: "Mountain Climbers", sets: 3, repsRange: "45s", restSeconds: 60, notes: triSetMetabolico(["Cadeira Extensora", "Cadeira Flexora Sentado"]) },
          { name: "Corrida Intervalada (Sprints)", sets: 8, repsRange: "30s sprint / 30s caminhada leve", restSeconds: 120 },
        ],
      },
      {
        letter: "B",
        name: "Superiores e Core Metabólico",
        exercises: [
          { name: "Supino Inclinado com Barra", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Remada Curvada com Barra", sets: 4, repsRange: "10", restSeconds: 0, notes: biSetContraste("Flexão de Braço") },
          { name: "Flexão de Braço", sets: 4, repsRange: "até a falha", restSeconds: 60, notes: biSetContraste("Remada Curvada com Barra") },
          { name: "Desenvolvimento Militar em Pé", sets: 3, repsRange: "10", restSeconds: 45 },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "12", restSeconds: 0, notes: triSetMetabolico(["Rosca Direta com Halteres", "Burpees"]) },
          { name: "Rosca Direta com Halteres", sets: 3, repsRange: "12", restSeconds: 0, notes: triSetMetabolico(["Tríceps Corda na Polia Alta", "Burpees"]) },
          { name: "Burpees", sets: 3, repsRange: "12", restSeconds: 60, notes: triSetMetabolico(["Tríceps Corda na Polia Alta", "Rosca Direta com Halteres"]) },
          { name: "Abdominal Canivete", sets: 3, repsRange: "15", restSeconds: 0, notes: biSet("Prancha Isométrica") },
          { name: "Prancha Isométrica", sets: 3, repsRange: "45s", restSeconds: 45, notes: biSet("Abdominal Canivete") },
        ],
      },
      {
        letter: "C",
        name: "Full Body Burn",
        exercises: [
          { name: "Levantamento Terra", sets: 4, repsRange: "6-8", restSeconds: 90 },
          { name: "Agachamento Búlgaro", sets: 3, repsRange: "10 por perna", restSeconds: 0, notes: biSetContraste("Pular Corda") },
          { name: "Pular Corda", sets: 3, repsRange: "1 minuto", restSeconds: 60, notes: biSetContraste("Agachamento Búlgaro") },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Mergulho nas Paralelas", sets: 3, repsRange: "10-12", restSeconds: 45 },
          { name: "Rotação Russa (Russian Twist)", sets: 3, repsRange: "20", restSeconds: 0, notes: circuitoCore(["Mountain Climbers", "Abdominal Bicicleta"]) },
          { name: "Mountain Climbers", sets: 3, repsRange: "30s", restSeconds: 0, notes: circuitoCore(["Rotação Russa (Russian Twist)", "Abdominal Bicicleta"]) },
          { name: "Abdominal Bicicleta", sets: 3, repsRange: "20", restSeconds: 45, notes: circuitoCore(["Rotação Russa (Russian Twist)", "Mountain Climbers"]) },
        ],
      },
    ],
  },
  {
    name: "Metabolic Shred Pro",
    description:
      "Emagrecimento, definição muscular extrema e recomposição corporal combinando grandes agrupamentos musculares e estímulos metabólicos de alta intensidade.",
    sessions: [
      {
        letter: "A",
        name: "Peito, Costas e Cardio Dense",
        exercises: [
          { name: "Supino Reto com Halteres", sets: 4, repsRange: "8-10", restSeconds: 0, notes: biSetAntagonista("Barra Fixa Pronada") },
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "8-10", restSeconds: 60, notes: biSetAntagonista("Supino Reto com Halteres") },
          { name: "Crucifixo Inclinado com Halteres", sets: 3, repsRange: "12", restSeconds: 0, notes: biSetAntagonista("Remada Baixa no Cabo") },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "12", restSeconds: 60, notes: biSetAntagonista("Crucifixo Inclinado com Halteres") },
          { name: "Burpees", sets: 4, repsRange: "15", restSeconds: 15, notes: restPauseMetabolico(15) },
          { name: "Remo Ergométrico", sets: 1, repsRange: "15min (HIIT: 45s moderado / 15s tiro máximo)", restSeconds: 0 },
        ],
      },
      {
        letter: "B",
        name: "Quadríceps, Glúteos e Densidade",
        exercises: [
          { name: "Agachamento Frontal", sets: 4, repsRange: "8", restSeconds: 60 },
          { name: "Hack Squat na Máquina", sets: 3, repsRange: "10", restSeconds: 0, notes: biSet("Agachamento Sumô com Halter") },
          { name: "Agachamento Sumô com Halter", sets: 3, repsRange: "12", restSeconds: 60, notes: biSet("Hack Squat na Máquina") },
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "10", restSeconds: 60, notes: REST_PAUSE },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12", restSeconds: 0, notes: triSetMetabolico(["Passada com Halteres", "Polichinelo (Jumping Jacks)"]) },
          { name: "Passada com Halteres", sets: 3, repsRange: "10 passos", restSeconds: 0, notes: triSetMetabolico(["Cadeira Extensora", "Polichinelo (Jumping Jacks)"]) },
          { name: "Polichinelo (Jumping Jacks)", sets: 3, repsRange: "45s", restSeconds: 60, notes: triSetMetabolico(["Cadeira Extensora", "Passada com Halteres"]) },
        ],
      },
      {
        letter: "C",
        name: "Ombros, Braços e Core Burn",
        exercises: [
          { name: "Desenvolvimento Arnold", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "12", restSeconds: 0, notes: biSet("Face Pull no Cabo") },
          { name: "Face Pull no Cabo", sets: 4, repsRange: "12", restSeconds: 60, notes: biSet("Elevação Lateral com Halteres") },
          { name: "Rosca Direta com Barra", sets: 3, repsRange: "10", restSeconds: 0, notes: biSetAntagonista("Tríceps Testa com Barra") },
          { name: "Tríceps Testa com Barra", sets: 3, repsRange: "10", restSeconds: 60, notes: biSetAntagonista("Rosca Direta com Barra") },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 4, repsRange: "12", restSeconds: 0, notes: biSet("Prancha com Toque no Ombro") },
          { name: "Prancha com Toque no Ombro", sets: 4, repsRange: "20", restSeconds: 60, notes: biSet("Abdominal na Roda (Ab Wheel)") },
          { name: "Pular Corda", sets: 1, repsRange: "10min contínuos, ritmo moderado a alto", restSeconds: 0 },
        ],
      },
      {
        letter: "D",
        name: "Posterior, Panturrilhas e HIIT Extreme",
        exercises: [
          { name: "Levantamento Terra Romeno", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Stiff com Barra", sets: 3, repsRange: "10", restSeconds: 0, notes: biSet("Mesa Flexora") },
          { name: "Mesa Flexora", sets: 3, repsRange: "12", restSeconds: 60, notes: biSet("Stiff com Barra") },
          { name: "Abdução de Quadril no Cabo em Pé", sets: 3, repsRange: "15", restSeconds: 45, notes: DROP_SET },
          { name: "Panturrilha em Pé", sets: 4, repsRange: "15", restSeconds: 45, notes: picoContracao(2) },
          { name: "Corrida Intervalada (Sprints)", sets: 10, repsRange: "30s corrida máxima / 30s descanso passivo", restSeconds: 0 },
        ],
      },
    ],
  },
  {
    name: "Corpo Trincado Extreme",
    description:
      "Máximo déficit calórico semanal induzido por treinamento de alta voltagem e densidade muscular, acelerando a queima de gordura sem perda de tonicidade.",
    sessions: [
      {
        letter: "A",
        name: "Legs & Cardio Burn (Anterior)",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "8", restSeconds: 60 },
          { name: "Leg Press 45", sets: 3, repsRange: "10", restSeconds: 60, notes: DROP_SET_TRIPLO },
          { name: "Agachamento Búlgaro", sets: 3, repsRange: "10 por perna", restSeconds: 0, notes: biSetExaustao("Agachamento Isométrico na Parede") },
          { name: "Agachamento Isométrico na Parede", sets: 3, repsRange: "45s", restSeconds: 60, notes: biSetExaustao("Agachamento Búlgaro") },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12", restSeconds: 0, notes: biSetContraste("Mountain Climbers") },
          { name: "Mountain Climbers", sets: 3, repsRange: "45s", restSeconds: 60, notes: biSetContraste("Cadeira Extensora") },
        ],
      },
      {
        letter: "B",
        name: "Push Shred (Peito, Ombros e Tríceps)",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "8", restSeconds: 60 },
          { name: "Desenvolvimento Militar em Pé", sets: 3, repsRange: "10", restSeconds: 0, notes: biSet("Elevação Lateral com Halteres") },
          { name: "Elevação Lateral com Halteres", sets: 3, repsRange: "12", restSeconds: 60, notes: biSet("Desenvolvimento Militar em Pé") },
          { name: "Flexão de Braço", sets: 3, repsRange: "até a falha", restSeconds: 0, notes: biSetMetabolico("Burpees") },
          { name: "Burpees", sets: 3, repsRange: "10", restSeconds: 60, notes: biSetMetabolico("Flexão de Braço") },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "12", restSeconds: 60, notes: DROP_SET },
        ],
      },
      {
        letter: "C",
        name: "Pull Shred (Costas, Bíceps e Core)",
        exercises: [
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Remada Curvada com Barra", sets: 3, repsRange: "10", restSeconds: 0, notes: biSet("Remada Baixa no Cabo") },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "12", restSeconds: 60, notes: biSet("Remada Curvada com Barra") },
          { name: "Crucifixo Inverso na Máquina", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Rosca Scott com Barra", sets: 3, repsRange: "10", restSeconds: 0, notes: biSet("Rosca Martelo") },
          { name: "Rosca Martelo", sets: 3, repsRange: "10", restSeconds: 60, notes: biSet("Rosca Scott com Barra") },
          { name: "Elevação de Pernas na Barra Fixa", sets: 4, repsRange: "12", restSeconds: 0, notes: biSet("Prancha Isométrica") },
          { name: "Prancha Isométrica", sets: 4, repsRange: "45s", restSeconds: 60, notes: biSet("Elevação de Pernas na Barra Fixa") },
        ],
      },
      {
        letter: "D",
        name: "Posterior, Glúteo e Hi-Voltage",
        exercises: [
          { name: "Levantamento Terra Sumô", sets: 4, repsRange: "8", restSeconds: 60 },
          { name: "Stiff com Halteres", sets: 3, repsRange: "10", restSeconds: 0, notes: biSet("Cadeira Flexora Sentado") },
          { name: "Cadeira Flexora Sentado", sets: 3, repsRange: "12", restSeconds: 60, notes: biSet("Stiff com Halteres") },
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "10", restSeconds: 60, notes: REST_PAUSE },
          { name: "Cadeira Abdutora", sets: 3, repsRange: "15", restSeconds: 0, notes: biSetContraste("Polichinelo (Jumping Jacks)") },
          { name: "Polichinelo (Jumping Jacks)", sets: 3, repsRange: "45s", restSeconds: 60, notes: biSetContraste("Cadeira Abdutora") },
        ],
      },
      {
        letter: "E",
        name: "Full Body Metabolic Conditioning",
        exercises: [
          { name: "Agachamento Sumô com Halter", sets: 4, repsRange: "12", restSeconds: 0, notes: biSet("Desenvolvimento com Halteres") },
          { name: "Desenvolvimento com Halteres", sets: 4, repsRange: "12", restSeconds: 60, notes: biSet("Agachamento Sumô com Halter") },
          { name: "Remada Cavalinho", sets: 4, repsRange: "12", restSeconds: 0, notes: biSet("Mergulho no Banco") },
          { name: "Mergulho no Banco", sets: 4, repsRange: "12", restSeconds: 60, notes: biSet("Remada Cavalinho") },
          { name: "Burpees", sets: 3, repsRange: "12", restSeconds: 0, notes: CIRCUITO_FINAL },
          { name: "Mountain Climbers", sets: 3, repsRange: "45s", restSeconds: 0, notes: CIRCUITO_FINAL },
          { name: "Pular Corda", sets: 3, repsRange: "1 minuto", restSeconds: 0, notes: CIRCUITO_FINAL },
          { name: "Abdominal Canivete", sets: 3, repsRange: "15", restSeconds: 60, notes: CIRCUITO_FINAL },
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
