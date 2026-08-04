// Achado reportado pelo fundador (2026-08-04): a curadoria de Pilates
// (seed-pilates.ts) criou os 12 exercícios só em PT, sem nenhuma linha de
// ExerciseTranslation — mesma lacuna que os outros 2 lotes recentes
// (seed-cardio-alongamento.ts, seed-antebraco-trapezio-quadril.ts) também
// deixaram (não corrigidos aqui, fora do pedido específico desta rodada).
// Sem tradução, `exercise-translation.service.ts` cai no fallback pro texto
// PT cru pra usuários em EN/ES — nunca é erro, só sub-tradução silenciosa do
// catálogo. Mesmo padrão idempotente de seed-traducoes-treino-em-casa.ts.
//
// `muscleGroup: "Pilates"` não muda por locale (mesma palavra em EN/ES) —
// sem tabela de mapeamento, ao contrário do padrão usado pra grupos
// musculares como "Peito"/"Costas".

import prisma from "../src/lib/prisma";

interface NewTranslation {
  name: string;
  EN: { name: string; description: string };
  ES: { name: string; description: string };
}

const NEW_TRANSLATIONS: NewTranslation[] = [
  {
    name: "O Cem",
    EN: {
      name: "The Hundred",
      description:
        "Lying on your back, lift your legs to 45° (or bend the knees to 90° for an easier variation) and raise your head/shoulders off the floor. Pump your extended arms at your sides in short pulses, inhaling for 5 pulses and exhaling for 5, until you reach 100 — the classic warm-up for core activation and the Pilates breathing pattern.",
    },
    ES: {
      name: "El Cien",
      description:
        "Acostado boca arriba, eleva las piernas a 45° (o con las rodillas dobladas a 90° para una variante más suave) y levanta la cabeza y los hombros del suelo. Bombea los brazos extendidos junto al cuerpo en pulsos cortos, inhalando en 5 pulsos y exhalando en 5, hasta llegar a 100 — el calentamiento clásico de activación del core y del patrón respiratorio del Pilates.",
    },
  },
  {
    name: "Enrolamento de Coluna (Roll Up)",
    EN: {
      name: "Roll Up",
      description:
        "Lying on your back with arms extended overhead, roll your spine up vertebra by vertebra until you're sitting with a rounded spine over your extended legs, then lower back down in the same controlled sequence — works the deep abdominals and spinal articulation.",
    },
    ES: {
      name: "Enrollamiento de Columna (Roll Up)",
      description:
        "Acostado boca arriba con los brazos extendidos por encima de la cabeza, enrolla la columna hacia arriba vértebra por vértebra hasta quedar sentado con la espalda redondeada sobre las piernas extendidas, y baja en la misma secuencia controlada — trabaja el abdomen profundo y la articulación de la columna.",
    },
  },
  {
    name: "Círculo com Uma Perna",
    EN: {
      name: "Single Leg Circle",
      description:
        "Lying on your back with one leg extended toward the ceiling, draw wide, controlled circles with that leg while keeping your hips and lower back stable on the mat — demands and builds core stability while the leg moves freely.",
    },
    ES: {
      name: "Círculo con Una Pierna",
      description:
        "Acostado boca arriba con una pierna extendida hacia el techo, dibuja círculos amplios y controlados con esa pierna, manteniendo la cadera y la zona lumbar estables sobre el mat — exige y desarrolla la estabilidad del core mientras la pierna se mueve libremente.",
    },
  },
  {
    name: "Rolando Como uma Bola",
    EN: {
      name: "Rolling Like a Ball",
      description:
        "Sitting up, hug your shins to form a compact ball with your body and roll back to your shoulder blades (never onto your neck), returning to the seated position in one smooth, controlled movement — builds balance, abdominal control, and massages the spine.",
    },
    ES: {
      name: "Rodando Como una Bola",
      description:
        "Sentado, abraza las canillas formando una bola compacta con el cuerpo y rueda hacia atrás hasta los omóplatos (nunca hasta el cuello), volviendo a la posición sentada en un movimiento fluido y controlado — trabaja el equilibrio, el control abdominal y masajea la columna.",
    },
  },
  {
    name: "Alongamento de Uma Perna",
    EN: {
      name: "Single Leg Stretch",
      description:
        "Lying with your head and shoulders lifted, pull one knee toward your chest while extending the other leg, alternating sides at a steady pace — a foundational move in the Pilates abdominal series, working the core through alternating movement.",
    },
    ES: {
      name: "Estiramiento de Una Pierna",
      description:
        "Acostado con la cabeza y los hombros elevados, lleva una rodilla hacia el pecho mientras extiendes la otra pierna, alternando los lados a un ritmo constante — ejercicio fundamental de la serie abdominal del Pilates, trabaja el core en movimiento alternado.",
    },
  },
  {
    name: "Alongamento das Duas Pernas",
    EN: {
      name: "Double Leg Stretch",
      description:
        "With knees at your chest and hands on your ankles, extend legs and arms at the same time in opposite directions (legs at 45°, arms overhead) and return to the compact position — requires full core control to keep the lower back stable during the extension.",
    },
    ES: {
      name: "Estiramiento de las Dos Piernas",
      description:
        "Con las rodillas en el pecho y las manos en los tobillos, extiende piernas y brazos al mismo tiempo en direcciones opuestas (piernas a 45°, brazos por encima de la cabeza) y vuelve a la posición compacta — exige control total del core para mantener la zona lumbar estable durante la extensión.",
    },
  },
  {
    name: "Alongamento de Coluna à Frente",
    EN: {
      name: "Spine Stretch Forward",
      description:
        "Sitting with legs extended in front of you, mat-width apart, fold your torso forward, rounding the spine vertebra by vertebra as if reaching over a ball, then return upright — improves spinal flexibility and hamstring length.",
    },
    ES: {
      name: "Estiramiento de Columna Hacia Adelante",
      description:
        "Sentado con las piernas extendidas al frente, separadas al ancho del mat, inclina el tronco hacia adelante redondeando la columna vértebra por vértebra, como si pasaras por encima de una pelota, y vuelve a la posición erguida — mejora la flexibilidad de la columna y de los isquiotibiales.",
    },
  },
  {
    name: "Nadando",
    EN: {
      name: "Swimming",
      description:
        "Lying face down, lift opposite arm and leg off the floor at the same time (right arm with left leg and vice versa) in a continuous alternating movement, as if swimming — strengthens the entire posterior chain and spinal extension.",
    },
    ES: {
      name: "Nadando",
      description:
        "Acostado boca abajo, eleva el brazo y la pierna opuestos del suelo al mismo tiempo (brazo derecho con pierna izquierda y viceversa) en un movimiento alternado y continuo, como si estuvieras nadando — fortalece toda la cadena posterior y la extensión de la columna.",
    },
  },
  {
    name: "Ponte de Ombro",
    EN: {
      name: "Shoulder Bridge",
      description:
        "Lying on your back with knees bent and feet flat on the floor, lift your hips vertebra by vertebra until your body forms a straight line from shoulders to knees, squeezing glutes and abs, then lower back down in the same controlled sequence — strengthens the glutes, hamstrings, and lower back.",
    },
    ES: {
      name: "Puente de Hombro",
      description:
        "Acostado boca arriba con las rodillas dobladas y los pies apoyados en el suelo, eleva la cadera vértebra por vértebra hasta formar una línea recta desde los hombros hasta las rodillas, contrayendo glúteos y abdomen, y baja controladamente en la misma secuencia — fortalece los glúteos, los isquiotibiales y la zona lumbar.",
    },
  },
  {
    name: "Chute Lateral",
    EN: {
      name: "Side Kick",
      description:
        "Lying on your side with your body in one straight line, propped on your forearm (or head resting on your hand), lift the top leg and perform controlled kicks forward and back while keeping the hips stable — works the glute medius and lateral core stability.",
    },
    ES: {
      name: "Patada Lateral",
      description:
        "Acostado de lado, con el cuerpo alineado en una sola línea recta y apoyado en el antebrazo (o la cabeza en la mano), eleva la pierna de arriba y ejecuta patadas controladas hacia adelante y hacia atrás, manteniendo la cadera estable — trabaja el glúteo medio y la estabilidad lateral del core.",
    },
  },
  {
    name: "A Serra",
    EN: {
      name: "The Saw",
      description:
        "Sitting with legs extended and apart, arms open at shoulder height, rotate your torso to one side and reach forward toward the opposite foot as if sawing off your little toe, then return — combines torso rotation with a stretch of the posterior chain.",
    },
    ES: {
      name: "La Sierra",
      description:
        "Sentado con las piernas extendidas y separadas, brazos abiertos a la altura de los hombros, gira el tronco hacia un lado e inclínate hacia adelante en dirección al pie opuesto, como si estuvieras serruchando el dedo pequeño del pie, y vuelve — combina rotación de tronco con estiramiento de la cadena posterior.",
    },
  },
  {
    name: "Tesoura Cruzada (Criss Cross)",
    EN: {
      name: "Criss Cross",
      description:
        "With hands behind your head and knees at your chest, rotate your torso bringing one elbow toward the opposite knee while extending the other leg, alternating sides in a pedaling rhythm — demands abdominal control, torso rotation, and coordination all at once.",
    },
    ES: {
      name: "Tijera Cruzada (Criss Cross)",
      description:
        "Con las manos detrás de la cabeza y las rodillas en el pecho, gira el tronco llevando el codo hacia la rodilla opuesta mientras extiendes la otra pierna, alternando los lados en un ritmo de pedaleo — exige control abdominal, rotación de tronco y coordinación al mismo tiempo.",
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
          muscleGroup: "Pilates",
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
