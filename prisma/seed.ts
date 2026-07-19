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
  // Fase 34: create-only, nunca upsert. Antes disso, rodar `npm run db:seed`
  // de novo sobrescrevia SILENCIOSAMENTE qualquer edição manual feita pela
  // tela de admin (Fase 33, ex: mídia customizada via upload da Fase 32) com
  // o valor "original" do JSON — bug real de perda de dado, encontrado ao
  // planejar a curadoria da Fase 34. Itens novos no JSON continuam sendo
  // criados normalmente; itens já existentes (por nome) são ignorados.
  console.log(`Seeding ${exercises.length} exercises (create-only)...`);
  let exercisesCreated = 0;
  for (const ex of exercises) {
    const existing = await prisma.exercise.findUnique({ where: { name: ex.name } });
    if (existing) continue;
    await prisma.exercise.create({ data: ex });
    exercisesCreated++;
  }
  console.log(`${exercisesCreated} new exercise(s) created, ${exercises.length - exercisesCreated} already existed (skipped).`);

  console.log(`Seeding ${foods.length} foods (create-only)...`);
  let foodsCreated = 0;
  for (const food of foods) {
    const existing = await prisma.food.findUnique({ where: { name: food.name } });
    if (existing) continue;
    await prisma.food.create({ data: food });
    foodsCreated++;
  }
  console.log(`${foodsCreated} new food(s) created, ${foods.length - foodsCreated} already existed (skipped).`);

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
