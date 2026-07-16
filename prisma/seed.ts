import { Prisma, DifficultyLevel } from "@prisma/client";
import exercisesRaw from "../data/exercises_seed.json";
import foods from "../data/foods_seed.json";
import prisma from "../src/lib/prisma";

// O JSON traz difficultyLevel como string; o Prisma espera o enum
// DifficultyLevel. Coagimos aqui, validando que o valor é um dos aceitos.
const exercises: Prisma.ExerciseCreateInput[] = (exercisesRaw as any[]).map((ex) => {
  if (!(ex.difficultyLevel in DifficultyLevel)) {
    throw new Error(`difficultyLevel inválido para "${ex.name}": ${ex.difficultyLevel}`);
  }
  return { ...ex, difficultyLevel: ex.difficultyLevel as DifficultyLevel };
});

async function main() {
  console.log(`Seeding ${exercises.length} exercises...`);
  for (const ex of exercises) {
    await prisma.exercise.upsert({
      where: { name: ex.name },
      update: ex,
      create: ex,
    });
  }

  console.log(`Seeding ${foods.length} foods...`);
  for (const food of foods) {
    await prisma.food.upsert({
      where: { name: food.name },
      update: food,
      create: food,
    });
  }

  console.log("Seeding complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
