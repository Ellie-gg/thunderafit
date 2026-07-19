// Fase 34: curadoria pontual do catálogo — dois ajustes de dado feitos uma
// única vez, não fazem parte do `db:seed` automático (mesmo raciocínio do
// `seed-admin.ts`: mudança deliberada, não algo que deve rodar sozinho a
// cada seed). Idempotente: pode rodar de novo sem efeito colateral (os
// updates são absolutos, não incrementais).
//
// 1. Recategoriza "Levantamento Terra Romeno" de Costas pra Pernas — é
//    predominantemente um exercício de posterior de coxa; o próprio catálogo
//    já tem "Levantamento Terra Sumô" em Pernas, inconsistência clara.
// 2. Marca isFeatured=true nos ~5 exercícios mais feitos de cada grupo
//    muscular (pesquisa de popularidade real de academia, não um palpite),
//    pra aparecerem primeiro e ganharem destaque visual na tela de
//    prescrição. Nunca desmarca isFeatured de ninguém — rodar de novo só
//    reforça a mesma lista.
import prisma from "../src/lib/prisma";

const RECATEGORIZE: Array<{ name: string; muscleGroup: string }> = [
  { name: "Levantamento Terra Romeno", muscleGroup: "Pernas" },
];

const FEATURED_EXERCISE_NAMES: string[] = [
  // Peito
  "Supino Reto com Barra",
  "Supino Reto com Halteres",
  "Supino Inclinado com Barra",
  "Crucifixo Reto com Halteres",
  "Flexão de Braço",
  // Costas
  "Levantamento Terra",
  "Puxada Frontal na Polia",
  "Remada Curvada com Barra",
  "Barra Fixa Pronada",
  "Remada Baixa no Cabo",
  // Pernas
  "Agachamento Livre",
  "Leg Press 45",
  "Levantamento Terra Romeno",
  "Cadeira Extensora",
  "Panturrilha em Pé",
  // Ombro
  "Desenvolvimento com Halteres",
  "Elevação Lateral com Halteres",
  "Desenvolvimento Militar em Pé",
  "Elevação Frontal com Halteres",
  "Desenvolvimento com Barra",
  // Bíceps
  "Rosca Direta com Barra",
  "Rosca Direta com Halteres",
  "Rosca Martelo",
  "Rosca Scott com Barra",
  "Rosca Concentrada",
  // Tríceps
  "Tríceps Pulley Barra Reta",
  "Tríceps Testa com Barra",
  "Mergulho nas Paralelas",
  "Tríceps Corda na Polia Alta",
  "Tríceps Francês com Halteres",
  // Abdômen
  "Prancha Isométrica",
  "Abdominal Supra no Solo",
  "Abdominal Bicicleta",
  "Abdominal na Máquina",
  "Rotação Russa (Russian Twist)",
];

async function main() {
  for (const { name, muscleGroup } of RECATEGORIZE) {
    const result = await prisma.exercise.updateMany({ where: { name }, data: { muscleGroup } });
    console.log(
      result.count > 0
        ? `Recategorizado: "${name}" -> ${muscleGroup}`
        : `Aviso: "${name}" não encontrado (recategorização ignorada).`
    );
  }

  const result = await prisma.exercise.updateMany({
    where: { name: { in: FEATURED_EXERCISE_NAMES } },
    data: { isFeatured: true },
  });
  console.log(`${result.count}/${FEATURED_EXERCISE_NAMES.length} exercício(s) marcado(s) como destaque.`);

  if (result.count < FEATURED_EXERCISE_NAMES.length) {
    const found = await prisma.exercise.findMany({
      where: { name: { in: FEATURED_EXERCISE_NAMES } },
      select: { name: true },
    });
    const foundNames = new Set(found.map((f) => f.name));
    const missing = FEATURED_EXERCISE_NAMES.filter((n) => !foundNames.has(n));
    console.log("Aviso: nome(s) não encontrado(s) no catálogo:", missing);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
