// Fase 34: curadoria pontual do catálogo — não faz parte do `db:seed`
// automático (mesmo raciocínio do `seed-admin.ts`: mudança deliberada, não
// algo que deve rodar sozinho a cada seed). Idempotente: pode rodar de novo
// sem efeito colateral (os updates são absolutos, não incrementais).
//
// Marca isFeatured=true nos ~5 exercícios mais feitos de cada grupo
// muscular (pesquisa de popularidade real de academia, não um palpite),
// pra aparecerem primeiro e ganharem destaque visual na tela de
// prescrição. Nunca desmarca isFeatured de ninguém — rodar de novo só
// reforça a mesma lista.
//
// RECATEGORIZE (histórico, Fase 34): recategorizava "Levantamento Terra
// Romeno" de Costas pra Pernas. Superado pela Fase 50, que já semeia esse
// exercício direto como "Posterior da Coxa" (subdivisão de "Pernas" em 5
// grupos) — mantido como array vazio, não como código morto removido, caso
// uma recategorização pontual futura precise do mesmo padrão.
import prisma from "../src/lib/prisma";

const RECATEGORIZE: Array<{ name: string; muscleGroup: string }> = [];

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
  // Quadríceps, Posterior da Coxa, Panturrilhas (ex-"Pernas", subdividido na Fase 50)
  "Agachamento Livre",
  "Leg Press 45",
  "Levantamento Terra Romeno",
  "Cadeira Extensora",
  "Panturrilha em Pé",
  // Glúteos e Adutores e Abdutores (novos na Fase 50 — já marcados isFeatured
  // na criação por seed-treino-em-casa-e-pernas.ts; listados aqui também
  // pra um `db:seed` + este script, sem aquele, ainda produzir o mesmo estado)
  "Hip Thrust com Barra",
  "Elevação Pélvica no Solo",
  "Abdução de Quadril no Cabo em Pé",
  "Exercício Ostra (Clamshell)",
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
