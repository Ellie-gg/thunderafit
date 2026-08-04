// Fecha a mesma lacuna já corrigida pro Pilates (seed-traducoes-pilates.ts):
// seed-antebraco-trapezio-quadril.ts (Fase 51) criou exercícios novos em
// Antebraço/Trapézio/Flexores do Quadril só em PT, sem nenhuma linha de
// ExerciseTranslation. 3 dos exercícios daquele lote ("Wrist Roller (Rolo de
// Punho)", "Elevação de Joelho em Pé (Marcha Alta)", "Elevação de Joelho
// Sentado no Banco") já foram traduzidos em seed-traducoes-treino-em-casa.ts
// (Fase 53, por reaparecerem em outro programa curado) — não repetidos aqui,
// e o check de idempotência (`existing`) já pularia mesmo se estivessem.
// Mesmo padrão de seed-traducoes-treino-em-casa.ts.
import prisma from "../src/lib/prisma";

const GROUP_LABELS: Record<string, { EN: string; ES: string }> = {
  Antebraço: { EN: "Forearms", ES: "Antebrazo" },
  Trapézio: { EN: "Traps", ES: "Trapecio" },
  "Flexores do Quadril": { EN: "Hip Flexors", ES: "Flexores de Cadera" },
};

interface NewTranslation {
  name: string;
  EN: { name: string; description: string };
  ES: { name: string; description: string };
}

const NEW_TRANSLATIONS: NewTranslation[] = [
  // --- Antebraço ---
  {
    name: "Rosca de Punho com Barra",
    EN: {
      name: "Barbell Wrist Curl",
      description:
        "Sitting on a bench with your forearms resting on your thighs and an underhand grip on the bar, curl your wrists upward squeezing the forearm flexors, and lower with control to full stretch.",
    },
    ES: {
      name: "Curl de Muñeca con Barra",
      description:
        "Sentado en el banco con los antebrazos apoyados en los muslos y agarre supino en la barra, flexiona las muñecas hacia arriba contrayendo los flexores del antebrazo, y baja con control hasta el estiramiento máximo.",
    },
  },
  {
    name: "Rosca de Punho Invertida com Halteres",
    EN: {
      name: "Reverse Dumbbell Wrist Curl",
      description:
        "Sitting with your forearms resting on your thighs and palms facing down, raise the backs of your hands toward the ceiling to work the wrist extensors, controlling the negative phase.",
    },
    ES: {
      name: "Curl de Muñeca Invertido con Mancuernas",
      description:
        "Sentado con los antebrazos apoyados en los muslos y las palmas hacia abajo, eleva el dorso de las manos hacia el techo para trabajar los extensores de la muñeca, controlando la fase negativa.",
    },
  },
  {
    name: "Farmer's Walk com Halteres",
    EN: {
      name: "Farmer's Walk with Dumbbells",
      description:
        "Hold a heavy dumbbell in each hand with a firm, neutral grip, keep your torso upright, and walk a set distance without letting your shoulders round forward.",
    },
    ES: {
      name: "Farmer's Walk con Mancuernas",
      description:
        "Sujeta una mancuerna pesada en cada mano con agarre firme y neutro, mantén el tronco erguido y camina una distancia determinada sin dejar que los hombros se venzan hacia adelante.",
    },
  },
  {
    name: "Pinça de Anilha (Plate Pinch)",
    EN: {
      name: "Plate Pinch",
      description:
        "Hold two smooth weight plates together using only your fingertips and thumb, keeping your arm extended by your side for the set time without letting the plates slip.",
    },
    ES: {
      name: "Pinza de Disco (Plate Pinch)",
      description:
        "Sujeta dos discos lisos juntos usando solo la punta de los dedos y el pulgar, manteniendo el brazo extendido junto al cuerpo durante el tiempo indicado sin dejar que los discos se resbalen.",
    },
  },
  {
    name: "Dead Hang na Toalha",
    EN: {
      name: "Towel Dead Hang",
      description:
        "Hang a sturdy towel over the pull-up bar, grip the ends firmly with both hands, and hold your body suspended for the set time without letting the fabric slip.",
    },
    ES: {
      name: "Dead Hang en Toalla",
      description:
        "Cuelga una toalla resistente sobre la barra fija, sujeta firmemente los extremos con ambas manos y mantén el cuerpo suspendido durante el tiempo indicado sin dejar que la tela se resbale.",
    },
  },
  {
    name: "Rosca Inversa no Cabo com Corda",
    EN: {
      name: "Cable Reverse Curl with Rope",
      description:
        "Standing at the low pulley with an overhand grip on the rope or straight bar, bend your elbows keeping them close to your body and your wrists locked, focusing the contraction on the forearms.",
    },
    ES: {
      name: "Curl Inverso en Polea con Cuerda",
      description:
        "De pie en la polea baja con agarre pronado en la cuerda o barra recta, flexiona los codos manteniéndolos junto al cuerpo y las muñecas fijas, enfocando la contracción en los antebrazos.",
    },
  },
  // --- Trapézio ---
  {
    name: "Encolhimento com Barra Atrás das Costas",
    EN: {
      name: "Behind-the-Back Barbell Shrug",
      description:
        "With your back to the bar resting against your legs, grip it with an overhand grip behind your body and raise your shoulders straight up, pausing at the top before lowering with control.",
    },
    ES: {
      name: "Encogimiento con Barra Detrás de la Espalda",
      description:
        "De espaldas a la barra apoyada en las piernas, sujétala con agarre pronado detrás del cuerpo y eleva los hombros en línea recta hacia arriba, haciendo una pausa arriba antes de bajar con control.",
    },
  },
  {
    name: "Rack Pull (Levantamento Parcial na Gaiola)",
    EN: {
      name: "Rack Pull (Partial Rack Deadlift)",
      description:
        "With the bar resting on the rack pins just below knee height, hinge your hips to grip it with an overhand grip and extend your hips and knees to full lockout, finishing with your traps squeezed.",
    },
    ES: {
      name: "Rack Pull (Levantamiento Parcial en el Rack)",
      description:
        "Con la barra apoyada en los pines del rack un poco por debajo de la rodilla, flexiona la cadera para sujetarla con agarre pronado y extiende cadera y rodillas hasta el bloqueo completo, terminando con los trapecios contraídos.",
    },
  },
  {
    name: "Remada Alta Pegada de Arranco (Snatch Grip High Pull)",
    EN: {
      name: "Snatch Grip High Pull",
      description:
        "With a very wide grip on the bar on the floor, explosively extend your hips and knees and pull the bar up along your body to chest height, raising your elbows and strongly squeezing your traps at the top.",
    },
    ES: {
      name: "Tirón Alto con Agarre de Arranque (Snatch Grip High Pull)",
      description:
        "Con un agarre muy abierto en la barra en el suelo, extiende cadera y rodillas de forma explosiva y tira de la barra a lo largo del cuerpo hasta la altura del pecho, elevando los codos y contrayendo fuertemente los trapecios arriba.",
    },
  },
  // --- Flexores do Quadril ---
  {
    name: "Flexão de Quadril em Pé no Cabo",
    EN: {
      name: "Standing Cable Hip Flexion",
      description:
        "Attach the ankle strap to your ankle, stand sideways to the tower, and drive your knee forward and up against the cable's resistance, keeping your torso stable.",
    },
    ES: {
      name: "Flexión de Cadera de Pie en Polea",
      description:
        "Sujeta la correa de tobillo, ponte de pie de lado a la torre y lleva la rodilla hacia adelante y arriba contra la resistencia del cable, manteniendo el tronco estable.",
    },
  },
  {
    name: "Flexão de Quadril na Máquina",
    EN: {
      name: "Machine Hip Flexion",
      description:
        "Sit on the multi-hip machine with your back supported, raise your thigh forward to horizontal and return with control without swinging your torso.",
    },
    ES: {
      name: "Flexión de Cadera en Máquina",
      description:
        "Siéntate en la máquina multi-hip con el respaldo apoyado, eleva el muslo al frente hasta la horizontal y regresa con control sin balancear el tronco.",
    },
  },
  {
    name: "Marcha Estacionária com Mini Band",
    EN: {
      name: "Standing March with Mini Band",
      description:
        "Place a mini band around your ankles, stand up and march in place raising your knee against the band's resistance, alternating legs.",
    },
    ES: {
      name: "Marcha Estacionaria con Mini Band",
      description:
        "Coloca una mini band en los tobillos, ponte de pie y marcha en el lugar elevando la rodilla contra la resistencia de la banda, alternando las piernas.",
    },
  },
  {
    name: "Elevação de Joelho com Caneleira em Pé",
    EN: {
      name: "Standing Knee Raise with Ankle Weight",
      description:
        "With an ankle weight strapped on, raise your knee forward against the extra load and lower slowly, keeping your hips stable and avoiding compensating with your lower back.",
    },
    ES: {
      name: "Elevación de Rodilla de Pie con Tobillera",
      description:
        "Con una tobillera sujeta al tobillo, eleva la rodilla al frente contra el peso extra y baja despacio, manteniendo la cadera estable y sin compensar con la zona lumbar.",
    },
  },
  {
    name: "L-Sit Tuck (Flexão de Quadril Suspensa em Barras)",
    EN: {
      name: "L-Sit Tuck (Suspended Hip Flexion on Bars)",
      description:
        "Support yourself on parallel bars or low bars with your arms extended and hold your knees bent up against your chest isometrically, sustaining the position for as long as possible.",
    },
    ES: {
      name: "L-Sit Tuck (Flexión de Cadera Suspendida en Barras)",
      description:
        "Apóyate en paralelas o barras bajas con los brazos extendidos y mantén las rodillas flexionadas junto al pecho en isometría, sosteniendo la posición el mayor tiempo posible.",
    },
  },
  {
    name: "Mountain Climber com Faixa Elástica (Flexores do Quadril)",
    EN: {
      name: "Mountain Climber with Resistance Band (Hip Flexors)",
      description:
        "In a plank position with a resistance band around your feet, slowly drive one knee toward your chest against the band's resistance, prioritizing control over speed.",
    },
    ES: {
      name: "Mountain Climber con Banda Elástica (Flexores de Cadera)",
      description:
        "En posición de plancha con una banda elástica en los pies, lleva lentamente una rodilla hacia el pecho contra la resistencia de la banda, priorizando el control sobre la velocidad.",
    },
  },
  {
    name: "Flexão de Quadril no Cabo (Psoas)",
    EN: {
      name: "Cable Hip Flexion (Psoas)",
      description:
        "With the ankle strap attached to the low cable, drive your knee upward and slightly inward in a controlled motion, emphasizing psoas activation.",
    },
    ES: {
      name: "Flexión de Cadera en Polea (Psoas)",
      description:
        "Con la tobillera sujeta al cable bajo, lleva la rodilla hacia arriba y ligeramente hacia adentro en un movimiento controlado, enfatizando la activación del psoas.",
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
