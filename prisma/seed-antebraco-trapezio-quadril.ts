// Fase 51: 3 grupos musculares novos — Antebraço, Trapézio, Flexores do
// Quadril — mesmo padrão de seed-treino-em-casa-e-pernas.ts (Fase 50):
// reclassifica exercícios existentes que já se encaixam melhor no grupo novo
// (curadoria manual pela ênfase muscular real) + curadoria nova via YouTube
// (2 agentes em paralelo, todo mediaUrl verificado por oEmbed/fetch real
// antes de entrar aqui). Idempotente, casamento por NAME (não por id).
//
// Reclassificações:
// - "Rosca Punho" e "Rosca Inversa com Barra" (Bíceps) → Antebraço: ênfase
//   real é flexores/extensores do punho e braquiorradial, não bíceps.
// - "Encolhimento com Barra"/"com Halteres" (Costas) e "no Cabo" (Ombro) →
//   Trapézio: encolhimento é O exercício clássico de trapézio, só não tinha
//   grupo próprio até agora.
// - "Elevação em Y no Banco Inclinado" (Ombro) → Trapézio: a descrição já
//   cadastrada deste exercício MENCIONA "contraindo o trapézio inferior" —
//   inconsistência clara, resolvida em vez de duplicar o exercício num novo
//   registro (um agente de curadoria propôs recriá-lo; descartado por ser a
//   mesma execução).
import { DifficultyLevel } from "@prisma/client";
import prisma from "../src/lib/prisma";

const RECATEGORIZE: Array<{ name: string; fromGroup: string; toGroup: string }> = [
  { name: "Rosca Punho", fromGroup: "Bíceps", toGroup: "Antebraço" },
  { name: "Rosca Inversa com Barra", fromGroup: "Bíceps", toGroup: "Antebraço" },
  { name: "Encolhimento com Halteres", fromGroup: "Costas", toGroup: "Trapézio" },
  { name: "Encolhimento com Barra", fromGroup: "Costas", toGroup: "Trapézio" },
  { name: "Encolhimento no Cabo", fromGroup: "Ombro", toGroup: "Trapézio" },
  { name: "Elevação em Y no Banco Inclinado", fromGroup: "Ombro", toGroup: "Trapézio" },
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
  // --- Antebraço ---
  {
    name: "Rosca de Punho com Barra",
    muscleGroup: "Antebraço",
    equipment: "Barra",
    difficultyLevel: "INICIANTE",
    description:
      "Sentado no banco com os antebraços apoiados nas coxas e pegada supinada na barra, flexione os punhos para cima contraindo os flexores do antebraço, e desça controladamente até o alongamento máximo.",
    mediaUrl: "https://www.youtube.com/watch?v=r5-nYE_1CXo",
  },
  {
    name: "Rosca de Punho Invertida com Halteres",
    muscleGroup: "Antebraço",
    equipment: "Halteres",
    difficultyLevel: "INICIANTE",
    description:
      "Sentado com os antebraços apoiados nas coxas e as palmas voltadas para baixo, eleve o dorso das mãos em direção ao teto para trabalhar os extensores do punho, controlando a fase negativa.",
    mediaUrl: "https://www.youtube.com/watch?v=krZ6pWGZ8xo",
  },
  {
    name: "Farmer's Walk com Halteres",
    muscleGroup: "Antebraço",
    equipment: "Halteres",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Segure um halter pesado em cada mão com pegada firme e neutra, mantenha o tronco ereto e caminhe uma distância determinada sem deixar os ombros caírem para frente.",
    mediaUrl: "https://www.youtube.com/watch?v=Fkzk_RqlYig",
  },
  {
    name: "Pinça de Anilha (Plate Pinch)",
    muscleGroup: "Antebraço",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Segure duas anilhas lisas juntas apenas com a ponta dos dedos e o polegar, mantendo o braço estendido ao lado do corpo pelo tempo determinado sem deixar as anilhas escorregarem.",
    mediaUrl: "https://www.youtube.com/watch?v=LARw21BBiDk",
  },
  {
    name: "Wrist Roller (Rolo de Punho)",
    muscleGroup: "Antebraço",
    equipment: "Itens Domésticos",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Segure o rolo de punho com os braços estendidos à frente do corpo e enrole a corda girando os punhos alternadamente até levantar o peso, depois desenrole controlando a descida.",
    mediaUrl: "https://www.youtube.com/watch?v=VPFQSgAiXco",
  },
  {
    name: "Dead Hang na Toalha",
    muscleGroup: "Antebraço",
    equipment: "Itens Domésticos",
    difficultyLevel: "INICIANTE",
    description:
      "Pendure uma toalha resistente sobre a barra fixa, segure firmemente as pontas com as duas mãos e mantenha o corpo suspenso pelo tempo determinado sem deixar o tecido escorregar.",
    mediaUrl: "https://www.youtube.com/watch?v=tTeAcQdG73s",
  },
  {
    name: "Rosca Inversa no Cabo com Corda",
    muscleGroup: "Antebraço",
    equipment: "Cabo",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Em pé na polia baixa com pegada pronada na corda ou barra reta, flexione os cotovelos mantendo-os junto ao corpo e os punhos travados, focando na contração dos antebraços.",
    mediaUrl: "https://www.youtube.com/watch?v=8uQdYcCUOu8",
  },
  // --- Trapézio ---
  {
    name: "Encolhimento com Barra Atrás das Costas",
    muscleGroup: "Trapézio",
    equipment: "Barra",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "De costas para a barra apoiada nas pernas, segure-a com pegada pronada atrás do corpo e eleve os ombros em linha reta para cima, pausando no topo antes de descer controladamente.",
    mediaUrl: "https://www.youtube.com/watch?v=H1BRkK7x-h8",
  },
  {
    name: "Rack Pull (Levantamento Parcial na Gaiola)",
    muscleGroup: "Trapézio",
    equipment: "Barra",
    difficultyLevel: "AVANCADO",
    description:
      "Com a barra apoiada nos pinos do rack pouco abaixo do joelho, flexione o quadril para segurá-la com pegada pronada e estenda o quadril e os joelhos até a extensão completa, finalizando com os trapézios contraídos.",
    mediaUrl: "https://www.youtube.com/watch?v=aAjN8zS7Idg",
  },
  {
    name: "Remada Alta Pegada de Arranco (Snatch Grip High Pull)",
    muscleGroup: "Trapézio",
    equipment: "Barra",
    difficultyLevel: "AVANCADO",
    description:
      "Com pegada bem aberta na barra no chão, estenda quadril e joelhos explosivamente e puxe a barra ao longo do corpo até a altura do peito, elevando os cotovelos e contraindo fortemente os trapézios no topo.",
    mediaUrl: "https://www.youtube.com/watch?v=5YBexETP3-E",
  },
  // --- Flexores do Quadril (grupo novo, 0 exercícios antes) ---
  {
    name: "Flexão de Quadril em Pé no Cabo",
    muscleGroup: "Flexores do Quadril",
    equipment: "Cabo",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Prenda a caneleira no tornozelo, fique de pé de lado para a torre e conduza o joelho à frente e para cima contra a resistência do cabo, mantendo o tronco estável.",
    mediaUrl: "https://www.youtube.com/watch?v=UPnv3H68IQY",
    isFeatured: true,
  },
  {
    name: "Flexão de Quadril na Máquina",
    muscleGroup: "Flexores do Quadril",
    equipment: "Máquina",
    difficultyLevel: "INICIANTE",
    description:
      "Sente-se na máquina multi-hip com o encosto apoiado, eleve a coxa à frente até a horizontal e retorne controladamente sem balançar o tronco.",
    mediaUrl: "https://www.youtube.com/watch?v=3A9B7hupyI4",
  },
  {
    name: "Marcha Estacionária com Mini Band",
    muscleGroup: "Flexores do Quadril",
    equipment: "Itens Domésticos",
    difficultyLevel: "INICIANTE",
    description:
      "Posicione uma mini band nos tornozelos, fique em pé e marche no lugar elevando o joelho contra a resistência da faixa, alternando as pernas.",
    mediaUrl: "https://www.youtube.com/watch?v=C7abjfzbpV4",
  },
  {
    name: "Elevação de Joelho em Pé (Marcha Alta)",
    muscleGroup: "Flexores do Quadril",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Em pé com postura ereta, eleve um joelho o mais alto possível em direção ao peito controladamente e retorne, alternando as pernas sem inclinar o tronco.",
    mediaUrl: "https://www.youtube.com/watch?v=O_8EUJ7i-PI",
  },
  {
    name: "Elevação de Joelho com Caneleira em Pé",
    muscleGroup: "Flexores do Quadril",
    equipment: "Itens Domésticos",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Com uma caneleira presa ao tornozelo, eleve o joelho à frente contra o peso extra e desça devagar, mantendo o quadril estável e sem compensar com a lombar.",
    mediaUrl: "https://www.youtube.com/watch?v=OuBrPpY_eyA",
  },
  {
    name: "Elevação de Joelho Sentado no Banco",
    muscleGroup: "Flexores do Quadril",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Sente-se na borda do banco segurando a lateral para estabilizar o tronco e eleve os joelhos em direção ao peito, focando na contração dos flexores do quadril.",
    mediaUrl: "https://www.youtube.com/watch?v=GXPCSeFYJPI",
  },
  {
    name: "L-Sit Tuck (Flexão de Quadril Suspensa em Barras)",
    muscleGroup: "Flexores do Quadril",
    equipment: "Peso Corporal",
    difficultyLevel: "AVANCADO",
    description:
      "Apoie-se em paralelas ou barras baixas com os braços estendidos e mantenha os joelhos flexionados junto ao peito em isometria, sustentando a posição pelo maior tempo possível.",
    mediaUrl: "https://www.youtube.com/watch?v=J_tmt6DGE9E",
  },
  {
    name: "Mountain Climber com Faixa Elástica (Flexores do Quadril)",
    muscleGroup: "Flexores do Quadril",
    equipment: "Itens Domésticos",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Em posição de prancha com uma faixa elástica presa aos pés, conduza um joelho lentamente em direção ao peito contra a resistência da banda, priorizando controle em vez de velocidade.",
    mediaUrl: "https://www.youtube.com/watch?v=rvSNalMjXno",
  },
  {
    name: "Flexão de Quadril no Cabo (Psoas)",
    muscleGroup: "Flexores do Quadril",
    equipment: "Cabo",
    difficultyLevel: "AVANCADO",
    description:
      "Com a caneleira presa ao cabo baixo, conduza o joelho para cima e ligeiramente para dentro em movimento controlado, enfatizando a ativação do psoas.",
    mediaUrl: "https://www.youtube.com/watch?v=rRYmaBwla-g",
  },
];

async function main() {
  console.log(`Reclassificando ${RECATEGORIZE.length} exercício(s)...`);
  for (const { name, fromGroup, toGroup } of RECATEGORIZE) {
    const result = await prisma.exercise.updateMany({
      where: { name, muscleGroup: fromGroup },
      data: { muscleGroup: toGroup },
    });
    if (result.count === 0) {
      console.log(`  Aviso: "${name}" não encontrado com muscleGroup "${fromGroup}" (já migrado ou nome divergente).`);
    } else {
      console.log(`  "${name}": ${fromGroup} -> ${toGroup}`);
    }
  }

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
