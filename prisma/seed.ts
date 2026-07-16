import exercises from "../data/exercises_seed.json";
import foods from "../data/foods_seed.json";
import prisma from "../src/lib/prisma";

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
