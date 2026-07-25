import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 57: 10 programas "Treinos Premium" (5 femininos + 5 masculinos,
// conteúdo avançado fornecido pelo fundador) — mesmo padrão de
// prisma/seed-programas-treinos-prontos.ts (idempotente por nome exato,
// resolve exercício por nome exato contra o catálogo existente, avisa e
// pula se algum nome não bater em vez de falhar o script inteiro).
//
// Notas técnicas: quando uma linha do programa citava uma "Técnica" (Drop-set,
// Rest-Pause, Bi-set, Pico de Contração, Cluster Set), o texto explicativo
// vira o campo `notes` daquele WorkoutExercise — é a "breve descrição de como
// fazer" pedida, visível pro aluno na tela de execução do treino.
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
  sessions: SessionEntry[];
}

const DROP_SET = "Técnica Drop-set: ao falhar com a carga da série, reduza o peso em 20-30% sem descansar e continue até uma nova falha.";
const DROP_SET_DUPLO = "Técnica Drop-set duplo: ao falhar, reduza a carga em 20-30% e continue; ao falhar de novo, reduza mais uma vez e finalize.";
const DROP_SET_TRIPLO = "Técnica Drop-set triplo: ao falhar, reduza a carga em 20-30% e continue; repita a redução mais duas vezes até a falha final.";
const REST_PAUSE = "Técnica Rest-Pause: ao falhar, descanse 10 a 15 segundos mantendo a posição e continue com a mesma carga até falhar de novo.";
const CLUSTER_SET = "Técnica Cluster Set: fracione a série em mini-blocos (ex: 3 mini-séries de 3 repetições) com 10 a 15 segundos de descanso entre eles.";
function picoContracao(segundos: number) {
  return `Técnica Pico de Contração: sustente a fase de máxima contração por ${segundos}s antes de voltar à fase excêntrica.`;
}
function biSet(outro: string) {
  return `Técnica Bi-set: execute em sequência imediata com "${outro}", sem descanso entre os dois.`;
}

const FEMININO: ProgramEntry[] = [
  {
    name: "Bumbum na Nuca Extreme",
    sessions: [
      {
        letter: "A",
        name: "Quadríceps e Glúteos (Ênfase Anterior)",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Agachamento Búlgaro", sets: 3, repsRange: "10-12 por perna", restSeconds: 60 },
          { name: "Leg Press 45", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 60, notes: picoContracao(2) },
          { name: "Elevação Pélvica no Solo", sets: 3, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Membros Superiores e Core",
        exercises: [
          { name: "Puxada Frontal na Polia", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "10-12", restSeconds: 60, notes: picoContracao(2) },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "12-15", restSeconds: 60, notes: DROP_SET },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "12", restSeconds: 0, notes: biSet("Rosca Martelo") },
          { name: "Rosca Martelo", sets: 3, repsRange: "12", restSeconds: 60, notes: biSet("Tríceps Corda na Polia Alta") },
          { name: "Prancha Isométrica", sets: 4, repsRange: "45s", restSeconds: 30 },
        ],
      },
      {
        letter: "C",
        name: "Cadeia Posterior e Glúteos (Ênfase Posterior)",
        exercises: [
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "8-10", restSeconds: 90, notes: REST_PAUSE },
          { name: "Levantamento Terra Romeno", sets: 4, repsRange: "10", restSeconds: 90 },
          { name: "Mesa Flexora", sets: 3, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Abdução de Quadril no Cabo em Pé", sets: 4, repsRange: "12-15", restSeconds: 45 },
          { name: "Panturrilha em Pé", sets: 4, repsRange: "15-20", restSeconds: 45, notes: picoContracao(2) },
        ],
      },
    ],
  },
  {
    name: "Silhueta Ampulheta",
    sessions: [
      {
        letter: "A",
        name: "Glúteos e Abdutores",
        exercises: [
          { name: "Elevação Pélvica com Barra", sets: 4, repsRange: "8-10", restSeconds: 90, notes: CLUSTER_SET },
          { name: "Glúteo Cabo Joelho Estendido", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Step Up Lateral com Halteres", sets: 3, repsRange: "10-12 por perna", restSeconds: 60 },
          { name: "Cadeira Abdutora", sets: 4, repsRange: "15-20", restSeconds: 60, notes: DROP_SET_DUPLO },
          { name: "Exercício Ostra (Clamshell)", sets: 3, repsRange: "15 por lado", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Costas, Ombros e Core",
        exercises: [
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Remada Curvada com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Elevação Lateral no Cabo", sets: 4, repsRange: "12-15", restSeconds: 60, notes: DROP_SET },
          { name: "Desenvolvimento Militar em Pé", sets: 3, repsRange: "10", restSeconds: 60 },
          { name: "Abdominal Canivete", sets: 3, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Quadríceps e Posterior de Coxa",
        exercises: [
          { name: "Agachamento na Máquina Smith", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Stiff com Barra", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Hack Squat na Máquina", sets: 3, repsRange: "10-12", restSeconds: 60, notes: REST_PAUSE },
          { name: "Cadeira Flexora Sentado", sets: 4, repsRange: "12", restSeconds: 60, notes: DROP_SET },
          { name: "Panturrilha no Leg Press", sets: 4, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "D",
        name: "Peito, Braços e Abdômen",
        exercises: [
          { name: "Crucifixo Reto com Halteres", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Rosca Direta com Barra", sets: 3, repsRange: "10-12", restSeconds: 45 },
          { name: "Tríceps Testa com Barra", sets: 3, repsRange: "10-12", restSeconds: 45 },
          { name: "Rotação Russa (Russian Twist)", sets: 3, repsRange: "20", restSeconds: 30 },
          { name: "Abdominal Bicicleta", sets: 3, repsRange: "20", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Pernas Magníficas",
    sessions: [
      {
        letter: "A",
        name: "Quadríceps Dominante",
        exercises: [
          { name: "Agachamento Frontal", sets: 4, repsRange: "6-8", restSeconds: 120 },
          { name: "Leg Press 45", sets: 4, repsRange: "10-12", restSeconds: 60, notes: REST_PAUSE },
          { name: "Passada com Halteres", sets: 3, repsRange: "12 passos por perna", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 4, repsRange: "12-15", restSeconds: 60, notes: DROP_SET_TRIPLO },
          { name: "Agachamento Sumô com Halter", sets: 3, repsRange: "12-15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Dorsal, Deltoides e Tríceps",
        exercises: [
          { name: "Remada Unilateral com Halter", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Puxada Frontal com Pegada Fechada", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "12", restSeconds: 60, notes: REST_PAUSE },
          { name: "Crucifixo Inverso com Halteres", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Mergulho nas Paralelas", sets: 3, repsRange: "10-12", restSeconds: 60 },
        ],
      },
      {
        letter: "C",
        name: "Posterior de Coxa e Glúteo Máximo",
        exercises: [
          { name: "Levantamento Terra Sumô", sets: 4, repsRange: "6-8", restSeconds: 120 },
          { name: "Stiff com Halteres", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Mesa Flexora", sets: 4, repsRange: "10-12", restSeconds: 60, notes: picoContracao(2) },
          { name: "Pull-Through no Cabo", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Panturrilha Sentado", sets: 4, repsRange: "15-20", restSeconds: 45 },
        ],
      },
      {
        letter: "D",
        name: "Glúteo Isolado, Abdutores e Core",
        exercises: [
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "8-10", restSeconds: 60, notes: DROP_SET },
          { name: "Abdução de Quadril no Banco 45°", sets: 4, repsRange: "12-15", restSeconds: 45 },
          { name: "Cadeira Abdutora", sets: 3, repsRange: "15-20", restSeconds: 60, notes: picoContracao(3) },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Prancha Lateral", sets: 3, repsRange: "30s por lado", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Corpo Esculpido Pro",
    sessions: [
      {
        letter: "A",
        name: "Glúteo Foco Total",
        exercises: [
          { name: "Elevação Pélvica com Barra", sets: 5, repsRange: "8-10", restSeconds: 60, notes: picoContracao(2) },
          { name: "Agachamento Búlgaro", sets: 3, repsRange: "10 por perna", restSeconds: 60 },
          { name: "Glúteo Cabo Joelho Estendido", sets: 4, repsRange: "12", restSeconds: 60, notes: DROP_SET },
          { name: "Abdução de Quadril no Cabo em Pé", sets: 4, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Costas e Bíceps",
        exercises: [
          { name: "Puxada Frontal na Polia", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Remada Cavalinho", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Pulldown com Braços Estendidos", sets: 3, repsRange: "12-15", restSeconds: 60, notes: picoContracao(2) },
          { name: "Rosca Concentrada", sets: 3, repsRange: "12", restSeconds: 0, notes: biSet("Rosca Martelo") },
          { name: "Rosca Martelo", sets: 3, repsRange: "12", restSeconds: 60, notes: biSet("Rosca Concentrada") },
        ],
      },
      {
        letter: "C",
        name: "Quadríceps e Adutores",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "8", restSeconds: 90 },
          { name: "Hack Squat na Máquina", sets: 3, repsRange: "10-12", restSeconds: 60, notes: REST_PAUSE },
          { name: "Cadeira Extensora", sets: 4, repsRange: "12-15", restSeconds: 60, notes: DROP_SET },
          { name: "Cadeira Adutora", sets: 4, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "D",
        name: "Ombros, Peito e Tríceps",
        exercises: [
          { name: "Desenvolvimento Arnold", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Elevação Lateral no Cabo", sets: 4, repsRange: "12-15", restSeconds: 60, notes: DROP_SET },
          { name: "Crucifixo Inclinado com Halteres", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Tríceps Francês com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
        ],
      },
      {
        letter: "E",
        name: "Posterior de Coxa, Panturrilhas e Core",
        exercises: [
          { name: "Stiff com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Cadeira Flexora Sentado", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Elevação Pélvica Unilateral", sets: 3, repsRange: "12 por perna", restSeconds: 45 },
          { name: "Panturrilha em Pé com Halteres", sets: 4, repsRange: "15", restSeconds: 45 },
          { name: "Elevação de Pernas na Barra Fixa", sets: 3, repsRange: "12-15", restSeconds: 45 },
        ],
      },
    ],
  },
  {
    name: "Definição de Conjunto",
    sessions: [
      {
        letter: "A",
        name: "Cadeia Anterior (Quadríceps, Peito e Tríceps)",
        exercises: [
          { name: "Agachamento Goblet", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Leg Press 45", sets: 3, repsRange: "12", restSeconds: 60, notes: REST_PAUSE },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 60, notes: DROP_SET },
          { name: "Supino Reto com Halteres", sets: 3, repsRange: "12", restSeconds: 0, notes: biSet("Tríceps Corda na Polia Alta") },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "12", restSeconds: 60, notes: biSet("Supino Reto com Halteres") },
          { name: "Prancha Isométrica", sets: 3, repsRange: "60s", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Cadeia Posterior (Glúteos, Posteriores e Costas)",
        exercises: [
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "10", restSeconds: 60, notes: picoContracao(2) },
          { name: "Levantamento Terra Romeno", sets: 4, repsRange: "10", restSeconds: 90 },
          { name: "Cadeira Flexora Sentado", sets: 3, repsRange: "12", restSeconds: 60, notes: DROP_SET },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "12", restSeconds: 0, notes: biSet("Remada Baixa no Cabo") },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "12", restSeconds: 60, notes: biSet("Puxada Frontal na Polia") },
          { name: "Panturrilha em Pé", sets: 4, repsRange: "15", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Deltoides, Adutores/Abdutores e Core",
        exercises: [
          { name: "Desenvolvimento com Halteres", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "12-15", restSeconds: 60, notes: DROP_SET },
          { name: "Cadeira Abdutora", sets: 3, repsRange: "15", restSeconds: 0, notes: biSet("Cadeira Adutora") },
          { name: "Cadeira Adutora", sets: 3, repsRange: "15", restSeconds: 45, notes: biSet("Cadeira Abdutora") },
          { name: "Abdução de Quadril no Cabo em Pé", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Abdominal Supra no Solo", sets: 3, repsRange: "15", restSeconds: 0, notes: biSet("Abdominal Infra no Solo") },
          { name: "Abdominal Infra no Solo", sets: 3, repsRange: "15", restSeconds: 45, notes: biSet("Abdominal Supra no Solo") },
        ],
      },
    ],
  },
];

const MASCULINO: ProgramEntry[] = [
  {
    name: "Hipertrofia Extrema Pro",
    sessions: [
      {
        letter: "A",
        name: "Peito e Tríceps",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "6-8", restSeconds: 90, notes: CLUSTER_SET },
          { name: "Supino Inclinado com Halteres", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Crucifixo Inclinado com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Crossover no Cabo", sets: 3, repsRange: "12-15", restSeconds: 60, notes: DROP_SET },
          { name: "Tríceps Testa com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "10-12", restSeconds: 60, notes: REST_PAUSE },
        ],
      },
      {
        letter: "B",
        name: "Costas e Bíceps",
        exercises: [
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Remada Curvada com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Puxada Alta com Triângulo", sets: 3, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Remada Unilateral com Halter", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Rosca Direta com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Rosca Martelo", sets: 3, repsRange: "10-12", restSeconds: 60, notes: picoContracao(2) },
        ],
      },
      {
        letter: "C",
        name: "Quadríceps e Panturrilhas",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "6-8", restSeconds: 120 },
          { name: "Leg Press 45", sets: 4, repsRange: "10-12", restSeconds: 60, notes: REST_PAUSE },
          { name: "Hack Squat na Máquina", sets: 3, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 60, notes: picoContracao(2) },
          { name: "Panturrilha em Pé", sets: 5, repsRange: "15-20", restSeconds: 45, notes: picoContracao(2) },
        ],
      },
      {
        letter: "D",
        name: "Ombros e Trapézio",
        exercises: [
          { name: "Desenvolvimento Militar em Pé", sets: 4, repsRange: "6-8", restSeconds: 120 },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET_TRIPLO },
          { name: "Elevação Lateral no Cabo", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Crucifixo Inverso na Máquina", sets: 4, repsRange: "12-15", restSeconds: 60, notes: picoContracao(2) },
          { name: "Encolhimento com Barra", sets: 4, repsRange: "10-12", restSeconds: 60 },
        ],
      },
      {
        letter: "E",
        name: "Posterior de Coxa e Core",
        exercises: [
          { name: "Levantamento Terra Romeno", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Mesa Flexora", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Stiff com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 4, repsRange: "12", restSeconds: 60 },
          { name: "Elevação de Pernas na Barra Fixa", sets: 4, repsRange: "12-15", restSeconds: 45 },
        ],
      },
    ],
  },
  {
    name: "Shape Inabalável",
    sessions: [
      {
        letter: "A",
        name: "Peito e Deltoide Anterior/Medial",
        exercises: [
          { name: "Supino Inclinado com Barra", sets: 4, repsRange: "6-8", restSeconds: 90, notes: CLUSTER_SET },
          { name: "Supino Reto com Halteres", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Peck Deck (Voador)", sets: 3, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Desenvolvimento com Halteres", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Elevação Lateral no Cabo", sets: 4, repsRange: "12-15", restSeconds: 60, notes: REST_PAUSE },
        ],
      },
      {
        letter: "B",
        name: "Costas e Deltoide Posterior",
        exercises: [
          { name: "Levantamento Terra", sets: 4, repsRange: "5-6", restSeconds: 120 },
          { name: "Remada Cavalinho", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Crucifixo Inverso com Halteres", sets: 4, repsRange: "12-15", restSeconds: 60 },
          { name: "Face Pull no Cabo", sets: 3, repsRange: "12-15", restSeconds: 45, notes: picoContracao(2) },
        ],
      },
      {
        letter: "C",
        name: "Membros Inferiores Completo",
        exercises: [
          { name: "Agachamento Frontal", sets: 4, repsRange: "6-8", restSeconds: 120 },
          { name: "Agachamento Búlgaro", sets: 3, repsRange: "10 por perna", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 60, notes: REST_PAUSE },
          { name: "Mesa Flexora", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Panturrilha no Leg Press", sets: 4, repsRange: "15-20", restSeconds: 45 },
        ],
      },
      {
        letter: "D",
        name: "Braços (Bíceps/Tríceps/Antebraço) e Core",
        exercises: [
          { name: "Rosca Scott com Barra", sets: 4, repsRange: "8-10", restSeconds: 0, notes: biSet("Tríceps Testa com Barra") },
          { name: "Tríceps Testa com Barra", sets: 4, repsRange: "8-10", restSeconds: 60, notes: biSet("Rosca Scott com Barra") },
          { name: "Rosca Martelo no Cabo com Corda", sets: 3, repsRange: "10-12", restSeconds: 0, notes: biSet("Tríceps Pulley Barra Reta") },
          { name: "Tríceps Pulley Barra Reta", sets: 3, repsRange: "10-12", restSeconds: 60, notes: biSet("Rosca Martelo no Cabo com Corda") },
          { name: "Rosca 21", sets: 3, repsRange: "21 (7+7+7 parciais)", restSeconds: 60 },
          { name: "Rosca Punho", sets: 3, repsRange: "15", restSeconds: 45 },
          { name: "Abdominal Canivete", sets: 4, repsRange: "15", restSeconds: 45 },
        ],
      },
    ],
  },
  {
    name: "V-Taper Master",
    sessions: [
      {
        letter: "A",
        name: "Push (Empurrar)",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "6-8", restSeconds: 120 },
          { name: "Desenvolvimento Militar em Pé", sets: 4, repsRange: "6-8", restSeconds: 120 },
          { name: "Supino Inclinado com Halteres", sets: 3, repsRange: "8-10", restSeconds: 90 },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Mergulho nas Paralelas", sets: 3, repsRange: "8-10 com sobrecarga", restSeconds: 90 },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "10-12", restSeconds: 60, notes: REST_PAUSE },
        ],
      },
      {
        letter: "B",
        name: "Pull (Puxar)",
        exercises: [
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Remada Curvada com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "10-12", restSeconds: 60, notes: picoContracao(2) },
          { name: "Crucifixo Inverso na Máquina", sets: 4, repsRange: "12-15", restSeconds: 60 },
          { name: "Rosca Direta com Barra", sets: 4, repsRange: "8-10", restSeconds: 60, notes: DROP_SET },
          { name: "Rosca Martelo", sets: 3, repsRange: "10-12", restSeconds: 60 },
        ],
      },
      {
        letter: "C",
        name: "Legs (Pernas e Core)",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "6-8", restSeconds: 120 },
          { name: "Leg Press 45", sets: 4, repsRange: "10-12", restSeconds: 60, notes: REST_PAUSE },
          { name: "Stiff com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Cadeira Flexora Sentado", sets: 3, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Panturrilha em Pé", sets: 5, repsRange: "15-20", restSeconds: 45 },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 4, repsRange: "12", restSeconds: 45 },
        ],
      },
    ],
  },
  {
    name: "Monster Mass",
    sessions: [
      {
        letter: "A",
        name: "Peito Dominante",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "6-8", restSeconds: 90, notes: CLUSTER_SET },
          { name: "Supino Inclinado com Halteres", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Crucifixo Reto com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Crossover no Cabo", sets: 4, repsRange: "12-15", restSeconds: 60, notes: DROP_SET_TRIPLO },
        ],
      },
      {
        letter: "B",
        name: "Costas e Trapézio",
        exercises: [
          { name: "Remada Curvada com Barra", sets: 4, repsRange: "6-8", restSeconds: 120 },
          { name: "Puxada Frontal com Pegada Fechada", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Remada Unilateral com Halter", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Pulldown com Braços Estendidos", sets: 3, repsRange: "12-15", restSeconds: 60, notes: picoContracao(2) },
          { name: "Encolhimento com Barra", sets: 4, repsRange: "10-12", restSeconds: 60, notes: REST_PAUSE },
        ],
      },
      {
        letter: "C",
        name: "Quadríceps e Panturrilhas",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "6-8", restSeconds: 120 },
          { name: "Hack Squat na Máquina", sets: 4, repsRange: "8-10", restSeconds: 60, notes: REST_PAUSE },
          { name: "Passada com Halteres", sets: 3, repsRange: "12 passos por perna", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 4, repsRange: "12-15", restSeconds: 60, notes: DROP_SET },
          { name: "Panturrilha Sentado", sets: 4, repsRange: "15-20", restSeconds: 45 },
        ],
      },
      {
        letter: "D",
        name: "Ombros Completo",
        exercises: [
          { name: "Desenvolvimento Arnold", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Elevação Lateral na Máquina", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Elevação Frontal com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Crucifixo Inverso com Halteres", sets: 4, repsRange: "12-15", restSeconds: 60 },
          { name: "Face Pull na Corda para Ombro", sets: 3, repsRange: "15", restSeconds: 45, notes: picoContracao(2) },
        ],
      },
      {
        letter: "E",
        name: "Posterior, Braços e Core",
        exercises: [
          { name: "Levantamento Terra Romeno", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Mesa Flexora", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Rosca Scott com Barra", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Tríceps Francês com Halteres", sets: 4, repsRange: "8-10", restSeconds: 60 },
          { name: "Farmer's Walk com Halteres", sets: 3, repsRange: "60s", restSeconds: 60 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "60s", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Força & Volume Titã",
    sessions: [
      {
        letter: "A",
        name: "Upper Body (Foco Peito e Costas Pesado)",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "5-6", restSeconds: 90, notes: CLUSTER_SET },
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "6-8 com sobrecarga", restSeconds: 120 },
          { name: "Supino Inclinado na Máquina Smith", sets: 3, repsRange: "8-10", restSeconds: 60, notes: REST_PAUSE },
          { name: "Remada Cavalinho", sets: 3, repsRange: "8-10", restSeconds: 90 },
          { name: "Pullover com Halter", sets: 3, repsRange: "10-12", restSeconds: 60 },
        ],
      },
      {
        letter: "B",
        name: "Lower Body (Foco Quadríceps e Panturrilha)",
        exercises: [
          { name: "Agachamento Frontal", sets: 4, repsRange: "5-6", restSeconds: 120 },
          { name: "Leg Press 45", sets: 4, repsRange: "8-10", restSeconds: 60, notes: DROP_SET },
          { name: "Agachamento Búlgaro", sets: 3, repsRange: "10 por perna", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 60, notes: picoContracao(2) },
          { name: "Panturrilha em Pé", sets: 5, repsRange: "12-15", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Upper Body (Foco Ombros e Braços)",
        exercises: [
          { name: "Desenvolvimento Militar em Pé", sets: 4, repsRange: "6-8", restSeconds: 120 },
          { name: "Elevação Lateral no Cabo", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Rosca Scott com Barra", sets: 4, repsRange: "8-10", restSeconds: 60, notes: REST_PAUSE },
          { name: "Tríceps Francês com Halteres", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Rosca Inversa com Barra", sets: 3, repsRange: "12", restSeconds: 45 },
        ],
      },
      {
        letter: "D",
        name: "Lower Body (Foco Posterior, Glúteo e Core)",
        exercises: [
          { name: "Levantamento Terra Sumô", sets: 4, repsRange: "5-6", restSeconds: 120 },
          { name: "Stiff com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Cadeira Flexora Sentado", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 4, repsRange: "12", restSeconds: 60 },
          { name: "Elevação de Pernas na Barra Fixa", sets: 4, repsRange: "12-15", restSeconds: 45 },
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
  console.log("Programas Premium — femininos:");
  for (const p of FEMININO) await createProgram(p);
  console.log("Programas Premium — masculinos:");
  for (const p of MASCULINO) await createProgram(p);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
