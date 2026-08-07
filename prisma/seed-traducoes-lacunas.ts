// Fase 119: fecha a última lacuna de tradução do catálogo, encontrada ao
// AUDITAR O BANCO DE PRODUÇÃO (não o local): 20 exercícios sem nenhuma linha de
// `ExerciseTranslation`, espalhados por 6 grupos musculares. São sobras das
// curadorias anteriores que os seeds de tradução das Fases 53/113/114 não
// cobriram — nenhum lote inteiro faltando, e sim itens avulsos.
//
// O banco local tinha 21 (um a mais que prod: "Abdominal Bicicleta", cuja
// tradução prod já tem). Este script cobre os 21 e é idempotente por
// (exerciseId, locale), então roda sem risco nos dois ambientes e só cria o que
// falta em cada um.
//
// Verificado na mesma auditoria: ZERO exercícios com tradução PARCIAL (só EN ou
// só ES) — a cobertura é sempre por par, então não há meio-caminho a consertar.
//
// Mesmo padrão de `seed-traducoes-treino-em-casa.ts`: terminologia natural de
// academia, não tradução literal.

import prisma from "../src/lib/prisma";

const GROUP_LABELS: Record<string, { EN: string; ES: string }> = {
  Abdômen: { EN: "Abs", ES: "Abdomen" },
  "Adutores e Abdutores": { EN: "Adductors & Abductors", ES: "Aductores y Abductores" },
  Bíceps: { EN: "Biceps", ES: "Bíceps" },
  Costas: { EN: "Back", ES: "Espalda" },
  Glúteos: { EN: "Glutes", ES: "Glúteos" },
  Ombro: { EN: "Shoulders", ES: "Hombros" },
  Peito: { EN: "Chest", ES: "Pecho" },
};

interface NewTranslation {
  name: string;
  EN: { name: string; description: string };
  ES: { name: string; description: string };
}

const NEW_TRANSLATIONS: NewTranslation[] = [
  {
    name: "Abdominal Bicicleta",
    EN: {
      name: "Bicycle Crunch",
      description:
        "Lying on your back, alternate bringing each elbow to the opposite knee while pedaling your legs, contracting the obliques in a controlled way.",
    },
    ES: {
      name: "Abdominal Bicicleta",
      description:
        "Acostado, alterna llevar el codo a la rodilla opuesta mientras pedaleas las piernas, contrayendo los oblicuos de forma controlada.",
    },
  },
  // --- Adutores e Abdutores ---
  {
    name: "Abdutora em Pé na Máquina",
    EN: {
      name: "Standing Machine Hip Abduction",
      description:
        "Standing at the abduction machine with the pad set just above your knee and your spine neutral, push your leg out to the side against the resistance and return slowly without letting your torso sway.",
    },
    ES: {
      name: "Abductora de Pie en Máquina",
      description:
        "De pie en la máquina de abducción con la almohadilla apoyada por encima de la rodilla y la columna neutra, separa la pierna lateralmente contra la resistencia y regresa despacio sin balancear el tronco.",
    },
  },
  {
    name: "Abdução de Quadril no Banco 45°",
    EN: {
      name: "45° Bench Cable Hip Abduction",
      description:
        "Lying on your side on a bench set to 45 degrees with the cable strapped to your ankle, raise the top leg out to the side squeezing the abductor, avoiding letting the hip rotate backward.",
    },
    ES: {
      name: "Abducción de Cadera en Banco a 45°",
      description:
        "Acostado de lado sobre un banco a 45 grados con el cable sujeto al tobillo, eleva la pierna de arriba lateralmente contrayendo el abductor y evitando que la cadera gire hacia atrás.",
    },
  },
  {
    name: "Abdução de Quadril no Cabo em Pé",
    EN: {
      name: "Standing Cable Hip Abduction",
      description:
        "With the cable strapped to your ankle and standing side-on to the pulley tower, lift your leg out to the side keeping your torso upright and knee straight, without tilting your hip to compensate.",
    },
    ES: {
      name: "Abducción de Cadera de Pie en Polea",
      description:
        "Con el cable sujeto al tobillo y de lado a la torre de la polea, separa la pierna lateralmente manteniendo el tronco erguido y la rodilla extendida, sin inclinar la cadera para compensar.",
    },
  },
  {
    name: "Adução de Quadril Deitado",
    EN: {
      name: "Lying Hip Adduction",
      description:
        "Lying on your side with the bottom leg straight and the top leg crossed in front resting on the floor, slowly raise the bottom leg toward the ceiling to work the inner thigh.",
    },
    ES: {
      name: "Aducción de Cadera Acostado",
      description:
        "Acostado de lado con la pierna de abajo extendida y la de arriba cruzada al frente apoyada en el suelo, eleva lentamente la pierna de abajo hacia el techo trabajando el aductor del muslo.",
    },
  },
  {
    name: "Adução de Quadril no Cabo",
    EN: {
      name: "Cable Hip Adduction",
      description:
        "With the cable strapped to your ankle and the working leg crossing in front of the supporting leg, pull the leg inward squeezing the adductor, controlling the return to the starting position.",
    },
    ES: {
      name: "Aducción de Cadera en Polea",
      description:
        "Con el cable sujeto al tobillo y la pierna de trabajo cruzando por delante de la pierna de apoyo, lleva la pierna hacia dentro contrayendo el aductor, controlando el regreso a la posición inicial.",
    },
  },
  {
    name: "Agachamento Sumô no Smith",
    EN: {
      name: "Smith Machine Sumo Squat",
      description:
        "With your feet set wide and toes turned out under the guided bar, lower by bending your knees until your thighs are parallel to the floor, driving through your heels and squeezing the adductors on the way up.",
    },
    ES: {
      name: "Sentadilla Sumo en Máquina Smith",
      description:
        "Con los pies bien separados y las puntas hacia afuera bajo la barra guiada, baja flexionando las rodillas hasta que los muslos queden paralelos al suelo, empujando con los talones y contrayendo los aductores al subir.",
    },
  },
  // --- Bíceps ---
  {
    name: "Rosca Bíceps com Toalha",
    EN: {
      name: "Towel Bicep Curl",
      description:
        "Seated, trap the towel under your foot and pull the ends toward your shoulder, working isometrically against the resistance of your own leg.",
    },
    ES: {
      name: "Curl de Bíceps con Toalla",
      description:
        "Sentado, sujeta la toalla bajo el pie y tira de los extremos hacia el hombro haciendo fuerza isométrica contra la resistencia de tu propia pierna.",
    },
  },
  {
    name: "Rosca Martelo com Mochila",
    EN: {
      name: "Backpack Hammer Curl",
      description:
        "Hold the backpack in a neutral grip (like a hammer), elbows fixed at your sides, curl up to chest height and lower with control without swinging your torso.",
    },
    ES: {
      name: "Curl Martillo con Mochila",
      description:
        "Sujeta la mochila en posición neutra (como un martillo), codos fijos a los costados, flexiona hasta la altura del pecho y baja de forma controlada sin balancear el tronco.",
    },
  },
  {
    name: "Rosca Unilateral com Mochila",
    EN: {
      name: "Single-Arm Backpack Curl",
      description:
        "Hold the backpack with one arm, elbow tucked against your torso, curl up to shoulder height squeezing the bicep and lower slowly before switching sides.",
    },
    ES: {
      name: "Curl Unilateral con Mochila",
      description:
        "Sujeta la mochila con un brazo, codo pegado al tronco, flexiona hasta la altura del hombro contrayendo el bíceps y regresa despacio antes de cambiar de lado.",
    },
  },
  // --- Costas ---
  {
    name: "Remada com Toalha na Porta",
    EN: {
      name: "Towel Door Row",
      description:
        "Loop a towel around a sturdy door handle or frame, lean back with your arms extended and pull your torso toward the door, squeezing your shoulder blades together.",
    },
    ES: {
      name: "Remo con Toalla en la Puerta",
      description:
        "Enrolla una toalla en el pomo o el marco firme de la puerta, inclina el cuerpo hacia atrás con los brazos extendidos y lleva el tronco hacia la puerta contrayendo las escápulas.",
    },
  },
  // --- Glúteos ---
  {
    name: "Elevação Pélvica Unilateral",
    EN: {
      name: "Single-Leg Glute Bridge",
      description:
        "Lying on your back with one foot planted and the other leg extended, raise your hips supporting yourself only on the base leg, squeezing the glute at the top of the movement.",
    },
    ES: {
      name: "Puente de Glúteo Unilateral",
      description:
        "Acostado boca arriba con un pie apoyado en el suelo y la otra pierna extendida, eleva la cadera apoyándote solo en la pierna de base, contrayendo el glúteo en la parte alta del movimiento.",
    },
  },
  {
    name: "Glúteo Cabo Joelho Estendido",
    EN: {
      name: "Straight-Leg Cable Kickback",
      description:
        "With the cable strapped to your ankle and holding the pulley frame for support, extend your hip driving the leg back with the knee straight, squeezing the glute at the end without arching your lower back.",
    },
    ES: {
      name: "Patada de Glúteo en Polea con Pierna Extendida",
      description:
        "Con el cable sujeto al tobillo y apoyado en la estructura de la polea, extiende la cadera llevando la pierna hacia atrás con la rodilla extendida, contrayendo el glúteo al final sin arquear la zona lumbar.",
    },
  },
  {
    name: "Hip Thrust com Barra",
    EN: {
      name: "Barbell Hip Thrust",
      description:
        "With your shoulder blades resting on the bench and a padded barbell across your hips, drive your hips up to full extension, squeezing the glutes hard at the top before lowering with control.",
    },
    ES: {
      name: "Hip Thrust con Barra",
      description:
        "Con los omóplatos apoyados en el banco y la barra acolchada sobre la cadera, empuja la cadera hacia arriba hasta la extensión completa, contrayendo fuerte los glúteos arriba antes de bajar con control.",
    },
  },
  {
    name: "Pull-Through no Cabo",
    EN: {
      name: "Cable Pull-Through",
      description:
        "Facing away from the low pulley with the rope between your legs, hinge at the hips driving them back, then return by pushing through the floor and squeezing your glutes until you're standing tall.",
    },
    ES: {
      name: "Pull-Through en Polea",
      description:
        "De espaldas a la polea baja con la cuerda entre las piernas, flexiona la cadera llevándola hacia atrás y regresa empujando el suelo y contrayendo los glúteos hasta quedar de pie.",
    },
  },
  {
    name: "Step Up Lateral com Halteres",
    EN: {
      name: "Lateral Dumbbell Step-Up",
      description:
        "With a dumbbell in each hand at your sides, step up sideways onto the box driving through the heel of the supporting leg, without letting the knee cave inward.",
    },
    ES: {
      name: "Subida Lateral al Cajón con Mancuernas",
      description:
        "Con una mancuerna en cada mano al costado del cuerpo, sube lateralmente al cajón empujando con el talón de la pierna de apoyo, sin dejar que la rodilla se desvíe hacia dentro.",
    },
  },
  // --- Ombro ---
  {
    name: "Apoio de Mãos na Parede",
    EN: {
      name: "Wall Handstand Hold",
      description:
        "Facing away from the wall, place your hands on the floor and walk your feet up the wall until you're nearly vertical, holding your bodyweight on your shoulders with arms extended.",
    },
    ES: {
      name: "Parada de Manos en la Pared",
      description:
        "De espaldas a la pared, apoya las manos en el suelo y camina con los pies por la pared hasta quedar casi vertical, sosteniendo el peso del cuerpo sobre los hombros con los brazos extendidos.",
    },
  },
  {
    name: "Elevação Frontal com Mochila",
    EN: {
      name: "Backpack Front Raise",
      description:
        "Standing with feet shoulder-width apart, hold the backpack with both hands and raise it in front of you up to shoulder height — no higher — then lower with control.",
    },
    ES: {
      name: "Elevación Frontal con Mochila",
      description:
        "De pie con los pies al ancho de los hombros, sujeta la mochila con ambas manos y elévala al frente hasta la altura de los hombros, sin pasar esa línea, y baja de forma controlada.",
    },
  },
  // --- Peito ---
  {
    name: "Flexão Apoiada na Parede",
    EN: {
      name: "Wall Push-Up",
      description:
        "Place your hands on the wall at shoulder height, step your feet back and bend your elbows bringing your chest toward the wall before pushing back, controlling the movement throughout.",
    },
    ES: {
      name: "Flexión Apoyada en la Pared",
      description:
        "Apoya las manos en la pared a la altura de los hombros, separa los pies y flexiona los codos acercando el pecho a la pared antes de empujar de vuelta, controlando el movimiento.",
    },
  },
  {
    name: "Flexão Arqueiro",
    EN: {
      name: "Archer Push-Up",
      description:
        "With your hands set much wider than your shoulders, lower your body shifting your weight to one side while the opposite arm stays extended, alternating sides each rep.",
    },
    ES: {
      name: "Flexión Arquero",
      description:
        "Con las manos mucho más separadas que los hombros, baja el cuerpo desplazando el peso hacia un lado mientras el brazo opuesto permanece extendido, alternando los lados en cada repetición.",
    },
  },
  {
    name: "Flexão com Palmas",
    EN: {
      name: "Clapping Push-Up",
      description:
        "Lower into a standard push-up and drive up hard enough to leave the floor with your hands, clapping in mid-air before absorbing the landing with your arms.",
    },
    ES: {
      name: "Flexión con Palmada",
      description:
        "Baja en una flexión estándar e impulsa el cuerpo con fuerza suficiente para despegar las manos del suelo, dando una palmada en el aire antes de amortiguar la caída con los brazos.",
    },
  },
];

/**
 * Aplica as traduções num client QUALQUER (por isso recebe o client em vez de
 * usar o singleton). Exportado pra que o mesmo conjunto de traduções possa ser
 * aplicado em produção por um runner separado, sem duplicar as 21 entradas nem
 * passar connection string na linha de comando. Idempotente por
 * (exerciseId, locale).
 */
export async function aplicarTraducoes(client: {
  exercise: typeof prisma.exercise;
  exerciseTranslation: typeof prisma.exerciseTranslation;
}) {
  let createdCount = 0;
  let skippedCount = 0;
  let notFound = 0;
  for (const item of NEW_TRANSLATIONS) {
    const exercise = await client.exercise.findUnique({ where: { name: item.name } });
    if (!exercise) {
      console.log(`  Aviso: exercício "${item.name}" não encontrado — pulado.`);
      notFound++;
      continue;
    }
    const correctLabels = GROUP_LABELS[exercise.muscleGroup];
    for (const locale of ["EN", "ES"] as Array<"EN" | "ES">) {
      const existing = await client.exerciseTranslation.findUnique({
        where: { exerciseId_locale: { exerciseId: exercise.id, locale } },
      });
      if (existing) {
        skippedCount++;
        continue;
      }
      const t = item[locale];
      await client.exerciseTranslation.create({
        data: {
          exerciseId: exercise.id,
          locale,
          name: t.name,
          muscleGroup: correctLabels ? correctLabels[locale] : exercise.muscleGroup,
          description: t.description,
        },
      });
      createdCount++;
    }
  }
  console.log(
    `${createdCount} tradução(ões) criada(s), ${skippedCount} já existiam, ${notFound} exercício(s) não encontrado(s).`
  );
  return { createdCount, skippedCount, notFound };
}

async function main() {
  await aplicarTraducoes(prisma);
  const restantes = await prisma.exercise.count({ where: { translations: { none: {} } } });
  console.log(`Exercícios ainda sem nenhuma tradução: ${restantes}`);
}

// Só executa quando o arquivo é rodado DIRETO (`ts-node prisma/seed-...`).
// Sem este guard, qualquer módulo que importasse `aplicarTraducoes` disparava o
// seed contra o banco do `.env` como efeito colateral do import — inofensivo
// aqui porque é idempotente, mas é o tipo de surpresa que não deve existir num
// script que escreve no banco.
if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
