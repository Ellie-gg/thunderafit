// Fase 53: 3 programas curados de "Treino em Casa" (category: HOME),
// pedidos pelo fundador com sessões/exercícios/séries/reps exatos — mesmo
// padrão idempotente dos scripts anteriores (casamento por NAME, não por id;
// não faz parte do db:seed automático). Cada categoria vira um WorkoutProgram
// (origin: SELF, isTemplate: true, sessionScheme: LETTER) com 3 sessões
// (A/B/C), cada sessão com os exercícios do catálogo já existente (nenhum
// exercício novo — todos os 42 nomes usados aqui já foram verificados contra
// o catálogo real antes de escrever este arquivo).
//
// restSeconds não foi especificado pelo fundador (só séries x reps/segundos)
// — escolhido por categoria, mesmo espírito dos presets de objetivo já
// usados no gerador determinístico (workout-generator.service.ts):
// Categoria 1 (hipertrofia/força): 60s (45s nos isolamentos leves).
// Categoria 2 (metabólico/cardio): 30s (ritmo de circuito).
// Categoria 3 (isolamento/glúteos): 45s.
// "3 a 4 séries"/"30 a 45 segundos" etc. (faixas com dois números pro mesmo
// campo): o campo `sets` é um Int único — usa o menor número da faixa de
// séries (mais conservador) e guarda a faixa completa de reps/tempo em
// `repsRange` (texto livre, sem formato exigido). Qualificadores como "por
// perna"/"por lado" vão em `notes` (mesmo uso já dado a esse campo em todo o
// resto do catálogo — observação de execução, não dado estruturado).
import prisma from "../src/lib/prisma";

interface ExerciseLine {
  name: string;
  sets: number;
  repsRange: string;
  restSeconds: number;
  notes?: string;
}

interface SessionSpec {
  letter: string;
  name: string;
  exercises: ExerciseLine[];
}

interface ProgramSpec {
  name: string;
  sessions: SessionSpec[];
}

const PROGRAMS: ProgramSpec[] = [
  {
    name: "Hipertrofia & Força em Casa",
    sessions: [
      {
        letter: "A",
        name: "Peito, Ombro e Tríceps",
        exercises: [
          { name: "Flexão de Braço", sets: 3, repsRange: "8-12", restSeconds: 60 },
          { name: "Supino Reto com Mochila", sets: 3, repsRange: "10-15", restSeconds: 60 },
          { name: "Flexão Pike", sets: 3, repsRange: "8-12", restSeconds: 60, notes: "Foco em ombros" },
          { name: "Elevação Lateral com Mochila", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Tríceps Mergulho na Cadeira", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Tríceps Francês com Mochila", sets: 3, repsRange: "12-15", restSeconds: 45 },
        ],
      },
      {
        letter: "B",
        name: "Membros Inferiores",
        exercises: [
          { name: "Agachamento com Peso Corporal", sets: 4, repsRange: "12-15", restSeconds: 60 },
          { name: "Subida no Banco (Step Up)", sets: 3, repsRange: "10-12", restSeconds: 60, notes: "Por perna" },
          {
            name: "Stiff Unilateral com Peso Corporal",
            sets: 3,
            repsRange: "10-12",
            restSeconds: 60,
            notes: "Por perna",
          },
          { name: "Agachamento Isométrico na Parede", sets: 3, repsRange: "30-45s", restSeconds: 45 },
          { name: "Panturrilha em Pé no Degrau", sets: 4, repsRange: "15-20", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Costas, Bíceps, Antebraço e Core",
        exercises: [
          { name: "Remada Invertida na Mesa", sets: 3, repsRange: "8-12", restSeconds: 60 },
          { name: "Remada Unilateral com Mochila", sets: 3, repsRange: "10-12", restSeconds: 60, notes: "Por lado" },
          { name: "Superman no Solo", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Rosca Direta com Mochila", sets: 3, repsRange: "10-12", restSeconds: 60 },
          { name: "Wrist Roller (Rolo de Punho)", sets: 3, repsRange: "Até a fadiga", restSeconds: 60 },
          { name: "Abdominal Remador", sets: 3, repsRange: "12-15", restSeconds: 45 },
        ],
      },
    ],
  },
  {
    name: "Seca Barriga em Casa",
    sessions: [
      {
        letter: "A",
        name: "Full Body Burn & Cardio",
        exercises: [
          { name: "Polichinelo (Jumping Jacks)", sets: 3, repsRange: "45s", restSeconds: 30 },
          { name: "Burpees", sets: 3, repsRange: "10-12", restSeconds: 30 },
          { name: "Mountain Climbers", sets: 3, repsRange: "40s", restSeconds: 30 },
          { name: "Agachamento com Peso Corporal", sets: 3, repsRange: "15-20", restSeconds: 30 },
          { name: "Abdominal Bicicleta", sets: 3, repsRange: "15-20", restSeconds: 30, notes: "Por lado" },
        ],
      },
      {
        letter: "B",
        name: "Core Extremo e Definição",
        exercises: [
          { name: "Abdominal Remador", sets: 3, repsRange: "15", restSeconds: 30 },
          { name: "Prancha com Toque no Ombro", sets: 3, repsRange: "40s", restSeconds: 30 },
          { name: "Abdominal Infra no Solo", sets: 3, repsRange: "12-15", restSeconds: 30 },
          { name: "Rotação Russa (Russian Twist)", sets: 3, repsRange: "20 total", restSeconds: 30 },
          { name: "Prancha Isométrica", sets: 3, repsRange: "45-60s", restSeconds: 30 },
        ],
      },
      {
        letter: "C",
        name: "Agilidade e Resistência",
        exercises: [
          { name: "Polichinelo (Jumping Jacks)", sets: 3, repsRange: "45s", restSeconds: 30 },
          { name: "Elevação de Joelho em Pé (Marcha Alta)", sets: 3, repsRange: "45s", restSeconds: 30 },
          { name: "Flexão de Braço Inclinada", sets: 3, repsRange: "12-15", restSeconds: 30 },
          { name: "Mountain Climbers", sets: 3, repsRange: "45s", restSeconds: 30 },
          { name: "Abdominal Canivete", sets: 3, repsRange: "10-12", restSeconds: 30 },
        ],
      },
    ],
  },
  {
    name: "Bumbum na Lua, Pernas & Core em Casa",
    sessions: [
      {
        letter: "A",
        name: "Glúteos e Isquiotibiais",
        exercises: [
          { name: "Elevação Pélvica no Solo", sets: 4, repsRange: "15-20", restSeconds: 45 },
          {
            name: "Ponte de Glúteo Unilateral Dinâmica",
            sets: 3,
            repsRange: "10-12",
            restSeconds: 45,
            notes: "Por perna",
          },
          {
            name: "Coice de Glúteo em Quatro Apoios",
            sets: 3,
            repsRange: "15",
            restSeconds: 45,
            notes: "Por perna",
          },
          {
            name: "Stiff Unilateral com Apoio para Equilíbrio",
            sets: 3,
            repsRange: "12",
            restSeconds: 45,
            notes: "Por perna",
          },
        ],
      },
      {
        letter: "B",
        name: "Coxas, Adutores e Abdutores",
        exercises: [
          { name: "Agachamento Cossaco", sets: 3, repsRange: "10", restSeconds: 45, notes: "Por lado" },
          { name: "Exercício Ostra (Clamshell)", sets: 3, repsRange: "15-20", restSeconds: 45, notes: "Por lado" },
          { name: "Afundo Cruzado Alternado", sets: 3, repsRange: "12", restSeconds: 45, notes: "Por perna" },
          { name: "Abdução de Quadril em Pé", sets: 3, repsRange: "15", restSeconds: 45, notes: "Por perna" },
          { name: "Panturrilha Inclinada (Donkey Calf Raise)", sets: 3, repsRange: "15-20", restSeconds: 45 },
        ],
      },
      {
        letter: "C",
        name: "Core, Quadril e Estabilidade Postural",
        exercises: [
          { name: "Dead Bug (Inseto Morto)", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Prancha Lateral", sets: 3, repsRange: "30s", restSeconds: 45, notes: "De cada lado" },
          { name: "Hiperextensão Lombar", sets: 3, repsRange: "12-15", restSeconds: 45 },
          { name: "Elevação de Joelho Sentado no Banco", sets: 3, repsRange: "15", restSeconds: 45 },
          { name: "Abdominal Oblíquo no Solo", sets: 3, repsRange: "15", restSeconds: 45, notes: "Por lado" },
        ],
      },
    ],
  },
];

async function main() {
  for (const programSpec of PROGRAMS) {
    const existing = await prisma.workoutProgram.findFirst({
      where: { name: programSpec.name, origin: "SELF", isTemplate: true },
    });
    if (existing) {
      console.log(`Já existe, pulando: "${programSpec.name}"`);
      continue;
    }

    const program = await prisma.workoutProgram.create({
      data: {
        name: programSpec.name,
        origin: "SELF",
        personalId: null,
        isTemplate: true,
        sessionScheme: "LETTER",
        category: "HOME",
      },
    });
    console.log(`Criado programa "${program.name}" (${program.id})`);

    for (const sessionSpec of programSpec.sessions) {
      const workout = await prisma.workout.create({
        data: {
          programId: program.id,
          personalId: null,
          alunoId: null,
          name: sessionSpec.name,
          letter: sessionSpec.letter,
        },
      });
      console.log(`  Sessão ${sessionSpec.letter} — "${sessionSpec.name}" (${workout.id})`);

      let order = 1;
      for (const ex of sessionSpec.exercises) {
        const exercise = await prisma.exercise.findUnique({ where: { name: ex.name } });
        if (!exercise) {
          console.log(`    Aviso: exercício "${ex.name}" não encontrado no catálogo — pulado.`);
          continue;
        }
        await prisma.workoutExercise.create({
          data: {
            workoutId: workout.id,
            exerciseId: exercise.id,
            sets: ex.sets,
            repsRange: ex.repsRange,
            restSeconds: ex.restSeconds,
            order: order++,
            notes: ex.notes ?? null,
          },
        });
      }
      console.log(`    ${order - 1} exercício(s) adicionado(s).`);
    }
  }

  const homePrograms = await prisma.workoutProgram.count({
    where: { origin: "SELF", isTemplate: true, category: "HOME" },
  });
  console.log(`\nTotal de templates HOME após o seed: ${homePrograms}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
