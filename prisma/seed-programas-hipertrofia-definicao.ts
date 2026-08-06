import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 115: 12 programas PREMIUM novos, criados a partir de um levantamento
// real do catálogo (WorkoutProgram origin: SELF, category: PREMIUM) contra
// o enum WorkoutTag (Fase 63). Achado: FEMININO(4)/EXPRESS(5)/INICIANTE(3)/
// INTERMEDIARIO(8)/AVANCADO(10) já tinham cobertura real, mas as duas tags
// HIPERTROFIA e DEFINICAO — que existem no enum desde a Fase 63 — nunca
// foram aplicadas a NENHUM programa real do catálogo (0 cada; as únicas
// linhas com essas tags no banco eram fixture de teste E2E "Fase 63 —
// Treino com Tags"/"Treino Tags E2E", sem relação com conteúdo real). Este
// lote fecha essa lacuna: HIPERTROFIA e DEFINICAO aparecem em 7 programas
// cada (2 sozinhas, 2 combinadas — "recomposição corporal"), e de
// passagem reforça também INICIANTE (+3) e FEMININO (+3), os próximos
// níveis mais escassos.
//
// Nomes escolhidos em inglês/termos internacionais de fitness (mesmo padrão
// já usado no catálogo: "Monster Mass", "V-Taper Master", "Metabolic Burn
// 40") — funcionam como estão nos 3 idiomas do app (PT/EN/ES), sem precisar
// de tradução própria de nome. Descrição, nomes de sessão e observações
// ficam em PT (canônico), mesmo padrão de todo programa curado anterior —
// tradução de descrição é um seed separado (ver Fase 53/59), fora do pedido
// desta rodada.
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
type Tag = "FEMININO" | "HIPERTROFIA" | "DEFINICAO" | "EXPRESS" | "INICIANTE" | "INTERMEDIARIO" | "AVANCADO";
interface ProgramEntry {
  name: string;
  description: string;
  tags: Tag[];
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
    name: "Prime Mass",
    description:
      "Introdução à hipertrofia para quem está começando: divisão AB de corpo inteiro, cargas moderadas e técnica em primeiro lugar, para construir a base de força e massa muscular com segurança.",
    tags: ["HIPERTROFIA", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Inferiores e Push",
        exercises: [
          {
            name: "Agachamento Livre",
            sets: 4,
            repsRange: "8-10",
            restSeconds: 90,
            notes: "Priorize a profundidade completa (coxa paralela ao chão) antes de aumentar a carga — é a base de todo o programa.",
          },
          { name: "Leg Press 45", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Supino Reto com Barra", sets: 3, repsRange: "8-10", restSeconds: 90 },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Tríceps Testa com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
        ],
      },
      {
        letter: "B",
        name: "Pull e Posterior",
        exercises: [
          {
            name: "Levantamento Terra Romeno",
            sets: 4,
            repsRange: "8-10",
            restSeconds: 90,
            notes: "Mantenha a coluna neutra durante todo o movimento — a tensão deve ser sentida no posterior de coxa, nunca na lombar.",
          },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Remada Curvada com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Rosca Direta com Barra", sets: 3, repsRange: "10-12", restSeconds: 45 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "30-45s", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Hybrid Volume",
    description:
      "Push-pull-legs de alto volume para ganho de massa muscular, em divisão ABC de 4 a 6 dias por semana, com técnicas de intensificação nos exercícios de isolamento.",
    tags: ["HIPERTROFIA", "INTERMEDIARIO"],
    sessions: [
      {
        letter: "A",
        name: "Peito e Tríceps",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Supino Inclinado com Halteres", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Crossover no Cabo", sets: 3, repsRange: "12-15", restSeconds: 45, notes: picoContracao(2) },
          { name: "Desenvolvimento Militar em Pé", sets: 3, repsRange: "8-10", restSeconds: 90 },
          { name: "Tríceps Testa com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "12-15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Costas e Bíceps",
        exercises: [
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Remada Curvada com Barra", sets: 4, repsRange: "8-10", restSeconds: 90, notes: REST_PAUSE },
          { name: "Puxada Triângulo Neutra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Rosca Direta com Barra", sets: 3, repsRange: "10-12", restSeconds: 0, notes: biSet("Rosca Martelo") },
          { name: "Rosca Martelo", sets: 3, repsRange: "12", restSeconds: 45, notes: biSet("Rosca Direta com Barra") },
        ],
      },
      {
        letter: "C",
        name: "Pernas Completo",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "6-8", restSeconds: 120 },
          { name: "Leg Press 45", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 45, notes: picoContracao(2) },
          { name: "Mesa Flexora", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Panturrilha em Pé", sets: 4, repsRange: "15-20", restSeconds: 45 },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 3, repsRange: "12", restSeconds: 45 },
        ],
      },
    ],
  },
  {
    name: "Titan Hypertrophy",
    description:
      "Hipertrofia avançada em divisão ABCDE de 5 dias por semana, com cargas próximas da falha, técnicas de intensificação em quase todo exercício e volume alto para quem já tem anos de treino.",
    tags: ["HIPERTROFIA", "AVANCADO"],
    sessions: [
      {
        letter: "A",
        name: "Peito e Tríceps",
        exercises: [
          { name: "Supino Reto com Barra", sets: 5, repsRange: "6-8", restSeconds: 120 },
          { name: "Supino Inclinado com Halteres", sets: 4, repsRange: "8-10", restSeconds: 90, notes: REST_PAUSE },
          { name: "Crucifixo Inclinado com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60, notes: picoContracao(2) },
          { name: "Crossover Baixo no Cabo", sets: 3, repsRange: "12-15", restSeconds: 45, notes: DROP_SET },
          { name: "Tríceps Francês com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Tríceps Pulley Barra Reta", sets: 3, repsRange: "12-15", restSeconds: 45, notes: DROP_SET_DUPLO },
        ],
      },
      {
        letter: "B",
        name: "Costas e Bíceps",
        exercises: [
          { name: "Levantamento Terra", sets: 5, repsRange: "5-6", restSeconds: 150 },
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "8-10", restSeconds: 90, notes: REST_PAUSE },
          { name: "Remada Cavalinho", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Pulldown com Braços Estendidos", sets: 3, repsRange: "12-15", restSeconds: 45, notes: picoContracao(2) },
          { name: "Rosca Direta com Barra", sets: 4, repsRange: "8-10", restSeconds: 60, notes: DROP_SET },
          { name: "Rosca Martelo", sets: 3, repsRange: "12", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Pernas (Quadríceps Dominante)",
        exercises: [
          { name: "Agachamento Frontal", sets: 5, repsRange: "6-8", restSeconds: 120 },
          { name: "Hack Squat na Máquina", sets: 4, repsRange: "8-10", restSeconds: 90, notes: REST_PAUSE },
          { name: "Cadeira Extensora", sets: 4, repsRange: "12-15", restSeconds: 60, notes: DROP_SET_TRIPLO },
          { name: "Afundo Caminhando com Barra", sets: 3, repsRange: "10 passos por perna", restSeconds: 60 },
          { name: "Panturrilha no Leg Press", sets: 4, repsRange: "15-20", restSeconds: 45 },
        ],
      },
      {
        letter: "D",
        name: "Ombro e Trapézio",
        exercises: [
          { name: "Desenvolvimento com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "12-15", restSeconds: 45, notes: DROP_SET },
          { name: "Elevação Lateral no Cabo", sets: 3, repsRange: "15", restSeconds: 45, notes: picoContracao(2) },
          { name: "Face Pull na Corda para Ombro", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Encolhimento com Barra", sets: 4, repsRange: "10-12", restSeconds: 60, notes: picoContracao(2) },
          { name: "Remada Alta Pegada de Arranco (Snatch Grip High Pull)", sets: 3, repsRange: "8", restSeconds: 90 },
        ],
      },
      {
        letter: "E",
        name: "Posterior de Coxa, Glúteos e Core",
        exercises: [
          { name: "Levantamento Terra Romeno", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Cadeira Flexora Sentado", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "8-10", restSeconds: 60, notes: CLUSTER_SET },
          { name: "Glúteo Cabo Joelho Estendido", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 4, repsRange: "12", restSeconds: 45 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "60s", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Lean Start",
    description:
      "Primeiro programa de definição para iniciantes: circuitos de corpo inteiro em divisão AB, repetições altas, descanso curto e finalizadores metabólicos, sem carga pesada.",
    tags: ["DEFINICAO", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Circuito de Corpo Inteiro (Ênfase Inferior)",
        exercises: [
          {
            name: "Agachamento com Peso Corporal",
            sets: 3,
            repsRange: "15-20",
            restSeconds: 30,
            notes: "Ritmo constante, sem pausa no topo — o objetivo aqui é elevar a frequência cardíaca, não a carga.",
          },
          { name: "Afundo com Halteres", sets: 3, repsRange: "12 por perna", restSeconds: 30 },
          { name: "Elevação Pélvica no Solo", sets: 3, repsRange: "15-20", restSeconds: 30 },
          { name: "Flexão de Braço Inclinada", sets: 3, repsRange: "12-15", restSeconds: 30 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "30-45s", restSeconds: 30 },
          {
            name: "Polichinelo (Jumping Jacks)",
            sets: 3,
            repsRange: "30s",
            restSeconds: 30,
            notes: "Finalizador metabólico — mantenha o ritmo alto pelos 30s completos.",
          },
        ],
      },
      {
        letter: "B",
        name: "Circuito de Corpo Inteiro (Ênfase Superior)",
        exercises: [
          { name: "Remada Invertida na Barra", sets: 3, repsRange: "12-15", restSeconds: 30 },
          { name: "Desenvolvimento com Halteres Sentado", sets: 3, repsRange: "12-15", restSeconds: 30 },
          { name: "Rosca Alternada com Halteres", sets: 3, repsRange: "12", restSeconds: 30 },
          { name: "Tríceps Banco com Peso", sets: 3, repsRange: "12-15", restSeconds: 30 },
          { name: "Abdominal Bicicleta", sets: 3, repsRange: "20", restSeconds: 30 },
          {
            name: "Mountain Climbers",
            sets: 3,
            repsRange: "30s",
            restSeconds: 30,
            notes: "Finalizador metabólico — mantenha o core firme, sem deixar o quadril subir.",
          },
        ],
      },
    ],
  },
  {
    name: "Shred Circuit",
    description:
      "Definição rápida em sessões curtas (35 a 40 minutos): circuitos e supersets em divisão ABC, com finalizadores de alta intensidade para maximizar o gasto calórico no tempo disponível.",
    tags: ["DEFINICAO", "EXPRESS", "INTERMEDIARIO"],
    sessions: [
      {
        letter: "A",
        name: "Superiores em Circuito",
        exercises: [
          { name: "Supino Reto com Halteres", sets: 3, repsRange: "12", restSeconds: 0, notes: biSet("Remada Unilateral com Halter") },
          { name: "Remada Unilateral com Halter", sets: 3, repsRange: "12", restSeconds: 45, notes: biSet("Supino Reto com Halteres") },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "12", restSeconds: 0, notes: biSet("Puxada Frontal na Polia") },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "12", restSeconds: 45, notes: biSet("Desenvolvimento com Halteres") },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "15", restSeconds: 30 },
          { name: "Rosca Martelo", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Inferiores em Circuito",
        exercises: [
          { name: "Agachamento Búlgaro", sets: 3, repsRange: "12 por perna", restSeconds: 30 },
          { name: "Leg Press 45", sets: 3, repsRange: "15", restSeconds: 30, notes: REST_PAUSE },
          { name: "Stiff com Halteres", sets: 3, repsRange: "12", restSeconds: 30 },
          { name: "Cadeira Abdutora", sets: 3, repsRange: "15-20", restSeconds: 30 },
          { name: "Panturrilha em Pé", sets: 3, repsRange: "20", restSeconds: 30 },
          {
            name: "Corrida Intervalada (Sprints)",
            sets: 4,
            repsRange: "30s",
            restSeconds: 30,
            notes: "4 tiros de 30s em ritmo forte, com 30s de caminhada entre eles — finalizador metabólico.",
          },
        ],
      },
      {
        letter: "C",
        name: "Corpo Inteiro Metabólico",
        exercises: [
          { name: "Thruster com Halteres", sets: 4, repsRange: "10", restSeconds: 45 },
          { name: "Balanço com Kettlebell (Kettlebell Swing)", sets: 4, repsRange: "15", restSeconds: 30 },
          { name: "Mountain Climbers", sets: 4, repsRange: "30s", restSeconds: 20 },
          {
            name: "Burpees",
            sets: 3,
            repsRange: "12",
            restSeconds: 30,
            notes: "Priorize execução completa (peito no chão, salto no topo) mesmo que precise reduzir o ritmo.",
          },
          { name: "Prancha com Toque no Ombro", sets: 3, repsRange: "20", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Cut Elite",
    description:
      "Definição avançada em divisão ABCD, com supersets densos, drop-sets e finalizadores de HIIT — para quem já tem base de treino e quer secar mantendo o máximo de massa muscular possível.",
    tags: ["DEFINICAO", "AVANCADO"],
    sessions: [
      {
        letter: "A",
        name: "Peito, Ombro e Tríceps em Superset",
        exercises: [
          { name: "Supino Inclinado com Halteres", sets: 4, repsRange: "10-12", restSeconds: 0, notes: biSet("Flexão com Pés Elevados") },
          { name: "Flexão com Pés Elevados", sets: 4, repsRange: "15", restSeconds: 45, notes: biSet("Supino Inclinado com Halteres") },
          { name: "Desenvolvimento Arnold", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "15", restSeconds: 30, notes: DROP_SET },
          { name: "Tríceps Pulley com Corda", sets: 4, repsRange: "15", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Costas e Bíceps em Superset",
        exercises: [
          { name: "Puxada Alta Aberta", sets: 4, repsRange: "10-12", restSeconds: 0, notes: biSet("Rosca Direta com Halteres") },
          { name: "Rosca Direta com Halteres", sets: 4, repsRange: "12", restSeconds: 45, notes: biSet("Puxada Alta Aberta") },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Remada Cavalinho", sets: 4, repsRange: "12", restSeconds: 30, notes: REST_PAUSE },
          { name: "Prancha com Rotação", sets: 3, repsRange: "20", restSeconds: 30 },
        ],
      },
      {
        letter: "C",
        name: "Pernas em Circuito Metabólico",
        exercises: [
          { name: "Agachamento Sumô com Halter", sets: 4, repsRange: "15", restSeconds: 30 },
          { name: "Leg Press 45", sets: 4, repsRange: "15", restSeconds: 30, notes: DROP_SET_DUPLO },
          { name: "Cadeira Extensora", sets: 4, repsRange: "15-20", restSeconds: 30 },
          { name: "Mesa Flexora", sets: 4, repsRange: "15", restSeconds: 30 },
          { name: "Panturrilha no Leg Press", sets: 4, repsRange: "20", restSeconds: 30 },
          {
            name: "Corrida Intervalada (Sprints)",
            sets: 5,
            repsRange: "30s",
            restSeconds: 30,
            notes: "5 tiros de 30s no ritmo mais forte que conseguir sustentar, com 30s de caminhada entre eles.",
          },
        ],
      },
      {
        letter: "D",
        name: "Glúteos, Core e Finalizador",
        exercises: [
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "12", restSeconds: 45 },
          { name: "Abdução de Quadril no Cabo em Pé", sets: 4, repsRange: "15", restSeconds: 30, notes: DROP_SET },
          { name: "Elevação Pélvica Unilateral", sets: 3, repsRange: "15 por perna", restSeconds: 30 },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 4, repsRange: "12", restSeconds: 30 },
          {
            name: "Assault Bike (Bicicleta de Ar)",
            sets: 6,
            repsRange: "20s",
            restSeconds: 20,
            notes: "6 tiros de 20s em esforço máximo, 20s de recuperação ativa — finalizador HIIT clássico.",
          },
        ],
      },
    ],
  },
  {
    name: "Glow Tone",
    description:
      "Tonificação feminina para iniciantes, em divisão AB, com ênfase em glúteos, pernas e core — cargas leves a moderadas e execução controlada para aprender o movimento antes de progredir.",
    tags: ["FEMININO", "DEFINICAO", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Glúteos, Pernas e Core",
        exercises: [
          {
            name: "Agachamento Goblet",
            sets: 3,
            repsRange: "15",
            restSeconds: 45,
            notes: "Desça até a coxa ficar paralela ao chão, sem deixar o joelho passar da ponta do pé.",
          },
          { name: "Elevação Pélvica no Solo", sets: 3, repsRange: "15-20", restSeconds: 30 },
          { name: "Cadeira Abdutora", sets: 3, repsRange: "15-20", restSeconds: 30 },
          { name: "Exercício Ostra (Clamshell)", sets: 3, repsRange: "15 por lado", restSeconds: 30 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "30s", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Superiores e Abdômen",
        exercises: [
          { name: "Remada Invertida na Barra", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Desenvolvimento com Halteres Sentado", sets: 3, repsRange: "12", restSeconds: 30 },
          { name: "Elevação Lateral com Halteres", sets: 3, repsRange: "15", restSeconds: 30 },
          { name: "Tríceps Banco com Peso", sets: 3, repsRange: "12-15", restSeconds: 30 },
          { name: "Abdominal Infra no Solo", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Curve Builder",
    description:
      "Hipertrofia feminina de glúteos e pernas com tonificação de superiores, em divisão ABC, para quem já tem experiência de treino e quer aumentar volume muscular com definição de curvas.",
    tags: ["FEMININO", "HIPERTROFIA", "INTERMEDIARIO"],
    sessions: [
      {
        letter: "A",
        name: "Glúteos Foco Isolado",
        exercises: [
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "10-12", restSeconds: 60, notes: CLUSTER_SET },
          { name: "Agachamento Búlgaro", sets: 4, repsRange: "10 por perna", restSeconds: 60 },
          { name: "Abdução de Quadril no Banco 45°", sets: 4, repsRange: "15", restSeconds: 45, notes: DROP_SET },
          { name: "Cadeira Abdutora", sets: 3, repsRange: "15-20", restSeconds: 45, notes: picoContracao(2) },
          { name: "Elevação Pélvica Unilateral", sets: 3, repsRange: "15 por perna", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Costas, Ombro e Braços",
        exercises: [
          { name: "Puxada Frontal na Polia", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "12-15", restSeconds: 45, notes: DROP_SET },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Rosca Alternada com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Quadríceps, Posterior e Core",
        exercises: [
          { name: "Agachamento na Máquina Smith", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Levantamento Terra Romeno", sets: 4, repsRange: "10", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 4, repsRange: "12-15", restSeconds: 45, notes: DROP_SET_TRIPLO },
          { name: "Mesa Flexora", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Abdominal Canivete no Cabo", sets: 3, repsRange: "15", restSeconds: 45 },
        ],
      },
    ],
  },
  {
    name: "Body Recomp",
    description:
      "Recomposição corporal (ganho de massa e perda de gordura ao mesmo tempo) em divisão ABC: treino de força no início de cada sessão e finalizador cardiovascular no final.",
    tags: ["HIPERTROFIA", "DEFINICAO", "INTERMEDIARIO"],
    sessions: [
      {
        letter: "A",
        name: "Peito, Ombro e Tríceps + Finalizador",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Crucifixo Reto com Halteres", sets: 3, repsRange: "12", restSeconds: 45, notes: picoContracao(2) },
          { name: "Tríceps Testa com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          {
            name: "Elíptico",
            sets: 1,
            repsRange: "10min",
            restSeconds: 0,
            notes: "Finalizador: 10 minutos em ritmo moderado-alto (percepção de esforço 7/10), sem pausas.",
          },
        ],
      },
      {
        letter: "B",
        name: "Costas e Bíceps + Finalizador",
        exercises: [
          { name: "Remada Curvada com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Remada Serrote no Cabo", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Rosca Direta com Barra", sets: 3, repsRange: "10-12", restSeconds: 45 },
          {
            name: "Pular Corda",
            sets: 1,
            repsRange: "8min",
            restSeconds: 0,
            notes: "Finalizador: 8 minutos alternando 1min de ritmo forte e 1min de ritmo leve.",
          },
        ],
      },
      {
        letter: "C",
        name: "Pernas e Core + Finalizador",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Leg Press 45", sets: 3, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Stiff com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 3, repsRange: "12", restSeconds: 30 },
          {
            name: "Remo Ergométrico",
            sets: 1,
            repsRange: "8min",
            restSeconds: 0,
            notes: "Finalizador: 8 minutos em ritmo constante e forte, remada completa.",
          },
        ],
      },
    ],
  },
  {
    name: "Vanguard Recomp",
    description:
      "Recomposição corporal avançada em divisão ABCDE: levantamentos pesados combinados com finalizadores de HIIT em toda sessão, para quem já treina há anos e quer ganhar músculo e perder gordura ao mesmo tempo.",
    tags: ["HIPERTROFIA", "DEFINICAO", "AVANCADO"],
    sessions: [
      {
        letter: "A",
        name: "Peito e Tríceps + HIIT",
        exercises: [
          { name: "Supino Reto com Barra", sets: 5, repsRange: "6-8", restSeconds: 120 },
          { name: "Supino Inclinado com Halteres", sets: 4, repsRange: "8-10", restSeconds: 90, notes: REST_PAUSE },
          { name: "Crossover no Cabo", sets: 3, repsRange: "12-15", restSeconds: 45, notes: DROP_SET },
          { name: "Tríceps Francês na Polia", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Assault Bike (Bicicleta de Ar)",
            sets: 6,
            repsRange: "20s",
            restSeconds: 20,
            notes: "6 tiros de 20s no esforço máximo, 20s de recuperação — finalizador HIIT.",
          },
        ],
      },
      {
        letter: "B",
        name: "Costas e Bíceps + HIIT",
        exercises: [
          { name: "Levantamento Terra", sets: 5, repsRange: "5-6", restSeconds: 150 },
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "8-10", restSeconds: 90, notes: REST_PAUSE },
          { name: "Remada Cavalinho", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Rosca Direta com Barra", sets: 4, repsRange: "8-10", restSeconds: 60, notes: DROP_SET },
          {
            name: "Remo Ergométrico",
            sets: 1,
            repsRange: "6min",
            restSeconds: 0,
            notes: "Finalizador: 6 minutos no ritmo mais forte que conseguir sustentar.",
          },
        ],
      },
      {
        letter: "C",
        name: "Pernas (Quadríceps) + Metabólico",
        exercises: [
          { name: "Agachamento Frontal", sets: 5, repsRange: "6-8", restSeconds: 120 },
          { name: "Hack Squat na Máquina", sets: 4, repsRange: "8-10", restSeconds: 90, notes: REST_PAUSE },
          { name: "Cadeira Extensora", sets: 4, repsRange: "12-15", restSeconds: 60, notes: DROP_SET_TRIPLO },
          { name: "Salto no Caixote (Box Jump)", sets: 4, repsRange: "8", restSeconds: 60 },
          {
            name: "Corrida Intervalada (Sprints)",
            sets: 5,
            repsRange: "30s",
            restSeconds: 30,
            notes: "5 tiros de 30s em esforço máximo, 30s de caminhada entre eles.",
          },
        ],
      },
      {
        letter: "D",
        name: "Ombro, Trapézio e Core",
        exercises: [
          { name: "Desenvolvimento com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "12-15", restSeconds: 45, notes: DROP_SET },
          { name: "Encolhimento com Barra", sets: 4, repsRange: "10-12", restSeconds: 60, notes: picoContracao(2) },
          { name: "Face Pull na Corda para Ombro", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 4, repsRange: "12", restSeconds: 30 },
          { name: "Prancha com Deslize", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
      {
        letter: "E",
        name: "Posterior, Glúteos + Metabólico",
        exercises: [
          { name: "Levantamento Terra Romeno", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "8-10", restSeconds: 60, notes: CLUSTER_SET },
          { name: "Cadeira Flexora Sentado", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Glúteo Cabo Joelho Estendido", sets: 3, repsRange: "12-15", restSeconds: 45 },
          {
            name: "Burpees",
            sets: 4,
            repsRange: "15",
            restSeconds: 30,
            notes: "Finalizador: 4 séries de 15 repetições, ritmo constante, sem pausas longas entre elas.",
          },
        ],
      },
    ],
  },
  {
    name: "Quick Mass",
    description:
      "Hipertrofia em sessões expressas (cerca de 40 minutos) via divisão AB com supersets antagonistas, mantendo o volume de treino alto mesmo com pouco tempo disponível.",
    tags: ["HIPERTROFIA", "EXPRESS", "INTERMEDIARIO"],
    sessions: [
      {
        letter: "A",
        name: "Push e Pull Superior (Superset)",
        exercises: [
          { name: "Supino Reto com Halteres", sets: 4, repsRange: "8-10", restSeconds: 0, notes: biSet("Remada Curvada com Halteres") },
          { name: "Remada Curvada com Halteres", sets: 4, repsRange: "8-10", restSeconds: 45, notes: biSet("Supino Reto com Halteres") },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "10-12", restSeconds: 0, notes: biSet("Puxada Triângulo Neutra") },
          { name: "Puxada Triângulo Neutra", sets: 3, repsRange: "10-12", restSeconds: 45, notes: biSet("Desenvolvimento com Halteres") },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "12", restSeconds: 0, notes: biSet("Rosca Martelo") },
          { name: "Rosca Martelo", sets: 3, repsRange: "12", restSeconds: 45, notes: biSet("Tríceps Corda na Polia Alta") },
        ],
      },
      {
        letter: "B",
        name: "Pernas Completo (Superset)",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Leg Press 45", sets: 3, repsRange: "10-12", restSeconds: 0, notes: biSet("Mesa Flexora") },
          { name: "Mesa Flexora", sets: 3, repsRange: "10-12", restSeconds: 60, notes: biSet("Leg Press 45") },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Panturrilha em Pé", sets: 3, repsRange: "15-20", restSeconds: 0, notes: biSet("Abdominal na Roda (Ab Wheel)") },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 3, repsRange: "12", restSeconds: 45, notes: biSet("Panturrilha em Pé") },
        ],
      },
    ],
  },
  {
    name: "Sculpt Elite",
    description:
      "Definição feminina avançada em divisão ABCD, com ênfase em glúteos e pernas, supersets e drop-sets densos, e um finalizador de corpo inteiro para fechar cada semana de treino.",
    tags: ["FEMININO", "DEFINICAO", "AVANCADO"],
    sessions: [
      {
        letter: "A",
        name: "Glúteos e Abdutores (Alta Densidade)",
        exercises: [
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "10-12", restSeconds: 60, notes: CLUSTER_SET },
          { name: "Agachamento Búlgaro", sets: 4, repsRange: "10 por perna", restSeconds: 45 },
          { name: "Abdução de Quadril no Cabo em Pé", sets: 4, repsRange: "15-20", restSeconds: 30, notes: DROP_SET },
          { name: "Cadeira Abdutora", sets: 4, repsRange: "20", restSeconds: 30, notes: picoContracao(2) },
          { name: "Elevação Pélvica Unilateral", sets: 3, repsRange: "15 por perna", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Costas, Ombro e Braços (Tonificação)",
        exercises: [
          { name: "Puxada Frontal na Polia", sets: 4, repsRange: "10-12", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "15", restSeconds: 30, notes: DROP_SET },
          { name: "Face Pull na Corda para Ombro", sets: 3, repsRange: "15", restSeconds: 30 },
          { name: "Tríceps Pulley com Corda", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
      {
        letter: "C",
        name: "Quadríceps, Posterior e Core (Metabólico)",
        exercises: [
          { name: "Agachamento Sumô no Smith", sets: 4, repsRange: "12-15", restSeconds: 45 },
          { name: "Levantamento Terra Romeno", sets: 4, repsRange: "10", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 4, repsRange: "15-20", restSeconds: 30, notes: DROP_SET_DUPLO },
          { name: "Mesa Flexora", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Prancha com Rotação", sets: 3, repsRange: "20", restSeconds: 30 },
        ],
      },
      {
        letter: "D",
        name: "Corpo Inteiro Finalizador",
        exercises: [
          { name: "Thruster com Halteres", sets: 4, repsRange: "10", restSeconds: 45 },
          { name: "Balanço com Kettlebell (Kettlebell Swing)", sets: 4, repsRange: "15", restSeconds: 30 },
          { name: "Step Up Lateral com Halteres", sets: 3, repsRange: "12 por perna", restSeconds: 30 },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 4, repsRange: "12", restSeconds: 30 },
          {
            name: "Pular Corda",
            sets: 1,
            repsRange: "6min",
            restSeconds: 0,
            notes: "Finalizador: 6 minutos intercalando 30s em ritmo forte e 30s em ritmo leve.",
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
  console.log("Programas novos — Hipertrofia/Definição (Fase 115):");
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
