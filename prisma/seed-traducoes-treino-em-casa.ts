// Fase 53: duas correções de tradução combinadas, achadas ao preparar os 3
// programas curados de "Treino em Casa" (seed-programas-treino-em-casa.ts).
//
// 1. BUG real: exercícios reclassificados nas Fases 50/51 (ex-"Pernas" -> 5
//    subgrupos; alguns de Bíceps/Costas/Ombro -> Antebraço/Trapézio) mantêm
//    a tradução ANTIGA de `muscleGroup` em EN/ES (ex: um exercício agora
//    "Antebraço" no PT ainda aparece como "Biceps" pra quem usa o app em
//    inglês) — a reclassificação atualizou só o campo canônico PT
//    (Exercise.muscleGroup), nunca as linhas de ExerciseTranslation.
// 2. Os 26 exercícios usados nos 3 programas curados que nasceram nas Fases
//    50-52 nunca tiveram tradução (mesmo comportamento de fallback pro PT já
//    documentado — não é erro, só uma lacuna que dá pra fechar agora).
//
// Terminologia de academia natural (não tradução literal), mesmo critério já
// usado na Fase 46 (ex: "Levantamento Terra" -> "Deadlift"/"Peso Muerto").

import prisma from "../src/lib/prisma";

const GROUP_LABELS: Record<string, { EN: string; ES: string }> = {
  Quadríceps: { EN: "Quadriceps", ES: "Cuádriceps" },
  Glúteos: { EN: "Glutes", ES: "Glúteos" },
  "Posterior da Coxa": { EN: "Hamstrings", ES: "Isquiotibiales" },
  Panturrilhas: { EN: "Calves", ES: "Pantorrillas" },
  "Adutores e Abdutores": { EN: "Adductors & Abductors", ES: "Aductores y Abductores" },
  Antebraço: { EN: "Forearms", ES: "Antebrazo" },
  Trapézio: { EN: "Traps", ES: "Trapecio" },
  "Flexores do Quadril": { EN: "Hip Flexors", ES: "Flexores de Cadera" },
  // Grupos já existentes antes da Fase 50/51 — confirmados aqui (não
  // reclassificados, sem bug de tradução desatualizada), só precisam
  // constar no mapa pra NEW_TRANSLATIONS resolver o label certo em vez de
  // cair no fallback (PT cru) por não encontrar a chave.
  Peito: { EN: "Chest", ES: "Pecho" },
  Costas: { EN: "Back", ES: "Espalda" },
  Ombro: { EN: "Shoulders", ES: "Hombros" },
  Bíceps: { EN: "Biceps", ES: "Bíceps" },
  Tríceps: { EN: "Triceps", ES: "Tríceps" },
  Abdômen: { EN: "Abs", ES: "Abdomen" },
};

interface NewTranslation {
  name: string;
  EN: { name: string; description: string };
  ES: { name: string; description: string };
}

const NEW_TRANSLATIONS: NewTranslation[] = [
  {
    name: "Panturrilha Inclinada (Donkey Calf Raise)",
    EN: {
      name: "Donkey Calf Raise",
      description:
        "Bend forward resting your hands on a stable piece of furniture, keep your knees slightly bent, and raise your heels as high as possible, squeezing your calves.",
    },
    ES: {
      name: "Elevación de Talones Inclinado (Donkey Calf Raise)",
      description:
        "Inclina el tronco hacia adelante apoyando las manos en un mueble estable, mantén las rodillas ligeramente flexionadas y eleva los talones al máximo contrayendo la pantorrilla.",
    },
  },
  {
    name: "Wrist Roller (Rolo de Punho)",
    EN: {
      name: "Wrist Roller",
      description:
        "Hold the wrist roller with arms extended in front of you and roll the rope by alternating your wrists to lift the weight, then unroll it while controlling the descent.",
    },
    ES: {
      name: "Rodillo de Muñeca (Wrist Roller)",
      description:
        "Sujeta el rodillo de muñeca con los brazos extendidos al frente y enrolla la cuerda alternando las muñecas hasta levantar el peso, luego desenróllalo controlando el descenso.",
    },
  },
  {
    name: "Supino Reto com Mochila",
    EN: {
      name: "Backpack Bench Press",
      description:
        "Lying on the floor with a backpack loaded with books or bottles held over your chest, push it up extending your arms and lower it in a controlled way until it almost touches your chest.",
    },
    ES: {
      name: "Press de Banca con Mochila",
      description:
        "Acostado en el suelo con una mochila cargada de libros o botellas sobre el pecho, empújala hacia arriba extendiendo los brazos y baja de forma controlada hasta casi tocar el pecho.",
    },
  },
  {
    name: "Remada Unilateral com Mochila",
    EN: {
      name: "Single-Arm Backpack Row",
      description:
        "Rest one knee and one hand on a chair or bench, hold the loaded backpack with your free hand, and pull your elbow back alongside your torso, squeezing your back at the top.",
    },
    ES: {
      name: "Remo Unilateral con Mochila",
      description:
        "Apoya una rodilla y una mano en una silla o banco, sujeta la mochila cargada con la mano libre y lleva el codo hacia atrás junto al tronco, contrayendo la espalda arriba.",
    },
  },
  {
    name: "Superman no Solo",
    EN: {
      name: "Superman on the Floor",
      description:
        "Lying face down with arms and legs extended, simultaneously raise your arms, chest and legs off the floor, squeezing your lower back and back, holding briefly at the top.",
    },
    ES: {
      name: "Superman en el Suelo",
      description:
        "Acostado boca abajo con brazos y piernas extendidos, eleva simultáneamente brazos, pecho y piernas del suelo contrayendo la zona lumbar y la espalda, sosteniendo un instante arriba.",
    },
  },
  {
    name: "Remada Invertida na Mesa",
    EN: {
      name: "Table Inverted Row",
      description:
        "Lie underneath a sturdy, stable table, hold the edge with your hands and pull your chest toward the table keeping your body straight, then lower with control.",
    },
    ES: {
      name: "Remo Invertido en Mesa",
      description:
        "Acuéstate debajo de una mesa firme y resistente, sujeta el borde con las manos y lleva el pecho hacia la mesa manteniendo el cuerpo recto, luego baja con control.",
    },
  },
  {
    name: "Flexão Pike",
    EN: {
      name: "Pike Push-Up",
      description:
        "In a push-up position with your hips raised forming an inverted V, bend your elbows lowering the top of your head toward the floor and push back up, focusing on the shoulders.",
    },
    ES: {
      name: "Flexión Pike",
      description:
        "En posición de flexión con las caderas elevadas formando una V invertida, flexiona los codos llevando la coronilla hacia el suelo y empuja de vuelta, enfocando el hombro.",
    },
  },
  {
    name: "Elevação Lateral com Mochila",
    EN: {
      name: "Backpack Lateral Raise",
      description:
        "Standing, hold a lightly loaded backpack in one hand and raise your arm out to the side up to shoulder height, with a slight elbow bend, controlling the descent.",
    },
    ES: {
      name: "Elevación Lateral con Mochila",
      description:
        "De pie, sujeta una mochila con poco peso en una mano y eleva el brazo lateralmente hasta la altura del hombro, con leve flexión de codo, controlando el descenso.",
    },
  },
  {
    name: "Rosca Direta com Mochila",
    EN: {
      name: "Backpack Bicep Curl",
      description:
        "Hold the straps of a backpack loaded with books, elbows fixed at your sides, curl the weight up to your shoulders and lower with control.",
    },
    ES: {
      name: "Curl de Bíceps con Mochila",
      description:
        "Sujeta las correas de una mochila cargada con libros, codos fijos a los costados, flexiona los brazos llevando el peso hasta los hombros y baja con control.",
    },
  },
  {
    name: "Tríceps Mergulho na Cadeira",
    EN: {
      name: "Chair Tricep Dip",
      description:
        "Place your hands on the edge of a sturdy chair with legs extended in front, lower your hips bending your elbows to 90 degrees and push back up, squeezing your triceps.",
    },
    ES: {
      name: "Fondos de Tríceps en Silla",
      description:
        "Apoya las manos en el borde de una silla firme con las piernas extendidas al frente, baja la cadera flexionando los codos a 90 grados y empuja de vuelta contrayendo el tríceps.",
    },
  },
  {
    name: "Tríceps Francês com Mochila",
    EN: {
      name: "Backpack Overhead Tricep Extension",
      description:
        "Hold the backpack with both hands behind your head, elbows pointed up and close together, extend your arms raising the weight and lower with control without flaring your elbows.",
    },
    ES: {
      name: "Extensión de Tríceps con Mochila",
      description:
        "Sujeta la mochila con ambas manos detrás de la cabeza, codos apuntando hacia arriba y cercanos, extiende los brazos elevando el peso y baja con control sin abrir los codos.",
    },
  },
  {
    name: "Elevação Pélvica no Solo",
    EN: {
      name: "Floor Glute Bridge",
      description:
        "Lie down with your knees bent and feet on the floor, brace your core and raise your hips until your shoulders, hips and knees form a straight line, squeezing your glutes at the top.",
    },
    ES: {
      name: "Puente de Glúteos en el Suelo",
      description:
        "Acuéstate con las rodillas flexionadas y los pies apoyados en el suelo, contrae el abdomen y eleva la cadera hasta formar una línea recta desde los hombros hasta las rodillas, apretando los glúteos arriba.",
    },
  },
  {
    name: "Coice de Glúteo em Quatro Apoios",
    EN: {
      name: "Quadruped Glute Kickback",
      description:
        "On all fours, keep your knee bent at 90 degrees and push your foot toward the ceiling using only your glute contraction, without arching your lower back.",
    },
    ES: {
      name: "Patada de Glúteo en Cuatro Apoyos",
      description:
        "Apóyate en cuatro puntos (manos y rodillas), mantén la rodilla flexionada a 90 grados y empuja el pie hacia el techo usando solo la contracción del glúteo, sin arquear la zona lumbar.",
    },
  },
  {
    name: "Ponte de Glúteo Unilateral Dinâmica",
    EN: {
      name: "Dynamic Single-Leg Glute Bridge",
      description:
        "With one foot planted and the other leg raised and extended, raise and lower your hips at a controlled pace, keeping your core braced to avoid rotating your torso.",
    },
    ES: {
      name: "Puente de Glúteo Unilateral Dinámico",
      description:
        "Con un pie apoyado y la otra pierna elevada y extendida, sube y baja la cadera a un ritmo controlado, manteniendo el core firme para evitar rotar el tronco.",
    },
  },
  {
    name: "Exercício Ostra (Clamshell)",
    EN: {
      name: "Clamshell",
      description:
        "Lie on your side with knees bent and feet together, open your top knee like a clamshell without rotating your hips back, focusing on your glute medius contraction.",
    },
    ES: {
      name: "Ejercicio de la Almeja (Clamshell)",
      description:
        "Acuéstate de lado con las rodillas flexionadas y los pies juntos, abre la rodilla de arriba como una concha sin girar la cadera hacia atrás, enfocando la contracción del glúteo medio.",
    },
  },
  {
    name: "Abdução de Quadril em Pé",
    EN: {
      name: "Standing Hip Abduction",
      description:
        "Standing with support from a wall or chair, raise your leg out to the side keeping your torso upright and foot neutral, without leaning to compensate.",
    },
    ES: {
      name: "Abducción de Cadera de Pie",
      description:
        "De pie y con apoyo en una pared o silla, eleva la pierna lateralmente manteniendo el tronco erguido y el pie neutro, sin inclinar el cuerpo para compensar el movimiento.",
    },
  },
  {
    name: "Agachamento Cossaco",
    EN: {
      name: "Cossack Squat",
      description:
        "With feet wide apart, shift your weight to one side bending that knee while the opposite leg stays extended with the foot planted, stretching the adductor of the extended leg.",
    },
    ES: {
      name: "Sentadilla Cosaca",
      description:
        "Con los pies bien separados, desplaza el peso del cuerpo hacia un lado flexionando esa rodilla mientras la pierna opuesta permanece extendida con el pie apoyado, estirando el aductor.",
    },
  },
  {
    name: "Afundo Cruzado Alternado",
    EN: {
      name: "Alternating Curtsy Lunge",
      description:
        "Step back crossing your leg behind your standing leg, like a curtsy, bending both knees until the back knee almost touches the floor, alternating sides.",
    },
    ES: {
      name: "Zancada Cruzada Alternada (Curtsy)",
      description:
        "Da un paso hacia atrás cruzando la pierna detrás de la pierna de apoyo, como una reverencia, flexionando ambas rodillas hasta casi tocar el suelo con la rodilla trasera, alternando lados.",
    },
  },
  {
    name: "Agachamento Isométrico na Parede",
    EN: {
      name: "Wall Sit",
      description:
        "Rest your back against a wall and slide down until your knees form a 90-degree angle, holding that isometric position for the set time without lifting your back off the wall.",
    },
    ES: {
      name: "Sentadilla Isométrica en la Pared (Wall Sit)",
      description:
        "Apoya la espalda en una pared y desliza hacia abajo hasta que las rodillas formen 90 grados, manteniendo esa posición isométrica el tiempo indicado sin despegar la espalda de la pared.",
    },
  },
  {
    name: "Subida no Banco (Step Up)",
    EN: {
      name: "Step-Up",
      description:
        "Step up onto a stable bench or platform using only the strength of your front leg, without pushing off with the back leg, and step down with control.",
    },
    ES: {
      name: "Subida al Banco (Step Up)",
      description:
        "Sube a un banco o plataforma estable usando solo la fuerza de la pierna delantera, sin impulsarte con la pierna trasera, y baja de forma controlada.",
    },
  },
  {
    name: "Abdominal Bicicleta",
    EN: {
      name: "Bicycle Crunch",
      description:
        "Lying down, alternate bringing your elbow to the opposite knee while pedaling your legs, contracting your obliques in a controlled way.",
    },
    ES: {
      name: "Abdominal Bicicleta",
      description:
        "Acostado, alterna llevar el codo a la rodilla opuesta mientras pedaleas las piernas, contrayendo los oblicuos de forma controlada.",
    },
  },
  {
    name: "Stiff Unilateral com Peso Corporal",
    EN: {
      name: "Single-Leg Bodyweight Stiff-Leg Deadlift",
      description:
        "Standing on one leg, lean your torso forward while extending the other leg back, keeping your spine neutral, until you feel the stretch in your hamstring.",
    },
    ES: {
      name: "Peso Muerto Rumano Unilateral con Peso Corporal",
      description:
        "De pie sobre una pierna, inclina el tronco hacia adelante mientras extiendes la otra pierna hacia atrás, manteniendo la columna neutra, hasta sentir el estiramiento en el isquiotibial.",
    },
  },
  {
    name: "Stiff Unilateral com Apoio para Equilíbrio",
    EN: {
      name: "Assisted Single-Leg Stiff-Leg Deadlift",
      description:
        "Hold lightly onto a chair or wall for balance and perform the single-leg stiff-leg deadlift with control, emphasizing the eccentric phase for greater hamstring activation.",
    },
    ES: {
      name: "Peso Muerto Rumano Unilateral con Apoyo",
      description:
        "Sujétate levemente a una silla o pared para el equilibrio y ejecuta el peso muerto unilateral con control, priorizando la fase excéntrica para mayor activación del isquiotibial.",
    },
  },
  {
    name: "Panturrilha em Pé no Degrau",
    EN: {
      name: "Standing Calf Raise on Step",
      description:
        "Rest the balls of your feet on the edge of a step with your heels hanging off, raise up onto your toes then lower below step level to extend the range of motion.",
    },
    ES: {
      name: "Elevación de Talones de Pie en Escalón",
      description:
        "Apoya la punta de los pies en el borde de un escalón, dejando los talones fuera, y eleva el cuerpo sobre la punta antes de bajar por debajo del nivel del escalón para ampliar el rango.",
    },
  },
  {
    name: "Elevação de Joelho em Pé (Marcha Alta)",
    EN: {
      name: "Standing High Knee March",
      description:
        "Standing tall, raise one knee as high as possible toward your chest with control and return, alternating legs without leaning your torso.",
    },
    ES: {
      name: "Marcha con Elevación de Rodilla de Pie",
      description:
        "De pie con postura erguida, eleva una rodilla lo más alto posible hacia el pecho de forma controlada y regresa, alternando piernas sin inclinar el tronco.",
    },
  },
  {
    name: "Elevação de Joelho Sentado no Banco",
    EN: {
      name: "Seated Knee Raise on Bench",
      description:
        "Sit on the edge of a bench holding the sides for stability and raise your knees toward your chest, focusing on your hip flexor contraction.",
    },
    ES: {
      name: "Elevación de Rodillas Sentado en Banco",
      description:
        "Siéntate en el borde de un banco sujetando los laterales para estabilizarte y eleva las rodillas hacia el pecho, enfocando la contracción de los flexores de cadera.",
    },
  },
];

async function main() {
  // 1. Corrige muscleGroup traduzido desatualizado em TODO exercício que hoje
  // pertence a um dos 8 grupos novos/subdivididos (Fase 50/51), independente
  // de fazer parte dos 3 programas ou não — o bug afeta o catálogo inteiro.
  const newGroupNames = Object.keys(GROUP_LABELS);
  const exercisesInNewGroups = await prisma.exercise.findMany({
    where: { muscleGroup: { in: newGroupNames } },
    include: { translations: true },
  });

  let fixedCount = 0;
  for (const ex of exercisesInNewGroups) {
    const correctLabels = GROUP_LABELS[ex.muscleGroup];
    for (const locale of ["EN", "ES"] as Array<"EN" | "ES">) {
      const translation = ex.translations.find((t) => t.locale === locale);
      if (translation && translation.muscleGroup !== correctLabels[locale]) {
        await prisma.exerciseTranslation.update({
          where: { id: translation.id },
          data: { muscleGroup: correctLabels[locale] },
        });
        fixedCount++;
      }
    }
  }
  console.log(`${fixedCount} tradução(ões) de muscleGroup corrigida(s) (desatualizadas pela Fase 50/51).`);

  // 2. Cria traduções novas (name + muscleGroup + description) pros 26
  // exercícios sem nenhuma linha ainda, usados nos 3 programas curados.
  let createdCount = 0;
  let skippedCount = 0;
  for (const item of NEW_TRANSLATIONS) {
    const exercise = await prisma.exercise.findUnique({ where: { name: item.name } });
    if (!exercise) {
      console.log(`  Aviso: exercício "${item.name}" não encontrado — pulado.`);
      continue;
    }
    const correctLabels = GROUP_LABELS[exercise.muscleGroup];
    for (const locale of ["EN", "ES"] as Array<"EN" | "ES">) {
      const existing = await prisma.exerciseTranslation.findUnique({
        where: { exerciseId_locale: { exerciseId: exercise.id, locale } },
      });
      if (existing) {
        skippedCount++;
        continue;
      }
      const t = item[locale];
      await prisma.exerciseTranslation.create({
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
  console.log(`${createdCount} tradução(ões) nova(s) criada(s), ${skippedCount} já existiam (puladas).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
