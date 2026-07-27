// Fase 68: expande os grupos musculares "Cardio" (foco em equipamento de
// academia — bike, esteira, remo, etc.) e "Alongamento" — mesmo padrão de
// seed-antebraco-trapezio-quadril.ts (Fase 51): curadoria via YouTube (busca
// só vídeos curtos e bem avaliados; todo mediaUrl verificado via oEmbed real
// antes de entrar aqui — nenhum link inventado), idempotente por NAME.
// Ambos os grupos já existiam (10 exercícios cada); ficam com 21 (Cardio) e
// 22 (Alongamento) depois deste seed — bem abaixo do teto de 50 pedido.
import { DifficultyLevel } from "@prisma/client";
import prisma from "../src/lib/prisma";

interface NewExercise {
  name: string;
  muscleGroup: "Cardio" | "Alongamento";
  equipment: string;
  difficultyLevel: DifficultyLevel;
  description: string;
  mediaUrl: string;
}

const NEW_EXERCISES: NewExercise[] = [
  // --- Cardio (equipamento de academia) ---
  {
    name: "Assault Bike (Bicicleta de Ar)",
    muscleGroup: "Cardio",
    equipment: "Assault Bike",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Sente-se na bike de ar e pedale empurrando e puxando os braços nas alavancas ao mesmo tempo, mantendo um ritmo alto o suficiente pra elevar bastante a frequência cardíaca.",
    mediaUrl: "https://www.youtube.com/watch?v=H7LglMSGCzo",
  },
  {
    name: "Ergômetro de Braço (Arm Bike)",
    muscleGroup: "Cardio",
    equipment: "Ergômetro de Braço",
    difficultyLevel: "INICIANTE",
    description:
      "Sentado no aparelho, gire as manivelas com os braços num ritmo constante — ótima opção de cardio de baixo impacto pra quem tem alguma limitação nos membros inferiores.",
    mediaUrl: "https://www.youtube.com/watch?v=BLVu198om5g",
  },
  {
    name: "Versaclimber (Escalada Vertical)",
    muscleGroup: "Cardio",
    equipment: "Versaclimber",
    difficultyLevel: "AVANCADO",
    description:
      "Em pé no aparelho, alterne braços e pernas opostos num movimento de escalada vertical contínuo, mantendo o tronco ereto e o ritmo alto.",
    mediaUrl: "https://www.youtube.com/watch?v=u1ghQ4_oWNk",
  },
  {
    name: "Ski Erg (Remo de Esqui)",
    muscleGroup: "Cardio",
    equipment: "Ski Erg",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Segure as pegas do Ski Erg acima da cabeça e puxe ambos os braços pra baixo e pra trás simultaneamente, flexionando levemente o quadril, imitando o movimento do esqui cross-country.",
    mediaUrl: "https://www.youtube.com/watch?v=B0lIgT5PHc8",
  },
  {
    name: "Balanço com Kettlebell (Kettlebell Swing)",
    muscleGroup: "Cardio",
    equipment: "Kettlebell",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Com os pés afastados na largura dos ombros, dobre o quadril pra trás segurando o kettlebell com os dois braços e o projete pra frente com um movimento explosivo de quadril, até a altura dos ombros.",
    mediaUrl: "https://www.youtube.com/watch?v=MB87gQFA_y0",
  },
  {
    name: "Salto no Caixote (Box Jump)",
    muscleGroup: "Cardio",
    equipment: "Caixote Plyo Box",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Agache levemente e salte com as duas pernas em direção ao caixote, aterrissando com os joelhos flexionados por cima da caixa, e desça andando (não pulando) de volta ao chão.",
    mediaUrl: "https://www.youtube.com/watch?v=vyJb5WDTLG8",
  },
  {
    name: "Empurrar Trenó (Sled Push)",
    muscleGroup: "Cardio",
    equipment: "Trenó (Sled)",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Com os braços estendidos apoiados na barra do trenó, incline o tronco à frente e empurre com passadas curtas e potentes por toda a distância determinada.",
    mediaUrl: "https://www.youtube.com/watch?v=0-_mWDmJF5M",
  },
  {
    name: "Agachamento com Salto (Jump Squat)",
    muscleGroup: "Cardio",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Agache até a coxa paralela ao chão e exploda pra cima saltando o mais alto possível, aterrissando de volta na posição de agachamento pra absorver o impacto.",
    mediaUrl: "https://www.youtube.com/watch?v=gnz5OFSO2IU",
  },
  {
    name: "Corrida Estacionária com Joelho Alto (High Knees)",
    muscleGroup: "Cardio",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Corra no lugar elevando os joelhos até a altura do quadril a cada passada, num ritmo rápido, mantendo o tronco ereto e os braços em movimento alternado.",
    mediaUrl: "https://www.youtube.com/watch?v=uWXxhzpMIqg",
  },
  {
    name: "Devil Press",
    muscleGroup: "Cardio",
    equipment: "Halteres",
    difficultyLevel: "AVANCADO",
    description:
      "A partir de um burpee com as mãos nos halteres, empurre o corpo pra cima e, ao ficar de pé, faça um arranco levando os dois halteres acima da cabeça num único movimento contínuo.",
    mediaUrl: "https://www.youtube.com/watch?v=9N4I-DhvnpI",
  },
  {
    name: "Thruster com Halteres",
    muscleGroup: "Cardio",
    equipment: "Halteres",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Segure um halter em cada ombro, agache completamente e, ao subir, use o impulso das pernas pra empurrar os halteres acima da cabeça num movimento único e fluido.",
    mediaUrl: "https://www.youtube.com/watch?v=x2uw767eMFI",
  },
  // --- Alongamento ---
  {
    name: "Alongamento de Pescoço (Cervical)",
    muscleGroup: "Alongamento",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Sentado ou em pé, incline a cabeça suavemente pra um lado aproximando a orelha do ombro, sem levantar o ombro, e segure a posição antes de trocar de lado.",
    mediaUrl: "https://www.youtube.com/watch?v=PODcBMoUfcU",
  },
  {
    name: "Alongamento de Trapézio Superior",
    muscleGroup: "Alongamento",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Com uma mão puxando levemente a cabeça na diagonal (orelha em direção à axila oposta), segure o alongamento sentindo a tensão na base do pescoço e no trapézio superior.",
    mediaUrl: "https://www.youtube.com/watch?v=EZN78jMP6Rw",
  },
  {
    name: "Alongamento de Flexores do Antebraço e Punho",
    muscleGroup: "Alongamento",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Com o braço estendido à frente e a palma da mão voltada pra cima, use a outra mão pra puxar os dedos suavemente em direção ao corpo, alongando os flexores do antebraço.",
    mediaUrl: "https://www.youtube.com/watch?v=35UmC29q2SI",
  },
  {
    name: "Alongamento de Extensores do Punho e Dedos",
    muscleGroup: "Alongamento",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Com o braço estendido à frente e a palma da mão voltada pra baixo, use a outra mão pra flexionar o punho pra baixo, alongando os extensores do antebraço e dos dedos.",
    mediaUrl: "https://www.youtube.com/shorts/y06cng2-CEY",
  },
  {
    name: "Rotação Torácica em 2 Apoios (Mobilidade Torácica)",
    muscleGroup: "Alongamento",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Em quatro apoios, leve uma mão atrás da cabeça e rotacione o tronco abrindo o cotovelo em direção ao teto, acompanhando o olhar, e retorne controladamente.",
    mediaUrl: "https://www.youtube.com/watch?v=TsFx870HBq0",
  },
  {
    name: "Postura da Criança (Child's Pose)",
    muscleGroup: "Alongamento",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Ajoelhado com os quadris sentados sobre os calcanhares, incline o tronco à frente estendendo os braços no chão, relaxando a lombar e os ombros na posição.",
    mediaUrl: "https://www.youtube.com/watch?v=5zRjI5hWitM",
  },
  {
    name: "Postura da Cobra (Extensão Lombar)",
    muscleGroup: "Alongamento",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Deitado de bruços com as mãos apoiadas próximas às costelas, empurre o chão pra estender os braços e elevar o tronco, mantendo o quadril no chão e alongando o abdômen.",
    mediaUrl: "https://www.youtube.com/watch?v=1A8N8k9Qub8",
  },
  {
    name: "Alongamento Lateral de Tronco em Pé (Oblíquos)",
    muscleGroup: "Alongamento",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Em pé com os pés afastados na largura do quadril, eleve um braço acima da cabeça e incline o tronco pro lado oposto, sentindo o alongamento na lateral do corpo.",
    mediaUrl: "https://www.youtube.com/watch?v=gxVzDSs5iME",
  },
  {
    name: "Mobilidade de Tornozelo",
    muscleGroup: "Alongamento",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Apoiado numa parede ou banco, leve o joelho à frente sem levantar o calcanhar do chão, ganhando amplitude de dorsiflexão do tornozelo de forma controlada.",
    mediaUrl: "https://www.youtube.com/watch?v=CREaubVbw0I",
  },
  {
    name: "Alongamento da Banda Iliotibial (IT Band)",
    muscleGroup: "Alongamento",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Em pé, cruze a perna a ser alongada por trás da outra e incline o tronco pro lado oposto, sentindo o alongamento na lateral da coxa/quadril.",
    mediaUrl: "https://www.youtube.com/watch?v=WAv8jUxd5HU",
  },
  {
    name: "Alongamento do Grande Dorsal (Lat Stretch)",
    muscleGroup: "Alongamento",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Com os braços estendidos acima da cabeça (segurando um apoio, se disponível), incline o tronco pro lado, alongando o grande dorsal e a lateral do tronco.",
    mediaUrl: "https://www.youtube.com/watch?v=x3tN9Kw6UmM",
  },
  {
    name: "Postura do Pombo (Pigeon Pose)",
    muscleGroup: "Alongamento",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "A partir de quatro apoios, traga um joelho à frente entre as mãos com a canela cruzada no chão e estenda a outra perna pra trás, alongando profundamente o glúteo e o piriforme.",
    mediaUrl: "https://www.youtube.com/watch?v=1hB5LlY1OpM",
  },
];

async function main() {
  console.log(`Inserindo ${NEW_EXERCISES.length} exercício(s) novo(s) (idempotente por nome)...`);
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
        isFeatured: false,
      },
    });
    created++;
  }
  console.log(`${created} criado(s), ${skipped} já existiam.`);

  const byGroup = await prisma.exercise.groupBy({
    by: ["muscleGroup"],
    _count: true,
    orderBy: { muscleGroup: "asc" },
  });
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
