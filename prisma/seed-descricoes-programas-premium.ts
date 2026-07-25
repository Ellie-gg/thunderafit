import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fase 59: backfill da descrição ("Foco") dos 10 templates PREMIUM
// (Fase 57) — o texto é exatamente o campo "Foco" do conteúdo original
// fornecido pelo fundador, com tradução EN/ES. Idempotente (upsert).
interface DescriptionEntry {
  name: string;
  description: string;
  EN: string;
  ES: string;
}

const DESCRIPTIONS: DescriptionEntry[] = [
  {
    name: "Bumbum na Nuca Extreme",
    description: "Hipertrofia máxima do glúteo máximo e médio, com modelagem de coxas e definição de membros superiores.",
    EN: "Maximum hypertrophy of the gluteus maximus and medius, with thigh shaping and upper-body definition.",
    ES: "Hipertrofia máxima del glúteo mayor y medio, con modelado de piernas y definición de miembros superiores.",
  },
  {
    name: "Silhueta Ampulheta",
    description:
      'Construção do formato em "V" na parte superior (costas e ombros) para afinar visualmente a cintura, combinado com volume em glúteos e coxas.',
    EN: "Builds a V-shaped upper body (back and shoulders) to visually slim the waist, combined with glute and thigh volume.",
    ES: "Construcción de una forma en V en la parte superior (espalda y hombros) para afinar visualmente la cintura, combinada con volumen en glúteos y piernas.",
  },
  {
    name: "Pernas Magníficas",
    description:
      "Lapidação estética completa dos membros inferiores, priorizando densidade de quadríceps, profundidade de posteriores e volume de glúteos.",
    EN: "Complete aesthetic sculpting of the lower body, prioritizing quad density, hamstring depth and glute volume.",
    ES: "Lapidación estética completa de los miembros inferiores, priorizando densidad de cuádriceps, profundidad de isquiotibiales y volumen de glúteos.",
  },
  {
    name: "Corpo Esculpido Pro",
    description:
      "Treinamento de alta frequência e volume fracionado para máximo detalhamento muscular, simetria e definição corporal total.",
    EN: "High-frequency, split-volume training for maximum muscle detail, symmetry and total-body definition.",
    ES: "Entrenamiento de alta frecuencia y volumen fraccionado para máximo detalle muscular, simetría y definición corporal total.",
  },
  {
    name: "Definição de Conjunto",
    description:
      "Otimização do tempo na academia garantindo alto estímulo metabólico para queima de gordura e tonificação muscular geral.",
    EN: "Optimizes gym time with high metabolic stimulus for fat burning and overall muscle toning.",
    ES: "Optimización del tiempo en el gimnasio garantizando alto estímulo metabólico para quema de grasa y tonificación muscular general.",
  },
  {
    name: "Hipertrofia Extrema Pro",
    description:
      "Hipertrofia máxima por isolamento e volume fracionado em alta frequência, permitindo esgotar cada grupo muscular com intensidade extrema.",
    EN: "Maximum hypertrophy through isolation and split-volume high-frequency training, exhausting every muscle group with extreme intensity.",
    ES: "Hipertrofia máxima por aislamiento y volumen fraccionado en alta frecuencia, agotando cada grupo muscular con intensidad extrema.",
  },
  {
    name: "Shape Inabalável",
    description:
      "Construção de densidade muscular extrema e proporção torso-membros com dias dedicados a compostos pesados e pares agonistas/antagonistas.",
    EN: "Builds extreme muscle density and torso-to-limb proportion with days dedicated to heavy compounds and agonist/antagonist pairs.",
    ES: "Construcción de densidad muscular extrema y proporción torso-miembros con días dedicados a compuestos pesados y pares agonistas/antagonistas.",
  },
  {
    name: "V-Taper Master",
    description: "Fisiologia estética clássica baseada em cintura fina, dorsais largas, deltoides volumosos e pernas densas.",
    EN: "Classic aesthetic physique built on a narrow waist, wide lats, full delts and dense legs.",
    ES: "Fisiología estética clásica basada en cintura fina, dorsales anchas, deltoides voluminosos y piernas densas.",
  },
  {
    name: "Monster Mass",
    description:
      "Hipertrofia bruta e ganho de volume muscular acelerado focando no isolamento diário de cada grupo muscular principal com sobrecarga progressiva.",
    EN: "Raw hypertrophy and accelerated muscle volume gain, focusing daily isolation of each major muscle group with progressive overload.",
    ES: "Hipertrofia bruta y ganancia de volumen muscular acelerado, enfocando el aislamiento diario de cada grupo muscular principal con sobrecarga progresiva.",
  },
  {
    name: "Força & Volume Titã",
    description:
      "Powerbuilding. Fusão do trabalho de força máxima em exercícios compostos articulados com blocos de alta voltagem metabólica para hipertrofia densa.",
    EN: "Powerbuilding. Fuses maximal-strength compound work with high metabolic-volume blocks for dense hypertrophy.",
    ES: "Powerbuilding. Fusión del trabajo de fuerza máxima en ejercicios compuestos articulados con bloques de alto volumen metabólico para hipertrofia densa.",
  },
];

async function main() {
  let updated = 0;
  for (const item of DESCRIPTIONS) {
    const program = await prisma.workoutProgram.findFirst({
      where: { name: item.name, origin: "SELF", isTemplate: true },
    });
    if (!program) {
      console.log(`Aviso: programa "${item.name}" não encontrado — pulado.`);
      continue;
    }

    await prisma.workoutProgram.update({
      where: { id: program.id },
      data: { description: item.description },
    });

    for (const locale of ["EN", "ES"] as const) {
      const existing = await prisma.workoutProgramTranslation.findUnique({
        where: { workoutProgramId_locale: { workoutProgramId: program.id, locale } },
      });
      await prisma.workoutProgramTranslation.upsert({
        where: { workoutProgramId_locale: { workoutProgramId: program.id, locale } },
        // Sem tradução de nome ainda (não deveria acontecer, mas cai no nome
        // em PT em vez de deixar `name` vazio/obrigatório faltando).
        create: { workoutProgramId: program.id, locale, name: item.name, description: item[locale] },
        update: { description: item[locale], name: existing?.name ?? item.name },
      });
    }
    updated++;
  }
  console.log(`Descrições atualizadas: ${updated}/${DESCRIPTIONS.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
