import exercises from "../data/exercises_seed.json";
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
