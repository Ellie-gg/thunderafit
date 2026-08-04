// Fecha a mesma lacuna já corrigida pro Pilates (seed-traducoes-pilates.ts):
// seed-cardio-alongamento.ts (Fase 68) criou os 22 exercícios (10 Cardio +
// 12 Alongamento) só em PT, sem nenhuma linha de ExerciseTranslation.
// Mesmo padrão idempotente de seed-traducoes-treino-em-casa.ts.
//
// `Cardio` não muda por locale (termo internacional, mesmo padrão de
// `muscleGroup: "Pilates"`); `Alongamento` vira "Stretching"/"Estiramiento".

import prisma from "../src/lib/prisma";

const GROUP_LABELS: Record<string, { EN: string; ES: string }> = {
  Cardio: { EN: "Cardio", ES: "Cardio" },
  Alongamento: { EN: "Stretching", ES: "Estiramiento" },
};

interface NewTranslation {
  name: string;
  EN: { name: string; description: string };
  ES: { name: string; description: string };
}

const NEW_TRANSLATIONS: NewTranslation[] = [
  // --- Cardio ---
  {
    name: "Assault Bike (Bicicleta de Ar)",
    EN: {
      name: "Assault Bike (Air Bike)",
      description:
        "Sit on the air bike and pedal while pushing and pulling the arm levers at the same time, keeping a pace high enough to significantly raise your heart rate.",
    },
    ES: {
      name: "Assault Bike (Bicicleta de Aire)",
      description:
        "Siéntate en la bicicleta de aire y pedalea empujando y tirando de las palancas con los brazos al mismo tiempo, manteniendo un ritmo lo bastante alto para elevar considerablemente la frecuencia cardíaca.",
    },
  },
  {
    name: "Ergômetro de Braço (Arm Bike)",
    EN: {
      name: "Arm Bike (Ergometer)",
      description:
        "Seated at the machine, turn the cranks with your arms at a steady pace — a great low-impact cardio option for anyone with a lower-body limitation.",
    },
    ES: {
      name: "Ergómetro de Brazo (Arm Bike)",
      description:
        "Sentado en el aparato, gira las manivelas con los brazos a un ritmo constante — una excelente opción de cardio de bajo impacto para quienes tienen alguna limitación en las piernas.",
    },
  },
  {
    name: "Versaclimber (Escalada Vertical)",
    EN: {
      name: "Versaclimber (Vertical Climb)",
      description:
        "Standing on the machine, alternate opposite arms and legs in a continuous vertical climbing motion, keeping your torso upright and the pace high.",
    },
    ES: {
      name: "Versaclimber (Escalada Vertical)",
      description:
        "De pie en el aparato, alterna brazos y piernas opuestos en un movimiento continuo de escalada vertical, manteniendo el tronco erguido y un ritmo alto.",
    },
  },
  {
    name: "Ski Erg (Remo de Esqui)",
    EN: {
      name: "Ski Erg (Ski Row)",
      description:
        "Hold the Ski Erg handles overhead and pull both arms down and back at the same time, bending slightly at the hips, mimicking the cross-country skiing motion.",
    },
    ES: {
      name: "Ski Erg (Remo de Esquí)",
      description:
        "Sujeta las agarraderas del Ski Erg por encima de la cabeza y tira de ambos brazos hacia abajo y hacia atrás al mismo tiempo, flexionando levemente la cadera, imitando el movimiento del esquí de fondo.",
    },
  },
  {
    name: "Balanço com Kettlebell (Kettlebell Swing)",
    EN: {
      name: "Kettlebell Swing",
      description:
        "With feet shoulder-width apart, hinge your hips back holding the kettlebell with both hands and drive it forward with an explosive hip thrust, up to shoulder height.",
    },
    ES: {
      name: "Balanceo con Kettlebell (Kettlebell Swing)",
      description:
        "Con los pies separados al ancho de los hombros, flexiona la cadera hacia atrás sujetando la kettlebell con ambas manos y proyéctala hacia adelante con un movimiento explosivo de cadera, hasta la altura de los hombros.",
    },
  },
  {
    name: "Salto no Caixote (Box Jump)",
    EN: {
      name: "Box Jump",
      description:
        "Squat down slightly and jump with both legs onto the box, landing with bent knees on top, then step down (never jump down) back to the floor.",
    },
    ES: {
      name: "Salto al Cajón (Box Jump)",
      description:
        "Flexiona ligeramente las piernas y salta con ambas piernas hacia el cajón, aterrizando con las rodillas flexionadas encima, y baja caminando (nunca saltando) de vuelta al suelo.",
    },
  },
  {
    name: "Empurrar Trenó (Sled Push)",
    EN: {
      name: "Sled Push",
      description:
        "With arms extended against the sled's handles, lean your torso forward and push with short, powerful strides for the full distance.",
    },
    ES: {
      name: "Empuje de Trineo (Sled Push)",
      description:
        "Con los brazos extendidos apoyados en la barra del trineo, inclina el tronco hacia adelante y empuja con pasos cortos y potentes durante toda la distancia.",
    },
  },
  {
    name: "Agachamento com Salto (Jump Squat)",
    EN: {
      name: "Jump Squat",
      description:
        "Squat down until your thighs are parallel to the floor and explode upward jumping as high as possible, landing back in the squat position to absorb the impact.",
    },
    ES: {
      name: "Sentadilla con Salto (Jump Squat)",
      description:
        "Baja en sentadilla hasta que los muslos queden paralelos al suelo y explota hacia arriba saltando lo más alto posible, aterrizando de nuevo en sentadilla para absorber el impacto.",
    },
  },
  {
    name: "Corrida Estacionária com Joelho Alto (High Knees)",
    EN: {
      name: "High Knees",
      description:
        "Run in place raising your knees to hip height on every stride at a fast pace, keeping your torso upright and your arms pumping.",
    },
    ES: {
      name: "Carrera Estacionaria con Rodillas Altas (High Knees)",
      description:
        "Corre en el lugar elevando las rodillas a la altura de la cadera en cada zancada, a un ritmo rápido, manteniendo el tronco erguido y los brazos en movimiento alternado.",
    },
  },
  {
    name: "Devil Press",
    EN: {
      name: "Devil Press",
      description:
        "From a burpee with your hands on the dumbbells, push your body back up and, once standing, snatch both dumbbells overhead in one continuous motion.",
    },
    ES: {
      name: "Devil Press",
      description:
        "Desde un burpee con las manos en las mancuernas, empuja el cuerpo hacia arriba y, al ponerte de pie, lleva ambas mancuernas por encima de la cabeza en un arranque, en un solo movimiento continuo.",
    },
  },
  {
    name: "Thruster com Halteres",
    EN: {
      name: "Dumbbell Thruster",
      description:
        "Hold a dumbbell at each shoulder, squat all the way down and, as you stand, use the momentum from your legs to press the dumbbells overhead in one smooth, continuous motion.",
    },
    ES: {
      name: "Thruster con Mancuernas",
      description:
        "Sujeta una mancuerna en cada hombro, baja en sentadilla completa y, al subir, usa el impulso de las piernas para empujar las mancuernas por encima de la cabeza en un solo movimiento fluido.",
    },
  },
  // --- Alongamento ---
  {
    name: "Alongamento de Pescoço (Cervical)",
    EN: {
      name: "Neck Stretch (Cervical)",
      description:
        "Sitting or standing, gently tilt your head to one side bringing your ear toward your shoulder without raising the shoulder, and hold before switching sides.",
    },
    ES: {
      name: "Estiramiento de Cuello (Cervical)",
      description:
        "Sentado o de pie, inclina suavemente la cabeza hacia un lado acercando la oreja al hombro sin levantar el hombro, y mantén la posición antes de cambiar de lado.",
    },
  },
  {
    name: "Alongamento de Trapézio Superior",
    EN: {
      name: "Upper Trap Stretch",
      description:
        "With one hand gently pulling your head diagonally (ear toward the opposite armpit), hold the stretch feeling the tension at the base of the neck and upper trap.",
    },
    ES: {
      name: "Estiramiento de Trapecio Superior",
      description:
        "Con una mano tirando levemente de la cabeza en diagonal (oreja hacia la axila opuesta), mantén el estiramiento sintiendo la tensión en la base del cuello y el trapecio superior.",
    },
  },
  {
    name: "Alongamento de Flexores do Antebraço e Punho",
    EN: {
      name: "Forearm & Wrist Flexor Stretch",
      description:
        "With your arm extended in front of you and your palm facing up, use your other hand to gently pull your fingers back toward your body, stretching the forearm flexors.",
    },
    ES: {
      name: "Estiramiento de Flexores del Antebrazo y Muñeca",
      description:
        "Con el brazo extendido al frente y la palma hacia arriba, usa la otra mano para tirar suavemente de los dedos hacia el cuerpo, estirando los flexores del antebrazo.",
    },
  },
  {
    name: "Alongamento de Extensores do Punho e Dedos",
    EN: {
      name: "Wrist & Finger Extensor Stretch",
      description:
        "With your arm extended in front of you and your palm facing down, use your other hand to bend the wrist downward, stretching the forearm and finger extensors.",
    },
    ES: {
      name: "Estiramiento de Extensores de Muñeca y Dedos",
      description:
        "Con el brazo extendido al frente y la palma hacia abajo, usa la otra mano para flexionar la muñeca hacia abajo, estirando los extensores del antebrazo y de los dedos.",
    },
  },
  {
    name: "Rotação Torácica em 2 Apoios (Mobilidade Torácica)",
    EN: {
      name: "Two-Point Thoracic Rotation (Thoracic Mobility)",
      description:
        "On all fours, place one hand behind your head and rotate your torso opening that elbow toward the ceiling, following it with your gaze, then return with control.",
    },
    ES: {
      name: "Rotación Torácica en 2 Apoyos (Movilidad Torácica)",
      description:
        "En cuatro apoyos, lleva una mano detrás de la cabeza y rota el tronco abriendo el codo hacia el techo, acompañando con la mirada, y regresa de forma controlada.",
    },
  },
  {
    name: "Postura da Criança (Child's Pose)",
    EN: {
      name: "Child's Pose",
      description:
        "Kneeling with your hips resting on your heels, lean your torso forward extending your arms on the floor, relaxing your lower back and shoulders in the position.",
    },
    ES: {
      name: "Postura del Niño (Child's Pose)",
      description:
        "De rodillas con la cadera apoyada sobre los talones, inclina el tronco hacia adelante extendiendo los brazos en el suelo, relajando la zona lumbar y los hombros en la posición.",
    },
  },
  {
    name: "Postura da Cobra (Extensão Lombar)",
    EN: {
      name: "Cobra Pose (Lower Back Extension)",
      description:
        "Lying face down with your hands near your ribs, push through the floor to extend your arms and lift your chest, keeping your hips down and stretching your abs.",
    },
    ES: {
      name: "Postura de la Cobra (Extensión Lumbar)",
      description:
        "Acostado boca abajo con las manos cerca de las costillas, empuja el suelo para extender los brazos y elevar el pecho, manteniendo la cadera abajo y estirando el abdomen.",
    },
  },
  {
    name: "Alongamento Lateral de Tronco em Pé (Oblíquos)",
    EN: {
      name: "Standing Lateral Trunk Stretch (Obliques)",
      description:
        "Standing with feet hip-width apart, raise one arm overhead and lean your torso to the opposite side, feeling the stretch along the side of your body.",
    },
    ES: {
      name: "Estiramiento Lateral de Tronco de Pie (Oblicuos)",
      description:
        "De pie con los pies separados al ancho de la cadera, eleva un brazo por encima de la cabeza e inclina el tronco hacia el lado opuesto, sintiendo el estiramiento en el costado del cuerpo.",
    },
  },
  {
    name: "Mobilidade de Tornozelo",
    EN: {
      name: "Ankle Mobility",
      description:
        "Supported against a wall or bench, drive your knee forward without lifting your heel off the floor, gaining ankle dorsiflexion range in a controlled way.",
    },
    ES: {
      name: "Movilidad de Tobillo",
      description:
        "Apoyado en una pared o banco, lleva la rodilla hacia adelante sin levantar el talón del suelo, ganando rango de dorsiflexión del tobillo de forma controlada.",
    },
  },
  {
    name: "Alongamento da Banda Iliotibial (IT Band)",
    EN: {
      name: "IT Band Stretch",
      description:
        "Standing, cross the leg to be stretched behind the other and lean your torso to the opposite side, feeling the stretch along the outside of the thigh/hip.",
    },
    ES: {
      name: "Estiramiento de la Banda Iliotibial (IT Band)",
      description:
        "De pie, cruza la pierna a estirar por detrás de la otra e inclina el tronco hacia el lado opuesto, sintiendo el estiramiento en la parte lateral del muslo/cadera.",
    },
  },
  {
    name: "Alongamento do Grande Dorsal (Lat Stretch)",
    EN: {
      name: "Lat Stretch",
      description:
        "With your arms extended overhead (holding a support if available), lean your torso to one side, stretching the lats and the side of your trunk.",
    },
    ES: {
      name: "Estiramiento de Dorsal Ancho (Lat Stretch)",
      description:
        "Con los brazos extendidos por encima de la cabeza (sujetando un apoyo si está disponible), inclina el tronco hacia un lado, estirando el dorsal ancho y el costado del tronco.",
    },
  },
  {
    name: "Postura do Pombo (Pigeon Pose)",
    EN: {
      name: "Pigeon Pose",
      description:
        "From all fours, bring one knee forward between your hands with the shin crossed on the floor and extend the other leg back, deeply stretching the glute and piriformis.",
    },
    ES: {
      name: "Postura de la Paloma (Pigeon Pose)",
      description:
        "Desde cuatro apoyos, lleva una rodilla al frente entre las manos con la canilla cruzada en el suelo y extiende la otra pierna hacia atrás, estirando profundamente el glúteo y el piriforme.",
    },
  },
];

async function main() {
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
