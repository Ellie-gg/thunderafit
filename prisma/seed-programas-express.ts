import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 69: 5 programas PREMIUM com a tag EXPRESS (sessões curtas, alta
// densidade metabólica) — mesmo padrão idempotente de
// prisma/seed-programas-premium-emagrecimento.ts, com `tags: ["EXPRESS"]`
// (Fase 63) pra aparecerem no chip "Express" do carrossel "Treinos Premium".
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
const REST_PAUSE = "Técnica Rest-Pause: ao falhar, descanse 10 a 15 segundos mantendo a posição e continue com a mesma carga até falhar de novo.";
const CLUSTER_SET =
  "Técnica Cluster Set: na última série, divida as repetições em mini-blocos com pausas intra-série de 10-15s, sustentando uma carga mais alta com menos fadiga acumulada.";
const MYO_REPS =
  "Técnica Myo-Reps: após a série de ativação até quase a falha, descanse 3-5 respirações profundas e faça mini-blocos de 3-5 repetições, repetindo até perder a velocidade de execução.";
function biSet(outro: string) {
  return `Técnica Bi-set: execute em sequência imediata com "${outro}", sem descanso entre os dois.`;
}
function biSetAntagonista(outro: string) {
  return `Técnica Bi-set Antagonista: execute em sequência imediata com "${outro}" (grupo muscular oposto), sem descanso entre os dois.`;
}
function obs(texto: string, tecnica?: string) {
  return tecnica ? `${tecnica}\n\nObservação: ${texto}` : `Observação: ${texto}`;
}

const PROGRAMS: ProgramEntry[] = [
  {
    name: "Hipertrofia Express 3X",
    description:
      "Treino express de 3x por semana para iniciantes ganharem hipertrofia com sessões enxutas de 4 exercícios, priorizando movimentos compostos e boa técnica em cerca de 30 minutos por sessão.",
    sessions: [
      {
        letter: "A",
        name: "Peito, Ombro e Tríceps",
        exercises: [
          { name: "Supino Reto com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Elevação Lateral com Halteres", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Tríceps Corda na Polia Alta",
            sets: 3,
            repsRange: "12-15",
            restSeconds: 45,
            notes: obs("Priorize a conexão mente-músculo e a execução controlada (2s excêntrica) mesmo com pouco tempo disponível — qualidade acima de velocidade.", DROP_SET),
          },
        ],
      },
      {
        letter: "B",
        name: "Costas, Bíceps e Core",
        exercises: [
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Rosca Direta com Halteres", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Prancha Isométrica",
            sets: 3,
            repsRange: "30-45s",
            restSeconds: 45,
            notes: obs("Mantenha o abdômen contraído durante os puxadores para proteger a lombar; a prancha final fecha a sessão ativando o core."),
          },
        ],
      },
      {
        letter: "C",
        name: "Pernas e Panturrilha",
        exercises: [
          { name: "Leg Press 45", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Cadeira Flexora Sentado", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Panturrilha em Pé",
            sets: 4,
            repsRange: "15-20",
            restSeconds: 30,
            notes: obs("Aqueça bem os joelhos antes do Leg Press; finalize com a panturrilha para máximo recrutamento do gastrocnêmio."),
          },
        ],
      },
    ],
  },
  {
    name: "Metabolic Burn 40",
    description:
      "Divisão Push/Pull/Legs de alta densidade metabólica para sessões de até 40 minutos, unindo bi-sets e rest-pause pra maximizar o estímulo hipertrófico com volume reduzido.",
    sessions: [
      {
        letter: "A",
        name: "Push (Peito, Ombro e Tríceps)",
        exercises: [
          { name: "Supino Inclinado com Halteres", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Desenvolvimento Militar em Pé", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Crucifixo na Máquina Voador", sets: 3, repsRange: "12-15", restSeconds: 0, notes: biSet("Flexão de Braço") },
          { name: "Flexão de Braço", sets: 3, repsRange: "até a falha", restSeconds: 60, notes: biSet("Crucifixo na Máquina Voador") },
          {
            name: "Tríceps Testa com Halteres",
            sets: 3,
            repsRange: "12-15",
            restSeconds: 45,
            notes: obs("Sessão pensada pra caber em 40 minutos — evite descansos longos entre blocos e mantenha o ritmo entre os exercícios.", REST_PAUSE),
          },
        ],
      },
      {
        letter: "B",
        name: "Pull (Costas e Bíceps)",
        exercises: [
          { name: "Remada Curvada com Barra", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Puxada Alta Aberta", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Crucifixo Inverso na Máquina", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Rosca Scott com Barra",
            sets: 3,
            repsRange: "10-12",
            restSeconds: 45,
            notes: obs("Cotovelos apoiados e fixos no banco Scott o tempo todo — evite balanço pra isolar o bíceps.", DROP_SET),
          },
        ],
      },
      {
        letter: "C",
        name: "Legs (Pernas)",
        exercises: [
          { name: "Agachamento Búlgaro", sets: 3, repsRange: "10-12 por perna", restSeconds: 60 },
          { name: "Levantamento Terra Romeno", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Abdominal Bicicleta",
            sets: 3,
            repsRange: "20",
            restSeconds: 45,
            notes: obs("Fecha a semana com um estímulo de posterior de coxa e core — priorize amplitude no Terra Romeno sobre carga."),
          },
        ],
      },
    ],
  },
  {
    name: "Esculpimento Express",
    description:
      "Divisão de 4 sessões voltada à definição e simetria muscular, com um dia dedicado a braços e core em bi-sets antagonistas pra otimizar tempo e intensidade.",
    sessions: [
      {
        letter: "A",
        name: "Peito e Ombro",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Supino Inclinado com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Elevação Lateral no Cabo", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Elevação Frontal com Halteres",
            sets: 3,
            repsRange: "12-15",
            restSeconds: 45,
            notes: obs("Priorize o controle na fase excêntrica dos levantamentos de ombro — é onde ocorre o maior estímulo de definição."),
          },
        ],
      },
      {
        letter: "B",
        name: "Costas",
        exercises: [
          { name: "Remada Curvada com Barra", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Pulldown com Braços Estendidos", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Encolhimento com Halteres",
            sets: 3,
            repsRange: "15",
            restSeconds: 45,
            notes: obs("Segure 1s no topo do encolhimento pra maximizar o pico de contração do trapézio."),
          },
        ],
      },
      {
        letter: "C",
        name: "Pernas e Glúteo",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Hip Thrust com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Mesa Flexora", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Panturrilha em Pé",
            sets: 4,
            repsRange: "15-20",
            restSeconds: 30,
            notes: obs("Sustente 1s na contração máxima do Hip Thrust — foco em glúteo, não em lombar."),
          },
        ],
      },
      {
        letter: "D",
        name: "Braços e Core (Bi-Sets)",
        exercises: [
          { name: "Rosca Direta com Barra", sets: 3, repsRange: "10-12", restSeconds: 0, notes: biSetAntagonista("Mergulho nas Paralelas") },
          { name: "Mergulho nas Paralelas", sets: 3, repsRange: "10-12", restSeconds: 60, notes: biSetAntagonista("Rosca Direta com Barra") },
          { name: "Rosca Martelo", sets: 3, repsRange: "12", restSeconds: 0, notes: biSetAntagonista("Tríceps Corda na Polia Alta") },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "12-15", restSeconds: 60, notes: biSetAntagonista("Rosca Martelo") },
          {
            name: "Prancha Lateral",
            sets: 3,
            repsRange: "30-45s por lado",
            restSeconds: 45,
            notes: obs("Os bi-sets antagonistas de bíceps/tríceps economizam tempo sem perder intensidade — mantenha o quadril alinhado na prancha lateral."),
          },
        ],
      },
    ],
  },
  {
    name: "Força & Volume 40",
    description:
      "Divisão avançada de 4 sessões combinando força (baixas repetições, cargas altas) com volume hipertrófico, usando cluster sets nos básicos pesados pra sustentar intensidade dentro de 40 minutos.",
    sessions: [
      {
        letter: "A",
        name: "Pernas (Força)",
        exercises: [
          {
            name: "Agachamento Livre",
            sets: 4,
            repsRange: "5-6 (Cluster Set na última)",
            restSeconds: 90,
            notes: obs("Priorize a técnica de agachamento livre com carga alta antes de progredir peso — profundidade completa acima de tudo.", CLUSTER_SET),
          },
          { name: "Leg Press 45", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Panturrilha no Leg Press", sets: 4, repsRange: "15-20", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Peito e Tríceps",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "5-6 (Cluster Set na última)", restSeconds: 90, notes: CLUSTER_SET },
          { name: "Supino Inclinado na Máquina Smith", sets: 3, repsRange: "8-10", restSeconds: 60 },
          { name: "Crucifixo Reto com Halteres", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Tríceps Testa com Barra",
            sets: 3,
            repsRange: "10-12",
            restSeconds: 45,
            notes: obs("Cotovelos fixos e apontados pro teto durante o tríceps testa pra isolar o tríceps sem sobrecarregar o ombro.", REST_PAUSE),
          },
        ],
      },
      {
        letter: "C",
        name: "Costas e Bíceps",
        exercises: [
          { name: "Levantamento Terra", sets: 4, repsRange: "5-6 (Cluster Set na última)", restSeconds: 120, notes: CLUSTER_SET },
          { name: "Barra Fixa Pronada", sets: 3, repsRange: "8-10", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "10-12", restSeconds: 60 },
          {
            name: "Rosca Scott com Barra",
            sets: 3,
            repsRange: "10-12",
            restSeconds: 45,
            notes: obs("Aqueça a lombar antes do Levantamento Terra; nunca sacrifique a postura neutra da coluna por mais carga."),
          },
        ],
      },
      {
        letter: "D",
        name: "Ombro e Core",
        exercises: [
          { name: "Desenvolvimento Militar em Pé", sets: 4, repsRange: "5-6 (Cluster Set na última)", restSeconds: 90, notes: CLUSTER_SET },
          { name: "Elevação Lateral com Halteres", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Elevação Pélvica com Barra", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Rotação Russa (Russian Twist)",
            sets: 3,
            repsRange: "20",
            restSeconds: 45,
            notes: obs("Encerre a semana de força com o core — respiração controlada na rotação russa, sem puxar o pescoço."),
          },
        ],
      },
    ],
  },
  {
    name: "Pico de Hipertrofia 5X",
    description:
      "Divisão avançada de 5 sessões pra praticantes experientes buscarem o pico de hipertrofia, combinando bi-sets antagonistas, rest-pause e myo-reps num protocolo de alta densidade e curta duração.",
    sessions: [
      {
        letter: "A",
        name: "Peito",
        exercises: [
          { name: "Supino Inclinado com Halteres", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Supino Reto com Barra", sets: 3, repsRange: "8-10", restSeconds: 60 },
          { name: "Crucifixo na Máquina Voador", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Flexão de Braço",
            sets: 3,
            repsRange: "até a falha",
            restSeconds: 45,
            notes: obs("Varie o ângulo entre supino reto e inclinado pra atingir toda a fibra do peitoral em uma única sessão curta."),
          },
        ],
      },
      {
        letter: "B",
        name: "Costas",
        exercises: [
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Remada Curvada com Barra", sets: 3, repsRange: "8-10", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "10-12", restSeconds: 60 },
          {
            name: "Pulldown com Braços Estendidos", sets: 3, repsRange: "12-15", restSeconds: 45,
            notes: obs("Puxe com os cotovelos, não com as mãos — foco na contração do latíssimo do dorso em cada puxador."),
          },
        ],
      },
      {
        letter: "C",
        name: "Pernas",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Leg Press 45", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Levantamento Terra Romeno", sets: 3, repsRange: "10-12", restSeconds: 60 },
          {
            name: "Cadeira Extensora",
            sets: 3,
            repsRange: "12-15",
            restSeconds: 45,
            notes: obs("Com 5 sessões por semana, o volume total de pernas já é alto — não é necessário buscar falha em todas as séries."),
          },
        ],
      },
      {
        letter: "D",
        name: "Ombro e Trapézio",
        exercises: [
          { name: "Desenvolvimento com Halteres", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Elevação Lateral no Cabo", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Crucifixo Inverso na Máquina", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Encolhimento com Barra",
            sets: 3,
            repsRange: "15",
            restSeconds: 45,
            notes: obs("Encolhimento sempre por último — trapézio pré-fadigado não compromete a técnica dos desenvolvimentos e elevações.", REST_PAUSE),
          },
        ],
      },
      {
        letter: "E",
        name: "Braços (Myo-Reps)",
        exercises: [
          { name: "Rosca Direta com Barra", sets: 3, repsRange: "10-12", restSeconds: 0, notes: biSetAntagonista("Mergulho nas Paralelas") },
          { name: "Mergulho nas Paralelas", sets: 3, repsRange: "10-12", restSeconds: 60, notes: biSetAntagonista("Rosca Direta com Barra") },
          { name: "Rosca Martelo", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "12-15", restSeconds: 60 },
          { name: "Rosca Concentrada", sets: 1, repsRange: "12-15 + 4 mini-blocos de 3-5 (Myo-Reps)", restSeconds: 0, notes: MYO_REPS },
          {
            name: "Tríceps Francês com Halteres",
            sets: 1,
            repsRange: "12-15 + 4 mini-blocos de 3-5 (Myo-Reps)",
            restSeconds: 45,
            notes: obs("Sessão final da semana — os myo-reps de fechamento maximizam o estresse metabólico com o mínimo de séries.", MYO_REPS),
          },
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
      tags: ["EXPRESS"],
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

  console.log(`  Criado: "${entry.name}" (${entry.sessions.length} sessões, tag EXPRESS).`);
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
