// Nova leva de curadoria (2026-07-31) — categoria "Pilates" (mesmo padrão de
// seed-cardio-alongamento.ts/seed-antebraco-trapezio-quadril.ts): pedido do
// fundador foi especificamente PILATES SOLO/EM CASA (mat work, sem aparelho
// — reformer/cadillac/wunda chair ficam de fora de propósito), com vídeos
// curtos e de canais bem estabelecidos, mostrando o movimento completo.
// Curadoria manual + verificação real de cada `mediaUrl` via oEmbed do
// YouTube antes de entrar aqui (confirma que o vídeo existe e está
// incorporável, mesmo cuidado já documentado nas levas anteriores).
//
// 2 canais usados, ambos com produção consistente e o formato exato pedido
// ("vídeo curto mostrando o movimento"): Howcast (canal grande e
// estabelecido de tutoriais, série "How to Do X | Pilates Workout") e
// Online Pilates Classes by Lesley Logan (instrutora certificada, série
// "X on the Mat | Online Pilates Classes"). `muscleGroup: "Pilates"` é
// string livre (sem enum no schema) — aparece sozinho como filtro novo na
// UI assim que o primeiro registro existir, sem migration.
//
// Achado ao pesquisar (fora do escopo desta leva, só registrado): um vídeo
// no formato YouTube Shorts (`youtube.com/shorts/<id>`) que o fundador
// tentou cadastrar antes falhava na validação — não é restrição do
// YouTube (o mesmo vídeo funciona normalmente incorporado via
// `watch?v=<id>`), é só a regex de validação deste projeto (frontend
// `lib/youtube.ts` e backend `admin.service.ts#YOUTUBE_URL_REGEX`) que só
// reconhecia `watch?v=`/`youtu.be/`, corrigida separadamente pra também
// aceitar `shorts/<id>`.
import { DifficultyLevel } from "@prisma/client";
import prisma from "../src/lib/prisma";

interface NewExercise {
  name: string;
  equipment: string;
  difficultyLevel: DifficultyLevel;
  description: string;
  mediaUrl: string;
}

const MUSCLE_GROUP = "Pilates";

const NEW_EXERCISES: NewExercise[] = [
  {
    name: "O Cem",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Deitado de costas, eleve as pernas a 45° (ou com joelhos dobrados a 90° pra variação mais leve) e a cabeça/ombros do chão. Bombeie os braços estendidos ao lado do corpo em pulsos curtos, inspirando em 5 pulsos e expirando em 5, até completar 100 — aquecimento clássico de ativação do core e do padrão respiratório do Pilates.",
    mediaUrl: "https://www.youtube.com/watch?v=UaqpuUzs1i8",
  },
  {
    name: "Enrolamento de Coluna (Roll Up)",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Deitado de costas com os braços estendidos atrás da cabeça, role a coluna pra cima vértebra por vértebra até sentar com a coluna arredondada sobre as pernas estendidas, e desça na mesma sequência controlada — trabalha o abdômen profundo e a articulação da coluna.",
    mediaUrl: "https://www.youtube.com/watch?v=FZNwIJ03fhQ",
  },
  {
    name: "Círculo com Uma Perna",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Deitado de costas com uma perna estendida ao teto, desenhe círculos amplos e controlados com essa perna, mantendo o quadril e a lombar estáveis no chão — exige e desenvolve a estabilidade do core enquanto a perna se move livremente.",
    mediaUrl: "https://www.youtube.com/watch?v=pg4WRNkbnjA",
  },
  {
    name: "Rolando Como uma Bola",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Sentado, abrace as canelas formando uma bola compacta com o corpo e role pra trás até as omoplatas (nunca até o pescoço), voltando à posição sentada num movimento fluido e controlado — trabalha equilíbrio, controle abdominal e massageia a coluna.",
    mediaUrl: "https://www.youtube.com/watch?v=EfVURwxctv8",
  },
  {
    name: "Alongamento de Uma Perna",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Deitado com cabeça e ombros elevados, puxe um joelho em direção ao peito enquanto estende a outra perna, alternando os lados num ritmo constante — exercício fundamental da série abdominal do Pilates, trabalha o core em movimento alternado.",
    mediaUrl: "https://www.youtube.com/watch?v=7x-5-QHT1_Q",
  },
  {
    name: "Alongamento das Duas Pernas",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Com joelhos no peito e mãos nos tornozelos, estenda pernas e braços ao mesmo tempo em direções opostas (pernas a 45°, braços atrás da cabeça) e retorne à posição compacta — exige controle total do core pra manter a lombar estável durante a extensão.",
    mediaUrl: "https://www.youtube.com/watch?v=SbAzXngP480",
  },
  {
    name: "Alongamento de Coluna à Frente",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Sentado com as pernas estendidas à frente e afastadas na largura do mat, incline o tronco pra frente arredondando a coluna vértebra por vértebra, como se passasse por cima de uma bola, e retorne à posição ereta — melhora a flexibilidade da coluna e da parte posterior das pernas.",
    mediaUrl: "https://www.youtube.com/watch?v=yso-Y3Ik2BM",
  },
  {
    name: "Nadando",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Deitado de bruços, eleve braços e pernas opostos do chão simultaneamente (braço direito com perna esquerda e vice-versa) num movimento alternado e contínuo, como se estivesse nadando — fortalece toda a cadeia posterior e a extensão da coluna.",
    mediaUrl: "https://www.youtube.com/watch?v=bY6ZyiO_7ek",
  },
  {
    name: "Ponte de Ombro",
    equipment: "Peso Corporal",
    difficultyLevel: "INICIANTE",
    description:
      "Deitado de costas com os joelhos dobrados e pés apoiados no chão, eleve o quadril vértebra por vértebra até formar uma linha reta dos ombros aos joelhos, contraindo glúteos e abdômen, e desça controladamente na mesma sequência — fortalece glúteos, posterior de coxa e a região lombar.",
    mediaUrl: "https://www.youtube.com/watch?v=proSciSIAtU",
  },
  {
    name: "Chute Lateral",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Deitado de lado, com o corpo alinhado numa única linha reta e apoiado no antebraço (ou cabeça na mão), eleve a perna de cima e execute chutes controlados pra frente e pra trás, mantendo o quadril estável — trabalha o glúteo médio e a estabilidade lateral do core.",
    mediaUrl: "https://www.youtube.com/watch?v=ELwtXrhRbgI",
  },
  {
    name: "A Serra",
    equipment: "Peso Corporal",
    difficultyLevel: "INTERMEDIARIO",
    description:
      "Sentado com as pernas estendidas e afastadas, braços abertos na altura dos ombros, gire o tronco pra um lado e incline-se pra frente em direção ao pé oposto, como se estivesse serrando o dedinho do pé, e retorne — combina rotação de tronco com alongamento da cadeia posterior.",
    mediaUrl: "https://www.youtube.com/watch?v=hxvWihO3ocg",
  },
  {
    name: "Tesoura Cruzada (Criss Cross)",
    equipment: "Peso Corporal",
    difficultyLevel: "AVANCADO",
    description:
      "Com as mãos atrás da cabeça e joelhos no peito, gire o tronco levando o cotovelo em direção ao joelho oposto enquanto estende a outra perna, alternando os lados num ritmo de pedalada — exige controle abdominal, rotação de tronco e coordenação ao mesmo tempo.",
    mediaUrl: "https://www.youtube.com/watch?v=UDXfEmHyxJw",
  },
];

async function main() {
  console.log(`Inserindo ${NEW_EXERCISES.length} exercício(s) de "${MUSCLE_GROUP}" (idempotente por nome)...`);
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
        muscleGroup: MUSCLE_GROUP,
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
