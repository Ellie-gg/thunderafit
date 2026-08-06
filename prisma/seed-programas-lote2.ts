import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 116: 18 programas novos (15 PREMIUM + 3 gratuitos em PRONTOS), mesmo
// modelo da Fase 115. Levantamento no catálogo real (excluindo fixture de
// teste E2E) depois da Fase 115: AVANCADO(14)/INTERMEDIARIO(13) já bem
// cobertas; FEMININO/EXPRESS/HIPERTROFIA/DEFINICAO empatadas em 7; e
// INICIANTE era a mais escassa isolada, com 6. Este lote concentra o nível
// em INICIANTE (11 dos 18, incluindo os 3 gratuitos) e distribui as tags de
// objetivo (HIPERTROFIA/DEFINICAO/FEMININO/EXPRESS) entre os programas,
// deixando INTERMEDIARIO com só 5 novos e AVANCADO com 2 (as duas que já
// tinham mais volume).
//
// Os 3 programas gratuitos usam `category: "PRONTOS"` (mesma categoria dos
// 3 templates gratuitos já existentes, "Shape V: Hipertrofia (ABCD)" etc.) —
// sem cadeado de Aluno Premium, ao contrário dos outros 15.
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
  category: "PREMIUM" | "PRONTOS";
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
  // ===== 3 gratuitos (PRONTOS) =====
  {
    name: "Foundation Full Body",
    description:
      "Programa gratuito de introdução à hipertrofia, em divisão AB de corpo inteiro — ideal para quem nunca treinou com pesos e quer construir a base de força antes de avançar para divisões mais avançadas.",
    category: "PRONTOS",
    tags: ["HIPERTROFIA", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Inferiores e Push",
        exercises: [
          {
            name: "Agachamento Livre",
            sets: 3,
            repsRange: "10-12",
            restSeconds: 90,
            notes: "Aprenda o padrão de movimento com carga leve antes de progredir — profundidade e postura vêm antes de peso.",
          },
          { name: "Leg Press 45", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Supino Reto com Barra", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Tríceps Testa com Barra", sets: 3, repsRange: "12", restSeconds: 60 },
        ],
      },
      {
        letter: "B",
        name: "Pull e Posterior",
        exercises: [
          { name: "Levantamento Terra Romeno", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Remada Curvada com Barra", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Rosca Direta com Barra", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Abdominal Supra no Solo", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Metabolic Starter",
    description:
      "Circuito gratuito de definição para iniciantes, em divisão AB de sessões curtas (cerca de 30 minutos) com pouco descanso — pensado pra quem quer resultado rápido sem precisar de muito equipamento.",
    category: "PRONTOS",
    tags: ["DEFINICAO", "EXPRESS", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Circuito Inferior",
        exercises: [
          { name: "Agachamento com Peso Corporal", sets: 3, repsRange: "15-20", restSeconds: 30 },
          { name: "Afundo com Halteres", sets: 3, repsRange: "12 por perna", restSeconds: 30 },
          { name: "Elevação Pélvica no Solo", sets: 3, repsRange: "15-20", restSeconds: 30 },
          { name: "Panturrilha em Pé com Halteres", sets: 3, repsRange: "20", restSeconds: 30 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "30s", restSeconds: 30 },
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
        name: "Circuito Superior",
        exercises: [
          { name: "Flexão de Braço", sets: 3, repsRange: "12-15", restSeconds: 30 },
          { name: "Remada Invertida na Barra", sets: 3, repsRange: "12", restSeconds: 30 },
          { name: "Desenvolvimento com Halteres Sentado", sets: 3, repsRange: "12", restSeconds: 30 },
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
    name: "Balanced Push Pull",
    description:
      "Programa gratuito push-pull-legs em divisão ABC, pra quem já passou da fase inicial e quer ganhar massa muscular com um treino estruturado, sem custo.",
    category: "PRONTOS",
    tags: ["HIPERTROFIA", "INTERMEDIARIO"],
    sessions: [
      {
        letter: "A",
        name: "Push (Peito, Ombro, Tríceps)",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Desenvolvimento com Barra", sets: 3, repsRange: "8-10", restSeconds: 90 },
          { name: "Crucifixo Reto com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Elevação Lateral com Halteres", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Tríceps Corda na Polia Alta", sets: 3, repsRange: "12-15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Pull (Costas, Bíceps)",
        exercises: [
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Remada Curvada com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Puxada Triângulo Neutra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Rosca Direta com Barra", sets: 3, repsRange: "10-12", restSeconds: 45 },
          { name: "Rosca Martelo", sets: 3, repsRange: "12", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Legs (Pernas Completo)",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Leg Press 45", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Mesa Flexora", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Panturrilha em Pé", sets: 3, repsRange: "15-20", restSeconds: 45 },
        ],
      },
    ],
  },
  // ===== 15 PREMIUM =====
  {
    name: "Steel Foundations",
    description:
      "Base de força e massa muscular para quem está começando na academia, em divisão AB com foco em exercícios compostos fundamentais — o alicerce antes de qualquer programa mais avançado.",
    category: "PREMIUM",
    tags: ["HIPERTROFIA", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Compostos Inferiores e Push",
        exercises: [
          { name: "Agachamento Livre", sets: 3, repsRange: "10", restSeconds: 90 },
          { name: "Leg Press 45", sets: 3, repsRange: "12", restSeconds: 60 },
          {
            name: "Supino Reto com Barra",
            sets: 3,
            repsRange: "10",
            restSeconds: 90,
            notes: "Priorize amplitude completa — barra tocando o peito sem ricochete.",
          },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Tríceps Pulley com Corda", sets: 3, repsRange: "12-15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Compostos Pull e Posterior",
        exercises: [
          { name: "Levantamento Terra Romeno", sets: 3, repsRange: "10", restSeconds: 90 },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Rosca Alternada com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "30-45s", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Gentle Definition",
    description:
      "Definição de baixo impacto para iniciantes, em divisão AB com repetições moderadas a altas e cargas leves — para quem quer perder gordura sem sobrecarregar articulações ainda destreinadas.",
    category: "PREMIUM",
    tags: ["DEFINICAO", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Inferiores e Core",
        exercises: [
          { name: "Agachamento Goblet", sets: 3, repsRange: "15", restSeconds: 45 },
          { name: "Afundo com Halteres", sets: 3, repsRange: "12 por perna", restSeconds: 45 },
          { name: "Elevação Pélvica no Solo", sets: 3, repsRange: "15-20", restSeconds: 30 },
          { name: "Abdominal Infra no Solo", sets: 3, repsRange: "15", restSeconds: 30 },
          { name: "Prancha Lateral", sets: 3, repsRange: "20-30s por lado", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Superiores",
        exercises: [
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Supino Reto com Halteres", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Elevação Lateral com Halteres", sets: 3, repsRange: "15", restSeconds: 30 },
          { name: "Rosca Martelo", sets: 3, repsRange: "15", restSeconds: 30 },
          { name: "Tríceps Coice com Halter", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Curve Start",
    description:
      "Primeiro programa de hipertrofia focado em glúteos e pernas, em divisão AB, com cargas progressivas moderadas — para começar a construir volume muscular com segurança e boa execução.",
    category: "PREMIUM",
    tags: ["FEMININO", "HIPERTROFIA", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Glúteos e Pernas",
        exercises: [
          { name: "Agachamento Goblet", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Elevação Pélvica no Solo", sets: 3, repsRange: "15", restSeconds: 45, notes: picoContracao(2) },
          { name: "Cadeira Extensora", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Cadeira Abdutora", sets: 3, repsRange: "15", restSeconds: 45 },
          { name: "Exercício Ostra (Clamshell)", sets: 3, repsRange: "15 por lado", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Superiores e Core",
        exercises: [
          { name: "Remada Invertida na Barra", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Desenvolvimento com Halteres Sentado", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Rosca Alternada com Halteres", sets: 3, repsRange: "12", restSeconds: 30 },
          { name: "Abdominal Canivete", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Rapid Start",
    description:
      "Treino expresso para iniciantes com pouco tempo disponível (cerca de 30 minutos), em divisão AB de corpo inteiro com poucos exercícios por sessão e descanso curto.",
    category: "PREMIUM",
    tags: ["EXPRESS", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Corpo Inteiro (Push)",
        exercises: [
          { name: "Supino Reto com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Leg Press 45", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Abdominal Supra no Solo", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Corpo Inteiro (Pull)",
        exercises: [
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Levantamento Terra Romeno", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "30s", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Fresh Recomp",
    description:
      "Recomposição corporal para iniciantes: um pouco de força no início da sessão e um finalizador leve de cardio no final, em divisão AB, sem exigir experiência prévia.",
    category: "PREMIUM",
    tags: ["HIPERTROFIA", "DEFINICAO", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Força + Finalizador",
        exercises: [
          { name: "Agachamento Livre", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Supino Reto com Barra", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Abdominal Bicicleta", sets: 3, repsRange: "15", restSeconds: 30 },
          {
            name: "Bicicleta Ergométrica",
            sets: 1,
            repsRange: "10min",
            restSeconds: 0,
            notes: "Finalizador: 10 minutos em ritmo leve a moderado, sem pausas.",
          },
        ],
      },
      {
        letter: "B",
        name: "Força + Finalizador",
        exercises: [
          { name: "Levantamento Terra Romeno", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Remada Curvada com Barra", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "30s", restSeconds: 30 },
          {
            name: "Corrida na Esteira",
            sets: 1,
            repsRange: "10min",
            restSeconds: 0,
            notes: "Finalizador: 10 minutos em ritmo constante e confortável (percepção de esforço 5-6/10).",
          },
        ],
      },
    ],
  },
  {
    name: "Femme Express",
    description:
      "Treino feminino expresso, em divisão AB de cerca de 30 minutos, com ênfase em glúteos e core — pra encaixar o treino na rotina sem abrir mão de resultado.",
    category: "PREMIUM",
    tags: ["FEMININO", "EXPRESS", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Glúteos e Core",
        exercises: [
          { name: "Agachamento Goblet", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Elevação Pélvica no Solo", sets: 3, repsRange: "15-20", restSeconds: 30 },
          { name: "Cadeira Abdutora", sets: 3, repsRange: "15", restSeconds: 30 },
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
          { name: "Abdominal Oblíquo no Solo", sets: 3, repsRange: "15 por lado", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Iron Basics",
    description:
      "Introdução à hipertrofia em divisão ABC, um passo além do treino de corpo inteiro clássico — separa peito/ombro/tríceps, costas/bíceps e pernas, mantendo cargas moderadas e volume controlado.",
    category: "PREMIUM",
    tags: ["HIPERTROFIA", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Peito, Ombro e Tríceps",
        exercises: [
          { name: "Supino Reto com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Desenvolvimento com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Crucifixo Reto com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Tríceps Testa com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Costas e Bíceps",
        exercises: [
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Rosca Direta com Halteres", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Rosca Martelo", sets: 3, repsRange: "12", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Pernas",
        exercises: [
          { name: "Agachamento Livre", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Leg Press 45", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Mesa Flexora", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Panturrilha em Pé", sets: 3, repsRange: "15-20", restSeconds: 45 },
        ],
      },
    ],
  },
  {
    name: "Clean Cut",
    description:
      "Circuito rápido de definição para iniciantes, em divisão AB de sessões curtas, alternando força leve e cardio para maximizar o gasto calórico no tempo disponível.",
    category: "PREMIUM",
    tags: ["DEFINICAO", "EXPRESS", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Circuito A",
        exercises: [
          { name: "Agachamento com Peso Corporal", sets: 3, repsRange: "15", restSeconds: 30 },
          { name: "Flexão de Braço Inclinada", sets: 3, repsRange: "12-15", restSeconds: 30 },
          { name: "Remada Invertida na Barra", sets: 3, repsRange: "12", restSeconds: 30 },
          { name: "Mountain Climbers", sets: 3, repsRange: "30s", restSeconds: 20 },
        ],
      },
      {
        letter: "B",
        name: "Circuito B",
        exercises: [
          { name: "Afundo com Halteres", sets: 3, repsRange: "12 por perna", restSeconds: 30 },
          { name: "Desenvolvimento com Halteres Sentado", sets: 3, repsRange: "12", restSeconds: 30 },
          { name: "Abdominal Bicicleta", sets: 3, repsRange: "20", restSeconds: 30 },
          {
            name: "Polichinelo (Jumping Jacks)",
            sets: 3,
            repsRange: "30s",
            restSeconds: 20,
            notes: "Finalizador: ritmo alto pelos 30s completos, sem pausar no meio.",
          },
        ],
      },
    ],
  },
  {
    name: "Toned Beginnings",
    description:
      "Tonificação feminina de corpo inteiro para iniciantes, em divisão AB — foco em postura, definição de braços/ombros e firmeza de core, com cargas leves e boa execução.",
    category: "PREMIUM",
    tags: ["FEMININO", "DEFINICAO", "INICIANTE"],
    sessions: [
      {
        letter: "A",
        name: "Superiores e Postura",
        exercises: [
          { name: "Remada Invertida na Barra", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Desenvolvimento com Halteres Sentado", sets: 3, repsRange: "12", restSeconds: 30 },
          { name: "Crucifixo Inverso com Halteres", sets: 3, repsRange: "15", restSeconds: 30 },
          { name: "Elevação Lateral com Halteres", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Core e Pernas",
        exercises: [
          { name: "Agachamento Goblet", sets: 3, repsRange: "15", restSeconds: 45 },
          { name: "Elevação Pélvica no Solo", sets: 3, repsRange: "15-20", restSeconds: 30 },
          { name: "Abdominal Infra no Solo", sets: 3, repsRange: "15", restSeconds: 30 },
          { name: "Prancha com Elevação de Braço", sets: 3, repsRange: "10 por lado", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Momentum Mass",
    description:
      "Hipertrofia em divisão ABC para quem já tem alguns meses de treino, com técnicas de intensificação em exercícios de isolamento pra sair da estagnação inicial.",
    category: "PREMIUM",
    tags: ["HIPERTROFIA", "INTERMEDIARIO"],
    sessions: [
      {
        letter: "A",
        name: "Peito e Tríceps",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Supino Inclinado com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Crossover no Cabo", sets: 3, repsRange: "12-15", restSeconds: 45, notes: picoContracao(2) },
          { name: "Tríceps Francês com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60 },
        ],
      },
      {
        letter: "B",
        name: "Costas e Bíceps",
        exercises: [
          { name: "Remada Curvada com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Puxada Triângulo Neutra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "10-12", restSeconds: 60, notes: REST_PAUSE },
          { name: "Rosca Direta com Barra", sets: 3, repsRange: "10-12", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Pernas",
        exercises: [
          { name: "Agachamento Livre", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Leg Press 45", sets: 3, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Mesa Flexora", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Panturrilha em Pé", sets: 4, repsRange: "15-20", restSeconds: 45 },
        ],
      },
    ],
  },
  {
    name: "Definition Engine",
    description:
      "Máquina de definição em divisão ABC, com circuitos e supersets moderados — pra quem já treina há algum tempo e quer intensificar o corte sem perder força.",
    category: "PREMIUM",
    tags: ["DEFINICAO", "INTERMEDIARIO"],
    sessions: [
      {
        letter: "A",
        name: "Superiores em Superset",
        exercises: [
          { name: "Supino Inclinado com Halteres", sets: 3, repsRange: "12", restSeconds: 0, notes: biSet("Remada Unilateral com Halter") },
          { name: "Remada Unilateral com Halter", sets: 3, repsRange: "12", restSeconds: 45, notes: biSet("Supino Inclinado com Halteres") },
          { name: "Desenvolvimento Arnold", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Tríceps Pulley com Corda", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Inferiores em Circuito",
        exercises: [
          { name: "Agachamento Sumô com Halter", sets: 3, repsRange: "15", restSeconds: 30 },
          { name: "Leg Press 45", sets: 3, repsRange: "15", restSeconds: 30, notes: REST_PAUSE },
          { name: "Stiff com Halteres", sets: 3, repsRange: "12", restSeconds: 30 },
          { name: "Panturrilha no Leg Press", sets: 3, repsRange: "20", restSeconds: 30 },
        ],
      },
      {
        letter: "C",
        name: "Metabólico e Core",
        exercises: [
          { name: "Balanço com Kettlebell (Kettlebell Swing)", sets: 4, repsRange: "15", restSeconds: 30 },
          { name: "Burpees", sets: 3, repsRange: "12", restSeconds: 30 },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 3, repsRange: "12", restSeconds: 30 },
          {
            name: "Corrida Intervalada (Sprints)",
            sets: 4,
            repsRange: "30s",
            restSeconds: 30,
            notes: "4 tiros de 30s em ritmo forte, com 30s de caminhada entre eles.",
          },
        ],
      },
    ],
  },
  {
    name: "Curve & Cut",
    description:
      "Definição feminina de glúteos e pernas em divisão ABC, com circuitos e drop-sets moderados — pra quem já tem base de treino e quer aparar as curvas sem perder volume muscular.",
    category: "PREMIUM",
    tags: ["FEMININO", "DEFINICAO", "INTERMEDIARIO"],
    sessions: [
      {
        letter: "A",
        name: "Glúteos e Abdutores",
        exercises: [
          { name: "Hip Thrust com Barra", sets: 3, repsRange: "12", restSeconds: 60 },
          { name: "Abdução de Quadril no Cabo em Pé", sets: 3, repsRange: "15", restSeconds: 45, notes: DROP_SET },
          { name: "Cadeira Abdutora", sets: 3, repsRange: "15-20", restSeconds: 30 },
          { name: "Elevação Pélvica Unilateral", sets: 3, repsRange: "15 por perna", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Superiores em Circuito",
        exercises: [
          { name: "Puxada Frontal na Polia", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Remada Baixa no Cabo", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Elevação Lateral com Halteres", sets: 3, repsRange: "15", restSeconds: 30 },
          { name: "Tríceps Coice no Cabo", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
      {
        letter: "C",
        name: "Pernas e Metabólico",
        exercises: [
          { name: "Agachamento Búlgaro", sets: 3, repsRange: "12 por perna", restSeconds: 45 },
          { name: "Mesa Flexora", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Cadeira Extensora", sets: 3, repsRange: "15", restSeconds: 30 },
          {
            name: "Corrida Intervalada (Sprints)",
            sets: 4,
            repsRange: "30s",
            restSeconds: 30,
            notes: "4 tiros de 30s em ritmo forte, com 30s de caminhada entre eles.",
          },
        ],
      },
    ],
  },
  {
    name: "Balanced Athlete",
    description:
      "Hipertrofia funcional em divisão ABC, equilibrando força bruta e potência — pra quem já treina com consistência e quer massa muscular aplicável a outros esportes.",
    category: "PREMIUM",
    tags: ["HIPERTROFIA", "INTERMEDIARIO"],
    sessions: [
      {
        letter: "A",
        name: "Peito, Ombro e Explosão",
        exercises: [
          { name: "Supino Reto com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Desenvolvimento com Barra", sets: 3, repsRange: "8-10", restSeconds: 90 },
          {
            name: "Flexão com Palmas",
            sets: 3,
            repsRange: "8-10",
            restSeconds: 60,
            notes: "Foco na explosão na subida — reduza a amplitude se ainda não conseguir o movimento completo com controle.",
          },
          { name: "Elevação Lateral com Halteres", sets: 3, repsRange: "12-15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Costas e Trapézio",
        exercises: [
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Remada Cavalinho", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Encolhimento com Barra", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Rosca Martelo", sets: 3, repsRange: "12", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Pernas e Potência",
        exercises: [
          { name: "Agachamento Frontal", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Levantamento Terra Romeno", sets: 3, repsRange: "10-12", restSeconds: 90 },
          { name: "Salto no Caixote (Box Jump)", sets: 3, repsRange: "8", restSeconds: 60 },
          { name: "Panturrilha no Leg Press", sets: 3, repsRange: "15-20", restSeconds: 45 },
        ],
      },
    ],
  },
  {
    name: "Peak Definition",
    description:
      "Definição avançada em divisão ABCD, com supersets e drop-sets em quase todo exercício e finalizadores de HIIT — para quem já tem anos de treino e busca o corte máximo sem abandonar a massa muscular.",
    category: "PREMIUM",
    tags: ["DEFINICAO", "AVANCADO"],
    sessions: [
      {
        letter: "A",
        name: "Peito e Tríceps",
        exercises: [
          { name: "Supino Inclinado com Halteres", sets: 4, repsRange: "10-12", restSeconds: 0, notes: biSet("Flexão com Pés Elevados") },
          { name: "Flexão com Pés Elevados", sets: 4, repsRange: "15", restSeconds: 45, notes: biSet("Supino Inclinado com Halteres") },
          { name: "Crossover Baixo no Cabo", sets: 3, repsRange: "15", restSeconds: 30, notes: DROP_SET },
          { name: "Tríceps Pulley Barra Reta", sets: 3, repsRange: "15", restSeconds: 30 },
        ],
      },
      {
        letter: "B",
        name: "Costas e Bíceps",
        exercises: [
          { name: "Puxada Alta Aberta", sets: 4, repsRange: "10-12", restSeconds: 0, notes: biSet("Rosca Direta com Halteres") },
          { name: "Rosca Direta com Halteres", sets: 4, repsRange: "12", restSeconds: 45, notes: biSet("Puxada Alta Aberta") },
          { name: "Remada Serrote no Cabo", sets: 3, repsRange: "12", restSeconds: 45 },
          { name: "Prancha com Rotação", sets: 3, repsRange: "20", restSeconds: 30 },
        ],
      },
      {
        letter: "C",
        name: "Pernas Metabólico",
        exercises: [
          { name: "Agachamento Sumô no Smith", sets: 4, repsRange: "15", restSeconds: 30 },
          { name: "Leg Press 45", sets: 4, repsRange: "15", restSeconds: 30, notes: DROP_SET_DUPLO },
          { name: "Mesa Flexora", sets: 4, repsRange: "15", restSeconds: 30 },
          {
            name: "Corrida Intervalada (Sprints)",
            sets: 5,
            repsRange: "30s",
            restSeconds: 30,
            notes: "5 tiros de 30s no esforço máximo, com 30s de caminhada entre eles.",
          },
        ],
      },
      {
        letter: "D",
        name: "Ombro, Core e HIIT",
        exercises: [
          { name: "Desenvolvimento Arnold", sets: 4, repsRange: "12", restSeconds: 45 },
          { name: "Elevação Lateral no Cabo", sets: 4, repsRange: "15", restSeconds: 30, notes: DROP_SET },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 4, repsRange: "12", restSeconds: 30 },
          {
            name: "Assault Bike (Bicicleta de Ar)",
            sets: 6,
            repsRange: "20s",
            restSeconds: 20,
            notes: "6 tiros de 20s em esforço máximo, 20s de recuperação ativa.",
          },
        ],
      },
    ],
  },
  {
    name: "Apex Mass",
    description:
      "Hipertrofia avançada em divisão ABCDE de 5 dias por semana, com levantamentos pesados e técnicas de intensificação em todo grupo muscular — para quem já treina há anos e busca o próximo nível de massa.",
    category: "PREMIUM",
    tags: ["HIPERTROFIA", "AVANCADO"],
    sessions: [
      {
        letter: "A",
        name: "Peito e Tríceps",
        exercises: [
          { name: "Supino Reto com Barra", sets: 5, repsRange: "6-8", restSeconds: 120 },
          { name: "Supino Inclinado com Halteres", sets: 4, repsRange: "8-10", restSeconds: 90, notes: REST_PAUSE },
          { name: "Crucifixo Inclinado com Halteres", sets: 3, repsRange: "10-12", restSeconds: 60, notes: picoContracao(2) },
          { name: "Tríceps Francês na Polia", sets: 3, repsRange: "12-15", restSeconds: 45, notes: DROP_SET },
        ],
      },
      {
        letter: "B",
        name: "Costas e Bíceps",
        exercises: [
          { name: "Levantamento Terra", sets: 5, repsRange: "5-6", restSeconds: 150 },
          { name: "Barra Fixa Pronada", sets: 4, repsRange: "8-10", restSeconds: 90, notes: REST_PAUSE },
          { name: "Remada Cavalinho", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Rosca Direta com Barra", sets: 4, repsRange: "8-10", restSeconds: 60, notes: DROP_SET },
        ],
      },
      {
        letter: "C",
        name: "Pernas (Quadríceps)",
        exercises: [
          { name: "Agachamento Frontal", sets: 5, repsRange: "6-8", restSeconds: 120 },
          { name: "Hack Squat na Máquina", sets: 4, repsRange: "8-10", restSeconds: 90, notes: REST_PAUSE },
          { name: "Cadeira Extensora", sets: 4, repsRange: "12-15", restSeconds: 60, notes: DROP_SET_TRIPLO },
          { name: "Panturrilha no Leg Press", sets: 4, repsRange: "15-20", restSeconds: 45 },
        ],
      },
      {
        letter: "D",
        name: "Ombro e Trapézio",
        exercises: [
          { name: "Desenvolvimento com Barra", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Elevação Lateral com Halteres", sets: 4, repsRange: "12-15", restSeconds: 45, notes: DROP_SET },
          { name: "Encolhimento com Barra", sets: 4, repsRange: "10-12", restSeconds: 60, notes: picoContracao(2) },
          { name: "Face Pull na Corda para Ombro", sets: 3, repsRange: "12-15", restSeconds: 45 },
        ],
      },
      {
        letter: "E",
        name: "Posterior e Glúteos",
        exercises: [
          { name: "Levantamento Terra Romeno", sets: 4, repsRange: "8-10", restSeconds: 90 },
          { name: "Cadeira Flexora Sentado", sets: 4, repsRange: "10-12", restSeconds: 60, notes: DROP_SET },
          { name: "Hip Thrust com Barra", sets: 4, repsRange: "8-10", restSeconds: 60, notes: CLUSTER_SET },
          { name: "Abdominal na Roda (Ab Wheel)", sets: 4, repsRange: "12", restSeconds: 30 },
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
      category: entry.category,
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

  console.log(`  Criado: "${entry.name}" (${entry.category}, ${entry.sessions.length} sessões, tags: ${entry.tags.join(", ")}).`);
}

async function main() {
  console.log("Programas novos — Lote 2 (Fase 116):");
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
