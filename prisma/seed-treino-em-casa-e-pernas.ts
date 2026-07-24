// Fase 50: duas mudanças de dado combinadas (mesmo padrão de
// seed-featured-exercises.ts/update-exercise-videos.ts — script pontual, não
// faz parte do db:seed automático, casamento por NAME não por id porque os
// ids são gerados independentemente em cada ambiente).
//
// 1. Subdivide o antigo grupo muscular "Pernas" em 5 grupos mais específicos
//    (Quadríceps, Glúteos, Posterior da Coxa, Panturrilhas, Adutores e
//    Abdutores) — reclassificação dos 31 exercícios existentes, curadoria
//    manual usando a ênfase muscular real de cada exercício (ex: agachamentos
//    e afundos → Quadríceps; stiff/levantamento terra → Posterior da Coxa;
//    elevação pélvica → Glúteos; cadeira adutora/abdutora → Adutores e
//    Abdutores). "Pernas" deixa de existir como valor depois deste script —
//    nenhum código lê essa string como enum fixo (muscleGroup é string livre,
//    os seletores do admin/gerador de treino derivam a lista do banco).
// 2. Nova categoria "treino em casa": ~40 exercícios curados via pesquisa no
//    YouTube (4 agentes em paralelo, todo mediaUrl verificado por fetch real
//    da página antes de entrar aqui — nada gerado/adivinhado), cobrindo os
//    grupos que ficam MUITO magros de opções pra casa/sem peso, e reforçando
//    especificamente Glúteos e Adutores e Abdutores (só 2 exercícios cada
//    depois da reclassificação acima). `equipment: "Peso Corporal"` pra
//    exercícios sem nenhum item (mesmo valor já usado no catálogo) ou
//    `"Itens Domésticos"` (valor novo) quando usa mochila/cadeira/toalha/
//    parede/degrau. Sem tradução EN/ES nesta leva — cai no fallback pro PT já
//    existente (mesmo comportamento de qualquer exercício sem tradução
//    ainda), não bloqueia nada.
import { DifficultyLevel } from "@prisma/client";
import prisma from "../src/lib/prisma";

const RECATEGORIZE_PERNAS: Array<{ name: string; muscleGroup: string }> = [
  // Quadríceps (17)
  { name: "Afundo com Halteres", muscleGroup: "Quadríceps" },
  { name: "Agachamento Sumô com Halter", muscleGroup: "Quadríceps" },
  { name: "Agachamento Búlgaro", muscleGroup: "Quadríceps" },
  { name: "Agachamento Frontal", muscleGroup: "Quadríceps" },
  { name: "Passada com Halteres", muscleGroup: "Quadríceps" },
  { name: "Agachamento com Peso Corporal", muscleGroup: "Quadríceps" },
  { name: "Avanço Estático com Halteres", muscleGroup: "Quadríceps" },
  { name: "Agachamento Goblet", muscleGroup: "Quadríceps" },
  { name: "Cadeira Extensora Unilateral", muscleGroup: "Quadríceps" },
  { name: "Cadeira Extensora Isométrica", muscleGroup: "Quadríceps" },
  { name: "Passada Reversa com Halteres", muscleGroup: "Quadríceps" },
  { name: "Afundo Caminhando com Barra", muscleGroup: "Quadríceps" },
  { name: "Hack Squat na Máquina", muscleGroup: "Quadríceps" },
  { name: "Agachamento na Máquina Smith", muscleGroup: "Quadríceps" },
  { name: "Leg Press 45", muscleGroup: "Quadríceps" },
  { name: "Cadeira Extensora", muscleGroup: "Quadríceps" },
  { name: "Agachamento Livre", muscleGroup: "Quadríceps" },
  // Glúteos (2)
  { name: "Elevação Pélvica com Barra", muscleGroup: "Glúteos" },
  { name: "Elevação Pélvica na Máquina", muscleGroup: "Glúteos" },
  // Posterior da Coxa (6)
  { name: "Mesa Flexora", muscleGroup: "Posterior da Coxa" },
  { name: "Levantamento Terra Sumô", muscleGroup: "Posterior da Coxa" },
  { name: "Stiff com Halteres", muscleGroup: "Posterior da Coxa" },
  { name: "Stiff com Barra", muscleGroup: "Posterior da Coxa" },
  { name: "Cadeira Flexora Sentado", muscleGroup: "Posterior da Coxa" },
  { name: "Levantamento Terra Romeno", muscleGroup: "Posterior da Coxa" },
  // Panturrilhas (4)
  { name: "Panturrilha em Pé com Halteres", muscleGroup: "Panturrilhas" },
  { name: "Panturrilha no Leg Press", muscleGroup: "Panturrilhas" },
  { name: "Panturrilha Sentado", muscleGroup: "Panturrilhas" },
  { name: "Panturrilha em Pé", muscleGroup: "Panturrilhas" },
  // Adutores e Abdutores (2)
  { name: "Cadeira Adutora", muscleGroup: "Adutores e Abdutores" },
  { name: "Cadeira Abdutora", muscleGroup: "Adutores e Abdutores" },
];

interface NewExercise {
  name: string;
  muscleGroup: string;
  equipment: string;
  difficultyLevel: DifficultyLevel;
  description: string;
  mediaUrl: string;
  isFeatured?: boolean;
}

const NEW_EXERCISES: NewExercise[] = [
  // --- Peito (treino em casa) ---
  {
    name: "Flexão Apoiada na Parede",
    muscleGroup: "Peito",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Apoie as mãos na parede na altura dos ombros, afaste os pés e flexione os cotovelos aproximando o peito da parede antes de empurrar de volta, controlando o movimento.",
    mediaUrl: "https://www.youtube.com/watch?v=msMPUMk8Z7U",
  },
  {
    name: "Flexão Arqueiro",
    muscleGroup: "Peito",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Com as mãos bem mais afastadas que os ombros, desça o corpo deslocando o peso para um lado enquanto o braço oposto permanece estendido, alternando os lados a cada repetição.",
    mediaUrl: "https://www.youtube.com/watch?v=qA0lFPPq6UE",
  },
  {
    name: "Supino Reto com Mochila",
    muscleGroup: "Peito",
    equipment: "Itens Domésticos",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Deitado no chão com uma mochila carregada de livros ou garrafas segura sobre o peito, empurre-a para cima estendendo os braços e desça de forma controlada até quase tocar o peito.",
    mediaUrl: "https://www.youtube.com/watch?v=UZ8apI02uCA",
  },
  {
    name: "Flexão com Palmas",
    muscleGroup: "Peito",
    equipment: "Peso Corporal",
    difficultyLevel: "AVANCADO",
    description:
      "Desça em uma flexão padrão e impulsione o corpo com força suficiente para tirar as mãos do chão, batendo palmas no ar antes de amortecer a queda com os braços.",
    mediaUrl: "https://www.youtube.com/watch?v=IpwAHyea3lQ",
  },
  // --- Costas (treino em casa) ---
  {
    name: "Remada com Toalha na Porta",
    muscleGroup: "Costas",
    equipment: "Itens Domésticos",
    difficultyLevel: "INICIANTE",
    description:
      "Enrole uma toalha na maçaneta ou batente firme da porta, incline o corpo para trás com os braços estendidos e puxe o tronco em direção à porta contraindo as escápulas.",
    mediaUrl: "https://www.youtube.com/watch?v=IYe_Emg0DJg",
  },
  {
    name: "Remada Unilateral com Mochila",
    muscleGroup: "Costas",
    equipment: "Itens Domésticos",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Apoie um joelho e uma mão em uma cadeira ou banco, segure a mochila carregada com a mão livre e puxe o cotovelo para trás junto ao tronco, contraindo as costas no topo.",
    mediaUrl: "https://www.youtube.com/watch?v=M_aNTNw--8c",
  },
  {
    name: "Superman no Solo",
    muscleGroup: "Costas",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Deitado de bruços com braços e pernas estendidos, eleve simultaneamente braços, peito e pernas do chão contraindo a lombar e as costas, segurando um instante no topo.",
    mediaUrl: "https://www.youtube.com/watch?v=4mY7IewWVJ8",
  },
  {
    name: "Remada Invertida na Mesa",
    muscleGroup: "Costas",
    equipment: "Itens Domésticos",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Deite-se sob uma mesa firme e resistente, segure a borda com as mãos e puxe o peito em direção à mesa mantendo o corpo reto, depois desça controladamente.",
    mediaUrl: "https://www.youtube.com/watch?v=4-2JmXK9rtk",
  },
  // --- Ombro (treino em casa) ---
  {
    name: "Flexão Pike",
    muscleGroup: "Ombro",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Em posição de flexão com os quadris elevados formando um V invertido, flexione os cotovelos levando o topo da cabeça em direção ao chão e empurre de volta focando o ombro.",
    mediaUrl: "https://www.youtube.com/watch?v=BIW_B9JU8gk",
  },
  {
    name: "Elevação Lateral com Mochila",
    muscleGroup: "Ombro",
    equipment: "Itens Domésticos",
    difficultyLevel: "INICIANTE",
    description:
      "Em pé, segure a mochila com peso leve em uma das mãos e eleve o braço lateralmente até a altura do ombro, com leve flexão no cotovelo, controlando a descida.",
    mediaUrl: "https://www.youtube.com/watch?v=ldwVIgUeAVQ",
  },
  {
    name: "Elevação Frontal com Mochila",
    muscleGroup: "Ombro",
    equipment: "Itens Domésticos",
    difficultyLevel: "INICIANTE",
    description:
      "Em pé com os pés na largura dos ombros, segure a mochila com as duas mãos e eleve-a à frente do corpo até a altura dos ombros, sem passar essa linha, e desça controladamente.",
    mediaUrl: "https://www.youtube.com/watch?v=_n8dsiWSVUU",
  },
  {
    name: "Apoio de Mãos na Parede",
    muscleGroup: "Ombro",
    equipment: "Peso Corporal",
    difficultyLevel: "AVANCADO",
    description:
      "De costas para a parede, apoie as mãos no chão e caminhe os pés pela parede até ficar quase na vertical, sustentando o peso do corpo nos ombros e braços estendidos.",
    mediaUrl: "https://www.youtube.com/watch?v=KKTWN15CghE",
  },
  // --- Bíceps (treino em casa) ---
  {
    name: "Rosca Direta com Mochila",
    muscleGroup: "Bíceps",
    equipment: "Itens Domésticos",
    difficultyLevel: "INICIANTE",
    description:
      "Segure as alças de uma mochila carregada com livros, cotovelos fixos ao lado do corpo, flexione os braços trazendo o peso até os ombros e desça controladamente.",
    mediaUrl: "https://www.youtube.com/watch?v=LF3xohftl9k",
  },
  {
    name: "Rosca Unilateral com Mochila",
    muscleGroup: "Bíceps",
    equipment: "Itens Domésticos",
    difficultyLevel: "INICIANTE",
    description:
      "Segure a mochila com um braço, cotovelo colado ao tronco, flexione até a altura do ombro contraindo o bíceps e retorne devagar antes de trocar de lado.",
    mediaUrl: "https://www.youtube.com/watch?v=Qz4JWzkyJek",
  },
  {
    name: "Rosca Bíceps com Toalha",
    muscleGroup: "Bíceps",
    equipment: "Itens Domésticos",
    difficultyLevel: "INICIANTE",
    description:
      "Sentado, prenda a toalha sob o pé e puxe as pontas em direção ao ombro fazendo força isométrica contra a resistência do próprio pé.",
    mediaUrl: "https://www.youtube.com/watch?v=UB3RsYI7-RI",
  },
  {
    name: "Rosca Martelo com Mochila",
    muscleGroup: "Bíceps",
    equipment: "Itens Domésticos",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Segure a mochila na posição neutra (como um martelo), cotovelos fixos, flexione até a altura do peito e desça controladamente sem balançar o tronco.",
    mediaUrl: "https://www.youtube.com/watch?v=8wtLdOhwvtQ",
  },
  // --- Tríceps (treino em casa) ---
  {
    name: "Tríceps Mergulho na Cadeira",
    muscleGroup: "Tríceps",
    equipment: "Itens Domésticos",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Apoie as mãos na borda de uma cadeira firme, pernas estendidas à frente, desça o quadril flexionando os cotovelos a 90 graus e empurre de volta contraindo o tríceps.",
    mediaUrl: "https://www.youtube.com/watch?v=5SKV9hy5Rpk",
  },
  {
    name: "Tríceps Francês com Mochila",
    muscleGroup: "Tríceps",
    equipment: "Itens Domésticos",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Segure a mochila com as duas mãos atrás da cabeça, cotovelos apontados para cima e próximos, estenda os braços elevando o peso e desça controladamente sem abrir os cotovelos.",
    mediaUrl: "https://www.youtube.com/watch?v=2pGdWqtSUbk",
  },
  // --- Glúteos (treino em casa) ---
  {
    name: "Elevação Pélvica no Solo",
    muscleGroup: "Glúteos",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Deite-se com os joelhos flexionados e pés apoiados no chão, contraia o abdômen e eleve o quadril até formar uma linha reta dos ombros aos joelhos, apertando os glúteos no topo.",
    mediaUrl: "https://www.youtube.com/watch?v=kvmT_ZlgVI0",
    isFeatured: true,
  },
  {
    name: "Elevação Pélvica Unilateral",
    muscleGroup: "Glúteos",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Deitado de costas com um pé apoiado no chão e a outra perna estendida, eleve o quadril apoiando-se apenas na perna de base, contraindo o glúteo no topo do movimento.",
    mediaUrl: "https://www.youtube.com/watch?v=IW-xVGlldho",
  },
  {
    name: "Coice de Glúteo em Quatro Apoios",
    muscleGroup: "Glúteos",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Apoie-se em quatro apoios (mãos e joelhos), mantenha o joelho flexionado a 90 graus e empurre o pé em direção ao teto usando apenas a contração do glúteo, sem arquear a lombar.",
    mediaUrl: "https://www.youtube.com/watch?v=rQ-yA6tCH_w",
  },
  {
    name: "Ponte de Glúteo Unilateral Dinâmica",
    muscleGroup: "Glúteos",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Com um pé apoiado e a outra perna elevada e estendida, suba e desça o quadril em ritmo controlado, mantendo o core firme para evitar rotação do tronco.",
    mediaUrl: "https://www.youtube.com/watch?v=pX39RDCCxok",
  },
  // --- Glúteos (equipamento de academia) ---
  {
    name: "Hip Thrust com Barra",
    muscleGroup: "Glúteos",
    equipment: "Barra",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Com as escápulas apoiadas no banco e a barra acolchoada sobre o quadril, empurre o quadril para cima até a extensão completa, contraindo forte os glúteos no topo antes de descer com controle.",
    mediaUrl: "https://www.youtube.com/watch?v=3mnHo-F-U4Q",
    isFeatured: true,
  },
  {
    name: "Glúteo Cabo Joelho Estendido",
    muscleGroup: "Glúteos",
    equipment: "Cabo",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Preso o cabo no tornozelo e apoiado na estrutura da polia, estenda o quadril levando a perna para trás com o joelho estendido, contraindo o glúteo no fim do movimento sem arquear a lombar.",
    mediaUrl: "https://www.youtube.com/watch?v=wQRODgAmF4k",
  },
  {
    name: "Pull-Through no Cabo",
    muscleGroup: "Glúteos",
    equipment: "Cabo",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "De costas para a polia baixa com a corda entre as pernas, flexione o quadril levando-o para trás e retorne empurrando o chão e contraindo os glúteos até ficar em pé.",
    mediaUrl: "https://www.youtube.com/watch?v=oTGgQ1Nq8J0",
  },
  {
    name: "Step Up Lateral com Halteres",
    muscleGroup: "Glúteos",
    equipment: "Halteres",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Com um halter em cada mão ao lado do corpo, suba lateralmente sobre o step empurrando pelo calcanhar da perna de apoio, sem deixar o joelho projetar para dentro.",
    mediaUrl: "https://www.youtube.com/watch?v=K-74LaOH5Cg",
  },
  // --- Adutores e Abdutores (treino em casa) ---
  {
    name: "Exercício Ostra (Clamshell)",
    muscleGroup: "Adutores e Abdutores",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Deite-se de lado com os joelhos flexionados e os pés unidos, abra o joelho de cima como uma concha sem girar o quadril para trás, focando na contração do glúteo médio.",
    mediaUrl: "https://www.youtube.com/watch?v=-BVUHNJd75U",
    isFeatured: true,
  },
  {
    name: "Abdução de Quadril em Pé",
    muscleGroup: "Adutores e Abdutores",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Em pé e com apoio em uma parede ou cadeira, eleve a perna lateralmente mantendo o tronco ereto e o pé neutro, sem inclinar o corpo para compensar o movimento.",
    mediaUrl: "https://www.youtube.com/watch?v=9-XUx041ioE",
  },
  {
    name: "Agachamento Cossaco",
    muscleGroup: "Adutores e Abdutores",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Com os pés bem afastados, desloque o peso do corpo para um lado flexionando esse joelho enquanto a perna oposta permanece estendida com o pé apoiado, alongando o adutor da perna estendida.",
    mediaUrl: "https://www.youtube.com/watch?v=rMkDxOA3d0A",
  },
  {
    name: "Afundo Cruzado Alternado",
    muscleGroup: "Adutores e Abdutores",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Dê um passo para trás cruzando a perna atrás da perna de apoio, como uma reverência, flexionando ambos os joelhos até quase tocar o joelho de trás no chão, alternando os lados.",
    mediaUrl: "https://www.youtube.com/watch?v=OGKVPW0aoWs",
  },
  {
    name: "Adução de Quadril Deitado",
    muscleGroup: "Adutores e Abdutores",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Deitado de lado com a perna de baixo estendida e a de cima cruzada à frente apoiada no chão, eleve a perna de baixo lentamente em direção ao teto trabalhando o adutor da coxa.",
    mediaUrl: "https://www.youtube.com/watch?v=U_5-OcAu4Ro",
  },
  // --- Adutores e Abdutores (equipamento de academia) ---
  {
    name: "Abdução de Quadril no Cabo em Pé",
    muscleGroup: "Adutores e Abdutores",
    equipment: "Cabo",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Preso o cabo no tornozelo e de lado para a torre da polia, afaste a perna lateralmente mantendo o tronco ereto e o joelho estendido, sem inclinar o quadril para compensar.",
    mediaUrl: "https://www.youtube.com/watch?v=vBhkIaqW08Y",
    isFeatured: true,
  },
  {
    name: "Adução de Quadril no Cabo",
    muscleGroup: "Adutores e Abdutores",
    equipment: "Cabo",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Com o cabo preso no tornozelo e a perna de trabalho cruzando à frente da perna de apoio, puxe a perna para dentro contraindo o adutor, controlando o retorno até a posição inicial.",
    mediaUrl: "https://www.youtube.com/watch?v=5AONqQzcRYA",
  },
  {
    name: "Abdução de Quadril no Banco 45°",
    muscleGroup: "Adutores e Abdutores",
    equipment: "Cabo",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Deitado de lado sobre um banco a 45 graus com o cabo preso no tornozelo, eleve a perna de cima lateralmente contraindo o abdutor e evitando balançar o quadril para trás.",
    mediaUrl: "https://www.youtube.com/watch?v=F1UfOdTNCvY",
  },
  {
    name: "Agachamento Sumô no Smith",
    muscleGroup: "Adutores e Abdutores",
    equipment: "Máquina",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Com os pés bem afastados e as pontas viradas para fora sob a barra guiada, desça flexionando os joelhos até as coxas ficarem paralelas ao chão, empurrando os calcanhares e contraindo os adutores na subida.",
    mediaUrl: "https://www.youtube.com/watch?v=3I8MbMwaBAI",
  },
  {
    name: "Abdutora em Pé na Máquina",
    muscleGroup: "Adutores e Abdutores",
    equipment: "Máquina",
    difficultyLevel: "INICIANTE",
    description:
      "Em pé na máquina de abdução com a almofada apoiada acima do joelho e a coluna neutra, afaste a perna lateralmente contra a resistência e retorne devagar sem deixar o tronco balançar.",
    mediaUrl: "https://www.youtube.com/watch?v=g8Ro7Viqwb0",
  },
  // --- Quadríceps (treino em casa) ---
  {
    name: "Agachamento Isométrico na Parede",
    muscleGroup: "Quadríceps",
    equipment: "Itens Domésticos",
    difficultyLevel: "INICIANTE",
    description:
      "Apoie as costas em uma parede e deslize para baixo até os joelhos formarem 90 graus, mantendo essa posição isométrica pelo tempo determinado sem tirar as costas da parede.",
    mediaUrl: "https://www.youtube.com/watch?v=KBMTKkkPsPo",
  },
  {
    name: "Subida no Banco (Step Up)",
    muscleGroup: "Quadríceps",
    equipment: "Itens Domésticos",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Suba em um banco ou degrau estável usando apenas a força da perna da frente, sem impulsionar com a perna de trás, e desça controladamente.",
    mediaUrl: "https://www.youtube.com/watch?v=9LBlAgBjDKM",
  },
  // --- Posterior da Coxa (treino em casa) ---
  {
    name: "Stiff Unilateral com Peso Corporal",
    muscleGroup: "Posterior da Coxa",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Em pé sobre uma perna, incline o tronco para frente enquanto estende a outra perna para trás, mantendo a coluna neutra, até sentir o alongamento no posterior de coxa.",
    mediaUrl: "https://www.youtube.com/watch?v=kp2MyAjGpbM",
  },
  {
    name: "Stiff Unilateral com Apoio para Equilíbrio",
    muscleGroup: "Posterior da Coxa",
    equipment: "Itens Domésticos",
    difficultyLevel: "INICIANTE",
    description:
      "Segure-se levemente em uma cadeira ou parede para apoio e execute o stiff unilateral com controle, priorizando a fase excêntrica para maior ativação do isquiotibial.",
    mediaUrl: "https://www.youtube.com/watch?v=hfk08bJajWY",
  },
  // --- Panturrilhas (treino em casa) ---
  {
    name: "Panturrilha em Pé no Degrau",
    muscleGroup: "Panturrilhas",
    equipment: "Itens Domésticos",
    difficultyLevel: "INICIANTE",
    description:
      "Apoie a ponta dos pés na borda de um degrau, deixando os calcanhares para fora, e eleve o corpo na ponta dos pés antes de descer abaixo do nível do degrau para ampliar a amplitude.",
    mediaUrl: "https://www.youtube.com/watch?v=Bk92mZ7BYyY",
  },
  {
    name: "Panturrilha Inclinada (Donkey Calf Raise)",
    muscleGroup: "Panturrilhas",
    equipment: "Itens Domésticos",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Incline o tronco para frente apoiando as mãos em um móvel estável, mantenha os joelhos levemente flexionados e eleve os calcanhares o máximo possível contraindo a panturrilha.",
    mediaUrl: "https://www.youtube.com/watch?v=Q6G7jfvshrA",
  },
];

async function main() {
  console.log(`Reclassificando ${RECATEGORIZE_PERNAS.length} exercício(s) de "Pernas"...`);
  for (const { name, muscleGroup } of RECATEGORIZE_PERNAS) {
    const result = await prisma.exercise.updateMany({
      where: { name, muscleGroup: "Pernas" },
      data: { muscleGroup },
    });
    if (result.count === 0) {
      console.log(`  Aviso: "${name}" não encontrado com muscleGroup "Pernas" (já migrado ou nome divergente).`);
    }
  }

  const remainingPernas = await prisma.exercise.count({ where: { muscleGroup: "Pernas" } });
  console.log(`Restam ${remainingPernas} exercício(s) ainda como "Pernas" (deveria ser 0).`);

  console.log(`\nInserindo ${NEW_EXERCISES.length} exercício(s) novo(s) (idempotente por nome)...`);
  let created = 0;
  let skipped = 0;
  for (const ex of NEW_EXERCISES) {
    const existing = await prisma.exercise.findUnique({ where: { name: ex.name } });
    if (existing) {
      skipped++;
      console.log(`  Já existe, pulando: "${ex.name}"`);
      continue;
    }
    await prisma.exercise.create({
      data: {
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        equipment: ex.equipment,
        mediaUrl: ex.mediaUrl,
        mediaType: "YOUTUBE",
        description: ex.description,
        difficultyLevel: ex.difficultyLevel,
        isFeatured: ex.isFeatured ?? false,
      },
    });
    created++;
  }
  console.log(`${created} criado(s), ${skipped} já existiam.`);

  const byGroup = await prisma.exercise.groupBy({ by: ["muscleGroup"], _count: true, orderBy: { muscleGroup: "asc" } });
  console.log("\nCatálogo por grupo muscular após o seed:");
  byGroup.forEach((g) => console.log(`  ${g.muscleGroup}: ${g._count}`));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
